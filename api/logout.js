const { clearAdminSessionCookie, sendJson } = require("./_shared");

module.exports = function handler(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });
  res.setHeader("Set-Cookie", clearAdminSessionCookie());
  sendJson(res, 200, { ok: true });
};
