const {
  sendJson,
  isAdminRequest,
  supabaseRequest,
  centerFromRow,
  createSignedStorageUrl,
} = require("./_shared");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return sendJson(res, 405, { error: "Method not allowed" });
  if (!isAdminRequest(req)) return sendJson(res, 401, { error: "Unauthorized" });
  try {
    const [applications, centerRows, events] = await Promise.all([
      supabaseRequest("center_applications", { query: "?select=*&order=created_at.desc" }),
      supabaseRequest("centers", { query: "?select=*&order=created_at.desc" }),
      supabaseRequest("events", { query: "?select=*&order=created_at.desc&limit=100" }),
    ]);
    const centers = await Promise.all(centerRows.map(async (row) => {
      const paths = row.photo_paths?.length ? row.photo_paths : (row.photo_path ? [row.photo_path] : []);
      const photoUrls = await Promise.all(paths.map((path) => createSignedStorageUrl(path)));
      return ({
      ...centerFromRow(row, photoUrls[0] || "", photoUrls),
      views: events.filter((item) => item.center_id === row.id && item.event_type === "view").length,
      contactClicks: events.filter((item) => item.center_id === row.id && item.event_type === "contact").length,
      lastEventAt: events.find((item) => item.center_id === row.id)?.created_at || null,
    }); }));
    const applicationItems = await Promise.all(applications.map(async (item) => ({
      id: item.id,
      centerName: item.center_name,
      ownerName: item.owner_name,
      phone: item.phone,
      area: item.area,
      address: item.address,
      naverMapUrl: item.naver_map_url,
      website: item.website,
      photoUrl: item.photo_path ? await createSignedStorageUrl(item.photo_path) : (item.photo_url || ""),
      photoUrls: await Promise.all((item.photo_paths || []).map((path) => createSignedStorageUrl(path))),
      licenseImageUrl: item.license_image_path ? await createSignedStorageUrl(item.license_image_path) : "",
      licenseHolderName: item.license_holder_name,
      licenseNumber: item.license_number,
      services: item.services,
      memo: item.memo,
      status: item.status,
      rejectionReason: item.rejection_reason,
      centerId: centerRows.find((center) => center.application_id === item.id)?.id || "",
      createdAt: item.created_at,
    })));
    sendJson(res, 200, {
      totals: {
        centers: centers.length,
        pendingCenters: applications.filter((item) => item.status === "pending").length,
        views: events.filter((item) => item.event_type === "view").length,
        contactClicks: events.filter((item) => item.event_type === "contact").length,
        events: events.length,
      },
      centerApplications: applicationItems,
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
