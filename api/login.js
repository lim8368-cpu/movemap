const crypto = require("crypto");
const {
  ADMIN_SESSION_TTL_SECONDS,
  adminSessionCookie,
  hasSupabaseConfig,
  sendJson,
  signAdminSession,
  supabaseRequest,
  verifyAdminPassword,
} = require("./_shared");

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_LOGIN_FAILURES = 5;

function loginKey(req) {
  const ip = String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown")
    .split(",")[0]
    .trim();
  return crypto.createHash("sha256").update(`movemap-admin:${ip}`).digest("hex");
}

async function readLoginAttempt(key) {
  if (!hasSupabaseConfig()) return null;
  const rows = await supabaseRequest("admin_login_attempts", {
    query: `?select=*&key_hash=eq.${key}&limit=1`,
  });
  return rows[0] || null;
}

async function recordLoginFailure(key, current) {
  if (!hasSupabaseConfig()) return;
  const now = Date.now();
  const windowStartedAt = current ? new Date(current.window_started_at).getTime() : 0;
  const resetWindow = !current || now - windowStartedAt > LOGIN_WINDOW_MS;
  const failedCount = resetWindow ? 1 : Number(current.failed_count || 0) + 1;
  const body = {
    failed_count: failedCount,
    window_started_at: resetWindow ? new Date(now).toISOString() : current.window_started_at,
    locked_until: failedCount >= MAX_LOGIN_FAILURES ? new Date(now + LOGIN_WINDOW_MS).toISOString() : null,
  };

  if (!current) {
    await supabaseRequest("admin_login_attempts", {
      method: "POST",
      body: { key_hash: key, ...body },
    });
  } else {
    await supabaseRequest("admin_login_attempts", {
      method: "PATCH",
      query: `?key_hash=eq.${key}`,
      body,
    });
  }
}

async function clearLoginFailures(key) {
  if (!hasSupabaseConfig()) return;
  await supabaseRequest("admin_login_attempts", {
    method: "DELETE",
    query: `?key_hash=eq.${key}`,
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const key = loginKey(req);
    const attempt = await readLoginAttempt(key);

    if (attempt?.locked_until && new Date(attempt.locked_until).getTime() > Date.now()) {
      res.setHeader("Retry-After", "900");
      return sendJson(res, 429, {
        error: "로그인 시도가 너무 많습니다. 15분 후 다시 시도해 주세요.",
      });
    }

    if (!verifyAdminPassword(body.password)) {
      await recordLoginFailure(key, attempt);
      return sendJson(res, 401, { error: "관리자 비밀번호가 올바르지 않습니다." });
    }

    await clearLoginFailures(key);
    const token = signAdminSession();
    res.setHeader("Set-Cookie", adminSessionCookie(token));
    sendJson(res, 200, { ok: true, expiresInSeconds: ADMIN_SESSION_TTL_SECONDS });
  } catch (error) {
    console.error("admin login failed", error);
    sendJson(res, 503, { error: "관리자 로그인 설정을 확인해 주세요." });
  }
};
