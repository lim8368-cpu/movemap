const { sendJson, hasSupabaseConfig, supabaseRequest } = require("./_shared");

function readJsonBody(req) {
  if (req.body && typeof req.body === "object") {
    return Promise.resolve(req.body);
  }

  if (typeof req.body === "string") {
    return Promise.resolve(JSON.parse(req.body || "{}"));
  }

  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1_500_000) {
        reject(new Error("Request body too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(raw || "{}"));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function requiredString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }

  try {
    const body = await readJsonBody(req);
    const requiredFields = [
      "centerName",
      "ownerName",
      "phone",
      "email",
      "area",
      "address",
      "licenseHolderName",
      "licenseNumber",
      "licenseImagePath",
    ];

    const missing = requiredFields.filter((field) => !requiredString(body[field]));
    if (missing.length > 0 || body.consent !== true) {
      sendJson(res, 400, {
        error: "필수 정보를 모두 입력하고 개인정보 확인 동의에 체크해 주세요.",
      });
      return;
    }

    const email = String(body.email || "").trim().toLowerCase().slice(0, 254);
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      sendJson(res, 400, { error: "센터장 계정에 사용할 올바른 이메일을 입력해 주세요." });
      return;
    }

    if (!hasSupabaseConfig()) {
      sendJson(res, 503, { error: "테스트 DB가 아직 연결되지 않았습니다." });
      return;
    }

    const rows = await supabaseRequest("center_applications", {
      method: "POST",
      body: {
        center_name: body.centerName.trim(),
        owner_name: body.ownerName.trim(),
        phone: body.phone.trim(),
        email,
        area: body.area.trim(),
        address: body.address.trim(),
        naver_map_url: body.naverMapUrl || null,
        lat: body.lat ? Number(body.lat) : null,
        lng: body.lng ? Number(body.lng) : null,
        website: body.website || null,
        photo_url: body.photoUrl || null,
        photo_path: body.photoPath || null,
        photo_paths: Array.isArray(body.photoPaths) ? body.photoPaths.slice(0, 5) : [],
        license_holder_name: body.licenseHolderName.trim(),
        license_number: body.licenseNumber.trim(),
        license_image_path: body.licenseImagePath,
        services: body.services || null,
        memo: body.memo || null,
        consent: true,
        status: "pending",
      },
    });

    sendJson(res, 202, {
      ok: true,
      applicationId: rows[0].id,
      status: "received",
      message: "등록 신청이 접수되었습니다. 운영자 확인 후 연락드릴게요.",
    });
  } catch (error) {
    sendJson(res, 400, { error: "등록 신청 데이터를 확인해 주세요." });
  }
};
