const { sendJson, isAdminRequest, supabaseRequest } = require("../../_shared");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });
  if (!isAdminRequest(req)) return sendJson(res, 401, { error: "Unauthorized" });
  try {
    const applicationId = req.query.id;
    const applications = await supabaseRequest("center_applications", {
      query: `?select=*&id=eq.${encodeURIComponent(applicationId)}&limit=1`,
    });
    const item = applications[0];
    if (!item) return sendJson(res, 404, { error: "신청을 찾을 수 없습니다." });
    if (item.status !== "pending") return sendJson(res, 409, { error: "이미 처리된 신청입니다." });

    const centers = await supabaseRequest("centers", {
      method: "POST",
      body: {
        application_id: item.id,
        name: item.center_name,
        region: "other",
        area: item.area,
        address: item.address,
        naver_map_url: item.naver_map_url,
        lat: item.lat,
        lng: item.lng,
        lead: item.services || "물리치료사가 운영하는 운동센터입니다.",
        tags: [],
        therapist: `${item.license_holder_name} · 물리치료사 운영 확인`,
        price: "센터 문의",
        conversion: "신규 등록 센터",
        plan: "free",
        photo_path: item.photo_path,
        status: "approved",
      },
    });
    await supabaseRequest("center_applications", {
      method: "PATCH",
      query: `?id=eq.${encodeURIComponent(item.id)}`,
      body: { status: "approved", reviewed_at: new Date().toISOString() },
    });
    sendJson(res, 200, { ok: true, centerId: centers[0].id });
  } catch (error) {
    console.error("approve api failed", error);
    sendJson(res, 500, { error: "승인 처리에 실패했습니다." });
  }
};
