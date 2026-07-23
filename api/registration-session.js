const {
  captchaMode,
  createRegistrationSession,
  verifyHumanChallenge,
} = require("./_registration-security");
const {
  enforceRateLimit,
  recordAuditLog,
  recordErrorLog,
  sendJson,
} = require("./_shared");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });
  if (!enforceRateLimit(req, res, {
    bucket: "registration-session",
    max: 5,
    windowMs: 15 * 60 * 1000,
  })) return;

  try {
    const verified = await verifyHumanChallenge(req, req.body || {});
    if (!verified) {
      await recordAuditLog(req, {
        actorRole: "anonymous",
        action: "registration.captcha_failed",
        targetType: "registration_session",
        success: false,
      });
      return sendJson(res, 400, {
        error: "사람 확인에 실패했습니다. 보안 확인을 다시 진행해 주세요.",
        code: "captcha_failed",
      });
    }
    const created = await createRegistrationSession(req);
    await recordAuditLog(req, {
      actorRole: "anonymous",
      action: "registration.session_created",
      targetType: "registration_session",
      targetId: created.session.id,
      metadata: { captchaMode: captchaMode() },
    });
    sendJson(res, 201, {
      ok: true,
      registrationToken: created.token,
      expiresInSeconds: created.expiresInSeconds,
    });
  } catch (error) {
    console.error("registration session failed", error);
    await recordErrorLog(req, error, {
      errorCode: "registration_session_failed",
      statusCode: 503,
    });
    sendJson(res, 503, { error: "등록 보안 확인을 시작하지 못했습니다." });
  }
};
