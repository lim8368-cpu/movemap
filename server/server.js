const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const security = require("./security");

loadLocalEnv(path.resolve(__dirname, "..", ".env"));

const PORT = Number(process.env.PORT || 8090);
const ROOT = path.resolve(__dirname, "..");
const DB_PATH = path.join(__dirname, "data", "db.json");
const ADMIN_DIR = path.join(ROOT, "admin");
const WEB_DIR = path.join(ROOT, "web");
const REGISTER_DIR = path.join(ROOT, "register");

const sessions = new Map();
const rateLimit = security.createRateLimiter({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 60_000),
  max: Number(process.env.RATE_LIMIT_MAX || 160),
});

function loadLocalEnv(filePath) {
  if (process.env.NODE_ENV === "production" || !fs.existsSync(filePath)) return;

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, "");
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function readDb() {
  return JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
}

function writeDb(db) {
  fs.writeFileSync(DB_PATH, `${JSON.stringify(db, null, 2)}\n`);
}

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, security.jsonHeaders(Buffer.byteLength(body)));
  res.end(body);
}

function sendText(res, status, text, contentType = "text/plain; charset=utf-8") {
  res.writeHead(status, security.textHeaders(contentType, Buffer.byteLength(text)));
  res.end(text);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 4_500_000) {
        req.destroy();
        reject(new Error("Body too large"));
      }
    });
    req.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });
  });
}

function getToken(req) {
  const auth = req.headers.authorization || "";
  return auth.startsWith("Bearer ") ? auth.slice(7) : "";
}

function requireSession(req, res) {
  const token = getToken(req);
  if (!token || !sessions.has(token)) {
    sendJson(res, 401, { error: "로그인이 필요합니다." });
    return null;
  }

  const session = sessions.get(token);
  if (session.expiresAt <= Date.now()) {
    sessions.delete(token);
    sendJson(res, 401, { error: "세션이 만료되었습니다. 다시 로그인해 주세요." });
    return null;
  }

  return session;
}

function requirePermission(req, res, permission) {
  const session = requireSession(req, res);
  if (!session) return null;

  if (!security.hasPermission(session, permission)) {
    const db = readDb();
    security.appendAuditLog(db, {
      actorUserId: session.id,
      organizationId: session.organizationId,
      action: permission,
      objectType: "api",
      objectId: req.url,
      status: "denied",
    });
    writeDb(db);
    sendJson(res, 403, { error: "권한이 없습니다." });
    return null;
  }

  return session;
}

function summarizeStats(db) {
  const byCenter = new Map();

  for (const center of db.centers) {
    byCenter.set(center.id, {
      ...center,
      views: 0,
      contactClicks: 0,
      lastEventAt: "",
    });
  }

  for (const event of db.events) {
    const stat = byCenter.get(event.centerId);
    if (!stat) continue;

    if (event.type === "center_view") stat.views += 1;
    if (event.type === "contact_click") stat.contactClicks += 1;
    if (!stat.lastEventAt || event.createdAt > stat.lastEventAt) {
      stat.lastEventAt = event.createdAt;
    }
  }

  const centers = [...byCenter.values()];
  return {
    totals: {
      centers: db.centers.length,
      pendingCenters: (db.centerApplications || []).filter((item) => item.status === "pending").length,
      views: centers.reduce((sum, center) => sum + center.views, 0),
      contactClicks: centers.reduce((sum, center) => sum + center.contactClicks, 0),
      events: db.events.length,
    },
    centers,
    centerApplications: (db.centerApplications || []).slice().reverse(),
    recentEvents: db.events.slice(-20).reverse(),
  };
}

function cleanText(value, maxLength = 160) {
  return String(value || "").trim().slice(0, maxLength);
}

function slugify(value) {
  const base = cleanText(value, 80)
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || `center-${Date.now()}`;
}

function uniqueCenterId(db, name) {
  const base = slugify(name);
  let id = base;
  let index = 2;
  while (db.centers.some((center) => center.id === id)) {
    id = `${base}-${index}`;
    index += 1;
  }
  return id;
}

