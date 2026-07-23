const crypto = require("crypto");
const {
  enforceRateLimit,
  recordAuditLog,
  recordErrorLog,
  sendJson,
  supabaseRequest,
} = require("./_shared");
const { requireOwnerAccess } = require("./_platform-auth");
const {
  findAuthUserByEmail,
  inviteAuthUser,
} = require("./_user-auth");

const ALLOWED_ROLES = new Set(["manager", "staff", "viewer"]);

function invitationHash(token) {
  return crypto.createHash("sha256").update(String(token || "")).digest("base64url");
}

function publicOrigin(req) {
  const configured = String(process.env.PUBLIC_APP_ORIGIN || "").trim();
  if (configured) return new URL(configured).origin;
  const protocol = String(req.headers["x-forwarded-proto"] || (req.socket?.encrypted ? "https" : "http")).split(",")[0];
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "").split(",")[0];
  return `${protocol}://${host}`;
}

async function listMembers(access, res) {
  const [memberships, invitations, centers] = await Promise.all([
    supabaseRequest("center_memberships", {
      query: `?select=id,user_id,email,role,status,permissions,accepted_at,last_active_at,created_at,revoked_at&center_id=eq.${encodeURIComponent(access.centerId)}&order=created_at.asc`,
    }),
    supabaseRequest("center_invitations", {
      query: `?select=id,email,role,status,expires_at,created_at&center_id=eq.${encodeURIComponent(access.centerId)}&status=eq.pending&order=created_at.desc`,
    }),
    Promise.all((access.memberships || [access.membership].filter(Boolean)).map(async (membership) => {
      const rows = await supabaseRequest("centers", {
        query: `?select=id,name&status=in.(approved,hidden)&id=eq.${encodeURIComponent(membership.center_id)}&limit=1`,
      });
      return rows[0] ? { ...rows[0], role: membership.role } : null;
    })),
  ]);
  sendJson(res, 200, {
    centerId: access.centerId,
    currentUserId: access.userId,
    currentRole: access.role,
    centers: centers.filter(Boolean),
    memberships,
    invitations,
  });
}

async function createInvitation(req, res, access) {
  const body = req.body || {};
  const email = String(body.email || "").trim().toLowerCase().slice(0, 254);
  const role = String(body.role || "staff");
  if (!/^\S+@\S+\.\S+$/.test(email) || !ALLOWED_ROLES.has(role)) {
    return sendJson(res, 400, { error: "이메일과 역할을 확인해 주세요." });
  }
  if (access.role === "manager" && role === "manager") {
    return sendJson(res, 403, { error: "매니저는 다른 매니저를 초대할 수 없습니다." });
  }
  const existing = await supabaseRequest("center_memberships", {
    query: `?select=id,status&center_id=eq.${encodeURIComponent(access.centerId)}&email=eq.${encodeURIComponent(email)}&limit=1`,
  });
  if (existing[0] && existing[0].status !== "revoked") {
    return sendJson(res, 409, { error: "이미 해당 센터에 소속되었거나 초대된 이메일입니다." });
  }

  await supabaseRequest("center_invitations", {
    method: "DELETE",
    query: `?center_id=eq.${encodeURIComponent(access.centerId)}&email=eq.${encodeURIComponent(email)}&status=eq.pending`,
  }).catch(() => {});

  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
  const rows = await supabaseRequest("center_invitations", {
    method: "POST",
    body: {
      center_id: access.centerId,
      email,
      role,
      token_hash: invitationHash(token),
      invited_by_user_id: access.userId,
      expires_at: expiresAt,
    },
  });
  const inviteUrl = `${publicOrigin(req)}/center-dashboard/?invite=${encodeURIComponent(token)}`;
  const authUser = await findAuthUserByEmail(email).catch(() => null);
  let emailSent = false;
  if (!authUser) {
    try {
      await inviteAuthUser({
        email,
        redirectTo: inviteUrl,
        metadata: { account_type: "center_member", center_invitation_id: rows[0].id },
      });
      emailSent = true;
    } catch (error) {
      console.warn("center invitation email failed", error.message);
    }
  }
  await recordAuditLog(req, {
    actorUserId: access.userId,
    actorRole: access.role,
    centerId: access.centerId,
    action: "center_member.invite",
    targetType: "center_invitation",
    targetId: rows[0].id,
    metadata: { role, emailSent },
  });
  sendJson(res, 201, {
    ok: true,
    invitationId: rows[0].id,
    inviteUrl,
    emailSent,
    expiresAt,
  });
}

