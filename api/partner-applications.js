const {
  clientIp,
  enforceRateLimit,
  privacyHash,
  recordAuditLog,
  recordErrorLog,
  requestSource,
  requireAdminRole,
  sendJson,
  supabaseRequest,
} = require("./_shared");
const {
  consumeRegistrationSession,
  registrationSession,
} = require("./_registration-security");

const QUALIFICATION_TYPES = new Set(["physical_therapist", "sports_science"]);
const INTERESTS = new Set(["early-partner", "launch-news", "product-feedback", "promotion-consulting"]);
const STATUSES = new Set(["received", "reviewing", "contacted", "qualified", "invited", "converted", "closed"]);

function bodyFromRequest(req) {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === "string") {
    if (Buffer.byteLength(req.body, "utf8") > 30_000) throw new Error("too_large");
    return JSON.parse(req.body || "{}");
  }
  return {};
}

function text(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(value) && value.length <= 254;
}

function normalizedPhone(value) {
  const digits = String(value || "").replace(/\D/g, "").slice(0, 11);
  if (!/^01[016789]\d{7,8}$/.test(digits)) return "";
  if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

function normalizedWebsite(value) {
  const website = text(value, 500);
  if (!website) return null;
  try {
    const parsed = new URL(website);
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function normalizedCoordinate(value, min, max) {
  const coordinate = Number(value);
  return Number.isFinite(coordinate) && coordinate >= min && coordinate <= max ? coordinate : null;
}

function normalizedNaverMapUrl(value, centerName) {
  const mapUrl = text(value, 500);
  if (mapUrl) {
    try {
      const parsed = new URL(mapUrl);
      if (parsed.protocol === "https:" && parsed.hostname === "map.naver.com") return parsed.toString();
    } catch {
      // Use the safe search URL below.
    }
  }
  return `https://map.naver.com/p/search/${encodeURIComponent(centerName)}`;
}

async function submitApplication(req, res) {
  if (!enforceRateLimit(req, res, {
    bucket: "partner-application",
    max: 4,
    windowMs: 60 * 60 * 1000,
  })) return;

  const body = bodyFromRequest(req);
  if (text(body.companyWebsite, 120)) {
    return sendJson(res, 201, { ok: true, message: "파트너 센터 신청이 접수되었습니다." });
  }

  const secureSession = await registrationSession(req, body);
  if (!secureSession) {
    return sendJson(res, 403, {
      error: "보안 확인이 만료되었습니다. 사람 확인을 다시 진행해 주세요.",
      code: "registration_session_required",
    });
  }

  const applicantName = text(body.applicantName, 60);
  const centerName = text(body.centerName, 120);
  const centerStage = "operating";
  const qualificationType = text(body.qualificationType, 40);
  const address = text(body.address, 200);
  const roadAddress = text(body.roadAddress, 200) || null;
  const jibunAddress = text(body.jibunAddress, 200) || null;
  const lat = normalizedCoordinate(body.lat, 31.43, 44.35);
  const lng = normalizedCoordinate(body.lng, 122.37, 132);
  const naverPlaceId = text(body.naverPlaceId, 80) || null;
  const naverMapUrl = normalizedNaverMapUrl(body.naverMapUrl, centerName);
  const region = text(body.region, 80) || address.split(/\s+/).slice(0, 2).join(" ");
  const contactEmail = text(body.contactEmail, 254).toLowerCase();
  const contactPhone = normalizedPhone(body.contactPhone);
  const websiteValue = text(body.websiteUrl, 500);
  const websiteUrl = normalizedWebsite(websiteValue);
  const message = text(body.message, 1_000) || null;
  const interests = Array.isArray(body.interests)
    ? [...new Set(body.interests.map((value) => text(value, 40)).filter((value) => INTERESTS.has(value)))]
    : ["early-partner"];

  if (applicantName.length < 2) {
    return sendJson(res, 400, { error: "신청자 이름을 입력해 주세요.", field: "applicantName" });
  }
  if (centerName.length < 2) {
    return sendJson(res, 400, { error: "운영 중인 센터명을 입력해 주세요.", field: "centerName" });
  }
  if (!QUALIFICATION_TYPES.has(qualificationType)) {
    return sendJson(res, 400, { error: "보유 자격 또는 전공을 선택해 주세요.", field: "qualificationType" });
  }
  if (address.length < 5 || lat === null || lng === null) {
    return sendJson(res, 400, { error: "네이버 검색 결과에서 센터의 정확한 위치를 선택해 주세요.", field: "addressQuery" });
  }
  if (region.length < 2) {
    return sendJson(res, 400, { error: "센터 운영 지역을 확인해 주세요.", field: "addressQuery" });
  }
  if (!isValidEmail(contactEmail)) {
    return sendJson(res, 400, { error: "연락받을 이메일을 확인해 주세요.", field: "contactEmail" });
  }
  if (!contactPhone) {
    return sendJson(res, 400, { error: "휴대폰 번호를 010-0000-0000 형식으로 입력해 주세요.", field: "contactPhone" });
  }
  if (websiteValue && !websiteUrl) {
    return sendJson(res, 400, { error: "웹사이트 또는 SNS 주소는 https:// 또는 http://로 입력해 주세요.", field: "websiteUrl" });
  }
  if (body.privacyConsent !== true) {
    return sendJson(res, 400, { error: "개인정보 수집 및 이용에 동의해 주세요.", field: "privacyConsent" });
  }

  const existing = await supabaseRequest("partner_applications", {
    query: `?select=id,status&contact_email=eq.${encodeURIComponent(contactEmail)}&contact_phone=eq.${encodeURIComponent(contactPhone)}&status=in.(received,reviewing,contacted,qualified,invited)&order=created_at.desc&limit=1`,
  });
  await consumeRegistrationSession(secureSession.id);
  if (existing[0]) {
    await recordAuditLog(req, {
      actorRole: "anonymous",
      action: "partner_application.duplicate_received",
      targetType: "partner_application",
      targetId: existing[0].id,
      metadata: { centerStage, qualificationType },
    });
    return sendJson(res, 200, {
      ok: true,
      duplicate: true,
      message: "이미 접수된 신청이 있습니다. 기존 신청을 기준으로 안내드리겠습니다.",
    });
  }

  const now = new Date().toISOString();
  const rows = await supabaseRequest("partner_applications", {
    method: "POST",
    body: {
      applicant_name: applicantName,
      center_name: centerName,
      center_stage: centerStage,
      qualification_type: qualificationType,
      region,
      address,
      road_address: roadAddress,
      jibun_address: jibunAddress,
      lat,
      lng,
      naver_place_id: naverPlaceId,
      naver_map_url: naverMapUrl,
      contact_email: contactEmail,
      contact_phone: contactPhone,
      website_url: websiteUrl,
      interests,
      message,
      status: "received",
      source: ["web", "ios", "android"].includes(requestSource(req)) ? requestSource(req) : "web",
      privacy_consent: true,
      consented_at: now,
      ip_hash: privacyHash(clientIp(req), "partner-application-ip") || null,
      updated_at: now,
    },
  });
  const applicationId = rows?.[0]?.id;

  await recordAuditLog(req, {
    actorRole: "anonymous",
    action: "partner_application.received",
    targetType: "partner_application",
    targetId: applicationId,
    metadata: { centerStage, qualificationType, interests: interests.join(",") },
  });

  return sendJson(res, 201, {
    ok: true,
    id: applicationId,
    message: "파트너 센터 신청이 접수되었습니다.",
  });
}

async function updateApplication(req, res) {
  const admin = await requireAdminRole(req, res, ["super_admin", "admin", "support"]);
  if (!admin) return;

  const body = bodyFromRequest(req);
  const id = text(body.id || req.query?.id, 80);
  const status = text(body.status, 30);
  const adminNote = text(body.adminNote, 2_000) || null;
  if (!id || !STATUSES.has(status)) {
    return sendJson(res, 400, { error: "사전 신청 ID와 처리 상태를 확인해 주세요." });
  }

  const now = new Date().toISOString();
  await supabaseRequest("partner_applications", {
    method: "PATCH",
    query: `?id=eq.${encodeURIComponent(id)}`,
    body: {
      status,
      admin_note: adminNote,
      last_contacted_at: ["contacted", "qualified", "invited", "converted"].includes(status) ? now : undefined,
      updated_at: now,
    },
  });
  await recordAuditLog(req, {
    actorUserId: admin.userId,
    actorRole: admin.role || "admin",
    action: "partner_application.update",
    targetType: "partner_application",
    targetId: id,
    metadata: { status, hasAdminNote: Boolean(adminNote) },
  });
  return sendJson(res, 200, { ok: true, status });
}

module.exports = async function handler(req, res) {
  try {
    if (req.method === "POST") return submitApplication(req, res);
    if (req.method === "PATCH") return updateApplication(req, res);
    res.setHeader("Allow", "POST, PATCH");
    return sendJson(res, 405, { error: "Method not allowed" });
  } catch (error) {
    const statusCode = error.message === "too_large" ? 413 : 500;
    console.error("partner applications api failed", error);
    await recordErrorLog(req, error, {
      errorCode: "partner_application_failed",
      statusCode,
    });
    return sendJson(res, statusCode, {
      error: statusCode === 413
        ? "입력한 내용이 너무 깁니다."
        : "파트너 센터 신청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    });
  }
};
