const {
  adminIdentityFromRequest,
  clearAdminSessionCookie,
  recordAuditLog,
  sendJson,
} = require("./_shared");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });
  const admin = adminIdentityFromRequest(req);
  if (admin) {
    await recordAuditLog(req, {
      actorUserId: admin.userId,
      actorRole: admin.role,
      action: "platform_admin.logout",
      targetType: "session",
    });
  }
  res.setHeader("Set-Cookie", clearAdminSessionCookie(req));
  sendJson(res, 200, { ok: true });
};
