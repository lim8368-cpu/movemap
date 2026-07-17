const crypto = require("crypto");

const ADMIN_SESSION_TTL_SECONDS = 15 * 60;
const ADMIN_COOKIE_NAME = "movemap_admin_session";
const sampleCenters = [
  {
    id: "core",
    name: "코어핏 무브센터",
    region: "gangnam",
    area: "서울 강남구",
    distance: "1.2km",
    rating: "4.9",
    reviews: "128",
    lead: "허리 통증 이후 재발 방지 운동과 체형 평가를 함께 진행합니다.",
    tags: ["허리", "수술 후", "필라테스", "1:1 평가"],
    therapist: "김민재 센터장 · 물리치료사 출신",
    price: "첫 평가 30,000원",
    conversion: "상담 응답 평균 18분",
    lat: 37.4979,
    lng: 127.0276,
    fallbackX: "58%",
    fallbackY: "54%",
    plan: "pro",
    photoDataUrl: "",
  },
  {
    id: "reform",
    name: "리폼무브 스튜디오",
    region: "mapo",
    area: "서울 마포구",
    distance: "3.8km",
    rating: "4.8",
    reviews: "94",
    lead: "직장인 목, 어깨 불편감과 자세 습관을 운동 루틴으로 관리합니다.",
    tags: ["어깨", "거북목", "소그룹", "자세 분석"],
    therapist: "박서연 대표 · 물리치료사 출신",
    price: "체험 수업 20,000원",
    conversion: "이번 주 예약 가능",
    lat: 37.5557,
    lng: 126.9236,
    fallbackX: "42%",
    fallbackY: "40%",
    plan: "basic",
    photoDataUrl: "",
  },
  {
    id: "posture",
    name: "포스처랩 분당",
    region: "bundang",
    area: "경기 성남시 분당구",
    distance: "9.6km",
    rating: "4.7",
    reviews: "76",
    lead: "수술 후 일상 복귀와 고령자 근력 회복 프로그램에 강점이 있습니다.",
    tags: ["수술 후", "고령자", "근력", "보행"],
    therapist: "이도윤 원장 · 물리치료사 출신",
    price: "방문 상담 무료",
    conversion: "재방문율 71%",
    lat: 37.3827,
    lng: 127.1189,
    fallbackX: "73%",
    fallbackY: "68%",
    plan: "free",
    photoDataUrl: "",
  },
  {
    id: "shoulder",
    name: "숄더워크 랩",
    region: "gangnam",
    area: "서울 강남구",
    distance: "2.4km",
    rating: "4.9",
    reviews: "61",
    lead: "골프, 테니스 이용자를 위한 어깨 가동성 및 회전근개 운동을 제공합니다.",
    tags: ["어깨", "골프", "테니스", "가동성"],
    therapist: "최하린 대표 · 물리치료사 출신",
    price: "스포츠 평가 40,000원",
    conversion: "운동 영상 피드백 제공",
    lat: 37.5243,
    lng: 127.0399,
    fallbackX: "64%",
    fallbackY: "34%",
    plan: "basic",
    photoDataUrl: "",
  },
];

function sendJson(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(data));
}

function runtimeEnvironment() {
  return process.env.APP_ENV || "development";
}

function hasSupabaseConfig() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

