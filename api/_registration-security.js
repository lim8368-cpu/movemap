const crypto = require("crypto");
const {
  clientIp,
  privacyHash,
  supabaseRequest,
} = require("./_shared");

const SESSION_TTL_MS = 45 * 60 * 1000;
const CHALLENGE_TTL_MS = 10 * 60 * 1000;

function captchaMode() {
  if (process.env.TURNSTILE_SITE_KEY && process.env.TURNSTILE_SECRET_KEY) return "turnstile";
  if (["staging", "production"].includes(process.env.APP_ENV)) return "unconfigured";
  return "signed_math";
}

function challengeSecret() {
  const secret = process.env.REGISTRATION_CHALLENGE_SECRET ||
    process.env.USER_AUTH_STATE_SECRET ||
    process.env.ADMIN_SESSION_SECRET;
  if (!secret) throw new Error("REGISTRATION_CHALLENGE_SECRET is not configured");
  return secret;
}

function signPayload(payload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", challengeSecret()).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

function verifySignedPayload(value) {
  const [encoded, signature] = String(value || "").split(".");
  if (!encoded || !signature) return null;
  const expected = crypto.createHmac("sha256", challengeSecret()).update(encoded).digest("base64url");
  const given = Buffer.from(signature);
  const wanted = Buffer.from(expected);
  if (given.length !== wanted.length || !crypto.timingSafeEqual(given, wanted)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    return Number(payload.exp) > Date.now() ? payload : null;
  } catch {
    return null;
  }
}

function createMathChallenge() {
  const left = crypto.randomInt(2, 10);
  const right = crypto.randomInt(1, 10);
  return {
    mode: "signed_math",
    prompt: `${left} + ${right} = ?`,
    challengeToken: signPayload({
      left,
      right,
      nonce: crypto.randomBytes(12).toString("base64url"),
      exp: Date.now() + CHALLENGE_TTL_MS,
    }),
  };
}

async function verifyTurnstile(token, req) {
  if (!token || String(token).length > 2048) return false;
  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      secret: process.env.TURNSTILE_SECRET_KEY,
      response: token,
      remoteip: clientIp(req),
      idempotency_key: crypto.randomUUID(),
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) return false;
  const data = await response.json();
  return data.success === true;
}

async function verifyHumanChallenge(req, body = {}) {
  if (String(body.companyWebsite || "").trim()) return false;
  const startedAt = Number(body.formStartedAt || 0);
  if (!startedAt || Date.now() - startedAt < 1500 || Date.now() - startedAt > 2 * 60 * 60 * 1000) {
    return false;
  }
  if (body.challengeMode === "signed_math") {
    const challenge = verifySignedPayload(body.challengeToken);
    const answer = Number(String(body.challengeAnswer || "").trim());
    return Boolean(challenge && Number.isInteger(answer) && answer === challenge.left + challenge.right);
  }
  if (captchaMode() === "turnstile") {
    return verifyTurnstile(String(body.turnstileToken || ""), req);
  }
  if (captchaMode() !== "signed_math") return false;
  const challenge = verifySignedPayload(body.challengeToken);
  const answer = Number(String(body.challengeAnswer || "").trim());
  return Boolean(challenge && Number.isInteger(answer) && answer === challenge.left + challenge.right);
}

function registrationTokenHash(token) {
  return crypto.createHash("sha256").update(String(token || "")).digest("base64url");
}

async function createRegistrationSession(req, provider = captchaMode()) {
  const token = crypto.randomBytes(32).toString("base64url");
  const rows = await supabaseRequest("registration_sessions", {
    method: "POST",
    body: {
      token_hash: registrationTokenHash(token),
      ip_hash: privacyHash(clientIp(req), "registration-ip"),
      captcha_provider: provider,
      expires_at: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
    },
  });
  return {
    token,
    session: rows[0],
    expiresInSeconds: Math.floor(SESSION_TTL_MS / 1000),
  };
}

function registrationTokenFromRequest(req, body = {}) {
  return String(
    req?.headers?.["x-registration-token"] ||
    body.registrationToken ||
    ""
  ).trim();
}

async function registrationSession(req, body = {}) {
  const token = registrationTokenFromRequest(req, body);
  if (!token) return null;
  const rows = await supabaseRequest("registration_sessions", {
    query: `?select=*&token_hash=eq.${encodeURIComponent(registrationTokenHash(token))}&limit=1`,
  });
  const session = rows[0];
  const expectedIpHash = privacyHash(clientIp(req), "registration-ip");
  if (
    !session ||
    session.consumed_at ||
    session.ip_hash !== expectedIpHash ||
    new Date(session.expires_at).getTime() <= Date.now()
  ) return null;
  return session;
}

async function attachRegistrationUpload(sessionId, objectPath) {
  const rows = await supabaseRequest("registration_sessions", {
    query: `?select=upload_paths&id=eq.${encodeURIComponent(sessionId)}&limit=1`,
  });
  const paths = [...new Set([...(rows[0]?.upload_paths || []), objectPath])].slice(0, 8);
  await supabaseRequest("registration_sessions", {
    method: "PATCH",
    query: `?id=eq.${encodeURIComponent(sessionId)}`,
    body: { upload_paths: paths },
  });
}

async function consumeRegistrationSession(sessionId) {
  await supabaseRequest("registration_sessions", {
    method: "PATCH",
    query: `?id=eq.${encodeURIComponent(sessionId)}&consumed_at=is.null`,
    body: { consumed_at: new Date().toISOString() },
  });
}

module.exports = {
  attachRegistrationUpload,
  captchaMode,
  consumeRegistrationSession,
  createMathChallenge,
  createRegistrationSession,
  registrationSession,
  registrationTokenFromRequest,
  verifyHumanChallenge,
};
