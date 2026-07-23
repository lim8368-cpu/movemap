const crypto = require("crypto");
const {
  recordAuditLog,
  recordErrorLog,
  sendJson,
  supabaseRequest,
} = require("./_shared");
const { requireAuthenticatedUser } = require("./_platform-auth");
const {
  OWNER_SESSION_TTL_SECONDS,
  ownerSessionCookie,
  signOwnerSession,
} = require("./_owner-auth");
const { authRequest } = require("./_user-auth");

function invitationHash(token) {
  return crypto.createHash("sha256").update(String(token || "")).digest("base64url");
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });
  try {
    const auth = await requireAuthenticatedUser(req, res);
    if (!auth) return;
    const token = String(req.body?.invitationToken || "");
    const rows = await supabaseRequest("center_invitations", {
      query: `?select=*&token_hash=eq.${encodeURIComponent(invitationHash(token))}&status=eq.pending&limit=1`,
    });
    const invitation = rows[0];
    if (!invitation || new Date(invitation.expires_at).getTime() <= Date.now()) {
      return sendJson(res, 410, { error: "초대가 만료되었거나 이미 사용되었습니다." });
    }
    if (String(invitation.email).toLowerCase() !== String(auth.user.email || "").toLowerCase()) {
      return sendJson(res, 403, { error: "초대받은 이메일 계정으로 로그인해 주세요." });
    }
    const password = String(req.body?.password || "");
    if (password) {
      if (password.length < 10 || password.length > 128) {
        return sendJson(res, 400, { error: "비밀번호는 10자 이상 128자 이하로 입력해 주세요." });
      }
      await authRequest("/user", {
        method: "PUT",
        accessToken: auth.token,
        body: { password },
      });
    }
    const existing = await supabaseRequest("center_memberships", {
      query: `?select=id&center_id=eq.${encodeURIComponent(invitation.center_id)}&user_id=eq.${encodeURIComponent(auth.user.id)}&limit=1`,
    });
    const membershipBody = {
      center_id: invitation.center_id,
      user_id: auth.user.id,
      email: invitation.email,
      role: invitation.role,
      status: "active",
      permissions: invitation.permissions || [],
      invited_by_user_id: invitation.invited_by_user_id,
      accepted_at: new Date().toISOString(),
      revoked_at: null,
      updated_at: new Date().toISOString(),
    };
    if (existing[0]) {
      await supabaseRequest("center_memberships", {
        method: "PATCH",
        query: `?id=eq.${encodeURIComponent(existing[0].id)}`,
        body: membershipBody,
      });
    } else {
      await supabaseRequest("center_memberships", { method: "POST", body: membershipBody });
    }
    await supabaseRequest("center_invitations", {
      method: "PATCH",
      query: `?id=eq.${encodeURIComponent(invitation.id)}`,
      body: {
        status: "accepted",
        accepted_by_user_id: auth.user.id,
        accepted_at: new Date().toISOString(),
      },
    });
    await recordAuditLog(req, {
      actorUserId: auth.user.id,
      actorRole: invitation.role,
      centerId: invitation.center_id,
      action: "center_member.invitation_accept",
      targetType: "center_invitation",
      targetId: invitation.id,
    });
    const sessionToken = signOwnerSession({
      auth_user_id: auth.user.id,
      center_id: invitation.center_id,
      email: invitation.email,
    });
    res.setHeader("Set-Cookie", ownerSessionCookie(sessionToken, req));
    sendJson(res, 200, {
      ok: true,
      centerId: invitation.center_id,
      role: invitation.role,
      expiresInSeconds: OWNER_SESSION_TTL_SECONDS,
    });
  } catch (error) {
    console.error("center invitation accept failed", error);
    await recordErrorLog(req, error, { errorCode: "center_invitation_accept_failed", statusCode: 500 });
    sendJson(res, 500, { error: "센터 초대를 처리하지 못했습니다." });
  }
};
