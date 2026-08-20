const {
  recordAuditLog,
  recordErrorLog,
  requireAdminRole,
  sendJson,
  supabaseRequest,
} = require("./_shared");
const {
  findActivePartnerRegistrationInvitation,
  issuePartnerRegistrationInvite,
} = require("./_partner-registration-invite");
const {
  sendPartnerRegistrationInvitation,
  transactionalEmailConfigured,
} = require("./_transactional-email");

function text(value, maxLength = 500) {
  return String(value || "").trim().slice(0, maxLength);
}

async function applicationForInvite(invitation) {
  if (!invitation) return null;
  const rows = await supabaseRequest("partner_applications", {
    query: `?select=id,applicant_name,center_name,contact_email,status&id=eq.${encodeURIComponent(invitation.partner_application_id)}&contact_email=eq.${encodeURIComponent(invitation.email)}&limit=1`,
  });
  const application = rows[0] || null;
  if (!application || application.status !== "invited") return null;
  return application;
}

function requestOrigin(req) {
  const configured = text(process.env.PUBLIC_APP_ORIGIN || process.env.PUBLIC_SITE_URL, 300).replace(/\/$/, "");
  if (configured) return configured;
  const forwardedProto = text(req.headers?.["x-forwarded-proto"], 20).split(",")[0];
  const protocol = forwardedProto === "http" ? "http" : "https";
  const host = text(req.headers?.["x-forwarded-host"] || req.headers?.host, 255).split(",")[0];
  return host ? `${protocol}://${host}` : "";
}

async function validateInvite(req, res) {
  const invitation = await findActivePartnerRegistrationInvitation(req.query?.token);
  const application = await applicationForInvite(invitation);
  if (!invitation || !application) {
    return sendJson(res, 403, {
      valid: false,
      error: "유효한 센터 등록 초대 링크가 아닙니다. DAIL 운영팀에 새 링크를 요청해 주세요.",
      code: "partner_invite_invalid",
    });
  }
  return sendJson(res, 200, {
    valid: true,
    expiresAt: invitation.expires_at,
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
  await supabaseRequest("partner_registration_invitations", {
    method: "PATCH",
    query: `?partner_application_id=eq.${encodeURIComponent(id)}&status=eq.pending`,
    body: { status: "revoked", revoked_at: now, updated_at: now },
  });
  const invitationRows = await supabaseRequest("partner_registration_invitations", {
    method: "POST",
    body: {
      partner_application_id: id,
      email: invite.email,
      token_hash: invite.tokenHash,
      status: "pending",
      expires_at: invite.expiresAt,
      email_delivery_status: transactionalEmailConfigured() ? "queued" : "not_configured",
      created_by_user_id: admin.userId || null,
      updated_at: now,
    },
  });
  const invitation = invitationRows[0];
  await supabaseRequest("partner_applications", {
    method: "PATCH",
    query: `?id=eq.${encodeURIComponent(id)}`,
    body: { status: "invited", last_contacted_at: now, updated_at: now },
  });
  const origin = requestOrigin(req);
  const inviteUrl = `${origin}/register/?invite=${encodeURIComponent(invite.token)}`;
  let emailSent = false;
  let emailStatus = transactionalEmailConfigured() ? "queued" : "not_configured";
  let emailError = null;
  if (transactionalEmailConfigured()) {
    try {
      const delivery = await sendPartnerRegistrationInvitation({
        to: application.contact_email,
        applicantName: application.applicant_name,
        centerName: application.center_name,
        inviteUrl,
        expiresAt: invite.expiresAt,
      });
      emailSent = delivery.sent;
      emailStatus = delivery.status;
    } catch (error) {
      emailStatus = "failed";
      emailError = text(error.message, 500) || "이메일 전송에 실패했습니다.";
    }
    await supabaseRequest("partner_registration_invitations", {
      method: "PATCH",
      query: `?id=eq.${encodeURIComponent(invitation.id)}`,
      body: {
        email_delivery_status: emailStatus,
        email_error: emailError,
        sent_at: emailSent ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      },
    });
  }
  await recordAuditLog(req, {
    actorUserId: admin.userId,
    actorRole: admin.role || "admin",
    action: "partner_application.registration_invite_created",
    targetType: "partner_registration_invitation",
    targetId: invitation.id,
    metadata: { partnerApplicationId: id, expiresAt: invite.expiresAt, emailStatus },
  });
  return sendJson(res, 201, {
    ok: true,
    invitationId: invitation.id,
    inviteUrl,
    expiresAt: invite.expiresAt,
    emailSent,
    emailStatus,
    emailError,
  });
}

async function revokeInvite(req, res) {
  const admin = await requireAdminRole(req, res, ["super_admin", "admin", "support"]);
  if (!admin) return;
  const id = text(req.body?.id || req.query?.id, 80);
  if (!id) return sendJson(res, 400, { error: "취소할 초대 ID를 확인해 주세요." });
  const rows = await supabaseRequest("partner_registration_invitations", {
    query: `?select=id,partner_application_id,status&id=eq.${encodeURIComponent(id)}&limit=1`,
  });
  const invitation = rows[0];
  if (!invitation || invitation.status !== "pending") {
    return sendJson(res, 404, { error: "이미 사용·취소되었거나 찾을 수 없는 초대입니다." });
  }
  const now = new Date().toISOString();
  await supabaseRequest("partner_registration_invitations", {
    method: "PATCH",
    query: `?id=eq.${encodeURIComponent(id)}&status=eq.pending`,
    body: { status: "revoked", revoked_at: now, updated_at: now },
  });
  await supabaseRequest("partner_applications", {
    method: "PATCH",
    query: `?id=eq.${encodeURIComponent(invitation.partner_application_id)}&status=eq.invited`,
    body: { status: "qualified", updated_at: now },
  });
  await recordAuditLog(req, {
    actorUserId: admin.userId,
    actorRole: admin.role || "admin",
    action: "partner_application.registration_invite_revoked",
    targetType: "partner_registration_invitation",
    targetId: id,
    metadata: { partnerApplicationId: invitation.partner_application_id },
  });
  return sendJson(res, 200, { ok: true, status: "revoked" });
}

module.exports = async function handler(req, res) {
  try {
    if (req.method === "GET") return validateInvite(req, res);
    if (req.method === "POST") return createInvite(req, res);
    if (req.method === "DELETE") return revokeInvite(req, res);
    res.setHeader("Allow", "GET, POST, DELETE");
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
