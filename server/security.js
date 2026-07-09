const crypto = require("crypto");

const ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000;

const ROLE_PERMISSIONS = {
  super_admin: new Set([
    "access_logs:read",
    "center:approve",
    "center:update",
    "stats:read",
    "patient:create",
    "patient:read",
    "patient:update",
    "patient:delete",
    "patient:export",
  ]),
  admin: new Set([
    "center:approve",
    "center:update",
    "stats:read",
    "patient:create",
    "patient:read",
    "patient:update",
    "patient:delete",
    "patient:export",
  ]),
  therapist: new Set(["patient:read", "patient:update"]),
  front_desk: new Set(["patient:create", "patient:read"]),
  read_only: new Set(["patient:read", "stats:read"]),
  operator: new Set(["center:approve", "center:update", "stats:read"]),
};

function isProduction() {
  return process.env.NODE_ENV === "production";
}

function configuredOrigins() {
  const raw = process.env.ALLOWED_ORIGINS || "http://localhost:8080,http://127.0.0.1:8080";
  return raw
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function corsHeaders() {
  const [origin] = configuredOrigins();
  return {
    "Access-Control-Allow-Origin": origin || "null",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    Vary: "Origin",
  };
}

function securityHeaders() {
  const headers = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(self)",
    "Cross-Origin-Resource-Policy": "same-site",
  };

  if (isProduction()) {
    headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains";
  }

  return headers;
}

function jsonHeaders(contentLength) {
  return {
    ...corsHeaders(),
    ...securityHeaders(),
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": contentLength,
  };
}

function textHeaders(contentType, contentLength) {
  return {
    ...corsHeaders(),
    ...securityHeaders(),
    "Content-Type": contentType,
    "Content-Length": contentLength,
  };
}

function isHttpsRequest(req) {
  return Boolean(req.socket.encrypted) || req.headers["x-forwarded-proto"] === "https";
}

function isLocalRequest(req) {
  const host = req.headers.host || "";
  return host.startsWith("localhost:") || host.startsWith("127.0.0.1:");
}

function rejectInsecureRequest(req, res, sendJson) {
  const mustUseHttps = isProduction() || process.env.REQUIRE_HTTPS === "true";
  if (!mustUseHttps || isHttpsRequest(req) || (!isProduction() && isLocalRequest(req))) {
    return false;
  }

  sendJson(res, 403, { error: "HTTPS 연결만 허용됩니다." });
  return true;
}

function createRateLimiter({ windowMs = 60_000, max = 120 } = {}) {
  const buckets = new Map();

  return function rateLimit(req, res, sendJson) {
    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown";
    const key = `${ip}:${req.url.split("?")[0]}`;
    const now = Date.now();
    const bucket = buckets.get(key) || { count: 0, resetAt: now + windowMs };

    if (now > bucket.resetAt) {
      bucket.count = 0;
      bucket.resetAt = now + windowMs;
    }

    bucket.count += 1;
    buckets.set(key, bucket);

    if (bucket.count > max) {
      sendJson(res, 429, { error: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." });
      return false;
    }

    return true;
  };
}

function hasPermission(user, permission) {
  if (!user) return false;
  const rolePermissions = ROLE_PERMISSIONS[user.role] || new Set();
  return rolePermissions.has(permission);
}

function canAccessPatient(user, patient, relationship) {
  if (!user || !patient) return false;
  if (user.role === "admin" && user.organizationId === patient.organizationId) return true;
  if (user.organizationId !== patient.organizationId) return false;
  if (user.role === "read_only") return relationship?.canRead === true;
  if (user.role === "front_desk") return relationship?.canRead === true;
  if (user.role === "therapist") return relationship?.therapistUserId === user.id;
  return false;
}

function cleanAuditText(value, maxLength = 120) {
  return String(value || "")
    .replace(/[\r\n\t]/g, " ")
    .replace(/password|token|diagnosis|memo|name|phone/gi, "[redacted]")
    .trim()
    .slice(0, maxLength);
}

function appendAuditLog(db, entry) {
  if (!Array.isArray(db.auditLogs)) db.auditLogs = [];
  db.auditLogs.push({
    id: crypto.randomUUID(),
    actorUserId: entry.actorUserId || "anonymous",
    organizationId: entry.organizationId || "unknown",
    action: cleanAuditText(entry.action, 80),
    objectType: cleanAuditText(entry.objectType, 60),
    objectId: cleanAuditText(entry.objectId, 120),
    status: entry.status === "denied" ? "denied" : "success",
    createdAt: new Date().toISOString(),
  });
}

function appendAccessLog(db, entry) {
  if (!Array.isArray(db.accessLogs)) db.accessLogs = [];
  db.accessLogs.push({
    id: crypto.randomUUID(),
    actorUserId: cleanAuditText(entry.actorUserId || "anonymous", 80),
    actorRole: cleanAuditText(entry.actorRole || "anonymous", 40),
    organizationId: cleanAuditText(entry.organizationId || "unknown", 80),
    source: cleanAuditText(entry.source || "unknown", 40),
    method: cleanAuditText(entry.method || "GET", 12),
    path: cleanAuditText(entry.path || "/", 160),
    statusCode: Number(entry.statusCode) || 200,
    ip: cleanAuditText(entry.ip || "unknown", 80),
    userAgent: cleanAuditText(entry.userAgent || "unknown", 180),
    createdAt: new Date().toISOString(),
  });

  if (db.accessLogs.length > 1000) {
    db.accessLogs = db.accessLogs.slice(-1000);
  }
}

function encryptionKeyFromBase64(base64Key) {
  if (!base64Key) {
    throw new Error("Missing encryption key");
  }

  const key = Buffer.from(base64Key, "base64");
  if (key.length !== 32) {
    throw new Error("AES-256-GCM key must be 32 bytes");
  }
  return key;
}

function encryptField(value, base64Key) {
  const key = encryptionKeyFromBase64(base64Key);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(String(value || ""), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return {
    alg: "AES-256-GCM",
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  };
}

function decryptField(payload, base64Key) {
  const key = encryptionKeyFromBase64(base64Key);
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(payload.iv, "base64")
  );
  decipher.setAuthTag(Buffer.from(payload.tag, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, "base64")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}

module.exports = {
  ACCESS_TOKEN_TTL_MS,
  appendAccessLog,
  appendAuditLog,
  canAccessPatient,
  cleanAuditText,
  createRateLimiter,
  decryptField,
  encryptField,
  hasPermission,
  isProduction,
  jsonHeaders,
  rejectInsecureRequest,
  textHeaders,
};
