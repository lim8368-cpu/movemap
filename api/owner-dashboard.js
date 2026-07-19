const { centerFromRow, createSignedStorageUrl, sendJson, supabaseRequest } = require("./_shared");
const { ownerSessionFromRequest } = require("./_owner-auth");

const EDITABLE_FIELDS = ["name", "area", "address", "naver_map_url", "lead", "tags", "categories", "therapist", "price", "conversion", "phone", "website", "opening_hours"];
const ALLOWED_CATEGORIES = new Set(["재활운동", "통증관리", "자세교정", "체형관리", "스포츠재활", "시니어운동", "산전산후", "다이어트"]);

function cleanText(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

async function centerData(centerId) {
  const [centers, events, reviews] = await Promise.all([
    supabaseRequest("centers", { query: `?select=*&id=eq.${encodeURIComponent(centerId)}&limit=1` }),
    supabaseRequest("events", { query: `?select=*&center_id=eq.${encodeURIComponent(centerId)}&order=created_at.desc&limit=1000` }),
    supabaseRequest("reviews", { query: `?select=*&center_id=eq.${encodeURIComponent(centerId)}&order=created_at.desc&limit=100` }),
  ]);
  const row = centers[0];
  if (!row) return null;
  const paths = row.photo_paths?.length ? row.photo_paths : [row.photo_path].filter(Boolean);
  const photoUrls = await Promise.all(paths.map((path) => createSignedStorageUrl(path)));
  const approvedReviews = reviews.filter((review) => review.status === "approved");
  const now = Date.now();
  const last30Days = events.filter((event) => now - new Date(event.created_at).getTime() <= 30 * 24 * 60 * 60 * 1000);
  const views = events.filter((event) => event.event_type === "view").length;
  const contactClicks = events.filter((event) => event.event_type === "contact").length;
  const ratingAverage = approvedReviews.length
    ? approvedReviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / approvedReviews.length
    : 0;
  return {
    center: { ...centerFromRow(row, photoUrls[0] || "", photoUrls), phone: row.phone || "", website: row.website || "", openingHours: row.opening_hours || "", status: row.status, updatedAt: row.updated_at },
    totals: {
      views,
      contactClicks,
      contactRate: views ? Number(((contactClicks / views) * 100).toFixed(1)) : 0,
      last30Views: last30Days.filter((event) => event.event_type === "view").length,
      last30Contacts: last30Days.filter((event) => event.event_type === "contact").length,
      reviews: approvedReviews.length,
      ratingAverage: Number(ratingAverage.toFixed(1)),
    },
    recentEvents: events.slice(0, 12).map((event) => ({ type: event.event_type, source: event.source, createdAt: event.created_at })),
    recentReviews: approvedReviews.slice(0, 8).map((review) => ({ nickname: review.nickname, rating: review.rating, content: review.content, createdAt: review.created_at })),
  };
}

module.exports = async function handler(req, res) {
  let session;
  try {
    session = ownerSessionFromRequest(req);
  } catch {
    return sendJson(res, 503, { error: "센터장 세션 설정을 확인해 주세요." });
  }
  if (!session) return sendJson(res, 401, { error: "로그인이 필요합니다." });

  try {
    if (req.method === "GET") {
      const data = await centerData(session.centerId);
      if (!data) return sendJson(res, 404, { error: "연결된 센터를 찾을 수 없습니다." });
      return sendJson(res, 200, { ...data, account: { email: session.email } });
    }
    if (req.method !== "PATCH") return sendJson(res, 405, { error: "Method not allowed" });

    const body = req.body || {};
    const patch = {};
    for (const field of EDITABLE_FIELDS) {
      if (body[field] === undefined) continue;
      if (field === "tags") {
        patch.tags = Array.isArray(body.tags) ? body.tags.map((tag) => cleanText(tag, 30)).filter(Boolean).slice(0, 12) : [];
      } else if (field === "categories") {
        patch.categories = Array.isArray(body.categories) ? [...new Set(body.categories.map((value) => cleanText(value, 20)).filter((value) => ALLOWED_CATEGORIES.has(value)))].slice(0, 8) : [];
      } else {
        const limit = field === "lead" ? 800 : field === "opening_hours" ? 500 : 200;
        patch[field] = cleanText(body[field], limit);
        if (field === "therapist") {
          patch[field] = patch[field].replace(/물리치료사(?!\s*출신)/g, "물리치료사 출신");
        }
      }
    }
    if (!Object.keys(patch).length) return sendJson(res, 400, { error: "수정할 정보가 없습니다." });
    patch.updated_at = new Date().toISOString();
    await supabaseRequest("centers", { method: "PATCH", query: `?id=eq.${encodeURIComponent(session.centerId)}`, body: patch });
    sendJson(res, 200, { ok: true, ...(await centerData(session.centerId)) });
  } catch (error) {
    console.error("owner dashboard api failed", error);
    sendJson(res, 500, { error: "센터 정보를 처리하지 못했습니다." });
  }
};
