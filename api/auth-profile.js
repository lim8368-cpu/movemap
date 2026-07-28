const { sendJson, supabaseRequest } = require("./_shared");
const { authSupabaseServiceRoleKey, authSupabaseUrl, syncUserProfile, userFromAccessToken } = require("./_user-auth");

function bearer(req) { const value = String(req.headers.authorization || ""); return value.startsWith("Bearer ") ? value.slice(7) : ""; }

async function centerAccessForUser(userId) {
  const [memberships, applications] = await Promise.all([
    supabaseRequest("center_memberships", {
      query: `?select=id,center_id,role,status&user_id=eq.${encodeURIComponent(userId)}&status=eq.active&order=created_at.asc`,
    }),
    supabaseRequest("center_applications", {
      query: `?select=id,center_name,status,rejection_reason,created_at,reviewed_at&applicant_auth_user_id=eq.${encodeURIComponent(userId)}&order=created_at.desc&limit=1`,
    }),
  ]);
  return {
    hasActiveMembership: memberships.length > 0,
    memberships,
    latestApplication: applications[0] || null,
  };
}

module.exports = async function handler(req, res) {
  if (!["GET", "PATCH", "DELETE"].includes(req.method)) return sendJson(res, 405, { error: "Method not allowed" });
  try {
    const token = bearer(req);
    const user = await userFromAccessToken(token);
    if (!user) return sendJson(res, 401, { error: "로그인이 필요합니다." });

    if (req.method === "DELETE") {
      await supabaseRequest("user_favorites", {
        method: "DELETE",
        query: `?user_id=eq.${encodeURIComponent(user.id)}`,
      });
      const serviceRoleKey = authSupabaseServiceRoleKey();
      const response = await fetch(`${authSupabaseUrl()}/auth/v1/admin/users/${encodeURIComponent(user.id)}`, {
        method: "DELETE", headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
      });
      if (!response.ok) throw new Error(`Account deletion failed (${response.status})`);
      return sendJson(res, 200, { deleted: true });
    }

    if (req.method === "PATCH" && req.body?.acceptRequired !== true) return sendJson(res, 400, { error: "이용약관과 개인정보처리방침 동의가 필요합니다." });
    const profile = await syncUserProfile(user, req.method === "PATCH" ? req.body || {} : {});
    return sendJson(res, 200, {
      user: { id: user.id, email: user.email || "", provider: profile.provider },
      profile,
      centerAccess: await centerAccessForUser(user.id),
      needsOnboarding: !profile.terms_agreed_at || !profile.privacy_agreed_at || !profile.nickname,
    });
  } catch (error) {
    console.error("user profile failed", error);
    return sendJson(res, 503, { error: "회원 정보를 처리하지 못했습니다." });
  }
};
