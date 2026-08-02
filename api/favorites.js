const {
  centerFromRow,
  createSignedStorageUrl,
  sendJson,
  supabaseRequest,
} = require("./_shared");
const { requireAuthenticatedUser } = require("./_platform-auth");

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validCenterId(value) {
  const centerId = String(value || "").trim();
  return UUID_PATTERN.test(centerId) ? centerId : "";
}

function inFilter(ids) {
  return `(${ids.join(",")})`;
}

async function favoriteCards(userId) {
  const favoriteRows = await supabaseRequest("user_favorites", {
    query: `?select=center_id,created_at&user_id=eq.${encodeURIComponent(userId)}&order=created_at.desc`,
  });
  if (!favoriteRows.length) return [];

  const centerIds = favoriteRows.map((row) => row.center_id).filter(validCenterId);
  if (!centerIds.length) return [];
  const filter = inFilter(centerIds);
  const [centerRows, reviewRows, applications] = await Promise.all([
    supabaseRequest("centers", {
      query: `?select=*&id=in.${filter}&status=eq.approved`,
    }),
    supabaseRequest("reviews", {
      query: `?select=center_id,rating&center_id=in.${filter}&status=eq.approved`,
    }),
    supabaseRequest("center_applications", {
      query: "?select=id,therapist_background&status=eq.approved",
    }).catch(() => []),
  ]);
  const centerById = new Map(centerRows.map((center) => [center.id, center]));

  return Promise.all(favoriteRows.map(async (favorite) => {
    const row = centerById.get(favorite.center_id);
    if (!row) return null;
    const paths = row.photo_paths?.length
      ? row.photo_paths
      : (row.photo_path ? [row.photo_path] : []);
    const photoUrl = paths[0] ? await createSignedStorageUrl(paths[0], 3600) : "";
    const reviews = reviewRows.filter((review) => review.center_id === row.id);
    const rating = reviews.length
      ? (reviews.reduce((sum, review) => sum + Number(review.rating), 0) / reviews.length).toFixed(1)
      : "신규";
    const registration = applications.find((application) => application.id === row.application_id);
    return {
      center: centerFromRow({
        ...row,
        rating,
        reviews: String(reviews.length),
        therapist_background: registration?.therapist_background === true,
      }, photoUrl, photoUrl ? [photoUrl] : []),
      savedAt: favorite.created_at,
    };
  })).then((items) => items.filter(Boolean));
}

module.exports = async function handler(req, res) {
  if (!["GET", "POST", "DELETE"].includes(req.method)) {
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  try {
    const auth = await requireAuthenticatedUser(req, res);
    if (!auth) return;

    if (req.method === "GET") {
      return sendJson(res, 200, { favorites: await favoriteCards(auth.user.id) });
    }

    const centerId = validCenterId(req.body?.centerId);
    if (!centerId) {
      return sendJson(res, 400, { error: "올바른 센터를 선택해 주세요." });
    }

    if (req.method === "DELETE") {
      await supabaseRequest("user_favorites", {
        method: "DELETE",
        query: `?user_id=eq.${encodeURIComponent(auth.user.id)}&center_id=eq.${encodeURIComponent(centerId)}`,
      });
      return sendJson(res, 200, { centerId, saved: false });
    }

    const centers = await supabaseRequest("centers", {
      query: `?select=id&id=eq.${encodeURIComponent(centerId)}&status=eq.approved&limit=1`,
    });
    if (!centers.length) {
      return sendJson(res, 404, { error: "저장할 수 있는 센터를 찾지 못했습니다." });
    }

    const existing = await supabaseRequest("user_favorites", {
      query: `?select=center_id&user_id=eq.${encodeURIComponent(auth.user.id)}&center_id=eq.${encodeURIComponent(centerId)}&limit=1`,
    });
    if (!existing.length) {
      await supabaseRequest("user_favorites", {
        method: "POST",
        body: { user_id: auth.user.id, center_id: centerId },
      });
    }
    return sendJson(res, 200, { centerId, saved: true });
  } catch (error) {
    console.error("favorites api failed", error);
    return sendJson(res, 503, { error: "관심 센터를 처리하지 못했습니다." });
  }
};
