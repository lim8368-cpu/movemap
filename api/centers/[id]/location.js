const { sendJson, isAdminRequest, supabaseRequest } = require("../../_shared");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });
  if (!isAdminRequest(req)) return sendJson(res, 401, { error: "Unauthorized" });
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    await supabaseRequest("centers", {
      method: "PATCH",
      query: `?id=eq.${encodeURIComponent(req.query.id)}`,
      body: {
        area: body.area,
        address: body.address,
        lat: body.lat ? Number(body.lat) : null,
        lng: body.lng ? Number(body.lng) : null,
        naver_map_url: body.naverMapUrl || null,
        updated_at: new Date().toISOString(),
      },
    });
    sendJson(res, 200, { ok: true });
  } catch (error) {
    console.error("location api failed", error);
    sendJson(res, 500, { error: "위치를 저장하지 못했습니다." });
  }
};
