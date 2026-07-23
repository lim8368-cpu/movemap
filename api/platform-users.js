const {
  recordAuditLog,
  recordErrorLog,
  requireAdminRole,
  sendJson,
  supabaseRequest,
} = require("./_shared");
const {
  findAuthUserByEmail,
  inviteAuthUser,
} = require("./_user-auth");

const ROLES = new Set(["super_admin", "admin", "support", "analyst"]);
const STATUSES = new Set(["active", "suspended", "revoked"]);

async function requireSuperAdmin(req, res) {
  return requireAdminRole(req, res, ["super_admin"]);
}

async function upsertRole(req, res, admin) {
  const email = String(req.body?.email || "").trim().toLowerCase().slice(0, 254);
  const role = String(req.body?.role || "");
  if (!/^\S+@\S+\.\S+$/.test(email) || !ROLES.has(role)) {
    return sendJson(res, 400, { error: "이메일과 운영자 역할을 확인해 주세요." });
  }

  let user = await findAuthUserByEmail(email);
  let invitationSent = false;
  if (!user) {
    const origin = String(process.env.PUBLIC_APP_ORIGIN || "").replace(/\/$/, "");
    const invited = await inviteAuthUser({
      email,
      redirectTo: origin ? `${origin}/admin/` : undefined,
      metadata: { account_type: "platform_admin" },
    });
    user = invited?.user || invited;
    invitationSent = true;
  }
  if (!user?.id) return sendJson(res, 502, { error: "인증 사용자를 만들지 못했습니다." });

  const rows = await supabaseRequest("platform_user_roles", {
    query: `?select=*&user_id=eq.${encodeURIComponent(user.id)}&limit=1`,
  });
  const body = {
    user_id: user.id,
    email,
    role,
    status: "active",
    mfa_required: req.body?.mfaRequired !== false,
    created_by_user_id: admin.userId || null,
    updated_at: new Date().toISOString(),
    revoked_at: null,
  };
  if (rows[0]) {
    await supabaseRequest("platform_user_roles", {
      method: "PATCH",
      query: `?id=eq.${encodeURIComponent(rows[0].id)}`,
      body,
    });
  } else {
    await supabaseRequest("platform_user_roles", { method: "POST", body });
  }
  await recordAuditLog(req, {
    actorUserId: admin.userId,
    actorRole: admin.role,
    action: rows[0] ? "platform_role.update" : "platform_role.create",
    targetType: "platform_user_role",
    targetId: user.id,
    metadata: { role, mfaRequired: body.mfa_required, invitationSent },
  });
  return sendJson(res, rows[0] ? 200 : 201, {
    ok: true,
    userId: user.id,
    invitationSent,
  });
}

async function changeRole(req, res, admin) {
  const id = String(req.body?.id || "").trim();
  const role = String(req.body?.role || "");
  const status = String(req.body?.status || "");
  if (!id || !ROLES.has(role) || !STATUSES.has(status)) {
    return sendJson(res, 400, { error: "운영자 ID, 역할, 상태를 확인해 주세요." });
  }
  const rows = await supabaseRequest("platform_user_roles", {
    query: `?select=*&id=eq.${encodeURIComponent(id)}&limit=1`,
  });
  const target = rows[0];
  if (!target) return sendJson(res, 404, { error: "운영자 권한을 찾을 수 없습니다." });
  if (target.user_id === admin.userId && status !== "active") {
    return sendJson(res, 409, { error: "현재 로그인한 자신의 최고 관리자 권한은 회수할 수 없습니다." });
  }
  if (target.role === "super_admin" && (role !== "super_admin" || status !== "active")) {
    const active = await supabaseRequest("platform_user_roles", {
      query: "?select=id&role=eq.super_admin&status=eq.active",
    });
    if (active.length <= 1) {
      return sendJson(res, 409, { error: "최소 한 명의 활성 최고 관리자가 필요합니다." });
    }
  }
  const body = {
    role,
    status,
    mfa_required: req.body?.mfaRequired !== false,
    updated_at: new Date().toISOString(),
    revoked_at: status === "revoked" ? new Date().toISOString() : null,
  };
  await supabaseRequest("platform_user_roles", {
    method: "PATCH",
    query: `?id=eq.${encodeURIComponent(id)}`,
    body,
  });
  await recordAuditLog(req, {
    actorUserId: admin.userId,
    actorRole: admin.role,
    action: "platform_role.update",
    targetType: "platform_user_role",
    targetId: target.user_id,
    metadata: { role, status, mfaRequired: body.mfa_required },
  });
  return sendJson(res, 200, { ok: true });
}

module.exports = async function handler(req, res) {
  const admin = await requireSuperAdmin(req, res);
  if (!admin) return;
  try {
    if (req.method === "GET") {
      const roles = await supabaseRequest("platform_user_roles", {
        query: "?select=*&order=created_at.asc&limit=250",
      });
      return sendJson(res, 200, { roles });
    }
    if (req.method === "POST") return upsertRole(req, res, admin);
    if (req.method === "PATCH") return changeRole(req, res, admin);
    return sendJson(res, 405, { error: "Method not allowed" });
  } catch (error) {
    await recordErrorLog(req, error, {
      errorCode: "platform_roles_failed",
      statusCode: 500,
      source: "admin",
    });
    return sendJson(res, 500, { error: "운영자 권한을 처리하지 못했습니다." });
  }
};
