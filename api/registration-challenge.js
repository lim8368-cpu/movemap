const {
  captchaMode,
  createMathChallenge,
  createPassiveChallenge,
} = require("./_registration-security");
const {
  enforceRateLimit,
  sendJson,
} = require("./_shared");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return sendJson(res, 405, { error: "Method not allowed" });
  if (!enforceRateLimit(req, res, {
    bucket: "registration-challenge",
    max: 20,
    windowMs: 15 * 60 * 1000,
  })) return;

  const mode = captchaMode();
  if (mode === "unconfigured") {
    return sendJson(res, 503, {
      error: "센터 등록 보안 확인이 준비되지 않았습니다. 운영팀에 문의해 주세요.",
      code: "captcha_not_configured",
    });
  }
  if (mode === "turnstile") {
    return sendJson(res, 200, {
      mode: "turnstile",
      siteKey: process.env.TURNSTILE_SITE_KEY,
      fallbackChallenge: createMathChallenge(),
    });
  }
  if (mode === "signed_passive") {
    return sendJson(res, 200, createPassiveChallenge());
  }
  sendJson(res, 200, createMathChallenge());
};
