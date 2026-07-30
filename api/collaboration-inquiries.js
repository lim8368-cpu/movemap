const {
  clientIp,
  enforceRateLimit,
  privacyHash,
  recordAuditLog,
  recordErrorLog,
  requestSource,
  sendJson,
  supabaseRequest,
} = require("./_shared");

const ORGANIZATION_TYPES = new Set(["brand", "institution", "center", "media", "other"]);
const COLLABORATION_TYPES = new Set([
  "content-campaign",
  "service-partnership",
  "center-program",
  "product-brand",
  "research-institution",
  "other",
]);

function bodyFromRequest(req) {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === "string") {
    if (Buffer.byteLength(req.body, "utf8") > 40_000) throw new Error("too_large");
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

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  if (!enforceRateLimit(req, res, {
    bucket: "collaboration-inquiry",
    max: 5,
    windowMs: 60 * 60 * 1000,
  })) return;

  try {
    const body = bodyFromRequest(req);

    // Bots commonly fill every field. Return a normal response without storing it.
    if (text(body.companyFax, 100)) {
      return sendJson(res, 201, {
        ok: true,
        message: "협업 제안이 접수되었습니다.",
      });
    }

    const organizationType = text(body.organizationType, 30);
    const organizationName = text(body.organizationName, 120);
    const contactName = text(body.contactName, 60);
    const contactEmail = text(body.contactEmail, 254).toLowerCase();
    const contactPhone = text(body.contactPhone, 30) || null;
    const websiteValue = text(body.websiteUrl, 500);
    const websiteUrl = normalizedWebsite(websiteValue);
    const title = text(body.title, 160);
    const message = text(body.message, 4_000);
    const collaborationTypes = Array.isArray(body.collaborationTypes)
      ? [...new Set(body.collaborationTypes.map((value) => text(value, 40)).filter((value) => COLLABORATION_TYPES.has(value)))]
      : [];

    if (!ORGANIZATION_TYPES.has(organizationType)) {
      return sendJson(res, 400, { error: "제안하는 곳의 유형을 선택해 주세요.", field: "organizationType" });
    }
    if (organizationName.length < 2) {
      return sendJson(res, 400, { error: "브랜드 또는 기관명을 입력해 주세요.", field: "organizationName" });
    }
    if (contactName.length < 2) {
      return sendJson(res, 400, { error: "담당자 이름을 입력해 주세요.", field: "contactName" });
    }
    if (!isValidEmail(contactEmail)) {
      return sendJson(res, 400, { error: "연락받을 이메일을 확인해 주세요.", field: "contactEmail" });
    }
    if (websiteValue && !websiteUrl) {
      return sendJson(res, 400, { error: "웹사이트 주소는 https:// 또는 http://로 입력해 주세요.", field: "websiteUrl" });
    }
    if (!collaborationTypes.length) {
      return sendJson(res, 400, { error: "희망하는 협업 유형을 하나 이상 선택해 주세요.", field: "collaborationTypes" });
    }
    if (title.length < 4) {
      return sendJson(res, 400, { error: "제안 제목을 4자 이상 입력해 주세요.", field: "title" });
    }
    if (message.length < 30) {
      return sendJson(res, 400, { error: "협업 내용을 30자 이상 입력해 주세요.", field: "message" });
    }
    if (body.privacyConsent !== true) {
      return sendJson(res, 400, { error: "개인정보 수집 및 이용에 동의해 주세요.", field: "privacyConsent" });
    }

    const now = new Date().toISOString();
    const rows = await supabaseRequest("collaboration_inquiries", {
      method: "POST",
      body: {
        organization_type: organizationType,
        organization_name: organizationName,
        contact_name: contactName,
        contact_email: contactEmail,
        contact_phone: contactPhone,
        website_url: websiteUrl,
        collaboration_types: collaborationTypes,
        title,
        message,
        status: "received",
        source: ["web", "ios", "android"].includes(requestSource(req)) ? requestSource(req) : "web",
        privacy_consent: true,
        consented_at: now,
        ip_hash: privacyHash(clientIp(req), "collaboration-ip") || null,
        updated_at: now,
      },
    });
    const inquiryId = rows?.[0]?.id;

    await recordAuditLog(req, {
      actorRole: "anonymous",
      action: "collaboration.inquiry_received",
      targetType: "collaboration_inquiry",
      targetId: inquiryId,
      metadata: {
        organizationType,
        collaborationTypes: collaborationTypes.join(","),
      },
    });

    return sendJson(res, 201, {
      ok: true,
      id: inquiryId,
      message: "협업 제안이 접수되었습니다.",
    });
  } catch (error) {
    const statusCode = error.message === "too_large" ? 413 : 500;
    console.error("collaboration inquiry api failed", error);
    await recordErrorLog(req, error, {
      errorCode: "collaboration_inquiry_failed",
      statusCode,
    });
    return sendJson(res, statusCode, {
      error: statusCode === 413
        ? "입력한 내용이 너무 깁니다."
        : "협업 제안을 접수하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    });
  }
};
