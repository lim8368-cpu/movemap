const { recordAuditLog, sendJson } = require("./_shared");
const { clearOwnerSessionCookie, ownerSessionFromRequest } = require("./_owner-auth");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });
  const session = ownerSessionFromRequest(req);
  if (session) {
    await recordAuditLog(req, {
      actorUserId: session.userId,
      actorRole: "center_member",
      centerId: session.centerId,
      action: "center_member.logout",
      targetType: "session",
    });
  }
  res.setHeader("Set-Cookie", clearOwnerSessionCookie(req));
  sendJson(res, 200, { ok: true });
};
