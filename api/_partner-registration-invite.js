const crypto = require("crypto");

const INVITE_TTL_SECONDS = 14 * 24 * 60 * 60;

function inviteSecret() {
  return String(process.env.PARTNER_INVITE_SECRET || process.env.ADMIN_SESSION_SECRET || "");
}

function partnerInviteConfigured() {
  return process.env.PARTNER_INVITE_ENFORCEMENT !== "disabled" && Boolean(inviteSecret());
}

function encode(value) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function sign(encodedPayload) {
  return crypto.createHmac("sha256", inviteSecret()).update(encodedPayload).digest("base64url");
}

function issuePartnerRegistrationInvite(application, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (!inviteSecret()) throw new Error("PARTNER_INVITE_SECRET is not configured");
  const payload = {
    applicationId: String(application.id || ""),
    email: String(application.contact_email || application.contactEmail || "").trim().toLowerCase(),
    exp: nowSeconds + INVITE_TTL_SECONDS,
  };
  if (!payload.applicationId || !payload.email) throw new Error("Partner application is incomplete");
  const encoded = encode(payload);
  return {
    token: `${encoded}.${sign(encoded)}`,
    expiresAt: new Date(payload.exp * 1000).toISOString(),
  };
}

function verifyPartnerRegistrationInvite(token, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (!inviteSecret()) return null;
  const [encoded, signature, ...rest] = String(token || "").split(".");
  if (!encoded || !signature || rest.length) return null;
  const expected = sign(encoded);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(actualBuffer, expectedBuffer)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (!payload.applicationId || !payload.email || Number(payload.exp) <= nowSeconds) return null;
    return {
      applicationId: String(payload.applicationId),
      email: String(payload.email).trim().toLowerCase(),
      expiresAt: new Date(Number(payload.exp) * 1000).toISOString(),
    };
  } catch {
    return null;
  }
}

module.exports = {
  INVITE_TTL_SECONDS,
  issuePartnerRegistrationInvite,
  partnerInviteConfigured,
  verifyPartnerRegistrationInvite,
};
