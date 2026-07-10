const { sendJson } = require("./_shared");

module.exports = function handler(req, res) {
  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }

  sendJson(res, 201, {
    ok: true,
    event: {
      id: "vercel-preview-event",
      source: "vercel-preview",
    },
  });
};
