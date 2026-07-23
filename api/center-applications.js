const {
  enforceRateLimit,
  hasSupabaseConfig,
  privacyHash,
  recordAuditLog,
  recordErrorLog,
  sendJson,
  supabaseRequest,
} = require("./_shared");
const {
  consumeRegistrationSession,
  registrationSession,
  registrationTokenFromRequest,
} = require("./_registration-security");
const {
  signInWithPassword,
  signUpWithPassword,
} = require("./_user-auth");

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
    const sessionToken = registrationTokenFromRequest(req, body);
    if (!enforceRateLimit(req, res, {
      bucket: "center-application",
      max: 3,
      windowMs: 60 * 60 * 1000,
      identity: privacyHash(sessionToken, "center-application"),
    })) return;
    const secureSession = await registrationSession(req, body);
    if (!secureSession) {
      sendJson(res, 401, {
        error: "등록 보안 확인이 만료되었습니다. 사람 확인을 다시 진행해 주세요.",
        code: "registration_session_required",
      });
      return;
    }
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

    const activeApplications = await supabaseRequest("center_applications", {
        query: `?select=id,status&email=eq.${encodeURIComponent(email)}&status=eq.pending&limit=1`,
      });
    if (activeApplications[0]) {
      sendJson(res, 409, {
        error: "이 이메일로 처리 중인 센터 등록 신청이 있습니다. 승인 또는 반려 후 다른 센터를 신청해 주세요.",
      });
      return;
    }

    const requestedPaths = [
      body.photoPath,
      ...(Array.isArray(body.photoPaths) ? body.photoPaths : []),
      body.licenseImagePath,
    ].filter(Boolean);
    const allowedPaths = new Set(secureSession.upload_paths || []);
    const invalidUpload = requestedPaths.find((objectPath) =>
      !allowedPaths.has(objectPath) ||
      !String(objectPath).startsWith(`registration/${secureSession.id}/`)
    );
    if (invalidUpload) {
      sendJson(res, 400, { error: "현재 등록 절차에서 올린 파일만 사용할 수 있습니다." });
      return;
    }

    let authUser;
    let emailVerificationRequired = false;
    try {
      const signedIn = await signInWithPassword(email, String(body.password || ""));
      authUser = signedIn.user;
    } catch {
      const signedUp = await signUpWithPassword(email, String(body.password || ""), {
        account_type: "center_member",
        pending_center_application: true,
      });
      authUser = signedUp?.user;
      emailVerificationRequired = !signedUp?.access_token;
      if (!authUser?.id || (Array.isArray(authUser.identities) && authUser.identities.length === 0)) {
        sendJson(res, 409, {
          error: "이미 가입된 이메일입니다. 기존 비밀번호로 다시 시도하거나 비밀번호를 재설정해 주세요.",
          code: "existing_auth_user",
        });
        return;
      }
    }

    const rows = await supabaseRequest("center_applications", {
      method: "POST",
      body: {
        center_name: body.centerName.trim(),
        owner_name: body.ownerName.trim(),
        phone: body.phone.trim(),
        email,
        owner_password_scrypt: null,
        applicant_auth_user_id: authUser.id,
        registration_session_id: secureSession.id,
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
    await consumeRegistrationSession(secureSession.id);
    await recordAuditLog(req, {
      actorUserId: authUser.id,
      actorRole: "center_applicant",
      action: "center_application.create",
      targetType: "center_application",
      targetId: rows[0].id,
      metadata: { therapistBackground, uploadedFiles: requestedPaths.length },
    });

    sendJson(res, 202, {
      ok: true,
      applicationId: rows[0].id,
      status: "received",
      emailVerificationRequired,
      message: emailVerificationRequired
        ? "등록 신청이 접수되었습니다. 이메일 인증 후 운영자 검토가 진행됩니다."
        : "등록 신청이 접수되었습니다. 운영자 확인 후 연락드릴게요.",
    });
  } catch (error) {
    console.error("center application api failed", error);
    await recordErrorLog(req, error, { errorCode: "center_application_failed", statusCode: 400 });
    const message = /비밀번호는/.test(String(error.message || ""))
      ? error.message
      : "등록 신청을 저장하지 못했습니다. 입력 내용을 확인한 뒤 다시 시도해 주세요.";
    sendJson(res, 400, { error: message });
  }
};
