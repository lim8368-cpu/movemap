const {
  enforceRateLimit,
  recordErrorLog,
  sendJson,
} = require("./_shared");

const NAVER_LOCAL_SEARCH_URL = "https://openapi.naver.com/v1/search/local.json";
const KOREA_BOUNDS = {
  minLat: 31.43,
  maxLat: 44.35,
  minLng: 122.37,
  maxLng: 132,
};

function plainText(value) {
  return String(value || "")
    .replace(/<[^>]*>/g, "")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function coordinate(value) {
  const number = Number(value) / 10_000_000;
  return Number.isFinite(number) ? number : NaN;
}

function normalizePlace(item, index) {
  const lat = coordinate(item.mapy);
  const lng = coordinate(item.mapx);
  if (
    lat < KOREA_BOUNDS.minLat ||
    lat > KOREA_BOUNDS.maxLat ||
    lng < KOREA_BOUNDS.minLng ||
    lng > KOREA_BOUNDS.maxLng
  ) return null;

  const name = plainText(item.title);
  if (!name) return null;
  const naverPlaceId = String(item.link || "").match(/\/place\/(\d+)/)?.[1] || "";
  return {
    id: `${Math.round(lng * 10_000_000)}-${Math.round(lat * 10_000_000)}-${index}`,
    name,
    category: plainText(item.category).replaceAll(">", " · "),
    address: plainText(item.address),
    roadAddress: plainText(item.roadAddress),
    lat,
    lng,
    naverPlaceId,
    naverMapUrl: item.link && /^https:\/\/map\.naver\.com\//i.test(item.link)
      ? item.link
      : `https://map.naver.com/p/search/${encodeURIComponent(name)}`,
  };
}

async function fetchPlaces(query) {
  const clientId = String(process.env.NAVER_SEARCH_CLIENT_ID || "").trim();
  const clientSecret = String(process.env.NAVER_SEARCH_CLIENT_SECRET || "").trim();
  if (!clientId || !clientSecret) {
    const error = new Error("NAVER place search credentials are not configured");
    error.code = "NAVER_PLACE_SEARCH_NOT_CONFIGURED";
    throw error;
  }

  const url = new URL(NAVER_LOCAL_SEARCH_URL);
  url.searchParams.set("query", query);
  url.searchParams.set("display", "5");
  url.searchParams.set("start", "1");
  url.searchParams.set("sort", "random");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);
  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "X-Naver-Client-Id": clientId,
        "X-Naver-Client-Secret": clientSecret,
      },
      signal: controller.signal,
    });
    if (!response.ok) {
      const error = new Error(`NAVER local search failed (${response.status})`);
      error.statusCode = response.status;
      throw error;
    }
    const data = await response.json();
    return (Array.isArray(data.items) ? data.items : [])
      .map(normalizePlace)
      .filter(Boolean);
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return sendJson(res, 405, { error: "Method not allowed" });
  if (!enforceRateLimit(req, res, {
    bucket: "place-search",
    max: 30,
    windowMs: 10 * 60 * 1000,
  })) return;

  const query = String(req.query?.q || "").replace(/\s+/g, " ").trim();
  if (query.length < 2 || query.length > 60) {
    return sendJson(res, 400, { error: "장소 이름을 2~60자로 입력해 주세요." });
  }

  try {
    const places = await fetchPlaces(query);
    return sendJson(res, 200, { query, places });
  } catch (error) {
    if (error.code === "NAVER_PLACE_SEARCH_NOT_CONFIGURED") {
      return sendJson(res, 503, {
        code: error.code,
        error: "네이버 장소 검색 연결을 준비하고 있습니다.",
      });
    }
    console.error("place search api failed", error);
    await recordErrorLog(req, error, {
      errorCode: "naver_place_search_failed",
      statusCode: 502,
      source: "naver-local-search",
    });
    return sendJson(res, 502, { error: "네이버 장소 검색에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요." });
  }
};

module.exports._test = { coordinate, normalizePlace, plainText };
