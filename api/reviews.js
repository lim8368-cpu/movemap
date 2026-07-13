const { sendJson, hasSupabaseConfig, supabaseRequest } = require("./_shared");

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 20_000) reject(new Error("too large"));
    });
    req.on("end", () => {
      try { resolve(JSON.parse(raw || "{}")); } catch (error) { reject(error); }
    });
    req.on("error", reject);
  });
}

module.exports = async function handler(req, res) {
  if (!hasSupabaseConfig()) return sendJson(res, 503, { error: "DB가 연결되지 않았습니다." });
  try {
    if (req.method === "GET") {
      const centerId = String(req.query.centerId || "");
      const filter = centerId ? `&center_id=eq.${encodeURIComponent(centerId)}` : "";
      const rows = await supabaseRequest("reviews", {
        query: `?select=id,center_id,nickname,rating,content,created_at&status=eq.approved${filter}&order=created_at.desc&limit=100`,
      });
      return sendJson(res, 200, { reviews: rows });
    }
    if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });
    const body = await readBody(req);
    const nickname = String(body.nickname || "").trim();
    const content = String(body.content || "").trim();
    const rating = Number(body.rating);
    const centerId = String(body.centerId || "");
    if (!centerId || nickname.length < 1 || nickname.length > 30 || content.length < 10 || content.length > 500 || !Number.isInteger(rating) || rating < 1 || rating > 5) {
      return sendJson(res, 400, { error: "별점, 닉네임, 10자 이상의 후기를 확인해 주세요." });
    }
    const center = await supabaseRequest("centers", { query: `?select=id&id=eq.${encodeURIComponent(centerId)}&status=eq.approved&limit=1` });
    if (!center.length) return sendJson(res, 404, { error: "센터를 찾을 수 없습니다." });
    await supabaseRequest("reviews", { method: "POST", body: { center_id: centerId, nickname, rating, content, status: "approved" } });
    return sendJson(res, 201, { ok: true });
  } catch (error) {
    console.error("reviews api failed", error);
    return sendJson(res, 500, { error: "후기를 처리하지 못했습니다." });
  }
};
