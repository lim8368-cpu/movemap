const {
  centerFromRow,
  createSignedStorageUrl,
  recordAuditLog,
  recordErrorLog,
  sendJson,
  supabaseRequest,
} = require("./_shared");
const { requireOwnerAccess } = require("./_platform-auth");
const { normalizeSchedule, scheduleSummary } = require("./_booking");

const EDITABLE_FIELDS = [
  "name",
  "area",
  "address",
  "naver_map_url",
  "lead",
  "tags",
  "categories",
  "therapist",
  "manager_career",
  "price",
  "phone",
  "website",
  "opening_schedule",
  "booking_slot_minutes",
  "booking_enabled",
];
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
    center: {
      ...centerFromRow(row, photoUrls[0] || "", photoUrls),
      phone: row.phone || "",
      website: row.website || "",
      status: row.status,
      updatedAt: row.updated_at,
      photoItems: paths.map((path, index) => ({ path, url: photoUrls[index] || "" })),
    },
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

async function availableCenters(access) {
  const memberships = access.memberships || [];
  if (!memberships.length) {
    const rows = await supabaseRequest("centers", {
      query: `?select=id,name,status&id=eq.${encodeURIComponent(access.centerId)}&limit=1`,
    });
    return rows.map((center) => ({ ...center, role: access.role }));
  }
  const centers = await Promise.all(memberships.map(async (membership) => {
    const rows = await supabaseRequest("centers", {
      query: `?select=id,name,status&id=eq.${encodeURIComponent(membership.center_id)}&limit=1`,
    });
    return rows[0] ? { ...rows[0], role: membership.role } : null;
  }));
  return centers.filter(Boolean);
}

module.exports = async function handler(req, res) {
  try {
    const requestedCenterId = String(req.query?.centerId || req.body?.centerId || "");
    const access = await requireOwnerAccess(req, res, {
      centerId: requestedCenterId,
      action: req.method === "PATCH" ? "edit_center" : "read",
    });
    if (!access) return;
    if (req.method === "GET") {
      const [data, centers] = await Promise.all([
        centerData(access.centerId),
        availableCenters(access),
      ]);
      if (!data) return sendJson(res, 404, { error: "연결된 센터를 찾을 수 없습니다." });
      return sendJson(res, 200, {
        ...data,
        account: {
          email: access.email,
          userId: access.userId,
          role: access.role,
          legacy: access.legacy,
        },
        availableCenters: centers,
      });
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
      } else if (field === "opening_schedule") {
        patch.opening_schedule = normalizeSchedule(body.opening_schedule);
        patch.opening_hours = scheduleSummary(patch.opening_schedule);
      } else if (field === "booking_slot_minutes") {
        const duration = Number(body.booking_slot_minutes);
        if (![30, 60, 90, 120].includes(duration)) {
          return sendJson(res, 400, { error: "예약 단위는 30분, 60분, 90분, 120분 중에서 선택해 주세요." });
        }
        patch.booking_slot_minutes = duration;
      } else if (field === "booking_enabled") {
        patch.booking_enabled = body.booking_enabled === true || body.booking_enabled === "true" || body.booking_enabled === "on";
      } else {
        const limit = field === "lead" ? 800 : field === "manager_career" ? 2000 : 200;
        patch[field] = cleanText(body[field], limit);
        if (field === "therapist") {
          patch[field] = patch[field].replace(/물리치료사(?!\s*출신)/g, "물리치료사 출신");
        }
      }
    }
    if (!Object.keys(patch).length) return sendJson(res, 400, { error: "수정할 정보가 없습니다." });
    patch.updated_at = new Date().toISOString();
    await supabaseRequest("centers", { method: "PATCH", query: `?id=eq.${encodeURIComponent(access.centerId)}`, body: patch });
    await recordAuditLog(req, {
      actorUserId: access.userId,
      actorRole: access.role,
      centerId: access.centerId,
      action: "center.update",
      targetType: "center",
      targetId: access.centerId,
      metadata: { fields: Object.keys(patch).filter((key) => key !== "updated_at").join(",") },
    });
    sendJson(res, 200, {
      ok: true,
      ...(await centerData(access.centerId)),
      availableCenters: await availableCenters(access),
    });
  } catch (error) {
    console.error("owner dashboard api failed", error);
    await recordErrorLog(req, error, { errorCode: "owner_dashboard_failed", statusCode: 500 });
    sendJson(res, 500, { error: "센터 정보를 처리하지 못했습니다." });
  }
};
