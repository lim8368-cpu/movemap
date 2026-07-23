const {
  recordAuditLog,
  recordErrorLog,
  requireAdminRole,
  sendJson,
  supabaseRequest,
} = require("../../_shared");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });
  const admin = await requireAdminRole(req, res, ["super_admin", "admin"]);
  if (!admin) return;
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
    await recordAuditLog(req, {
      actorUserId: admin.userId,
      actorRole: admin.role,
      centerId: req.query.id,
      action: "center.location_update",
      targetType: "center",
      targetId: req.query.id,
    });
    sendJson(res, 200, { ok: true });
  } catch (error) {
    console.error("location api failed", error);
    await recordErrorLog(req, error, {
      errorCode: "center_location_update_failed",
      statusCode: 500,
      source: "admin",
    });
    sendJson(res, 500, { error: "위치를 저장하지 못했습니다." });
  }
};