async function supabaseRequest(table, { method = "GET", query = "", body } = {}) {
  if (!hasSupabaseConfig()) {
    throw new Error("Supabase environment variables are not configured");
  }

  const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/${table}${query}`, {
    method,
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: method === "POST" ? "return=representation" : "return=minimal",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(data?.message || `Supabase request failed (${response.status})`);
  }
  return data;
}

async function supabaseStorageRequest(path, { method = "POST", body, headers = {} } = {}) {
  if (!hasSupabaseConfig()) throw new Error("Supabase environment variables are not configured");
  const response = await fetch(`${process.env.SUPABASE_URL}/storage/v1${path}`, {
    method,
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      ...headers,
    },
    body,
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(data?.message || data?.error || `Storage request failed (${response.status})`);
  return data;
}

function storageBucket() {
  return process.env.SUPABASE_STORAGE_BUCKET || "movemap-private";
}

async function createSignedStorageUrl(objectPath, expiresIn = 900) {
  if (!objectPath) return "";
  const bucket = storageBucket();
  const data = await supabaseStorageRequest(
    `/object/sign/${encodeURIComponent(bucket)}/${objectPath.split("/").map(encodeURIComponent).join("/")}`,
    {
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expiresIn }),
    }
  );
  const signedPath = data?.signedURL || data?.signedUrl;
  if (!signedPath) return "";
  return signedPath.startsWith("http") ? signedPath : `${process.env.SUPABASE_URL}/storage/v1${signedPath}`;
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

function verifyAdminPassword(password) {
  const stored = parseScryptHash(process.env.ADMIN_PASSWORD_SCRYPT);
  if (!stored || typeof password !== "string") return false;
  const candidate = crypto.scryptSync(password, stored.salt, stored.hash.length);
  return candidate.length === stored.hash.length && crypto.timingSafeEqual(candidate, stored.hash);
}

function signAdminSession(now = Date.now()) {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) throw new Error("ADMIN_SESSION_SECRET is not configured");
  const payload = Buffer.from(JSON.stringify({ role: "super_admin", exp: now + ADMIN_SESSION_TTL_SECONDS * 1000 })).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function verifyAdminSession(token, now = Date.now()) {
  const secret = process.env.ADMIN_SESSION_SECRET;
  const [payload, signature] = String(token || "").split(".");
  if (!secret || !payload || !signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  const given = Buffer.from(signature);
  const wanted = Buffer.from(expected);
  if (given.length !== wanted.length || !crypto.timingSafeEqual(given, wanted)) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return data.role === "super_admin" && Number(data.exp) > now;
  } catch {
    return false;
  }
}

function cookieValue(req, name) {
  const prefix = `${name}=`;
  const item = String(req.headers.cookie || "").split(";").map((part) => part.trim()).find((part) => part.startsWith(prefix));
  return item ? decodeURIComponent(item.slice(prefix.length)) : "";
}

function adminSessionFromRequest(req) {
  const authorization = req.headers.authorization || "";
  const bearer = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  return bearer || cookieValue(req, ADMIN_COOKIE_NAME);
}

function requestUsesHttps(req) {
  const forwardedProto = String(req?.headers?.["x-forwarded-proto"] || "")
    .split(",")[0]
    .trim()
    .toLowerCase();
  return forwardedProto === "https" || Boolean(req?.socket?.encrypted);
}

function adminSessionCookie(token, req) {
  const secure = requestUsesHttps(req) ? "; Secure" : "";
  return `${ADMIN_COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly${secure}; SameSite=Strict; Path=/; Max-Age=${ADMIN_SESSION_TTL_SECONDS}`;
}

function clearAdminSessionCookie(req) {
  const secure = requestUsesHttps(req) ? "; Secure" : "";
  return `${ADMIN_COOKIE_NAME}=; HttpOnly${secure}; SameSite=Strict; Path=/; Max-Age=0`;
}

function centerFromRow(row, photoUrl = "", photoUrls = []) {
  return {
    id: row.id,
    name: row.name,
    region: row.region,
    area: row.area,
    address: row.address,
    naverMapUrl: row.naver_map_url,
    distance: "신규",
    rating: row.rating || "신규",
    reviews: row.reviews || "0",
    lead: row.lead,
    tags: row.tags || [],
    therapist: String(row.therapist || "").replace(/물리치료사(?!\s*출신)/g, "물리치료사 출신"),
    price: row.price,
    conversion: row.conversion,
    lat: row.lat,
    lng: row.lng,
    plan: row.plan,
    photoUrl,
    photoUrls,
  };
}

function isAdminRequest(req) {
  return verifyAdminSession(adminSessionFromRequest(req));
}

module.exports = {
  sampleCenters,
  sendJson,
  hasSupabaseConfig,
  supabaseRequest,
  centerFromRow,
  createSignedStorageUrl,
  clearAdminSessionCookie,
  adminSessionCookie,
  ADMIN_SESSION_TTL_SECONDS,
  isAdminRequest,
  runtimeEnvironment,
  signAdminSession,
  storageBucket,
  supabaseStorageRequest,
  verifyAdminPassword,
  verifyAdminSession,
  requestUsesHttps,
};
