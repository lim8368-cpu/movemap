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
    const [rows, reviews] = await Promise.all([
      supabaseRequest("centers", { query: "?select=*&status=eq.approved&order=created_at.desc" }),
      supabaseRequest("reviews", { query: "?select=center_id,rating&status=eq.approved" }),
    ]);
    const centers = await Promise.all(rows.map(async (row) => {
      const paths = row.photo_paths?.length ? row.photo_paths : (row.photo_path ? [row.photo_path] : []);
      const photoUrls = await Promise.all(paths.map((path) => createSignedStorageUrl(path, 3600)));
      const ownReviews = reviews.filter((review) => review.center_id === row.id);
      const rating = ownReviews.length ? (ownReviews.reduce((sum, review) => sum + Number(review.rating), 0) / ownReviews.length).toFixed(1) : "신규";
      return centerFromRow({ ...row, rating, reviews: String(ownReviews.length) }, photoUrls[0] || "", photoUrls);
    }));
    sendJson(res, 200, { centers, source: "supabase" });
  } catch (error) {
    console.error("centers api failed", error);
    sendJson(res, 500, { error: "센터 목록을 불러오지 못했습니다." });
  }
};