async function changeMembership(req, res, access) {
  const body = req.body || {};
  const membershipId = String(body.membershipId || "");
  const action = String(body.action || "update");
  const rows = await supabaseRequest("center_memberships", {
    query: `?select=*&id=eq.${encodeURIComponent(membershipId)}&center_id=eq.${encodeURIComponent(access.centerId)}&limit=1`,
  });
  const target = rows[0];
  if (!target) return sendJson(res, 404, { error: "센터 구성원을 찾을 수 없습니다." });
  if (target.role === "owner" && access.role !== "owner") {
    return sendJson(res, 403, { error: "센터 소유자 권한은 소유자만 변경할 수 있습니다." });
  }

  let patch;
  if (action === "revoke") {
    if (target.user_id === access.userId) {
      return sendJson(res, 409, { error: "현재 로그인한 자신의 권한은 다른 소유자가 회수해야 합니다." });
    }
    if (target.role === "owner") {
      const owners = await supabaseRequest("center_memberships", {
        query: `?select=id&center_id=eq.${encodeURIComponent(access.centerId)}&role=eq.owner&status=eq.active`,
      });
      if (owners.length <= 1) return sendJson(res, 409, { error: "센터에는 최소 한 명의 활성 소유자가 필요합니다." });
    }
    patch = {
      status: "revoked",
      revoked_by_user_id: access.userId,
      revoked_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  } else {
    const role = String(body.role || target.role);
    const status = String(body.status || target.status);
    if (!["owner", ...ALLOWED_ROLES].includes(role) || !["active", "suspended"].includes(status)) {
      return sendJson(res, 400, { error: "역할 또는 상태를 확인해 주세요." });
    }
    if (role === "owner" && access.role !== "owner") {
      return sendJson(res, 403, { error: "소유자 역할은 기존 소유자만 부여할 수 있습니다." });
    }
    patch = {
      role,
      status,
      revoked_at: null,
      updated_at: new Date().toISOString(),
    };
  }
  await supabaseRequest("center_memberships", {
    method: "PATCH",
    query: `?id=eq.${encodeURIComponent(target.id)}`,
    body: patch,
  });
  await recordAuditLog(req, {
    actorUserId: access.userId,
    actorRole: access.role,
    centerId: access.centerId,
    action: action === "revoke" ? "center_member.revoke" : "center_member.update",
    targetType: "center_membership",
    targetId: target.id,
    metadata: { role: patch.role || target.role, status: patch.status },
  });
  sendJson(res, 200, { ok: true });
}

module.exports = async function handler(req, res) {
  if (!enforceRateLimit(req, res, {
    bucket: "center-members",
    max: req.method === "GET" ? 120 : 30,
    windowMs: 15 * 60 * 1000,
  })) return;
  try {
    const action = req.method === "GET" ? "read" : "manage_members";
    const access = await requireOwnerAccess(req, res, {
      centerId: req.query?.centerId || req.body?.centerId,
      action,
    });
    if (!access) return;
    if (req.method === "GET") return listMembers(access, res);
    if (req.method === "POST") return createInvitation(req, res, access);
    if (req.method === "PATCH") return changeMembership(req, res, access);
    return sendJson(res, 405, { error: "Method not allowed" });
  } catch (error) {
    console.error("center members api failed", error);
    await recordErrorLog(req, error, { errorCode: "center_members_failed", statusCode: 500 });
    sendJson(res, 500, { error: "센터 구성원 정보를 처리하지 못했습니다." });
  }
};
