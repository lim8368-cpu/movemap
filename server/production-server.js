const fs = require("fs");
const http = require("http");
const path = require("path");
const { validateRuntimeEnvironment } = require("./environment");
const { startMonitoring } = require("./monitoring");
const {
  adminIdentityFromRequest,
  recordAccessLog,
  recordErrorLog,
  requestId,
  supabaseRequest,
} = require("../api/_shared");
const { ownerSessionFromRequest } = require("../api/_owner-auth");
const { validateClientDataConfig } = require("../api/_sensitive-data");

const runtimeEnvironment = validateRuntimeEnvironment();
if (runtimeEnvironment.appEnv !== "development") validateClientDataConfig();

process.on("unhandledRejection", (reason) => {
  const error = reason instanceof Error ? reason : new Error(String(reason || "Unhandled rejection"));
  console.error("unhandled rejection", error);
  recordErrorLog(null, error, {
    errorCode: "unhandled_rejection",
    statusCode: 500,
    source: "process",
  }).catch(() => {});
});

process.on("uncaughtException", (error) => {
  console.error("uncaught exception", error);
  const forceExit = setTimeout(() => process.exit(1), 3_000);
  recordErrorLog(null, error, {
    errorCode: "uncaught_exception",
    statusCode: 500,
    source: "process",
  }).finally(() => {
    clearTimeout(forceExit);
    process.exit(1);
  });
});

const ROOT = path.resolve(__dirname, "..");
const STATIC_ROOT = path.join(ROOT, "dist");
const PORT = Number(process.env.PORT || 3000);
const MAX_BODY_BYTES = 4 * 1024 * 1024;

const apiRoutes = new Map([
  ["/api/access-logs", require("../api/access-logs")],
  ["/api/admin-mfa", require("../api/admin-mfa")],
  ["/api/auth/start", require("../api/auth-start")],
  ["/api/auth/naver/callback", require("../api/auth-naver-callback")],
  ["/api/auth/profile", require("../api/auth-profile")],
  ["/api/approve-center", require("../api/approve-center")],
  ["/api/bookings", require("../api/bookings")],
  ["/api/center-applications", require("../api/center-applications")],
  ["/api/center-invitations", require("../api/center-invitations")],
  ["/api/center-clients", require("../api/center-clients")],
  ["/api/center-client-assessments", require("../api/center-client-assessments")],
  ["/api/center-members", require("../api/center-members")],
  ["/api/centers", require("../api/centers")],
  ["/api/collaboration-inquiries", require("../api/collaboration-inquiries")],
  ["/api/config", require("../api/config")],
  ["/api/events", require("../api/events")],
  ["/api/favorites", require("../api/favorites")],
  ["/api/login", require("../api/login")],
  ["/api/logout", require("../api/logout")],
  ["/api/owner-accounts", require("../api/owner-accounts")],
  ["/api/owner-dashboard", require("../api/owner-dashboard")],
  ["/api/owner-bookings", require("../api/owner-bookings")],
  ["/api/owner-login", require("../api/owner-login")],
  ["/api/owner-logout", require("../api/owner-logout")],
  ["/api/owner-uploads", require("../api/owner-uploads")],
  ["/api/partner-applications", require("../api/partner-applications")],
  ["/api/partner-registration-invites", require("../api/partner-registration-invites")],
  ["/api/operations", require("../api/operations")],
  ["/api/place-search", require("../api/place-search")],
  ["/api/platform-users", require("../api/platform-users")],
  ["/api/reviews", require("../api/reviews")],
  ["/api/registration-challenge", require("../api/registration-challenge")],
  ["/api/registration-session", require("../api/registration-session")],
  ["/api/stats", require("../api/stats")],
  ["/api/uploads", require("../api/uploads")],
]);
const locationHandler = require("../api/centers/[id]/location");

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

function setSecurityHeaders(res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(self), geolocation=(self), microphone=()");
}

function sendText(res, statusCode, body) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Content-Length", Buffer.byteLength(body));
  res.end(body);
}

function queryObject(url) {
  const values = {};
  for (const [key, value] of url.searchParams.entries()) {
    if (values[key] === undefined) values[key] = value;
  }
  return values;
}

function readRequestBody(req) {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    return Promise.resolve(undefined);
  }

  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error("Request body too large"), { statusCode: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      const body = Buffer.concat(chunks);
      const type = String(req.headers["content-type"] || "").split(";")[0].trim();
      if (type === "application/json") {
        try {
          resolve(body.length ? JSON.parse(body.toString("utf8")) : {});
        } catch {
          reject(Object.assign(new Error("Invalid JSON"), { statusCode: 400 }));
        }
        return;
      }
      resolve(body);
    });
    req.on("error", reject);
  });
}

function findApiHandler(pathname, req) {
  const direct = apiRoutes.get(pathname);
  if (direct) return direct;

  const match = pathname.match(/^\/api\/centers\/([^/]+)\/location$/);
  if (match) {
    req.query.id = decodeURIComponent(match[1]);
    return locationHandler;
  }

  return null;
}

