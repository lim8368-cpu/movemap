const { sendJson, isAdminRequest, supabaseRequest, centerFromRow } = require("./_shared");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return sendJson(res, 405, { error: "Method not allowed" });
  if (!isAdminRequest(req)) return sendJson(res, 401, { error: "Unauthorized" });
  try {
    const [applications, centerRows, events] = await Promise.all([
      supabaseRequest("center_applications", { query: "?select=*&order=created_at.desc" }),
      supabaseRequest("centers", { query: "?select=*&order=created_at.desc" }),
      supabaseRequest("events", { query: "?select=*&order=created_at.desc&limit=100" }),
    ]);
    const centers = centerRows.map((row) => ({
      ...centerFromRow(row),
      views: events.filter((item) => item.center_id === row.id && item.event_type === "view").length,
      contactClicks: events.filter((item) => item.center_id === row.id && item.event_type === "contact").length,
      lastEventAt: events.find((item) => item.center_id === row.id)?.created_at || null,
    }));
    sendJson(res, 200, {
      totals: {
        centers: centers.length,
        pendingCenters: applications.filter((item) => item.status === "pending").length,
        views: events.filter((item) => item.event_type === "view").length,
        contactClicks: events.filter((item) => item.event_type === "contact").length,
        events: events.length,
      },
      centerApplications: applications.map((item) => ({
        id: item.id,
        centerName: item.center_name,
        ownerName: item.owner_name,
        phone: item.phone,
        area: item.area,
        address: item.address,
        naverMapUrl: item.naver_map_url,
        website: item.website,
        photoUrl: item.photo_url,
        licenseHolderName: item.license_holder_name,
        licenseNumber: item.license_number,
        services: item.services,
        memo: item.memo,
        status: item.status,
        createdAt: item.created_at,
      })),
      centers,
      recentEvents: events.slice(0, 30).map((item) => ({
        type: item.event_type,
        centerId: item.center_id || "-",
        source: item.source,
        createdAt: item.created_at,
      })),
    });
  } catch (error) {
    console.error("stats api failed", error);
    sendJson(res, 500, { error: "관리자 데이터를 불러오지 못했습니다." });
  }
};
