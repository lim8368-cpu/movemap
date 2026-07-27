const crypto = require("crypto");

const ADMIN_SESSION_TTL_SECONDS = 15 * 60;
const ADMIN_COOKIE_NAME = "movemap_admin_session";
const rateLimitBuckets = new Map();
const errorAlertCooldowns = new Map();
const sampleCenters = [
  {
    id: "core",
    name: "코어핏 무브센터",
    region: "gangnam",
    area: "서울 강남구",
    distance: "1.2km",
    rating: "4.9",
    reviews: "128",
    lead: "허리 통증 이후 재발 방지 운동과 체형 평가를 함께 진행합니다.",
    tags: ["허리", "수술 후", "필라테스", "1:1 평가"],
    therapist: "김민재 센터장 · 물리치료사 출신",
    price: "첫 평가 30,000원",
    conversion: "전화 상담 가능",
    lat: 37.4979,
    lng: 127.0276,
    fallbackX: "58%",
    fallbackY: "54%",
    plan: "pro",
    photoDataUrl: "",
  },
  {
    id: "reform",
    name: "리폼무브 스튜디오",
    region: "mapo",
    area: "서울 마포구",
    distance: "3.8km",
    rating: "4.8",
    reviews: "94",
    lead: "직장인 목, 어깨 불편감과 자세 습관을 운동 루틴으로 관리합니다.",
    tags: ["어깨", "거북목", "소그룹", "자세 분석"],
    therapist: "박서연 대표 · 물리치료사 출신",
    price: "체험 수업 20,000원",
    conversion: "예약 후 방문",
    lat: 37.5557,
    lng: 126.9236,
    fallbackX: "42%",
    fallbackY: "40%",
    plan: "basic",
    photoDataUrl: "",
  },
  {
    id: "posture",
    name: "포스처랩 분당",
    region: "bundang",
    area: "경기 성남시 분당구",
    distance: "9.6km",
    rating: "4.7",
    reviews: "76",
    lead: "수술 후 일상 복귀와 고령자 근력 회복 프로그램에 강점이 있습니다.",
    tags: ["수술 후", "고령자", "근력", "보행"],
    therapist: "이도윤 원장 · 물리치료사 출신",
    price: "방문 상담 무료",
    conversion: "센터 문의",
    lat: 37.3827,
    lng: 127.1189,
    fallbackX: "73%",
    fallbackY: "68%",
    plan: "free",
    photoDataUrl: "",
  },
  {
    id: "shoulder",
    name: "숄더워크 랩",
    region: "gangnam",
    area: "서울 강남구",
    distance: "2.4km",
    rating: "4.9",
    reviews: "61",
    lead: "골프, 테니스 이용자를 위한 어깨 가동성 및 회전근개 운동을 제공합니다.",
    tags: ["어깨", "골프", "테니스", "가동성"],
    therapist: "최하린 대표 · 물리치료사 출신",
    price: "스포츠 평가 40,000원",
    conversion: "운동 영상 피드백 제공",
    lat: 37.5243,
    lng: 127.0399,
    fallbackX: "64%",
    fallbackY: "34%",
    plan: "basic",
    photoDataUrl: "",
  },
];

function sendJson(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(data));
}

function runtimeEnvironment() {
  return process.env.APP_ENV || "development";
}

function hasSupabaseConfig() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

