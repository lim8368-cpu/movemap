const { isAdminRequest, sendJson, supabaseRequest } = require("./_shared");
const { hashOwnerPassword } = require("./_owner-auth");

module.exports = async function handler(req, res) {
  if (!isAdminRequest(req)) return sendJson(res, 401, { error: "Unauthorized" });
  try {
    if (req.method === "GET") {
      const accounts = await supabaseRequest("center_owner_accounts", { query: "?select=id,center_id,email,status,last_login_at,created_at&order=created_at.desc" });
      return sendJson(res, 200, { accounts });
    }
    if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });
    const body = req.body || {};
    const centerId = String(body.centerId || "").trim();
    const email = String(body.email || "").trim().toLowerCase().slice(0, 254);
    const password = String(body.password || "");
    if (!centerId || !/^\S+@\S+\.\S+$/.test(email)) return sendJson(res, 400, { error: "센터와 올바른 이메일이 필요합니다." });
    const passwordScrypt = hashOwnerPassword(password);
    const existing = await supabaseRequest("center_owner_accounts", { query: `?select=id&center_id=eq.${encodeURIComponent(centerId)}&limit=1` });
    if (existing[0]) {
      await supabaseRequest("center_owner_accounts", { method: "PATCH", query: `?id=eq.${encodeURIComponent(existing[0].id)}`, body: { email, password_scrypt: passwordScrypt, status: "active", failed_count: 0, locked_until: null, updated_at: new Date().toISOString() } });
    } else {
      await supabaseRequest("center_owner_accounts", { method: "POST", body: { center_id: centerId, email, password_scrypt: passwordScrypt } });
    }
    sendJson(res, 200, { ok: true });
  } catch (error) {
    console.error("owner account api failed", error);
    sendJson(res, 400, { error: error.message || "센터장 계정을 저장하지 못했습니다." });
  }
};
