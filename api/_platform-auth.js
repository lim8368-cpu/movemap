const { sendJson, supabaseRequest } = require("./_shared");
const { ownerSessionFromRequest } = require("./_owner-auth");
const {
  accessTokenFromRequest,
  jwtClaims,
  userFromAccessToken,
} = require("./_user-auth");

async function authenticatedUser(req) {
  const token = accessTokenFromRequest(req);
  if (!token) return null;
  const user = await userFromAccessToken(token);
  if (!user) return null;
  return { token, user, claims: jwtClaims(token) };
}

async function requireAuthenticatedUser(req, res) {
  const auth = await authenticatedUser(req);
  if (!auth) {
    sendJson(res, 401, { error: "로그인이 필요합니다." });
    return null;
  }
  req.authContext = {
    actorUserId: auth.user.id,
    actorRole: "user",
    centerId: null,
  };
  return auth;
}

async function platformRoleForUser(userId) {
  if (!userId) return null;
  const rows = await supabaseRequest("platform_user_roles", {
    query: `?select=*&user_id=eq.${encodeURIComponent(userId)}&status=eq.active&limit=1`,
  });
  return rows[0] || null;
}

async function requirePlatformRole(req, res, {
  roles = ["super_admin", "admin"],
  requireMfa = true,
} = {}) {
  const auth = await requireAuthenticatedUser(req, res);
  if (!auth) return null;
  const platformRole = await platformRoleForUser(auth.user.id);
  if (!platformRole || !roles.includes(platformRole.role)) {
    sendJson(res, 403, { error: "관리자 권한이 없습니다." });
    return null;
  }
  const mfaRequired = requireMfa && platformRole.mfa_required !== false;
  if (mfaRequired && auth.claims.aal !== "aal2") {
    sendJson(res, 403, {
      error: "관리자 작업에는 2단계 인증이 필요합니다.",
      code: "mfa_required",
    });
    return null;
  }
  req.authContext.actorRole = platformRole.role;
  return { ...auth, platformRole };
}

async function membershipsForUser(userId) {
  if (!userId) return [];
  return supabaseRequest("center_memberships", {
    query: `?select=*&user_id=eq.${encodeURIComponent(userId)}&status=eq.active&order=created_at.asc`,
  });
}

function roleAllows(role, action, permissions = []) {
  if (role === "owner") return true;
  if (role === "manager") return action !== "transfer_ownership";
  if (permissions.includes(action)) return true;
  if (role === "staff") return ["read", "edit_center", "read_stats"].includes(action);
  return action === "read";
}

async function legacyOwnerAccess(session, requestedCenterId) {
  if (!session?.accountId) return null;
  const rows = await supabaseRequest("center_owner_accounts", {
    query: `?select=id,center_id,email,status,auth_user_id&id=eq.${encodeURIComponent(session.accountId)}&limit=1`,
  });
  const account = rows[0];
  if (!account || account.status !== "active") return null;
  if (requestedCenterId && requestedCenterId !== account.center_id) return null;
  return {
    session,
    membership: null,
    centerId: account.center_id,
    userId: account.auth_user_id || session.userId || null,
    email: account.email,
    role: "owner",
    legacy: true,
  };
}

async function ownerAccess(req, {
  centerId = "",
  action = "read",
} = {}) {
  const session = ownerSessionFromRequest(req);
  if (!session) return null;

  const requestedCenterId = String(centerId || req?.query?.centerId || "").trim();
  const userId = session.userId || null;
  if (!userId) return legacyOwnerAccess(session, requestedCenterId);

  const memberships = await membershipsForUser(userId);
  const membership = requestedCenterId
    ? memberships.find((item) => item.center_id === requestedCenterId)
    : memberships[0];
  if (!membership || !roleAllows(membership.role, action, membership.permissions || [])) return null;

  await supabaseRequest("center_memberships", {
    method: "PATCH",
    query: `?id=eq.${encodeURIComponent(membership.id)}`,
    body: { last_active_at: new Date().toISOString() },
  }).catch(() => {});

  return {
    session,
    membership,
    memberships,
    centerId: membership.center_id,
    userId,
    email: session.email || membership.email,
    role: membership.role,
    legacy: false,
  };
}

async function requireOwnerAccess(req, res, options = {}) {
  const access = await ownerAccess(req, options);
  if (!access) {
    sendJson(res, 403, {
      error: "센터 접근 권한이 없거나 회수되었습니다. 다시 로그인해 주세요.",
      code: "membership_required",
    });
    return null;
  }
  req.authContext = {
    actorUserId: access.userId,
    actorRole: access.role,
    centerId: access.centerId,
  };
  return access;
}

module.exports = {
  authenticatedUser,
  membershipsForUser,
  ownerAccess,
  platformRoleForUser,
  requireAuthenticatedUser,
  requireOwnerAccess,
  requirePlatformRole,
  roleAllows,
};
