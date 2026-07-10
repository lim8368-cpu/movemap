const { sendJson } = require("./_shared");

module.exports = function handler(req, res) {
  if (req.method !== "GET") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }

  sendJson(res, 200, {
    naverMapNcpKeyId: process.env.NAVER_MAP_NCP_KEY_ID || "",
  });
};