async function supabaseRequest(table, { method = "GET", query = "", body } = {}) {
  if (!hasSupabaseConfig()) {
    throw new Error("Supabase environment variables are not configured");
  }

  const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/${table}${query}`, {
    method,
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: method === "POST" ? "return=representation" : "return=minimal",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(data?.message || `Supabase request failed (${response.status})`);
  }
  return data;
}

async function supabaseStorageRequest(path, { method = "POST", body, headers = {} } = {}) {
  if (!hasSupabaseConfig()) throw new Error("Supabase environment variables are not configured");
  const response = await fetch(`${process.env.SUPABASE_URL}/storage/v1${path}`, {
    method,
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      ...headers,
    },
    body,
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(data?.message || data?.error || `Storage request failed (${response.status})`);
  return data;
}

function storageBucket() {
  return process.env.SUPABASE_STORAGE_BUCKET || "movemap-private";
}

async function createSignedStorageUrl(objectPath, expiresIn = 900) {
  if (!objectPath) return "";
  const bucket = storageBucket();
  const data = await supabaseStorageRequest(
    `/object/sign/${encodeURIComponent(bucket)}/${objectPath.split("/").map(encodeURIComponent).join("/")}`,
    {
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expiresIn }),
    }
  );
  const signedPath = data?.signedURL || data?.signedUrl;
  if (!signedPath) return "";
  return signedPath.startsWith("http") ? signedPath : `${process.env.SUPABASE_URL}/storage/v1${signedPath}`;
}

function parseScryptHash(encoded) {
  const [algorithm, saltValue, hashValue] = String(encoded || "").split("$");
  if (algorithm !== "scrypt" || !saltValue || !hashValue) return null;
  try {
    return { salt: Buffer.from(saltValue, "base64url"), hash: Buffer.from(hashValue, "base64url") };
  } catch {
    return null;
  }
}

function verifyAdminPassword(password) {
  const stored = parseScryptHash(process.env.ADMIN_PASSWORD_SCRYPT);
  if (!stored || typeof password !== "string") return false;
  const candidate = crypto.scryptSync(password, stored.salt, stored.hash.length);
  return candidate.length === stored.hash.length && crypto.timingSafeEqual(candidate, stored.hash);
}

function signAdminSession(context = {}, now = Date.now()) {
  if (typeof context === "number") {
    now = context;
    context = {};
  }
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) throw new Error("ADMIN_SESSION_SECRET is not configured");
  const payload = Buffer.from(JSON.stringify({
    role: context.role || "super_admin",
    userId: context.userId || null,
    email: context.email || null,
    aal: context.aal || (context.userId ? "aal2" : "legacy"),
    exp: now + ADMIN_SESSION_TTL_SECONDS * 1000,
  })).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function adminSessionData(token, now = Date.now()) {
  const secret = process.env.ADMIN_SESSION_SECRET;
  const [payload, signature] = String(token || "").split(".");
  if (!secret || !payload || !signature) return null;
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  const given = Buffer.from(signature);
  const wanted = Buffer.from(expected);
  if (given.length !== wanted.length || !crypto.timingSafeEqual(given, wanted)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!["super_admin", "admin", "support", "analyst"].includes(data.role) || Number(data.exp) <= now) return null;
    return data;
  } catch {
    return null;
  }
}

function verifyAdminSession(token, now = Date.now()) {
  return Boolean(adminSessionData(token, now));
}

function cookieValue(req, name) {
  const prefix = `${name}=`;
  const item = String(req.headers.cookie || "").split(";").map((part) => part.trim()).find((part) => part.startsWith(prefix));
  return item ? decodeURIComponent(item.slice(prefix.length)) : "";
}

function adminSessionFromRequest(req) {
  const authorization = req.headers.authorization || "";
  const bearer = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  return bearer || cookieValue(req, ADMIN_COOKIE_NAME);
}

function adminIdentityFromRequest(req) {
  return adminSessionData(adminSessionFromRequest(req));
}

function requestUsesHttps(req) {
  const forwardedProto = String(req?.headers?.["x-forwarded-proto"] || "")
    .split(",")[0]
    .trim()
    .toLowerCase();
  return forwardedProto === "https" || Boolean(req?.socket?.encrypted);
}

function clientIp(req) {
  return String(
    req?.headers?.["cf-connecting-ip"] ||
    req?.headers?.["x-forwarded-for"] ||
    req?.socket?.remoteAddress ||
    "unknown"
  ).split(",")[0].trim().slice(0, 128);
}

function privacyHash(value, namespace = "generic") {
  const secret = process.env.LOG_HASH_SECRET || process.env.ADMIN_SESSION_SECRET;
  if (!secret) return "";
  return crypto
    .createHmac("sha256", secret)
    .update(`${namespace}:${String(value || "")}`)
    .digest("base64url");
}

function requestId(req) {
  if (req?.requestId) return req.requestId;
  const incoming = String(req?.headers?.["x-request-id"] || "").trim();
  const value = /^[0-9a-f-]{36}$/i.test(incoming) ? incoming : crypto.randomUUID();
  if (req) req.requestId = value;
  return value;
}

function requestSource(req) {
  const explicit = String(req?.headers?.["x-dail-source"] || "").trim().toLowerCase();
  if (["web", "ios", "android", "admin", "center-dashboard", "register"].includes(explicit)) {
    return explicit;
  }
  const legacyClient = String(req?.headers?.["x-movemap-client"] || "").trim().toLowerCase();
  if (legacyClient === "admin") return "admin";
  const referer = String(req?.headers?.referer || "").toLowerCase();
  if (referer.includes("/admin/")) return "admin";
  if (referer.includes("/center-dashboard/")) return "center-dashboard";
  if (referer.includes("/register/")) return "register";
  const agent = String(req?.headers?.["user-agent"] || "").toLowerCase();
  if (agent.includes("dail-ios")) return "ios";
  if (agent.includes("dail-android")) return "android";
  return "web";
}

function enforceRateLimit(req, res, {
  bucket = "default",
  max = 60,
  windowMs = 60_000,
  identity = "",
} = {}) {
  const now = Date.now();
  const identityValue = identity || privacyHash(clientIp(req), "rate-limit") || clientIp(req);
  const key = `${bucket}:${identityValue}`;
  const current = rateLimitBuckets.get(key);
  const entry = !current || current.resetAt <= now
    ? { count: 0, resetAt: now + windowMs }
    : current;
  entry.count += 1;
  rateLimitBuckets.set(key, entry);

  if (rateLimitBuckets.size > 10_000) {
    for (const [candidate, value] of rateLimitBuckets.entries()) {
      if (value.resetAt <= now) rateLimitBuckets.delete(candidate);
    }
  }

  res.setHeader("RateLimit-Limit", String(max));
  res.setHeader("RateLimit-Remaining", String(Math.max(0, max - entry.count)));
  res.setHeader("RateLimit-Reset", String(Math.ceil(entry.resetAt / 1000)));
  if (entry.count <= max) return true;

  res.setHeader("Retry-After", String(Math.max(1, Math.ceil((entry.resetAt - now) / 1000))));
  sendJson(res, 429, { error: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." });
  return false;
}

function cleanLogText(value, maxLength = 240) {
  return String(value || "")
    .replace(/[\r\n\t]/g, " ")
    .replace(/(bearer|password|token|secret|cookie|authorization)\s*[:=]\s*\S+/gi, "$1=[redacted]")
    .trim()
    .slice(0, maxLength);
}

function safeLogMetadata(metadata) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return {};
  const safe = {};
  for (const [key, rawValue] of Object.entries(metadata).slice(0, 20)) {
    if (/password|token|secret|cookie|authorization|license|phone|email/i.test(key)) continue;
    if (typeof rawValue === "number" || typeof rawValue === "boolean" || rawValue === null) {
      safe[key] = rawValue;
    } else {
      safe[key] = cleanLogText(rawValue, 180);
    }
  }
  return safe;
}

async function recordAuditLog(req, {
  actorUserId = null,
  actorRole = "system",
  centerId = null,
  action,
  targetType,
  targetId = null,
  success = true,
  metadata = {},
} = {}) {
  if (!hasSupabaseConfig() || !action || !targetType) return;
  try {
    await supabaseRequest("audit_logs", {
      method: "POST",
      body: {
        request_id: requestId(req),
        actor_user_id: actorUserId,
        actor_role: cleanLogText(actorRole, 40) || "system",
        center_id: centerId,
        action: cleanLogText(action, 100),
        target_type: cleanLogText(targetType, 80),
        target_id: targetId ? cleanLogText(targetId, 160) : null,
        success: Boolean(success),
        ip_hash: privacyHash(clientIp(req), "audit-ip") || null,
        metadata: safeLogMetadata(metadata),
      },
    });
  } catch (error) {
    console.error("audit log write failed", cleanLogText(error.message));
  }
}

async function recordAccessLog(req, {
  actorUserId = null,
  actorRole = "anonymous",
  centerId = null,
  statusCode = 200,
  durationMs = 0,
} = {}) {
  if (!hasSupabaseConfig()) return;
  try {
    const path = new URL(req.url || "/", "http://localhost").pathname;
    await supabaseRequest("access_logs", {
      method: "POST",
      body: {
        request_id: requestId(req),
        actor_user_id: actorUserId,
        actor_role: cleanLogText(actorRole, 40) || "anonymous",
        center_id: centerId,
        source: requestSource(req),
        method: cleanLogText(req.method || "GET", 12),
        path: cleanLogText(path, 200),
        status_code: Number(statusCode) || 0,
        duration_ms: Math.max(0, Math.round(Number(durationMs) || 0)),
        ip_hash: privacyHash(clientIp(req), "access-ip") || null,
        user_agent: cleanLogText(req.headers?.["user-agent"], 240) || null,
      },
    });
  } catch (error) {
    console.error("access log write failed", cleanLogText(error.message));
  }
}

async function emitAlertWebhook(payload) {
  const url = String(process.env.ALERT_WEBHOOK_URL || "").trim();
  if (!url) return;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") throw new Error("ALERT_WEBHOOK_URL must use HTTPS");
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    });
  } catch (error) {
    console.error("alert webhook failed", cleanLogText(error.message));
  }
}

async function recordOperationalAlert({
  alertType,
  severity = "warning",
  message,
  metricValue = null,
  thresholdValue = null,
  metadata = {},
} = {}) {
  if (!hasSupabaseConfig() || !alertType || !message) return;
  const body = {
    alert_type: alertType,
    severity,
    message: cleanLogText(message, 500),
    metric_value: Number.isFinite(metricValue) ? metricValue : null,
    threshold_value: Number.isFinite(thresholdValue) ? thresholdValue : null,
    metadata: safeLogMetadata(metadata),
  };
  try {
    await supabaseRequest("operational_alerts", { method: "POST", body });
    await emitAlertWebhook({ service: "DAIL", environment: runtimeEnvironment(), ...body });
  } catch (error) {
    console.error("operational alert write failed", cleanLogText(error.message));
  }
}

async function recordErrorLog(req, error, {
  errorCode = "unhandled_error",
  statusCode = 500,
  source = "api",
  metadata = {},
} = {}) {
  const message = cleanLogText(error?.message || error || "Unknown error", 500);
  const path = req ? new URL(req.url || "/", "http://localhost").pathname : null;
  const fingerprint = crypto
    .createHash("sha256")
    .update(`${source}:${errorCode}:${path || ""}:${message}`)
    .digest("base64url")
    .slice(0, 32);
  if (hasSupabaseConfig()) {
    try {
      await supabaseRequest("error_logs", {
        method: "POST",
        body: {
          request_id: req ? requestId(req) : null,
          source: cleanLogText(source, 60),
          error_code: cleanLogText(errorCode, 100),
          message,
          path,
          status_code: Number(statusCode) || null,
          fingerprint,
          metadata: safeLogMetadata(metadata),
        },
      });
    } catch (writeError) {
      console.error("error log write failed", cleanLogText(writeError.message));
    }
  }
  if (Number(statusCode) >= 500) {
    const now = Date.now();
    if ((errorAlertCooldowns.get(fingerprint) || 0) <= now) {
      errorAlertCooldowns.set(fingerprint, now + 15 * 60 * 1000);
      if (errorAlertCooldowns.size > 5_000) {
        for (const [key, expiresAt] of errorAlertCooldowns.entries()) {
          if (expiresAt <= now) errorAlertCooldowns.delete(key);
        }
      }
      await recordOperationalAlert({
        alertType: "error_rate",
        severity: "warning",
        message: `${errorCode}: ${message}`,
        metadata: { path, fingerprint },
      });
    }
  }
}

function adminSessionCookie(token, req) {
  const secure = requestUsesHttps(req) ? "; Secure" : "";
  return `${ADMIN_COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly${secure}; SameSite=Strict; Path=/; Max-Age=${ADMIN_SESSION_TTL_SECONDS}`;
}

function clearAdminSessionCookie(req) {
  const secure = requestUsesHttps(req) ? "; Secure" : "";
  return `${ADMIN_COOKIE_NAME}=; HttpOnly${secure}; SameSite=Strict; Path=/; Max-Age=0`;
}

function centerFromRow(row, photoUrl = "", photoUrls = []) {
  const { normalizeSchedule, scheduleSummary } = require("./_booking");
  const openingSchedule = normalizeSchedule(row.opening_schedule);
  return {
    id: row.id,
    name: row.name,
    region: row.region,
    area: row.area,
    address: row.address,
    naverMapUrl: row.naver_map_url,
    phone: row.phone || "",
    website: row.website || "",
    openingHours: row.opening_hours || scheduleSummary(openingSchedule),
    openingSchedule,
    bookingSlotMinutes: Number(row.booking_slot_minutes || 60),
    bookingEnabled: row.booking_enabled !== false,
    distance: "신규",
    rating: row.rating || "신규",
    reviews: row.reviews || "0",
    lead: row.lead,
    tags: row.tags || [],
    categories: row.categories || [],
    therapist: String(row.therapist || "").replace(/물리치료사(?!\s*출신)/g, "물리치료사 출신"),
    managerCareer: row.manager_career || "",
    price: row.price,
    conversion: row.conversion,
    lat: row.lat,
    lng: row.lng,
    plan: row.plan,
    photoUrl,
    photoUrls,
  };
}

function isAdminRequest(req) {
  return verifyAdminSession(adminSessionFromRequest(req));
}

async function requireAdminRole(req, res, roles = ["super_admin", "admin"]) {
  let identity = adminIdentityFromRequest(req);
  if (!identity) {
    sendJson(res, 401, { error: "Unauthorized" });
    return null;
  }
  if (!identity.userId && process.env.ALLOW_LEGACY_ADMIN_LOGIN === "false") {
    sendJson(res, 403, { error: "레거시 관리자 세션이 종료되었습니다. 이메일과 MFA로 다시 로그인해 주세요." });
    return null;
  }
  if (identity.userId && hasSupabaseConfig()) {
    const rows = await supabaseRequest("platform_user_roles", {
      query: `?select=role,status,mfa_required&user_id=eq.${encodeURIComponent(identity.userId)}&status=eq.active&limit=1`,
    });
    const current = rows[0];
    if (!current) {
      sendJson(res, 403, { error: "관리자 권한이 회수되었거나 중지되었습니다." });
      return null;
    }
    if (current.mfa_required !== false && identity.aal !== "aal2") {
      sendJson(res, 403, { error: "관리자 작업에는 MFA 인증이 필요합니다." });
      return null;
    }
    identity = { ...identity, role: current.role };
  }
  if (!roles.includes(identity.role)) {
    sendJson(res, 403, { error: "이 작업을 수행할 관리자 권한이 없습니다." });
    return null;
  }
  req.authContext = {
    actorUserId: identity.userId,
    actorRole: identity.role,
    centerId: null,
  };
  return identity;
}

module.exports = {
  sampleCenters,
  sendJson,
  hasSupabaseConfig,
  supabaseRequest,
  centerFromRow,
  cleanLogText,
  clientIp,
  createSignedStorageUrl,
  clearAdminSessionCookie,
  adminSessionCookie,
  adminIdentityFromRequest,
  adminSessionData,
  ADMIN_SESSION_TTL_SECONDS,
  emitAlertWebhook,
  enforceRateLimit,
  isAdminRequest,
  privacyHash,
  recordAccessLog,
  recordAuditLog,
  recordErrorLog,
  recordOperationalAlert,
  requestId,
  requestSource,
  runtimeEnvironment,
  requestUsesHttps,
  requireAdminRole,
  signAdminSession,
  storageBucket,
  supabaseStorageRequest,
  verifyAdminPassword,
  verifyAdminSession,
};
