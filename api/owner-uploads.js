const crypto = require("crypto");
const {
  createSignedStorageUrl,
  enforceRateLimit,
  recordAuditLog,
  recordErrorLog,
  sendJson,
  storageBucket,
  supabaseRequest,
  supabaseStorageRequest,
} = require("./_shared");
const { requireOwnerAccess } = require("./_platform-auth");

const MAX_FILE_BYTES = 3 * 1024 * 1024;
const ALLOWED_TYPES = {
  "image/jpeg": { extension: "jpg", signature: Buffer.from([0xff, 0xd8, 0xff]) },
  "image/png": { extension: "png", signature: Buffer.from([0x89, 0x50, 0x4e, 0x47]) },
  "image/webp": { extension: "webp", signature: Buffer.from("RIFF") },
};

async function readRawBody(req) {
  if (Buffer.isBuffer(req.body)) return req.body;
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_FILE_BYTES) {
        reject(Object.assign(new Error("too_large"), { statusCode: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function matchesSignature(type, body) {
  if (type === "image/webp") {
    return body.subarray(0, 4).equals(Buffer.from("RIFF")) &&
      body.subarray(8, 12).equals(Buffer.from("WEBP"));
  }
  return body.subarray(0, ALLOWED_TYPES[type].signature.length).equals(ALLOWED_TYPES[type].signature);
}

async function centerPhotos(centerId) {
  const rows = await supabaseRequest("centers", {
    query: `?select=id,photo_path,photo_paths&id=eq.${encodeURIComponent(centerId)}&limit=1`,
  });
  const center = rows[0];
  if (!center) return null;
  const paths = center.photo_paths?.length ? center.photo_paths : [center.photo_path].filter(Boolean);
  const urls = await Promise.all(paths.map((path) => createSignedStorageUrl(path, 3600)));
  return { paths, items: paths.map((path, index) => ({ path, url: urls[index] || "" })) };
}

module.exports = async function handler(req, res) {
  try {
    const centerId = String(req.query?.centerId || "");
    const access = await requireOwnerAccess(req, res, { centerId, action: "edit_center" });
    if (!access) return;
    if (!enforceRateLimit(req, res, {
      bucket: "owner-photo",
      max: 30,
      windowMs: 60 * 60 * 1000,
      identity: access.userId || access.centerId,
    })) return;

    const current = await centerPhotos(access.centerId);
    if (!current) return sendJson(res, 404, { error: "센터를 찾을 수 없습니다." });

    if (req.method === "DELETE") {
      const objectPath = String(req.query?.path || "");
      const expectedPrefix = `centers/${access.centerId}/photos/`;
      if (!objectPath.startsWith(expectedPrefix) || !current.paths.includes(objectPath)) {
        return sendJson(res, 400, { error: "삭제할 센터 사진을 확인해 주세요." });
      }
      const nextPaths = current.paths.filter((path) => path !== objectPath);
      await supabaseRequest("centers", {
        method: "PATCH",
        query: `?id=eq.${encodeURIComponent(access.centerId)}`,
        body: {
          photo_path: nextPaths[0] || null,
          photo_paths: nextPaths,
          updated_at: new Date().toISOString(),
        },
      });
      await supabaseStorageRequest(
        `/object/${encodeURIComponent(storageBucket())}/${objectPath.split("/").map(encodeURIComponent).join("/")}`,
        { method: "DELETE" }
      ).catch(() => {});
      await recordAuditLog(req, {
        actorUserId: access.userId,
        actorRole: access.role,
        centerId: access.centerId,
        action: "center.photo.delete",
        targetType: "storage_object",
        targetId: objectPath,
      });
      const photos = await centerPhotos(access.centerId);
      return sendJson(res, 200, { ok: true, photoItems: photos.items });
    }

    if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });
    if (current.paths.length >= 5) return sendJson(res, 409, { error: "센터 사진은 최대 5장까지 등록할 수 있습니다." });
    const type = String(req.headers["content-type"] || "").split(";")[0].trim().toLowerCase();
    const fileType = ALLOWED_TYPES[type];
    if (!fileType) return sendJson(res, 400, { error: "JPG, PNG, WEBP 이미지만 올릴 수 있습니다." });
    const body = await readRawBody(req);
    if (!body.length || body.length > MAX_FILE_BYTES || !matchesSignature(type, body)) {
      return sendJson(res, 400, { error: "이미지 파일 형식이나 크기를 확인해 주세요." });
    }
    const objectPath = `centers/${access.centerId}/photos/${crypto.randomUUID()}.${fileType.extension}`;
    await supabaseStorageRequest(
      `/object/${encodeURIComponent(storageBucket())}/${objectPath.split("/").map(encodeURIComponent).join("/")}`,
      {
        body,
        headers: {
          "Content-Type": type,
          "Content-Length": String(body.length),
          "x-upsert": "false",
          "Cache-Control": "max-age=3600",
        },
      }
    );
    const nextPaths = [...current.paths, objectPath];
    await supabaseRequest("centers", {
      method: "PATCH",
      query: `?id=eq.${encodeURIComponent(access.centerId)}`,
      body: {
        photo_path: nextPaths[0],
        photo_paths: nextPaths,
        updated_at: new Date().toISOString(),
      },
    });
    await recordAuditLog(req, {
      actorUserId: access.userId,
      actorRole: access.role,
      centerId: access.centerId,
      action: "center.photo.upload",
      targetType: "storage_object",
      targetId: objectPath,
      metadata: { size: body.length, contentType: type },
    });
    const photos = await centerPhotos(access.centerId);
    return sendJson(res, 201, { ok: true, photoItems: photos.items });
  } catch (error) {
    console.error("owner photo api failed", error);
    await recordErrorLog(req, error, { errorCode: "owner_photo_api_failed", statusCode: error.statusCode || 500 });
    return sendJson(res, error.statusCode || 500, {
      error: error.message === "too_large" ? "이미지는 3MB 이하로 올려주세요." : "센터 사진을 처리하지 못했습니다.",
    });
  }
};

module.exports.config = { api: { bodyParser: false } };
