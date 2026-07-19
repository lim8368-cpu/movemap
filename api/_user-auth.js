const crypto = require("crypto");
const { requestUsesHttps, supabaseRequest } = require("./_shared");

const STATE_COOKIE = "dail_oauth_state";

function authSupabaseUrl() {
  return process.env.AUTH_SUPABASE_URL || process.env.SUPABASE_URL || "";
}

function authSupabaseAnonKey() {
  return process.env.AUTH_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";
}

function authSupabaseServiceRoleKey() {
  return process.env.AUTH_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
}

function publicAuthConfig() {
  const supabaseUrl = authSupabaseUrl();
  const supabaseAnonKey = authSupabaseAnonKey();
  return {
    supabaseUrl,
    supabaseAnonKey,
    providers: {
      kakao: Boolean(supabaseUrl && supabaseAnonKey && process.env.KAKAO_AUTH_ENABLED === "true"),
      apple: Boolean(supabaseUrl && supabaseAnonKey && process.env.APPLE_AUTH_ENABLED === "true"),
      naver: Boolean(process.env.NAVER_LOGIN_CLIENT_ID && process.env.NAVER_LOGIN_CLIENT_SECRET),
    },
  };
}

function safeOrigin(req) {
  const configuredOrigin = String(process.env.PUBLIC_APP_ORIGIN || "").trim();
  if (configuredOrigin) {
    const url = new URL(configuredOrigin);
    if (!/^https?:$/.test(url.protocol) || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
      throw new Error("Invalid PUBLIC_APP_ORIGIN");
    }
    return url.origin;
  }
  const proto = String(req.headers["x-forwarded-proto"] || (req.socket?.encrypted ? "https" : "http")).split(",")[0];
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "").split(",")[0];
  if (!host || /[\r\n]/.test(host)) throw new Error("Invalid host");
  return `${proto}://${host}`;
}

function stateSecret() {
  const secret = process.env.USER_AUTH_STATE_SECRET || process.env.ADMIN_SESSION_SECRET;
  if (!secret) throw new Error("USER_AUTH_STATE_SECRET is not configured");
  return secret;
}

function createOAuthState(now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({ nonce: crypto.randomBytes(18).toString("base64url"), exp: now + 10 * 60 * 1000 })).toString("base64url");
  const signature = crypto.createHmac("sha256", stateSecret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function verifyOAuthState(value, now = Date.now()) {
  const [payload, signature] = String(value || "").split(".");
  if (!payload || !signature) return false;
  const expected = crypto.createHmac("sha256", stateSecret()).update(payload).digest("base64url");
  const a = Buffer.from(signature); const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  try { return Number(JSON.parse(Buffer.from(payload, "base64url").toString("utf8")).exp) > now; } catch { return false; }
}

function cookie(req, value, maxAge = 600) {
  const secure = requestUsesHttps(req) ? "; Secure" : "";
  return `${STATE_COOKIE}=${encodeURIComponent(value)}; HttpOnly${secure}; SameSite=Lax; Path=/api/auth/naver; Max-Age=${maxAge}`;
}

function cookieValue(req) {
  const part = String(req.headers.cookie || "").split(";").map((v) => v.trim()).find((v) => v.startsWith(`${STATE_COOKIE}=`));
  return part ? decodeURIComponent(part.slice(STATE_COOKIE.length + 1)) : "";
}

async function userFromAccessToken(token) {
  const supabaseUrl = authSupabaseUrl();
  const supabaseAnonKey = authSupabaseAnonKey();
  if (!token || !supabaseUrl || !supabaseAnonKey) return null;
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { apikey: supabaseAnonKey, Authorization: `Bearer ${token}` } });
  if (!response.ok) {
    console.warn("Supabase user token verification failed", response.status);
    return null;
  }
  return response.json();
}

async function syncUserProfile(user, input = {}) {
  const metadata = user.user_metadata || {};
  const provider = user.app_metadata?.provider || metadata.provider || "unknown";
  const nickname = String(input.nickname ?? metadata.full_name ?? metadata.name ?? metadata.user_name ?? metadata.nickname ?? "").trim().slice(0, 40);
  const existing = await supabaseRequest("user_profiles", { query: `?select=*&user_id=eq.${encodeURIComponent(user.id)}&limit=1` });
  const now = new Date().toISOString();
  const body = {
    user_id: user.id,
    email: user.email || null,
    nickname,
    avatar_url: metadata.avatar_url || metadata.picture || null,
    provider,
    updated_at: now,
  };
  if (input.acceptRequired === true) {
    body.terms_agreed_at = existing[0]?.terms_agreed_at || now;
    body.privacy_agreed_at = existing[0]?.privacy_agreed_at || now;
  }
  if (input.marketingAgreed === true) body.marketing_agreed_at = existing[0]?.marketing_agreed_at || now;
  if (input.marketingAgreed === false) body.marketing_agreed_at = null;
  if (existing.length) await supabaseRequest("user_profiles", { method: "PATCH", query: `?user_id=eq.${encodeURIComponent(user.id)}`, body });
  else await supabaseRequest("user_profiles", { method: "POST", body });
  return { ...existing[0], ...body };
}

module.exports = { authSupabaseServiceRoleKey, authSupabaseUrl, cookie, cookieValue, createOAuthState, publicAuthConfig, safeOrigin, syncUserProfile, userFromAccessToken, verifyOAuthState };
