const crypto = require("crypto");
const {
  ADMIN_SESSION_TTL_SECONDS,
  adminSessionCookie,
  enforceRateLimit,
  hasSupabaseConfig,
  recordAuditLog,
  recordErrorLog,
  sendJson,
  signAdminSession,
  supabaseRequest,
  verifyAdminPassword,
} = require("./_shared");
const { platformRoleForUser } = require("./_platform-auth");
const {
  authRequest,
  createAuthUser,
  findAuthUserByEmail,
  jwtClaims,
  signInWithPassword,
  updateAuthUser,
} = require("./_user-auth");

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

async function ensureBootstrapAdmin(email, password) {
  const bootstrapEmail = String(process.env.SUPER_ADMIN_EMAIL || "").trim().toLowerCase();
  if (!bootstrapEmail || email !== bootstrapEmail || !verifyAdminPassword(password)) return null;
  let user = await findAuthUserByEmail(email);
  if (!user) {
    const created = await createAuthUser({
      email,
      password,
      metadata: { account_type: "platform_admin" },
    });
    user = created.user || created;
  } else {
    await updateAuthUser(user.id, {
      password,
      email_confirm: true,
      user_metadata: {
        ...(user.user_metadata || {}),
        account_type: "platform_admin",
      },
    });
  }
  const existingRole = await platformRoleForUser(user.id);
  if (!existingRole) {
    await supabaseRequest("platform_user_roles", {
      method: "POST",
      body: {
        user_id: user.id,
        email,
        role: "super_admin",
        status: "active",
        mfa_required: true,
      },
    });
  }
  return signInWithPassword(email, password);
}

async function supabaseAdminLogin(email, password) {
  let authSession;
  try {
    authSession = await signInWithPassword(email, password);
  } catch {
    authSession = await ensureBootstrapAdmin(email, password);
  }
  if (!authSession?.user) return null;
  const platformRole = await platformRoleForUser(authSession.user.id);
  if (!platformRole) return null;
  const claims = jwtClaims(authSession.access_token);
  if (platformRole.mfa_required !== false && claims.aal !== "aal2") {
    const factors = await authRequest("/factors", {
      accessToken: authSession.access_token,
    }).catch(() => ({ all: [], totp: [] }));
    return {
      mfaRequired: true,
      authSession,
      platformRole,
      factors,
    };
  }
  return { authSession, platformRole, claims };
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });
  if (!enforceRateLimit(req, res, { bucket: "admin-login", max: 10, windowMs: LOGIN_WINDOW_MS })) return;

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const key = loginKey(req);
    const attempt = await readLoginAttempt(key);
    if (attempt?.locked_until && new Date(attempt.locked_until).getTime() > Date.now()) {
      res.setHeader("Retry-After", "900");
      return sendJson(res, 429, { error: "로그인 시도가 너무 많습니다. 15분 후 다시 시도해 주세요." });
    }

    if (email && hasSupabaseConfig()) {
      const result = await supabaseAdminLogin(email, password);
      if (result?.mfaRequired) {
        return sendJson(res, 403, {
          error: "관리자 계정은 2단계 인증이 필요합니다.",
          code: "mfa_required",
          mfa: {
            accessToken: result.authSession.access_token,
            refreshToken: result.authSession.refresh_token,
            factors: result.factors,
          },
        });
      }
      if (result?.authSession?.user && result.platformRole) {
        await clearLoginFailures(key);
        const token = signAdminSession({
          role: result.platformRole.role,
          userId: result.authSession.user.id,
          email,
          aal: result.claims.aal,
        });
        res.setHeader("Set-Cookie", adminSessionCookie(token, req));
        await recordAuditLog(req, {
          actorUserId: result.authSession.user.id,
          actorRole: result.platformRole.role,
          action: "platform_admin.login",
          targetType: "session",
        });
        return sendJson(res, 200, {
          ok: true,
          role: result.platformRole.role,
          expiresInSeconds: ADMIN_SESSION_TTL_SECONDS,
        });
      }
    }

    const allowLegacy = process.env.ALLOW_LEGACY_ADMIN_LOGIN !== "false";
    const legacyAdminEmail = String(process.env.SUPER_ADMIN_EMAIL || "").trim().toLowerCase();
    const isLocalBootstrapEmail = !hasSupabaseConfig() && Boolean(email) && email === legacyAdminEmail;
    if (allowLegacy && (!email || isLocalBootstrapEmail) && verifyAdminPassword(password)) {
      await clearLoginFailures(key);
      const token = signAdminSession({
        role: "super_admin",
        email: email || undefined,
        authMode: isLocalBootstrapEmail ? "local_bootstrap" : "legacy",
      });
      res.setHeader("Set-Cookie", adminSessionCookie(token, req));
      await recordAuditLog(req, {
        actorRole: "super_admin",
        action: "platform_admin.legacy_login",
        targetType: "session",
        metadata: {
          migrationRequired: true,
          authMode: isLocalBootstrapEmail ? "local_bootstrap" : "legacy",
        },
      });
      return sendJson(res, 200, {
        ok: true,
        legacyAuth: true,
        expiresInSeconds: ADMIN_SESSION_TTL_SECONDS,
      });
    }

    await recordLoginFailure(key, attempt);
    await recordAuditLog(req, {
      actorRole: "platform_admin",
      action: "platform_admin.login",
      targetType: "session",
      success: false,
      metadata: { reason: "invalid_credentials_or_role" },
    });
    return sendJson(res, 401, { error: "관리자 이메일, 비밀번호 또는 권한이 올바르지 않습니다." });
  } catch (error) {
    console.error("admin login failed", error);
    await recordErrorLog(req, error, { errorCode: "admin_login_failed", statusCode: 503 });
    sendJson(res, 503, { error: "관리자 로그인 설정을 확인해 주세요." });
  }
};
