const crypto = require("crypto");
const {
  enforceRateLimit,
  recordAuditLog,
  recordErrorLog,
  sendJson,
  supabaseRequest,
} = require("./_shared");
const {
  OWNER_SESSION_TTL_SECONDS,
  ownerSessionCookie,
  signOwnerSession,
  verifyOwnerPassword,
} = require("./_owner-auth");
const {
  accessTokenFromRequest,
  ensureAuthUser,
  signInWithPassword,
  updateAuthUser,
  userFromAccessToken,
} = require("./_user-auth");

const MAX_FAILURES = 5;
const LOCK_MS = 15 * 60 * 1000;

function invitationHash(token) {
  return crypto.createHash("sha256").update(String(token || "")).digest("base64url");
}

async function activeMemberships(userId) {
  return supabaseRequest("center_memberships", {
    query: `?select=id,center_id,email,role,status,permissions&user_id=eq.${encodeURIComponent(userId)}&status=eq.active&order=created_at.asc`,
  });
}

async function acceptInvitation(invitationToken, user) {
  if (!invitationToken) return null;
  const rows = await supabaseRequest("center_invitations", {
    query: `?select=*&token_hash=eq.${encodeURIComponent(invitationHash(invitationToken))}&status=eq.pending&limit=1`,
  });
  const invitation = rows[0];
  if (!invitation || new Date(invitation.expires_at).getTime() <= Date.now()) {
    const error = new Error("센터 초대가 만료되었거나 이미 사용되었습니다.");
    error.statusCode = 410;
    throw error;
  }
  if (String(invitation.email).toLowerCase() !== String(user.email || "").toLowerCase()) {
    const error = new Error("초대받은 이메일 계정으로 로그인해 주세요.");
    error.statusCode = 403;
    throw error;
  }
  const memberships = await supabaseRequest("center_memberships", {
    query: `?select=id&center_id=eq.${encodeURIComponent(invitation.center_id)}&user_id=eq.${encodeURIComponent(user.id)}&limit=1`,
  });
  const body = {
    center_id: invitation.center_id,
    user_id: user.id,
    email: invitation.email,
    role: invitation.role,
    status: "active",
    permissions: invitation.permissions || [],
    invited_by_user_id: invitation.invited_by_user_id,
    accepted_at: new Date().toISOString(),
    revoked_at: null,
    updated_at: new Date().toISOString(),
  };
  if (memberships[0]) {
    await supabaseRequest("center_memberships", {
      method: "PATCH",
      query: `?id=eq.${encodeURIComponent(memberships[0].id)}`,
      body,
    });
  } else {
    await supabaseRequest("center_memberships", { method: "POST", body });
  }
  await supabaseRequest("center_invitations", {
    method: "PATCH",
    query: `?id=eq.${encodeURIComponent(invitation.id)}`,
    body: {
      status: "accepted",
      accepted_by_user_id: user.id,
      accepted_at: new Date().toISOString(),
    },
  });
  return invitation;
}

