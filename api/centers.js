const {
  sampleCenters,
  sendJson,
  hasSupabaseConfig,
  supabaseRequest,
  centerFromRow,
  createSignedStorageUrl,
} = require("./_shared");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }

  try {
    if (!hasSupabaseConfig()) {
      sendJson(res, 200, { centers: sampleCenters, source: "fallback" });
      return;
    }
    const rows = await supabaseRequest("centers", {
      query: "?select=*&status=eq.approved&order=created_at.desc",
    });
    const centers = await Promise.all(rows.map(async (row) => {
      const photoUrl = row.photo_path ? await createSignedStorageUrl(row.photo_path, 3600) : "";
      return centerFromRow(row, photoUrl);
    }));
    sendJson(res, 200, { centers, source: "supabase" });
  } catch (error) {
    console.error("centers api failed", error);
    sendJson(res, 500, { error: "센터 목록을 불러오지 못했습니다." });
  }
};
