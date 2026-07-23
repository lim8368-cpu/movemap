const crypto = require("crypto");
const {
  enforceRateLimit,
  hasSupabaseConfig,
  privacyHash,
  recordErrorLog,
  requestSource,
  requestUsesHttps,
  sendJson,
  supabaseRequest,
} = require("./_shared");
const { authenticatedUser } = require("./_platform-auth");

const SESSION_COOKIE = "dail_analytics_session";
const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;
const EVENT_TYPES = new Map([
  ["center_view", "view"],
  ["view", "view"],
  ["contact_click", "contact"],
  ["contact", "contact"],
]);
const ALLOWED_DETAILS = new Set(["map_popup", "select_center", "center_card", "detail_page", ""]);

function analyticsSecret() {
  const secret = process.env.ANALYTICS_SESSION_SECRET || process.env.ADMIN_SESSION_SECRET;
  if (!secret) throw new Error("ANALYTICS_SESSION_SECRET is not configured");
  return secret;
}

function cookieValue(req, name) {
  const prefix = `${name}=`;
  const part = String(req.headers.cookie || "")
    .split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith(prefix));
  return part ? decodeURIComponent(part.slice(prefix.length)) : "";
}

function signSession(sessionId) {
  const signature = crypto.createHmac("sha256", analyticsSecret()).update(sessionId).digest("base64url");
  return `${sessionId}.${signature}`;
}

function verifiedSession(req) {
  const [sessionId, signature] = cookieValue(req, SESSION_COOKIE).split(".");
  if (!sessionId || !signature || !/^[A-Za-z0-9_-]{24,80}$/.test(sessionId)) return "";
  const expected = crypto.createHmac("sha256", analyticsSecret()).update(sessionId).digest("base64url");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b) ? sessionId : "";
}

function analyticsCookie(req, token) {
  const secure = requestUsesHttps(req) ? "; Secure" : "";
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly${secure}; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL_SECONDS}`;
}

function validIdempotencyKey(value) {
  return /^[0-9a-f-]{36}$/i.test(String(value || "").trim());
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const eventType = EVENT_TYPES.get(String(body.type || ""));
    const centerId = String(body.centerId || "");
    const detail = ALLOWED_DETAILS.has(String(body.detail || "")) ? String(body.detail || "") : "";
    const idempotencyKey = String(req.headers["idempotency-key"] || "").trim();
    if (!eventType || !centerId || !validIdempotencyKey(idempotencyKey)) {
      return sendJson(res, 400, { error: "올바르지 않은 이용 기록 요청입니다." });
    }
    if (!hasSupabaseConfig()) return sendJson(res, 201, { ok: true, source: "fallback" });

    let sessionId = verifiedSession(req);
    if (!sessionId) {
      sessionId = crypto.randomBytes(24).toString("base64url");
      res.setHeader("Set-Cookie", analyticsCookie(req, signSession(sessionId)));
    }
    const sessionHash = privacyHash(sessionId, "analytics-session");
    if (!enforceRateLimit(req, res, {
      bucket: "events",
      max: 60,
      windowMs: 10 * 60 * 1000,
      identity: sessionHash,
    })) return;

    const [center, duplicated, auth] = await Promise.all([
      supabaseRequest("centers", {
        query: `?select=id&id=eq.${encodeURIComponent(centerId)}&status=eq.approved&limit=1`,
      }),
      supabaseRequest("events", {
        query: `?select=id&idempotency_key=eq.${encodeURIComponent(idempotencyKey)}&limit=1`,
      }),
      authenticatedUser(req).catch(() => null),
    ]);
    if (!center.length) return sendJson(res, 404, { error: "센터를 찾을 수 없습니다." });
    if (duplicated[0]) return sendJson(res, 200, { ok: true, duplicate: true });

    const dedupeMinutes = eventType === "view" ? 30 : 5;
    const since = new Date(Date.now() - dedupeMinutes * 60 * 1000).toISOString();
    const recent = await supabaseRequest("events", {
      query: `?select=id&center_id=eq.${encodeURIComponent(centerId)}&event_type=eq.${eventType}&session_hash=eq.${encodeURIComponent(sessionHash)}&created_at=gte.${encodeURIComponent(since)}&limit=1`,
    });
    if (recent[0]) return sendJson(res, 200, { ok: true, deduplicated: true });

    const rows = await supabaseRequest("events", {
      method: "POST",
      body: {
        event_type: eventType,
        center_id: centerId,
        detail,
        source: requestSource(req),
        actor_user_id: auth?.user?.id || null,
        session_hash: sessionHash,
        idempotency_key: idempotencyKey,
      },
    });
    sendJson(res, 201, { ok: true, eventId: rows?.[0]?.id || null });
  } catch (error) {
    console.error("events api failed", error);
    await recordErrorLog(req, error, { errorCode: "events_api_failed", statusCode: 500 });
    sendJson(res, 500, { error: "이용 기록을 저장하지 못했습니다." });
  }
};