async function activateLegacyOwner(account, user) {
  const existing = await supabaseRequest("center_memberships", {
    query: `?select=id&center_id=eq.${encodeURIComponent(account.center_id)}&user_id=eq.${encodeURIComponent(user.id)}&limit=1`,
  });
  const body = {
    center_id: account.center_id,
    user_id: user.id,
    email: account.email,
    role: "owner",
    status: "active",
    accepted_at: new Date().toISOString(),
    revoked_at: null,
    updated_at: new Date().toISOString(),
  };
  if (existing[0]) {
    await supabaseRequest("center_memberships", {
      method: "PATCH",
      query: `?id=eq.${encodeURIComponent(existing[0].id)}`,
      body,
    });
  } else {
    await supabaseRequest("center_memberships", { method: "POST", body });
  }
  await supabaseRequest("center_owner_accounts", {
    method: "PATCH",
    query: `?id=eq.${encodeURIComponent(account.id)}`,
    body: {
      auth_user_id: user.id,
      failed_count: 0,
      locked_until: null,
      last_login_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  });
}

async function supabaseUserForLegacyAccount(account, password) {
  try {
    const session = await signInWithPassword(account.email, password);
    return { user: session.user, authMigrated: false };
  } catch {
    const result = await ensureAuthUser({
      email: account.email,
      password,
      metadata: { account_type: "center_member", migrated_from: "legacy_owner" },
    });
    if (!result.created) {
      await updateAuthUser(result.user.id, {
        password,
        email_confirm: true,
        user_metadata: {
          ...(result.user.user_metadata || {}),
          account_type: "center_member",
          migrated_from: "legacy_owner",
        },
      });
    }
    return { user: result.user, authMigrated: true };
  }
}

async function completeOwnerLogin(req, res, {
  user,
  account = null,
  invitationToken = "",
  authMigrated = false,
}) {
  if (account && account.status === "active") {
    await activateLegacyOwner(account, user);
  }
  const acceptedInvitation = await acceptInvitation(invitationToken, user);
  const memberships = await activeMemberships(user.id);
  if (!memberships.length) {
    await recordAuditLog(req, {
      actorUserId: user.id,
      actorRole: "center_member",
      action: "center_member.login",
      targetType: "session",
      success: false,
      metadata: { reason: "no_active_membership" },
    });
    return sendJson(res, 403, {
      error: "이 계정에는 아직 활성화된 센터 운영 권한이 없습니다.",
      code: "membership_required",
    });
  }

  const email = String(user.email || memberships[0].email || "").toLowerCase();
  const token = signOwnerSession({
    id: account?.id || null,
    auth_user_id: user.id,
    center_id: memberships[0].center_id,
    email,
  });
  res.setHeader("Set-Cookie", ownerSessionCookie(token, req));
  await recordAuditLog(req, {
    actorUserId: user.id,
    actorRole: memberships[0].role,
    centerId: memberships[0].center_id,
    action: "center_member.login",
    targetType: "session",
    metadata: { centers: memberships.length, authMigrated, method: account ? "password" : "social_session" },
  });
  return sendJson(res, 200, {
    ok: true,
    expiresInSeconds: OWNER_SESSION_TTL_SECONDS,
    centers: memberships.map((membership) => ({
      centerId: membership.center_id,
      role: membership.role,
    })),
    authMigrated,
    invitationAccepted: Boolean(acceptedInvitation),
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });
  if (!enforceRateLimit(req, res, { bucket: "owner-login", max: 10, windowMs: 15 * 60 * 1000 })) return;

  try {
    const body = req.body || {};
    const accessToken = accessTokenFromRequest(req);
    if (accessToken) {
      const socialUser = await userFromAccessToken(accessToken);
      if (!socialUser) return sendJson(res, 401, { error: "로그인 정보가 만료되었습니다. 다시 로그인해 주세요." });
      return completeOwnerLogin(req, res, {
        user: socialUser,
        invitationToken: String(body.invitationToken || ""),
      });
    }

    const email = String(body.email || "").trim().toLowerCase().slice(0, 254);
    const password = String(body.password || "");
    if (!email || !password) return sendJson(res, 400, { error: "이메일과 비밀번호를 입력해 주세요." });

    const accounts = await supabaseRequest("center_owner_accounts", {
      query: `?select=*&email=eq.${encodeURIComponent(email)}&limit=1`,
    });
    const account = accounts[0] || null;
    const locked = account?.locked_until && new Date(account.locked_until).getTime() > Date.now();
    if (locked) {
      res.setHeader("Retry-After", "900");
      return sendJson(res, 429, { error: "로그인 시도가 너무 많습니다. 15분 후 다시 시도해 주세요." });
    }

    let user = null;
    let authMigrated = false;
    try {
      const authSession = await signInWithPassword(email, password);
      user = authSession.user;
    } catch {
      const legacyValid = account &&
        account.status === "active" &&
        verifyOwnerPassword(password, account.password_scrypt);
      if (!legacyValid) {
        if (account) {
          const failedCount = Number(account.failed_count || 0) + 1;
          await supabaseRequest("center_owner_accounts", {
            method: "PATCH",
            query: `?id=eq.${encodeURIComponent(account.id)}`,
            body: {
              failed_count: failedCount,
              locked_until: failedCount >= MAX_FAILURES ? new Date(Date.now() + LOCK_MS).toISOString() : null,
              updated_at: new Date().toISOString(),
            },
          });
        }
        await recordAuditLog(req, {
          actorRole: "center_member",
          action: "center_member.login",
          targetType: "session",
          success: false,
          metadata: { reason: "invalid_credentials" },
        });
        return sendJson(res, 401, { error: "이메일 또는 비밀번호가 올바르지 않습니다." });
      }
      const migrated = await supabaseUserForLegacyAccount(account, password);
      user = migrated.user;
      authMigrated = migrated.authMigrated;
    }

    return completeOwnerLogin(req, res, {
      user,
      account,
      invitationToken: String(body.invitationToken || ""),
      authMigrated,
    });
  } catch (error) {
    console.error("center owner login failed", error);
    await recordErrorLog(req, error, { errorCode: "center_owner_login_failed", statusCode: 503 });
    sendJson(res, error.statusCode || 503, {
      error: error.statusCode ? error.message : "센터장 로그인 설정을 확인해 주세요.",
    });
  }
};
