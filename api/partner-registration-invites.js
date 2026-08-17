const {
  recordAuditLog,
  recordErrorLog,
  requireAdminRole,
  sendJson,
  supabaseRequest,
} = require("./_shared");
const {
  issuePartnerRegistrationInvite,
  verifyPartnerRegistrationInvite,
} = require("./_partner-registration-invite");

function text(value, maxLength = 500) {
  return String(value || "").trim().slice(0, maxLength);
}

async function applicationForInvite(payload) {
  if (!payload) return null;
  const rows = await supabaseRequest("partner_applications", {
    query: `?select=id,applicant_name,center_name,contact_email,status&id=eq.${encodeURIComponent(payload.applicationId)}&contact_email=eq.${encodeURIComponent(payload.email)}&limit=1`,
  });
  const application = rows[0] || null;
  if (!application || ["closed", "converted"].includes(application.status)) return null;
  return application;
}

function requestOrigin(req) {
  const configured = text(process.env.PUBLIC_SITE_URL, 300).replace(/\/$/, "");
  if (configured) return configured;
  const forwardedProto = text(req.headers?.["x-forwarded-proto"], 20).split(",")[0];
  const protocol = forwardedProto === "http" ? "http" : "https";
  const host = text(req.headers?.["x-forwarded-host"] || req.headers?.host, 255).split(",")[0];
  return host ? `${protocol}://${host}` : "";
}

async function validateInvite(req, res) {
  const payload = verifyPartnerRegistrationInvite(req.query?.token);
  const application = await applicationForInvite(payload);
  if (!payload || !application) {
    return sendJson(res, 403, {
      valid: false,
      error: "유효한 센터 등록 초대 링크가 아닙니다. DAIL 운영팀에 새 링크를 요청해 주세요.",
      code: "partner_invite_invalid",
    });
  }
  return sendJson(res, 200, {
    valid: true,
    expiresAt: payload.expiresAt,
    application: {
      id: application.id,
      applicantName: application.applicant_name,
      centerName: application.center_name,
      contactEmail: application.contact_email,
    },
  });
}

async function createInvite(req, res) {
  const admin = await requireAdminRole(req, res, ["super_admin", "admin", "support"]);
  if (!admin) return;
  const id = text(req.body?.id, 80);
  if (!id) return sendJson(res, 400, { error: "파트너 신청 ID를 확인해 주세요." });
  const rows = await supabaseRequest("partner_applications", {
    query: `?select=id,applicant_name,center_name,contact_email,status&id=eq.${encodeURIComponent(id)}&limit=1`,
  });
  const application = rows[0];
  if (!application || ["closed", "converted"].includes(application.status)) {
    return sendJson(res, 404, { error: "초대할 수 있는 파트너 신청을 찾지 못했습니다." });
  }
  if (!["qualified", "invited"].includes(application.status)) {
    return sendJson(res, 409, { error: "서류 검토를 마친 뒤 처리 상태를 ‘정식 등록 후보’로 저장해 주세요." });
  }
  const invite = issuePartnerRegistrationInvite(application);
  const now = new Date().toISOString();
  await supabaseRequest("partner_applications", {
    method: "PATCH",
    query: `?id=eq.${encodeURIComponent(id)}`,
    body: { status: "invited", last_contacted_at: now, updated_at: now },
  });
  await recordAuditLog(req, {
    actorUserId: admin.userId,
    actorRole: admin.role || "admin",
    action: "partner_application.registration_invite_created",
    targetType: "partner_application",
    targetId: id,
    metadata: { expiresAt: invite.expiresAt },
  });
  const origin = requestOrigin(req);
  return sendJson(res, 201, {
    ok: true,
    inviteUrl: `${origin}/register/?invite=${encodeURIComponent(invite.token)}`,
    expiresAt: invite.expiresAt,
  });
}

module.exports = async function handler(req, res) {
  try {
    if (req.method === "GET") return validateInvite(req, res);
    if (req.method === "POST") return createInvite(req, res);
    res.setHeader("Allow", "GET, POST");
    return sendJson(res, 405, { error: "Method not allowed" });
  } catch (error) {
    console.error("partner registration invite api failed", error);
    await recordErrorLog(req, error, {
      errorCode: "partner_registration_invite_failed",
      statusCode: 500,
    });
    return sendJson(res, 500, { error: "센터 등록 초대 링크를 처리하지 못했습니다." });
  }
};
