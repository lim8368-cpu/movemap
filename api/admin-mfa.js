const {
  ADMIN_SESSION_TTL_SECONDS,
  adminSessionCookie,
  enforceRateLimit,
  recordAuditLog,
  recordErrorLog,
  sendJson,
  signAdminSession,
} = require("./_shared");
const { platformRoleForUser } = require("./_platform-auth");
const {
  accessTokenFromRequest,
  authRequest,
  jwtClaims,
  userFromAccessToken,
} = require("./_user-auth");

function mfaFriendlyName(value, suffix = "") {
  const base = String(value || "DAIL 관리자 인증").trim() || "DAIL 관리자 인증";
  const normalizedSuffix = String(suffix || "").trim();
  if (!normalizedSuffix) return base.slice(0, 64);
  return `${base.slice(0, Math.max(1, 63 - normalizedSuffix.length))} ${normalizedSuffix}`.slice(0, 64);
}

async function enrollTotpFactor(accessToken, friendlyName) {
  const enroll = (name) => authRequest("/factors", {
    method: "POST",
    accessToken,
    body: {
      factor_type: "totp",
      friendly_name: name,
    },
  });
  try {
    return await enroll(mfaFriendlyName(friendlyName));
  } catch (error) {
    if (error?.authData?.error_code !== "mfa_factor_name_conflict") throw error;
    return enroll(mfaFriendlyName(friendlyName, Date.now().toString(36)));
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });
  if (!enforceRateLimit(req, res, { bucket: "admin-mfa", max: 15, windowMs: 15 * 60 * 1000 })) return;
  try {
    const accessToken = accessTokenFromRequest(req);
    const user = await userFromAccessToken(accessToken);
    if (!user) return sendJson(res, 401, { error: "MFA 로그인 세션이 만료되었습니다." });
    const role = await platformRoleForUser(user.id);
    if (!role) return sendJson(res, 403, { error: "관리자 권한이 없습니다." });

    const body = req.body || {};
    const action = String(body.action || "");
    let result;
    if (action === "set_password") {
      const password = String(body.password || "");
      if (password.length < 12 || password.length > 128) {
        return sendJson(res, 400, { error: "관리자 비밀번호는 12자 이상 128자 이하로 입력해 주세요." });
      }
      await authRequest("/user", {
        method: "PUT",
        accessToken,
        body: { password },
      });
      await recordAuditLog(req, {
        actorUserId: user.id,
        actorRole: role.role,
        action: "platform_admin.password_set",
        targetType: "auth_user",
        targetId: user.id,
      });
      return sendJson(res, 200, { ok: true });
    } else if (action === "enroll") {
      result = await enrollTotpFactor(accessToken, body.friendlyName);
    } else if (action === "challenge") {
      const factorId = String(body.factorId || "");
      result = await authRequest(`/factors/${encodeURIComponent(factorId)}/challenge`, {
        method: "POST",
        accessToken,
      });
    } else if (action === "verify") {
      const factorId = String(body.factorId || "");
      const challengeId = String(body.challengeId || "");
      const code = String(body.code || "").replace(/\D/g, "").slice(0, 8);
      result = await authRequest(`/factors/${encodeURIComponent(factorId)}/verify`, {
        method: "POST",
        accessToken,
        body: { challenge_id: challengeId, code },
      });
      const verifiedToken = result.access_token;
      const claims = jwtClaims(verifiedToken);
      if (claims.aal !== "aal2") {
        return sendJson(res, 403, { error: "2단계 인증을 완료하지 못했습니다." });
      }
      const token = signAdminSession({
        role: role.role,
        userId: user.id,
        email: user.email,
        aal: "aal2",
      });
      res.setHeader("Set-Cookie", adminSessionCookie(token, req));
      await recordAuditLog(req, {
        actorUserId: user.id,
        actorRole: role.role,
        action: "platform_admin.mfa_verified",
        targetType: "session",
      });
      return sendJson(res, 200, {
        ok: true,
        role: role.role,
        expiresInSeconds: ADMIN_SESSION_TTL_SECONDS,
      });
    } else {
      return sendJson(res, 400, { error: "MFA 작업을 확인해 주세요." });
    }
    sendJson(res, 200, { ok: true, result });
  } catch (error) {
    console.error("admin mfa failed", error);
    await recordErrorLog(req, error, { errorCode: "admin_mfa_failed", statusCode: 400 });
    sendJson(res, 400, { error: "2단계 인증을 처리하지 못했습니다." });
  }
};
