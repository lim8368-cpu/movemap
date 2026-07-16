const crypto = require("crypto");
const { requestUsesHttps } = require("./_shared");

const OWNER_COOKIE_NAME = "dail_center_session";
const OWNER_SESSION_TTL_SECONDS = 8 * 60 * 60;

function sessionSecret() {
  const secret = process.env.OWNER_SESSION_SECRET || process.env.ADMIN_SESSION_SECRET;
  if (!secret) throw new Error("OWNER_SESSION_SECRET is not configured");
  return secret;
}

function parseScryptHash(encoded) {
  const [algorithm, saltValue, hashValue] = String(encoded || "").split("$");
  if (algorithm !== "scrypt" || !saltValue || !hashValue) return null;
  try {
    return { salt: Buffer.from(saltValue, "base64url"), hash: Buffer.from(hashValue, "base64url") };
  } catch {
    return null;
  }
}

function hashOwnerPassword(password) {
  if (typeof password !== "string" || password.length < 10 || password.length > 128) {
    throw new Error("비밀번호는 10자 이상 128자 이하로 입력해 주세요.");
  }
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `scrypt$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

function verifyOwnerPassword(password, encoded) {
  const stored = parseScryptHash(encoded);
  if (!stored || typeof password !== "string") return false;
  const candidate = crypto.scryptSync(password, stored.salt, stored.hash.length);
  return candidate.length === stored.hash.length && crypto.timingSafeEqual(candidate, stored.hash);
}

function signOwnerSession(account, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({
    role: "center_owner",
    accountId: account.id,
    centerId: account.center_id,
    email: account.email,
    exp: now + OWNER_SESSION_TTL_SECONDS * 1000,
  })).toString("base64url");
  const signature = crypto.createHmac("sha256", sessionSecret()).update(`owner.${payload}`).digest("base64url");
  return `${payload}.${signature}`;
}

function verifyOwnerSession(token, now = Date.now()) {
  const [payload, signature] = String(token || "").split(".");
  if (!payload || !signature) return null;
  const expected = crypto.createHmac("sha256", sessionSecret()).update(`owner.${payload}`).digest("base64url");
  const given = Buffer.from(signature);
  const wanted = Buffer.from(expected);
  if (given.length !== wanted.length || !crypto.timingSafeEqual(given, wanted)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (data.role !== "center_owner" || !data.centerId || Number(data.exp) <= now) return null;
    return data;
  } catch {
    return null;
  }
}

function cookieValue(req, name) {
  const prefix = `${name}=`;
  const item = String(req.headers.cookie || "").split(";").map((part) => part.trim()).find((part) => part.startsWith(prefix));
  return item ? decodeURIComponent(item.slice(prefix.length)) : "";
}

function ownerSessionFromRequest(req) {
  const authorization = String(req.headers.authorization || "");
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : cookieValue(req, OWNER_COOKIE_NAME);
  return verifyOwnerSession(token);
}

function ownerSessionCookie(token, req) {
  const secure = requestUsesHttps(req) ? "; Secure" : "";
  return `${OWNER_COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly${secure}; SameSite=Strict; Path=/; Max-Age=${OWNER_SESSION_TTL_SECONDS}`;
}

function clearOwnerSessionCookie(req) {
  const secure = requestUsesHttps(req) ? "; Secure" : "";
  return `${OWNER_COOKIE_NAME}=; HttpOnly${secure}; SameSite=Strict; Path=/; Max-Age=0`;
}

module.exports = {
  OWNER_SESSION_TTL_SECONDS,
  clearOwnerSessionCookie,
  hashOwnerPassword,
  ownerSessionCookie,
  ownerSessionFromRequest,
  signOwnerSession,
  verifyOwnerPassword,
  verifyOwnerSession,
};
