const { sendJson, supabaseRequest } = require("./_shared");
const { syncUserProfile, userFromAccessToken } = require("./_user-auth");

function bearer(req) { const value = String(req.headers.authorization || ""); return value.startsWith("Bearer ") ? value.slice(7) : ""; }

module.exports = async function handler(req, res) {
  if (!["GET", "PATCH", "DELETE"].includes(req.method)) return sendJson(res, 405, { error: "Method not allowed" });
  try {
    const token = bearer(req);
    const user = await userFromAccessToken(token);
    if (!user) return sendJson(res, 401, { error: "로그인이 필요합니다." });

    if (req.method === "DELETE") {
      const response = await fetch(`${process.env.SUPABASE_URL}/auth/v1/admin/users/${encodeURIComponent(user.id)}`, {
        method: "DELETE", headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` },
      });
      if (!response.ok) throw new Error(`Account deletion failed (${response.status})`);
      return sendJson(res, 200, { deleted: true });
    }

    if (req.method === "PATCH" && req.body?.acceptRequired !== true) return sendJson(res, 400, { error: "이용약관과 개인정보처리방침 동의가 필요합니다." });
    const profile = await syncUserProfile(user, req.method === "PATCH" ? req.body || {} : {});
    return sendJson(res, 200, { user: { id: user.id, email: user.email || "", provider: profile.provider }, profile, needsOnboarding: !profile.terms_agreed_at || !profile.privacy_agreed_at || !profile.nickname });
  } catch (error) {
    console.error("user profile failed", error);
    return sendJson(res, 503, { error: "회원 정보를 처리하지 못했습니다." });
  }
};
