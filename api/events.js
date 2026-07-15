const { sendJson, hasSupabaseConfig, supabaseRequest } = require("./_shared");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }

  try {
    if (!hasSupabaseConfig()) {
      sendJson(res, 201, { ok: true, source: "fallback" });
      return;
    }
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const rows = await supabaseRequest("events", {
      method: "POST",
      body: {
        event_type: String(body.type || "unknown").slice(0, 80),
        center_id: body.centerId || null,
        detail: String(body.detail || "").slice(0, 500),
        source: String(body.source || "web").slice(0, 40),
      },
    });
    sendJson(res, 201, { ok: true, event: rows?.[0] || null });
  } catch (error) {
    console.error("events api failed", error);
    sendJson(res, 500, { error: "이벤트를 저장하지 못했습니다." });
  }
};
