const {
  adminIdentityFromRequest,
  enforceRateLimit,
  recordAuditLog,
  recordErrorLog,
  requireAdminRole,
  sendJson,
  supabaseRequest,
} = require("./_shared");
const { requireAuthenticatedUser } = require("./_platform-auth");

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 20_000) reject(new Error("too large"));
    });
    req.on("end", () => {
      try { resolve(JSON.parse(raw || "{}")); } catch (error) { reject(error); }
    });
    req.on("error", reject);
  });
}

function validIdempotencyKey(value) {
  return /^[0-9a-f-]{36}$/i.test(String(value || "").trim());
}

async function publicReviews(req, res) {
  const centerId = String(req.query.centerId || "");
  const filter = centerId ? `&center_id=eq.${encodeURIComponent(centerId)}` : "";
  const rows = await supabaseRequest("reviews", {
    query: `?select=id,center_id,nickname,rating,content,created_at&status=eq.approved${filter}&order=created_at.desc&limit=100`,
  });
  sendJson(res, 200, { reviews: rows });
}

async function adminReviews(req, res) {
  const rows = await supabaseRequest("reviews", {
    query: "?select=*&order=created_at.desc&limit=200",
  });
  sendJson(res, 200, { reviews: rows });
}

async function moderateReview(req, res) {
  if (!await requireAdminRole(req, res, ["super_admin", "admin", "support"])) return;
  const reviewId = String(req.query.id || "");
  const body = await readBody(req);
  const status = String(body.status || "");
  if (!reviewId || !["approved", "hidden", "rejected"].includes(status)) {
    return sendJson(res, 400, { error: "후기 ID와 처리 상태를 확인해 주세요." });
  }
  await supabaseRequest("reviews", {
    method: "PATCH",
    query: `?id=eq.${encodeURIComponent(reviewId)}`,
    body: { status, updated_at: new Date().toISOString() },
  });
  const admin = adminIdentityFromRequest(req) || {};
  await recordAuditLog(req, {
    actorUserId: admin.userId,
    actorRole: admin.role || "admin",
    action: "review.moderate",
    targetType: "review",
    targetId: reviewId,
    metadata: { status },
  });
  sendJson(res, 200, { ok: true, status });
}

module.exports = async function handler(req, res) {
  try {
    if (req.method === "GET") {
      if (req.query.includeAll === "true" && adminIdentityFromRequest(req)) {
        const admin = await requireAdminRole(req, res, ["super_admin", "admin", "support"]);
        if (!admin) return;
        return adminReviews(req, res);
      }
      return publicReviews(req, res);
    }
    if (req.method === "PATCH") return moderateReview(req, res);
    if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });

    const auth = await requireAuthenticatedUser(req, res);
    if (!auth) return;
    if (!enforceRateLimit(req, res, {
      bucket: "review-write",
      max: 5,
      windowMs: 60 * 60 * 1000,
      identity: auth.user.id,
    })) return;

    const idempotencyKey = String(req.headers["idempotency-key"] || "").trim();
    if (!validIdempotencyKey(idempotencyKey)) {
      return sendJson(res, 400, {
        error: "후기 중복 방지 키가 필요합니다. 화면을 새로고침한 뒤 다시 시도해 주세요.",
      });
    }

    const body = await readBody(req);
    const content = String(body.content || "").trim();
    const rating = Number(body.rating);
    const centerId = String(body.centerId || "");
    if (!centerId || content.length < 10 || content.length > 500 || !Number.isInteger(rating) || rating < 1 || rating > 5) {
      return sendJson(res, 400, { error: "별점과 10자 이상의 후기를 확인해 주세요." });
    }
    const [center, profiles, existing, duplicated] = await Promise.all([
      supabaseRequest("centers", {
        query: `?select=id&id=eq.${encodeURIComponent(centerId)}&status=eq.approved&limit=1`,
      }),
      supabaseRequest("user_profiles", {
        query: `?select=nickname&user_id=eq.${encodeURIComponent(auth.user.id)}&limit=1`,
      }),
      supabaseRequest("reviews", {
        query: `?select=id&center_id=eq.${encodeURIComponent(centerId)}&user_id=eq.${encodeURIComponent(auth.user.id)}&limit=1`,
      }),
      supabaseRequest("reviews", {
        query: `?select=id,status&idempotency_key=eq.${encodeURIComponent(idempotencyKey)}&limit=1`,
      }),
    ]);
    if (!center.length) return sendJson(res, 404, { error: "센터를 찾을 수 없습니다." });
    if (duplicated[0]) return sendJson(res, 200, { ok: true, status: duplicated[0].status, duplicate: true });

    const nickname = String(profiles[0]?.nickname || auth.user.user_metadata?.nickname || "DAIL 이용자")
      .trim()
      .slice(0, 30) || "DAIL 이용자";
    const values = {
      center_id: centerId,
      user_id: auth.user.id,
      nickname,
      rating,
      content,
      status: "pending",
      idempotency_key: idempotencyKey,
      updated_at: new Date().toISOString(),
    };
    let reviewId;
    if (existing[0]) {
      await supabaseRequest("reviews", {
        method: "PATCH",
        query: `?id=eq.${encodeURIComponent(existing[0].id)}`,
        body: values,
      });
      reviewId = existing[0].id;
    } else {
      const rows = await supabaseRequest("reviews", { method: "POST", body: values });
      reviewId = rows[0].id;
    }
    await recordAuditLog(req, {
      actorUserId: auth.user.id,
      actorRole: "user",
      centerId,
      action: existing[0] ? "review.update" : "review.create",
      targetType: "review",
      targetId: reviewId,
    });
    sendJson(res, 202, {
      ok: true,
      status: "pending",
      message: "후기가 접수되었습니다. 운영자 확인 후 공개됩니다.",
    });
  } catch (error) {
    console.error("reviews api failed", error);
    await recordErrorLog(req, error, { errorCode: "reviews_api_failed", statusCode: 500 });
    sendJson(res, 500, { error: "후기를 처리하지 못했습니다." });
  }
};
