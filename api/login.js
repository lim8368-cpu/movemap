const { sendJson } = require("./_shared");

module.exports = function handler(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });
  const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
  if (!process.env.ADMIN_PASSWORD || body.password !== process.env.ADMIN_PASSWORD) {
    return sendJson(res, 401, { error: "관리자 비밀번호가 올바르지 않습니다." });
  }
  if (!process.env.ADMIN_API_TOKEN) {
    return sendJson(res, 503, { error: "관리자 토큰이 설정되지 않았습니다." });
  }
  sendJson(res, 200, { token: process.env.ADMIN_API_TOKEN });
};