async function serveApi(req, res, url) {
  req.query = queryObject(url);
  const handler = findApiHandler(url.pathname, req);
  if (!handler) {
    sendText(res, 404, "API endpoint not found");
    return;
  }

  try {
    req.body = await readRequestBody(req);
    await handler(req, res);
  } catch (error) {
    console.error("api gateway failed", error);
    await recordErrorLog(req, error, {
      errorCode: "api_gateway_failed",
      statusCode: error.statusCode || 500,
      source: "gateway",
    });
    if (!res.headersSent) sendText(res, error.statusCode || 500, "Request failed");
    else if (!res.writableEnded) res.end();
  }
}

function staticPathFor(pathname) {
  let requested = pathname;
  if (requested === "/") requested = "/index.html";
  if (requested === "/admin/") requested = "/admin/index.html";
  if (requested === "/brand/") requested = "/brand/index.html";
  if (requested === "/collaboration/") requested = "/collaboration/index.html";
  if (requested === "/partner-apply/") requested = "/partner-apply/index.html";
  if (requested === "/register/") requested = "/register/index.html";
  if (requested === "/center-dashboard/") requested = "/center-dashboard/index.html";
  if (requested === "/account/") requested = "/account/index.html";
  if (requested === "/auth/callback/") requested = "/auth/callback/index.html";
  if (requested.startsWith("/web/")) requested = requested.slice(4);

  const decoded = decodeURIComponent(requested);
  const filePath = path.resolve(STATIC_ROOT, `.${decoded}`);
  if (!filePath.startsWith(`${STATIC_ROOT}${path.sep}`)) return "";
  return filePath;
}

function serveStatic(req, res, url) {
  if (url.pathname === "/register/" && !url.searchParams.get("invite")) {
    res.statusCode = 302;
    res.setHeader("Location", "/partner-apply/?registration=invite-required");
    res.end();
    return;
  }
  if (
    url.pathname === "/admin" ||
    url.pathname === "/brand" ||
    url.pathname === "/collaboration" ||
    url.pathname === "/partner-apply" ||
    url.pathname === "/register" ||
    url.pathname === "/center-dashboard" ||
    url.pathname === "/account" ||
    url.pathname === "/auth/callback"
  ) {
    res.statusCode = 308;
    res.setHeader("Location", `${url.pathname}/${url.search}`);
    res.end();
    return;
  }

  const filePath = staticPathFor(url.pathname);
  if (!filePath || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    sendText(res, 404, "Not found");
    return;
  }

  const extension = path.extname(filePath).toLowerCase();
  const stat = fs.statSync(filePath);
  res.statusCode = 200;
  res.setHeader("Content-Type", contentTypes[extension] || "application/octet-stream");
  res.setHeader("Content-Length", stat.size);
  res.setHeader(
    "Cache-Control",
    extension === ".html" ? "no-cache" : "public, max-age=3600, must-revalidate"
  );
  if (req.method === "HEAD") {
    res.end();
    return;
  }
  fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer(async (req, res) => {
  setSecurityHeaders(res);
  const startedAt = Date.now();
  const currentRequestId = requestId(req);
  res.setHeader("X-Request-ID", currentRequestId);
  res.once("finish", () => {
    const pathname = new URL(req.url || "/", "http://localhost").pathname;
    if (
      pathname === "/healthz" ||
      pathname === "/readyz" ||
      pathname.startsWith("/assets/") ||
      /\.(css|js|png|jpe?g|svg|ico|webp)$/i.test(pathname)
    ) return;
    const admin = adminIdentityFromRequest(req);
    const owner = ownerSessionFromRequest(req);
    const auth = req.authContext || {};
    recordAccessLog(req, {
      actorUserId: admin?.userId || auth.actorUserId || owner?.userId || null,
      actorRole: admin?.role || auth.actorRole || (owner ? "center_member" : "anonymous"),
      centerId: req.query?.centerId || req.body?.centerId || auth.centerId || owner?.centerId || null,
      statusCode: res.statusCode,
      durationMs: Date.now() - startedAt,
    }).catch(() => {});
  });
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  if (url.pathname === "/healthz") {
    res.setHeader("Cache-Control", "no-store");
    sendText(res, 200, "ok");
    return;
  }

  if (url.pathname === "/readyz") {
    res.setHeader("Cache-Control", "no-store");
    try {
      await supabaseRequest("centers", { query: "?select=id&limit=1" });
      sendText(res, 200, "ready");
    } catch {
      sendText(res, 503, "database unavailable");
    }
    return;
  }

  if (url.pathname.startsWith("/api/")) {
    await serveApi(req, res, url);
    return;
  }

  if (!["GET", "HEAD"].includes(req.method)) {
    sendText(res, 405, "Method not allowed");
    return;
  }

  serveStatic(req, res, url);
});

server.requestTimeout = 30_000;
server.headersTimeout = 35_000;
server.keepAliveTimeout = 5_000;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`DAIL ${runtimeEnvironment.appEnv} server listening on port ${PORT}`);
  startMonitoring();
});

function shutdown(signal) {
  console.log(`${signal} received, shutting down`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
