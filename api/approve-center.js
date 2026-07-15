const { sendJson, isAdminRequest, supabaseRequest } = require("./_shared");

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => { raw += chunk; });
    req.on("end", () => { try { resolve(JSON.parse(raw || "{}")); } catch (error) { reject(error); } });
    req.on("error", reject);
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });
  if (!isAdminRequest(req)) return sendJson(res, 401, { error: "Unauthorized" });

  try {
    const applicationId = req.query.id;
    const action = String(req.query.action || "approve");
    if (!applicationId) return sendJson(res, 400, { error: "신청 ID가 필요합니다." });

    if (action === "delete") {
      await supabaseRequest("centers", { method: "DELETE", query: `?id=eq.${encodeURIComponent(applicationId)}` });
      return sendJson(res, 200, { ok: true });
    }

    if (action === "update") {
      const body = await readBody(req);
      const allowed = ["name", "region", "area", "address", "naver_map_url", "lat", "lng", "lead", "tags", "therapist", "price", "conversion", "plan", "status"];
      const patch = Object.fromEntries(allowed.filter((key) => body[key] !== undefined).map((key) => [key, body[key]]));
      patch.updated_at = new Date().toISOString();
      await supabaseRequest("centers", { method: "PATCH", query: `?id=eq.${encodeURIComponent(applicationId)}`, body: patch });
      return sendJson(res, 200, { ok: true });
    }

    const applications = await supabaseRequest("center_applications", {
      query: `?select=*&id=eq.${encodeURIComponent(applicationId)}&limit=1`,
    });
    const item = applications[0];
    if (!item) return sendJson(res, 404, { error: "신청을 찾을 수 없습니다." });
    if (item.status !== "pending") return sendJson(res, 409, { error: "이미 처리된 신청입니다." });

    if (action === "reject") {
      const body = await readBody(req);
      const reason = String(body.reason || "정보 확인이 필요합니다.").trim().slice(0, 500);
      await supabaseRequest("center_applications", {
        method: "PATCH",
        query: `?id=eq.${encodeURIComponent(item.id)}`,
        body: { status: "rejected", rejection_reason: reason, reviewed_at: new Date().toISOString() },
      });
      return sendJson(res, 200, { ok: true });
    }

    const centers = await supabaseRequest("centers", {
      method: "POST",
      body: {
        application_id: item.id,
        name: item.center_name,
        region: "other",
        area: item.area,
        address: item.address,
        naver_map_url: item.naver_map_url,
        lat: item.lat,
        lng: item.lng,
        lead: item.services || "센터가 등록한 운동 프로그램 정보입니다.",
        tags: [],
        therapist: `${item.license_holder_name} · 물리치료사 출신`,
        price: "센터 문의",
        conversion: "신규 등록 센터",
        plan: "free",
        photo_path: item.photo_path,
        photo_paths: item.photo_paths || (item.photo_path ? [item.photo_path] : []),
        status: "approved",
      },
    });

    await supabaseRequest("center_applications", {
      method: "PATCH",
      query: `?id=eq.${encodeURIComponent(item.id)}`,
      body: { status: "approved", reviewed_at: new Date().toISOString() },
    });

    sendJson(res, 200, { ok: true, centerId: centers[0].id });
  } catch (error) {
    console.error("approve api failed", error);
    sendJson(res, 500, { error: "승인 처리에 실패했습니다." });
  }
};
