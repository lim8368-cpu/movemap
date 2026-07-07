const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = Number(process.env.PORT || 8090);
const ROOT = path.resolve(__dirname, "..");
const DB_PATH = path.join(__dirname, "data", "db.json");
const ADMIN_DIR = path.join(ROOT, "admin-dashboard");
const WEB_DIR = path.join(ROOT, "web-browser");
const REGISTER_DIR = path.join(ROOT, "center-registration");

const sessions = new Map();

function readDb() {
  return JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
}

function writeDb(db) {
  fs.writeFileSync(DB_PATH, `${JSON.stringify(db, null, 2)}\n`);
}

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

function sendText(res, status, text, contentType = "text/plain; charset=utf-8") {
  res.writeHead(status, {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": contentType,
    "Content-Length": Buffer.byteLength(text),
  });
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
  return sessions.get(token);
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
    if (url.pathname === "/api/health") {
      sendJson(res, 200, { ok: true, service: "movemap-backend" });
      return;
    }

    if (url.pathname === "/api/login" && req.method === "POST") {
      const body = await readBody(req);
      const db = readDb();
      const user = db.users.find(
        (item) => item.id === body.id && item.password === body.password
      );

      if (!user) {
        sendJson(res, 401, { error: "아이디 또는 비밀번호가 맞지 않습니다." });
        return;
      }

      const token = crypto.randomBytes(24).toString("hex");
      sessions.set(token, { id: user.id, role: user.role });
      sendJson(res, 200, { token, user: { id: user.id, role: user.role } });
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
        type: body.type,
        centerId: body.centerId,
        source: body.source || "web",
        detail: body.detail || "",
        createdAt: new Date().toISOString(),
      };
      db.events.push(event);
      writeDb(db);
      sendJson(res, 201, { ok: true, event });
      return;
    }

    if (url.pathname === "/api/center-applications" && req.method === "POST") {
      const body = await readBody(req);
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
      if (!requireSession(req, res)) return;

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
        sendJson(res, 200, { ok: true, center, application });
        return;
      }

      const center = applicationToCenter(db, application);
      application.status = "approved";
      application.approvedAt = new Date().toISOString();
      application.centerId = center.id;
      db.centers.push(center);
      writeDb(db);
      sendJson(res, 200, { ok: true, center, application });
      return;
    }

    if (
      url.pathname.startsWith("/api/centers/") &&
      url.pathname.endsWith("/location") &&
      req.method === "POST"
    ) {
      if (!requireSession(req, res)) return;

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

      writeDb(db);
      sendJson(res, 200, { ok: true, center });
      return;
    }

    if (url.pathname === "/api/stats" && req.method === "GET") {
      if (!requireSession(req, res)) return;
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
    sendJson(res, 500, { error: "서버 오류가 발생했습니다.", detail: error.message });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Movemap backend running at http://localhost:${PORT}`);
});
