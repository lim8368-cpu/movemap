const { sendJson } = require("./_shared");
const { cookie, cookieValue, safeOrigin, verifyOAuthState } = require("./_user-auth");

function redirect(res, location) { res.statusCode = 302; res.setHeader("Cache-Control", "no-store"); res.setHeader("Location", location); res.end(); }

async function jsonRequest(url, options) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.error) throw new Error(data.error_description || data.message || data.error || `Request failed (${response.status})`);
  return data;
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return sendJson(res, 405, { error: "Method not allowed" });
  const origin = safeOrigin(req);
  const state = String(req.query?.state || "");
  res.setHeader("Set-Cookie", cookie(req, "", 0));
  if (!state || state !== cookieValue(req) || !verifyOAuthState(state)) return redirect(res, `${origin}/auth/callback/?error=invalid_state`);
  if (req.query?.error) return redirect(res, `${origin}/auth/callback/?error=naver_cancelled`);

  try {
    const callback = `${origin}/api/auth/naver/callback`;
    const tokenUrl = new URL("https://nid.naver.com/oauth2.0/token");
    tokenUrl.search = new URLSearchParams({
      grant_type: "authorization_code", client_id: process.env.NAVER_LOGIN_CLIENT_ID,
      client_secret: process.env.NAVER_LOGIN_CLIENT_SECRET, code: String(req.query?.code || ""), state,
    }).toString();
    const token = await jsonRequest(tokenUrl, { method: "POST" });
    const profileData = await jsonRequest("https://openapi.naver.com/v1/nid/me", { headers: { Authorization: `Bearer ${token.access_token}` } });
    const profile = profileData.response || {};
    if (!profile.id) throw new Error("Naver profile id missing");
    const email = profile.email || `naver_${profile.id}@users.dail.invalid`;
    const generated = await jsonRequest(`${process.env.SUPABASE_URL}/auth/v1/admin/generate_link`, {
      method: "POST",
      headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ type: "magiclink", email, data: { provider: "naver", provider_id: profile.id, full_name: profile.name || profile.nickname || "", avatar_url: profile.profile_image || "" } }),
    });
    if (!generated.hashed_token) throw new Error("Supabase token missing");
    const next = new URL(`${origin}/auth/callback/`);
    next.search = new URLSearchParams({ token_hash: generated.hashed_token, type: "magiclink", provider: "naver" }).toString();
    return redirect(res, next.toString());
  } catch (error) {
    console.error("naver login failed", error);
    return redirect(res, `${origin}/auth/callback/?error=naver_failed`);
  }
};