function regionFromArea(area) {
  if (area.includes("강남")) return "gangnam";
  if (area.includes("마포")) return "mapo";
  if (area.includes("분당") || area.includes("성남")) return "bundang";
  if (area.includes("서울")) return "seoul";
  if (area.includes("경기")) return "gyeonggi";
  return "other";
}

function fallbackCoordinates(area, address) {
  const text = `${area} ${address}`;
  if (text.includes("강남")) return { lat: 37.4979, lng: 127.0276 };
  if (text.includes("마포")) return { lat: 37.5557, lng: 126.9236 };
  if (text.includes("분당") || text.includes("성남")) return { lat: 37.3827, lng: 127.1189 };
  if (text.includes("서울")) return { lat: 37.5665, lng: 126.978 };
  if (text.includes("경기")) return { lat: 37.4138, lng: 127.5183 };
  return { lat: 37.5665, lng: 126.978 };
}

function tagsFromText(text) {
  const value = cleanText(text, 240);
  const tags = value
    .split(/[,/·\n]/)
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 4);
  return tags.length ? tags : ["운동 관리", "1:1 평가"];
}

function applicationToCenter(db, application) {
  const fallback = fallbackCoordinates(application.area, application.address);
  const lat = Number(application.lat) || fallback.lat;
  const lng = Number(application.lng) || fallback.lng;

  return {
    id: application.centerId || uniqueCenterId(db, application.centerName),
    name: application.centerName,
    region: regionFromArea(application.area),
    area: application.area,
    address: application.address,
    distance: "신규",
    rating: "신규",
    reviews: "0",
    lead: application.services || application.memo || "물리치료사가 운영하는 운동센터입니다.",
    tags: tagsFromText(application.services),
    therapist: `${application.licenseHolderName} · 물리치료사 면허 확인`,
    price: "센터 문의",
    conversion: "신규 등록 센터",
    lat,
    lng,
    fallbackX: "52%",
    fallbackY: "50%",
    plan: "free",
    photoUrl: application.photoUrl,
    photoDataUrl: application.photoDataUrl,
    naverMapUrl: application.naverMapUrl,
    sourceApplicationId: application.id,
  };
}

function contentTypeFor(filePath) {
  const ext = path.extname(filePath);
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".css") return "text/css; charset=utf-8";
  if (ext === ".js") return "application/javascript; charset=utf-8";
  if (ext === ".json") return "application/json; charset=utf-8";
  return "application/octet-stream";
}

