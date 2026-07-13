const { sendJson, isAdminRequest } = require("./_shared");

module.exports = function handler(req, res) {
  if (!isAdminRequest(req)) return sendJson(res, 401, { error: "Unauthorized" });
  sendJson(res, 200, { totals: { accessLogs: 0 }, accessLogs: [] });
};
