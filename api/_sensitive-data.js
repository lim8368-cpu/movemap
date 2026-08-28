const crypto = require("crypto");

function keyRing() {
  const raw = String(process.env.CENTER_CLIENT_DATA_KEYS || "").trim();
  if (!raw) throw new Error("CENTER_CLIENT_DATA_KEYS is not configured");

  const entries = raw.split(",").map((entry) => entry.trim()).filter(Boolean);
  const keys = new Map();
  for (const entry of entries) {
    const separator = entry.indexOf(":");
    if (separator <= 0) throw new Error("CENTER_CLIENT_DATA_KEYS has an invalid entry");
    const version = entry.slice(0, separator).trim();
    const encoded = entry.slice(separator + 1).trim();
    if (!/^[a-zA-Z0-9_-]{1,24}$/.test(version) || !encoded) {
      throw new Error("CENTER_CLIENT_DATA_KEYS has an invalid entry");
    }
    const key = Buffer.from(encoded, "base64");
    if (key.length !== 32) throw new Error("Center client encryption keys must be 32 bytes");
    if (keys.has(version)) throw new Error("CENTER_CLIENT_DATA_KEYS contains a duplicate version");
    keys.set(version, key);
  }
  if (!keys.size) throw new Error("CENTER_CLIENT_DATA_KEYS is not configured");
  const activeVersion = String(process.env.CENTER_CLIENT_DATA_ACTIVE_VERSION || "").trim() || entries.at(-1).split(":", 1)[0].trim();
  if (!keys.has(activeVersion)) throw new Error("CENTER_CLIENT_DATA_ACTIVE_VERSION is not in the key ring");
  return { activeVersion, keys };
}

function validateClientDataConfig() {
  keyRing();
  const secret = String(process.env.CENTER_CLIENT_LOOKUP_SECRET || "");
  if (secret.length < 32) throw new Error("CENTER_CLIENT_LOOKUP_SECRET must be at least 32 characters");
  return true;
}

function associatedData({ centerId, clientId, field }) {
  if (!centerId || !clientId || !field) throw new Error("Sensitive data context is incomplete");
  return Buffer.from(`center-client:${centerId}:${clientId}:${field}`, "utf8");
}

function encryptClientField(value, context) {
  const plaintext = String(value ?? "");
  if (!plaintext) return null;
  const { activeVersion, keys } = keyRing();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", keys.get(activeVersion), iv);
  cipher.setAAD(associatedData(context));
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return {
    v: activeVersion,
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  };
}

function decryptClientField(payload, context) {
  if (payload === null || payload === undefined) return "";
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Encrypted center client field is invalid");
  }
  const { keys } = keyRing();
  const key = keys.get(String(payload.v || ""));
  if (!key) throw new Error("Encrypted center client field uses an unknown key version");
  try {
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(String(payload.iv || ""), "base64"));
    decipher.setAAD(associatedData(context));
    decipher.setAuthTag(Buffer.from(String(payload.tag || ""), "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(String(payload.ciphertext || ""), "base64")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new Error("Encrypted center client field authentication failed");
  }
}

function normalizedPhone(value) {
  return String(value || "").replace(/\D/g, "");
}

function hashClientPhone(value, centerId) {
  const secret = String(process.env.CENTER_CLIENT_LOOKUP_SECRET || "");
  if (secret.length < 32) throw new Error("CENTER_CLIENT_LOOKUP_SECRET must be at least 32 characters");
  const normalized = normalizedPhone(value);
  if (!normalized) return "";
  if (!centerId) throw new Error("Center client phone lookup context is incomplete");
  return crypto.createHmac("sha256", secret).update(`center-client-phone:${centerId}:${normalized}`).digest("base64url");
}

module.exports = {
  decryptClientField,
  encryptClientField,
  hashClientPhone,
  normalizedPhone,
  validateClientDataConfig,
};
