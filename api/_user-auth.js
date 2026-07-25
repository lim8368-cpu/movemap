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

async function authRequest(path, {
  method = "GET",
  accessToken = "",
  useServiceRole = false,
  body,
} = {}) {
  const supabaseUrl = authSupabaseUrl();
  const apiKey = useServiceRole ? authSupabaseServiceRoleKey() : authSupabaseAnonKey();
  if (!supabaseUrl || !apiKey) throw new Error("Supabase Auth is not configured");
  const authorization = accessToken || (useServiceRole ? apiKey : "");
  const response = await fetch(`${supabaseUrl}/auth/v1${path}`, {
    method,
    headers: {
      apikey: apiKey,
      ...(authorization ? { Authorization: `Bearer ${authorization}` } : {}),
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const error = new Error(data?.msg || data?.message || data?.error_description || data?.error || `Auth request failed (${response.status})`);
    error.statusCode = response.status;
    error.authData = data;
    throw error;
  }
  return data;
}

async function signInWithPassword(email, password) {
  return authRequest("/token?grant_type=password", {
    method: "POST",
    body: { email: String(email || "").trim().toLowerCase(), password },
  });
}

async function signUpWithPassword(email, password, metadata = {}) {
  return authRequest("/signup", {
    method: "POST",
    body: {
      email: String(email || "").trim().toLowerCase(),
      password,
      data: metadata,
    },
  });
}

async function findAuthUserByEmail(email) {
  const normalized = String(email || "").trim().toLowerCase();
  if (!normalized) return null;
  const perPage = 1000;
  for (let page = 1; page <= 100; page += 1) {
    const data = await authRequest(`/admin/users?page=${page}&per_page=${perPage}`, {
      useServiceRole: true,
    });
    const users = Array.isArray(data?.users) ? data.users : Array.isArray(data) ? data : [];
    const match = users.find((user) => String(user.email || "").toLowerCase() === normalized);
    if (match) return match;
    if (users.length < perPage) return null;
  }
  throw new Error("Supabase Auth user lookup exceeded 100,000 users");
}

async function createAuthUser({ email, password, metadata = {} }) {
  return authRequest("/admin/users", {
    method: "POST",
    useServiceRole: true,
    body: {
      email: String(email || "").trim().toLowerCase(),
      password,
      email_confirm: true,
      user_metadata: metadata,
    },
  });
}

async function updateAuthUser(userId, attributes) {
  return authRequest(`/admin/users/${encodeURIComponent(userId)}`, {
    method: "PUT",
    useServiceRole: true,
    body: attributes,
  });
}

async function inviteAuthUser({ email, redirectTo, metadata = {} }) {
  return authRequest("/invite", {
    method: "POST",
    useServiceRole: true,
    body: {
      email: String(email || "").trim().toLowerCase(),
      data: metadata,
      ...(redirectTo ? { redirect_to: redirectTo } : {}),
    },
  });
}

async function ensureAuthUser({ email, password, metadata = {} }) {
  const existing = await findAuthUserByEmail(email);
  if (existing) return { user: existing, created: false };
  const created = await createAuthUser({ email, password, metadata });
  return { user: created?.user || created, created: true };
}

function accessTokenFromRequest(req) {
  const authorization = String(req?.headers?.authorization || "");
  return authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
}

function jwtClaims(token) {
  try {
    const payload = String(token || "").split(".")[1];
    return payload ? JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) : {};
  } catch {
    return {};
  }
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

async function claimLegacyAuthIdentity(userId, confirmedEmail) {
  const legacyProfiles = await supabaseRequest("user_profiles", {
    query: `?select=*&email=eq.${encodeURIComponent(confirmedEmail)}&user_id=neq.${encodeURIComponent(userId)}&limit=2`,
  });
  if (legacyProfiles.length !== 1) return [];

  const legacyUserId = legacyProfiles[0].user_id;
  const references = [
    ["reviews", "user_id"],
    ["events", "actor_user_id"],
    ["center_memberships", "user_id"],
    ["center_memberships", "invited_by_user_id"],
    ["center_memberships", "revoked_by_user_id"],
    ["center_invitations", "invited_by_user_id"],
    ["center_invitations", "accepted_by_user_id"],
    ["center_owner_accounts", "auth_user_id"],
    ["center_applications", "applicant_auth_user_id"],
    ["platform_user_roles", "user_id"],
    ["platform_user_roles", "created_by_user_id"],
    ["access_logs", "actor_user_id"],
    ["audit_logs", "actor_user_id"],
    ["operational_alerts", "acknowledged_by_user_id"],
  ];
  for (const [table, column] of references) {
    await supabaseRequest(table, {
      method: "PATCH",
      query: `?${column}=eq.${encodeURIComponent(legacyUserId)}`,
      body: { [column]: userId },
    });
  }
  await supabaseRequest("user_profiles", {
    method: "PATCH",
    query: `?user_id=eq.${encodeURIComponent(legacyUserId)}&email=eq.${encodeURIComponent(confirmedEmail)}`,
    body: {
      user_id: userId,
      updated_at: new Date().toISOString(),
    },
  });
  return [{ ...legacyProfiles[0], user_id: userId }];
}

async function syncUserProfile(user, input = {}) {
  const metadata = user.user_metadata || {};
  const provider = user.app_metadata?.provider || metadata.provider || "unknown";
  const nickname = String(input.nickname ?? metadata.full_name ?? metadata.name ?? metadata.user_name ?? metadata.nickname ?? "").trim().slice(0, 40);
  let existing = await supabaseRequest("user_profiles", { query: `?select=*&user_id=eq.${encodeURIComponent(user.id)}&limit=1` });
  const confirmedEmail = user.email && (user.email_confirmed_at || user.confirmed_at)
    ? String(user.email).trim().toLowerCase()
    : "";
  if (!existing.length && confirmedEmail) {
    try {
      existing = await claimLegacyAuthIdentity(user.id, confirmedEmail);
    } catch (error) {
      console.warn("Legacy auth identity claim was skipped", error.message);
    }
  }
  const now = new Date().toISOString();
  const body = {
    user_id: user.id,
    email: user.email || existing[0]?.email || null,
    nickname: nickname || existing[0]?.nickname || "",
    avatar_url: metadata.avatar_url || metadata.picture || existing[0]?.avatar_url || null,
    provider: provider === "unknown" ? (existing[0]?.provider || provider) : provider,
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

module.exports = {
  accessTokenFromRequest,
  authRequest,
  authSupabaseServiceRoleKey,
  authSupabaseUrl,
  cookie,
  cookieValue,
  createAuthUser,
  createOAuthState,
  ensureAuthUser,
  findAuthUserByEmail,
  inviteAuthUser,
  jwtClaims,
  publicAuthConfig,
  safeOrigin,
  signInWithPassword,
  signUpWithPassword,
  syncUserProfile,
  updateAuthUser,
  userFromAccessToken,
  verifyOAuthState,
};
