const { sendJson, hasSupabaseConfig, supabaseRequest } = require("./_shared");
const { hashOwnerPassword } = require("./_owner-auth");

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
      "password",
    ];

    const missing = requiredFields.filter((field) => !requiredString(body[field]));
    if (missing.length > 0 || body.consent !== true) {
      sendJson(res, 400, {
        error: "필수 정보를 모두 입력하고 개인정보 확인 동의에 체크해 주세요.",
      });
      return;
    }

    const therapistBackground = body.therapistBackground === true;
    const missingLicense = therapistBackground && [
      "licenseHolderName",
      "licenseNumber",
      "licenseImagePath",
    ].some((field) => !requiredString(body[field]));
    if (missingLicense) {
      sendJson(res, 400, { error: "물리치료사 출신 센터는 면허 확인 정보를 모두 입력해 주세요." });
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

    const [ownerAccounts, activeApplications] = await Promise.all([
      supabaseRequest("center_owner_accounts", {
        query: `?select=id&email=eq.${encodeURIComponent(email)}&limit=1`,
      }).catch(() => []),
      supabaseRequest("center_applications", {
        query: `?select=id,status&email=eq.${encodeURIComponent(email)}&status=in.(pending,approved)&limit=1`,
      }),
    ]);
    if (ownerAccounts[0] || activeApplications[0]) {
      sendJson(res, 409, {
        error: "이미 등록 신청 또는 센터장 계정에 사용 중인 이메일입니다. 기존 계정으로 로그인하거나 운영팀에 문의해 주세요.",
      });
      return;
    }

    const passwordScrypt = hashOwnerPassword(String(body.password || ""));

    const rows = await supabaseRequest("center_applications", {
      method: "POST",
      body: {
        center_name: body.centerName.trim(),
        owner_name: body.ownerName.trim(),
        phone: body.phone.trim(),
        email,
        owner_password_scrypt: passwordScrypt,
        area: body.area.trim(),
        address: body.address.trim(),
        naver_map_url: body.naverMapUrl || null,
        lat: body.lat ? Number(body.lat) : null,
        lng: body.lng ? Number(body.lng) : null,
        website: body.website || null,
        photo_url: body.photoUrl || null,
        photo_path: body.photoPath || null,
        photo_paths: Array.isArray(body.photoPaths) ? body.photoPaths.slice(0, 5) : [],
        therapist_background: therapistBackground,
        license_holder_name: therapistBackground ? body.licenseHolderName.trim() : "해당 없음",
        license_number: therapistBackground ? body.licenseNumber.trim() : "해당 없음",
        license_image_path: therapistBackground ? body.licenseImagePath : null,
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
    console.error("center application api failed", error);
    const message = /비밀번호는/.test(String(error.message || ""))
      ? error.message
      : "등록 신청을 저장하지 못했습니다. 입력 내용을 확인한 뒤 다시 시도해 주세요.";
    sendJson(res, 400, { error: message });
  }
};
