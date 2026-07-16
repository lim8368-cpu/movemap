const { sendJson } = require("./_shared");
const { clearOwnerSessionCookie } = require("./_owner-auth");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });
  res.setHeader("Set-Cookie", clearOwnerSessionCookie(req));
  sendJson(res, 200, { ok: true });
};
