const crypto = require("crypto");
const {
  hasSupabaseConfig,
  sendJson,
  storageBucket,
  supabaseStorageRequest,
} = require("./_shared");

const MAX_FILE_BYTES = 3 * 1024 * 1024;
const ALLOWED_TYPES = {
  "image/jpeg": { extension: "jpg", signatures: [Buffer.from([0xff, 0xd8, 0xff])] },
  "image/png": { extension: "png", signatures: [Buffer.from([0x89, 0x50, 0x4e, 0x47])] },
  "image/webp": { extension: "webp", signatures: [Buffer.from("RIFF")] },
};

function readRawBody(req) {
  if (Buffer.isBuffer(req.body)) return Promise.resolve(req.body);
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_FILE_BYTES) {
        reject(new Error("too_large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function matchesFileSignature(type, body) {
  if (type === "image/webp") {
    return body.subarray(0, 4).equals(Buffer.from("RIFF")) && body.subarray(8, 12).equals(Buffer.from("WEBP"));
  }
  return ALLOWED_TYPES[type].signatures.some((signature) => body.subarray(0, signature.length).equals(signature));
}

async function handler(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });
  if (!hasSupabaseConfig()) return sendJson(res, 503, { error: "비공개 파일 저장소가 연결되지 않았습니다." });

  const type = String(req.headers["content-type"] || "").split(";")[0].trim().toLowerCase();
  const fileType = ALLOWED_TYPES[type];
  const kind = req.query?.kind;
  if (!fileType || !["center-photo", "license"].includes(kind)) {
    return sendJson(res, 400, { error: "JPG, PNG, WEBP 이미지만 올릴 수 있습니다." });
  }

  try {
    const body = await readRawBody(req);
    if (!body.length || body.length > MAX_FILE_BYTES || !matchesFileSignature(type, body)) {
      return sendJson(res, 400, { error: "이미지 파일 형식이나 크기를 확인해 주세요." });
    }
    const objectPath = `${kind}/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${fileType.extension}`;
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
    sendJson(res, 201, { ok: true, path: objectPath });
  } catch (error) {
    if (error.message === "too_large") return sendJson(res, 413, { error: "이미지는 3MB 이하로 올려주세요." });
    console.error("private upload failed", error);
    sendJson(res, 500, { error: "비공개 파일 업로드에 실패했습니다." });
  }
}

module.exports = handler;
module.exports.config = { api: { bodyParser: false } };