function serveFile(res, baseDir, pathname) {
  const cleanPath = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.normalize(path.join(baseDir, cleanPath));

  if (!filePath.startsWith(baseDir)) {
    sendText(res, 403, "Forbidden");
    return;
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    sendText(res, 404, "Not found");
    return;
  }

  const file = fs.readFileSync(filePath);
  res.writeHead(200, {
    ...security.textHeaders(contentTypeFor(filePath), file.length),
    "Content-Type": contentTypeFor(filePath),
    "Content-Length": file.length,
  });
  res.end(file);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "OPTIONS") {
    sendJson(res, 204, {});
    return;
  }

  try {
    if (security.rejectInsecureRequest(req, res, sendJson)) return;
    if (!rateLimit(req, res, sendJson)) return;

    if (url.pathname === "/api/health") {
      sendJson(res, 200, { ok: true, service: "movemap-backend" });
      return;
    }

    if (url.pathname === "/api/login" && req.method === "POST") {
      if (security.isProduction() && !process.env.AUTH_PROVIDER) {
        sendJson(res, 503, {
          error: "운영 인증 공급자가 설정되지 않아 로그인을 중단했습니다.",
        });
        return;
      }

      const body = await readBody(req);
      const db = readDb();
      const user = db.users.find((item) => item.id === body.id);

      if (security.isProduction() && user) {
        sendJson(res, 503, {
          error: "운영 환경에서는 로컬 비밀번호 인증을 사용할 수 없습니다.",
        });
        return;
      }

      const localAdminPassword = process.env.LOCAL_ADMIN_PASSWORD;
      if (!security.isProduction() && !localAdminPassword) {
        sendJson(res, 503, {
          error: "로컬 관리자 비밀번호가 설정되지 않았습니다. .env의 LOCAL_ADMIN_PASSWORD를 설정해 주세요.",
        });
        return;
      }

      const passwordMatches = !security.isProduction() && body.password === localAdminPassword;
      if (!user) {
        sendJson(res, 401, { error: "아이디 또는 비밀번호가 맞지 않습니다." });
        return;
      }

      if (!passwordMatches) {
        sendJson(res, 401, { error: "아이디 또는 비밀번호가 맞지 않습니다." });
        return;
      }

      const token = crypto.randomBytes(32).toString("hex");
      const session = {
        id: user.id,
        role: user.role,
        organizationId: user.organizationId || "movemap",
        expiresAt: Date.now() + security.ACCESS_TOKEN_TTL_MS,
      };
      sessions.set(token, session);
      sendJson(res, 200, {
        token,
        expiresInSeconds: Math.floor(security.ACCESS_TOKEN_TTL_MS / 1000),
        user: {
          id: user.id,
          role: user.role,
          organizationId: session.organizationId,
        },
      });
      return;
    }

    if (url.pathname === "/api/logout" && req.method === "POST") {
      const session = requireSession(req, res);
      if (!session) return;
      sessions.delete(getToken(req));
      sendJson(res, 200, { ok: true });
      return;
    }

    if (url.pathname === "/api/events" && req.method === "POST") {
      const body = await readBody(req);
      if (!body.centerId || !body.type) {
        sendJson(res, 400, { error: "centerId와 type이 필요합니다." });
        return;
      }

      const db = readDb();
      const event = {
        id: crypto.randomUUID(),
        type: cleanText(body.type, 40),
        centerId: cleanText(body.centerId, 120),
        source: cleanText(body.source || "web", 40),
        detail: security.cleanAuditText(body.detail || "", 80),
        createdAt: new Date().toISOString(),
      };
      db.events.push(event);
      writeDb(db);
      sendJson(res, 201, { ok: true, event });
      return;
    }

    if (url.pathname === "/api/center-applications" && req.method === "POST") {
      const body = await readBody(req);
      if (security.isProduction() && (body.photoDataUrl || body.licenseImageDataUrl)) {
        sendJson(res, 400, {
          error: "운영 환경에서는 파일을 JSON/base64로 저장할 수 없습니다. 비공개 파일 저장소 업로드를 사용해야 합니다.",
        });
        return;
      }

      const requiredFields = [
        "centerName",
        "ownerName",
        "phone",
        "area",
        "address",
        "licenseHolderName",
        "licenseNumber",
        "licenseImageDataUrl",
      ];
      const missingField = requiredFields.find((field) => !cleanText(body[field]));

      if (missingField) {
        sendJson(res, 400, { error: "필수 항목을 모두 입력해 주세요." });
        return;
      }

      const db = readDb();
      if (!Array.isArray(db.centerApplications)) db.centerApplications = [];

      const application = {
        id: crypto.randomUUID(),
        status: "pending",
        centerName: cleanText(body.centerName, 80),
        ownerName: cleanText(body.ownerName, 40),
        phone: cleanText(body.phone, 40),
        area: cleanText(body.area, 80),
        address: cleanText(body.address, 160),
        naverMapUrl: cleanText(body.naverMapUrl, 260),
        lat: cleanText(body.lat, 40),
        lng: cleanText(body.lng, 40),
        website: cleanText(body.website, 160),
        photoUrl: cleanText(body.photoUrl, 260),
        photoDataUrl: cleanText(body.photoDataUrl, 1_800_000),
        licenseHolderName: cleanText(body.licenseHolderName, 40),
        licenseNumber: cleanText(body.licenseNumber, 60),
        licenseImageDataUrl: cleanText(body.licenseImageDataUrl, 1_800_000),
        services: cleanText(body.services, 240),
        memo: cleanText(body.memo, 400),
        consent: Boolean(body.consent),
        createdAt: new Date().toISOString(),
      };

      db.centerApplications.push(application);
      writeDb(db);
      sendJson(res, 201, { ok: true, application });
      return;
    }

    if (
      url.pathname.startsWith("/api/center-applications/") &&
      url.pathname.endsWith("/approve") &&
      req.method === "POST"
    ) {
      const session = requirePermission(req, res, "center:approve");
      if (!session) return;

      const applicationId = url.pathname
        .replace("/api/center-applications/", "")
        .replace("/approve", "");
      const db = readDb();
      const application = (db.centerApplications || []).find((item) => item.id === applicationId);

      if (!application) {
        sendJson(res, 404, { error: "등록 신청을 찾을 수 없습니다." });
        return;
      }

      if (application.status === "approved") {
        const center = db.centers.find((item) => item.sourceApplicationId === application.id);
        security.appendAuditLog(db, {
          actorUserId: session.id,
          organizationId: session.organizationId,
          action: "center:approve",
          objectType: "centerApplication",
          objectId: application.id,
          status: "success",
        });
        writeDb(db);
        sendJson(res, 200, { ok: true, center, application });
        return;
      }

      const center = applicationToCenter(db, application);
      application.status = "approved";
      application.approvedAt = new Date().toISOString();
      application.centerId = center.id;
      db.centers.push(center);
      security.appendAuditLog(db, {
        actorUserId: session.id,
        organizationId: session.organizationId,
        action: "center:approve",
        objectType: "centerApplication",
        objectId: application.id,
        status: "success",
      });
      writeDb(db);
      sendJson(res, 200, { ok: true, center, application });
      return;
    }

    if (
      url.pathname.startsWith("/api/centers/") &&
      url.pathname.endsWith("/location") &&
      req.method === "POST"
    ) {
      const session = requirePermission(req, res, "center:update");
      if (!session) return;

      const centerId = decodeURIComponent(
        url.pathname.replace("/api/centers/", "").replace("/location", "")
      );
      const body = await readBody(req);
      const lat = Number(body.lat);
      const lng = Number(body.lng);

      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        sendJson(res, 400, { error: "위도와 경도를 숫자로 입력해 주세요." });
        return;
      }

      const db = readDb();
      const center = db.centers.find((item) => item.id === centerId);
      if (!center) {
        sendJson(res, 404, { error: "센터를 찾을 수 없습니다." });
        return;
      }

      center.lat = lat;
      center.lng = lng;
      center.area = cleanText(body.area, 80) || center.area;
      center.address = cleanText(body.address, 160) || center.address;
      center.region = regionFromArea(center.area);
      center.naverMapUrl =
        cleanText(body.naverMapUrl, 260) ||
        `https://map.naver.com/p/search/${encodeURIComponent(center.address || center.area)}`;

      const application = (db.centerApplications || []).find(
        (item) => item.id === center.sourceApplicationId
      );
      if (application) {
        application.lat = String(lat);
        application.lng = String(lng);
        application.area = center.area;
        application.address = center.address;
        application.naverMapUrl = center.naverMapUrl;
      }

      security.appendAuditLog(db, {
        actorUserId: session.id,
        organizationId: session.organizationId,
        action: "center:update-location",
        objectType: "center",
        objectId: center.id,
        status: "success",
      });
      writeDb(db);
      sendJson(res, 200, { ok: true, center });
      return;
    }

    if (url.pathname === "/api/stats" && req.method === "GET") {
      if (!requirePermission(req, res, "stats:read")) return;
      sendJson(res, 200, summarizeStats(readDb()));
      return;
    }

    if (url.pathname === "/api/centers" && req.method === "GET") {
      sendJson(res, 200, { centers: readDb().centers });
      return;
    }

    if (url.pathname.startsWith("/admin")) {
      serveFile(res, ADMIN_DIR, url.pathname.replace(/^\/admin/, "") || "/");
      return;
    }

    if (url.pathname.startsWith("/web")) {
      serveFile(res, WEB_DIR, url.pathname.replace(/^\/web/, "") || "/");
      return;
    }

    if (url.pathname.startsWith("/register")) {
      serveFile(res, REGISTER_DIR, url.pathname.replace(/^\/register/, "") || "/");
      return;
    }

    sendJson(res, 404, { error: "찾을 수 없습니다." });
  } catch (error) {
    console.error("Movemap server error", {
      method: req.method,
      path: url.pathname,
      message: security.isProduction() ? "redacted" : error.message,
    });
    sendJson(res, 500, { error: "서버 오류가 발생했습니다." });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Movemap backend running locally at http://localhost:${PORT}`);
});
