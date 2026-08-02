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
  requireAuthenticatedUser,
} = require("./_platform-auth");
const {
  normalizeSchedule,
  scheduleSummary,
} = require("./_booking");
const { normalizeCenterCategories } = require("./_center-categories");

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

function normalizePhone(value) {
  const digits = String(value || "").replace(/\D/g, "").slice(0, 11);
  if (digits.startsWith("02")) {
    if (digits.length === 9) return `${digits.slice(0, 2)}-${digits.slice(2, 5)}-${digits.slice(5)}`;
    if (digits.length === 10) return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6)}`;
    return "";
  }
  if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  if (digits.length === 11) return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  return "";
}

function scheduleFallbackMemo(memo, openingHours, openingSchedule) {
  return [
    String(memo || "").trim(),
    "[DAIL 운영시간] " + openingHours,
    "[DAIL 운영일정] " + JSON.stringify(openingSchedule),
  ].filter(Boolean).join("\n\n");
}

function missingApplicationScheduleColumns(error) {
  return /opening_(?:schedule|hours).*column|column.*opening_(?:schedule|hours)/i.test(String(error?.message || ""));
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }

  try {
    const body = await readJsonBody(req);
    const auth = await requireAuthenticatedUser(req, res);
    if (!auth) return;
    const sessionToken = registrationTokenFromRequest(req, body);
    if (!enforceRateLimit(req, res, {
      bucket: "center-application",
      max: 3,
      windowMs: 60 * 60 * 1000,
      identity: privacyHash(`${auth.user.id}:${sessionToken}`, "center-application"),
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
    ];

    const missing = requiredFields.filter((field) => !requiredString(body[field]));
    if (missing.length > 0 || body.consent !== true) {
      sendJson(res, 400, {
        error: "필수 정보를 모두 입력하고 개인정보 확인 동의에 체크해 주세요.",
      });
      return;
    }

    const qualificationType = body.qualificationType || (body.therapistBackground === true ? "physical_therapist" : "");
    if (!["physical_therapist", "sports_science"].includes(qualificationType)) {
      sendJson(res, 403, {
        error: "물리치료사 면허 또는 체육학 학위 자격을 선택해 주세요.",
        code: "professional_qualification_required",
      });
      return;
    }
    const therapistBackground = qualificationType === "physical_therapist";
    const qualificationHolderName = String(body.qualificationHolderName || body.licenseHolderName || "").trim();
    const qualificationNumber = String(body.qualificationNumber || body.licenseNumber || "").trim();
    const qualificationImagePath = String(body.qualificationImagePath || body.licenseImagePath || "").trim();
    const degreeLevel = String(body.degreeLevel || "").trim();
    const degreeSchool = String(body.degreeSchool || "").trim();
    const degreeMajor = String(body.degreeMajor || "").trim();
    const missingCredential = !qualificationHolderName || !qualificationNumber || !qualificationImagePath || (
      qualificationType === "sports_science" && (
        !["학사", "석사", "박사"].includes(degreeLevel) || !degreeSchool || !degreeMajor
      )
    );
    if (missingCredential) {
      sendJson(res, 400, {
        error: therapistBackground
          ? "물리치료사 면허 확인 정보를 모두 입력해 주세요."
          : "체육학 학위 정보와 인증서를 모두 입력해 주세요.",
      });
      return;
    }
    if (!body.openingSchedule || typeof body.openingSchedule !== "object" || Array.isArray(body.openingSchedule)) {
      sendJson(res, 400, { error: "요일별 센터 운영시간을 설정해 주세요." });
      return;
    }
    const openingSchedule = normalizeSchedule(body.openingSchedule);
    if (Object.values(openingSchedule).every((day) => day.closed)) {
      sendJson(res, 400, { error: "운영일을 하나 이상 선택해 주세요." });
      return;
    }
    const openingHours = scheduleSummary(openingSchedule);
    const categories = normalizeCenterCategories(body.services);
    if (!categories.length) {
      sendJson(res, 400, { error: "회복 분야를 하나 이상 선택해 주세요." });
      return;
    }

    const email = String(body.email || "").trim().toLowerCase().slice(0, 254);
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      sendJson(res, 400, { error: "센터장 계정에 사용할 올바른 이메일을 입력해 주세요." });
      return;
    }
    const phone = normalizePhone(body.phone);
    if (!phone) {
      sendJson(res, 400, { error: "전화번호를 010-0000-0000 형식으로 입력해 주세요." });
      return;
    }

    if (!hasSupabaseConfig()) {
      sendJson(res, 503, { error: "테스트 DB가 아직 연결되지 않았습니다." });
      return;
    }

    const activeApplications = await supabaseRequest("center_applications", {
        query: `?select=id,status&applicant_auth_user_id=eq.${encodeURIComponent(auth.user.id)}&status=eq.pending&limit=1`,
      });
    if (activeApplications[0]) {
      sendJson(res, 409, {
        error: "현재 로그인한 계정으로 처리 중인 센터 등록 신청이 있습니다.",
        code: "application_pending",
      });
      return;
    }

    const requestedPaths = [
      body.photoPath,
      ...(Array.isArray(body.photoPaths) ? body.photoPaths : []),
      qualificationImagePath,
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

    const applicationBody = {
        center_name: body.centerName.trim(),
        owner_name: body.ownerName.trim(),
        phone,
        email,
        owner_password_scrypt: null,
        applicant_auth_user_id: auth.user.id,
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
        license_holder_name: qualificationHolderName,
        license_number: qualificationNumber,
        license_image_path: qualificationImagePath,
        services: categories.join(", "),
        opening_schedule: openingSchedule,
        opening_hours: openingHours,
        memo: body.memo || null,
        consent: true,
        status: "pending",
      };
    let rows;
    try {
      rows = await supabaseRequest("center_applications", {
        method: "POST",
        body: applicationBody,
      });
    } catch (error) {
      if (!missingApplicationScheduleColumns(error)) throw error;
      const { opening_schedule, opening_hours, ...legacyBody } = applicationBody;
      rows = await supabaseRequest("center_applications", {
        method: "POST",
        body: {
          ...legacyBody,
          memo: scheduleFallbackMemo(body.memo, openingHours, openingSchedule),
        },
      });
    }
    await consumeRegistrationSession(secureSession.id);
    await recordAuditLog(req, {
      actorUserId: auth.user.id,
      actorRole: "center_applicant",
      action: "center_application.create",
      targetType: "center_application",
      targetId: rows[0].id,
      metadata: { qualificationType, therapistBackground, uploadedFiles: requestedPaths.length },
    });

    sendJson(res, 202, {
      ok: true,
      applicationId: rows[0].id,
      status: "received",
      message: "등록 신청이 접수되었습니다. 승인되면 현재 로그인한 계정에 센터 운영 권한이 연결됩니다.",
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
