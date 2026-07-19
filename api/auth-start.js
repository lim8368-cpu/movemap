const { sendJson } = require("./_shared");
const { cookie, createOAuthState, publicAuthConfig, safeOrigin } = require("./_user-auth");

function redirect(res, location) {
  res.statusCode = 302;
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Location", location);
  res.end();
}

module.exports = function handler(req, res) {
  if (req.method !== "GET") return sendJson(res, 405, { error: "Method not allowed" });
  try {
    const provider = String(req.query?.provider || "").toLowerCase();
    const config = publicAuthConfig();
    const origin = safeOrigin(req);
    if (!Object.hasOwn(config.providers, provider)) return sendJson(res, 400, { error: "지원하지 않는 로그인 방식입니다." });
    if (!config.providers[provider]) return sendJson(res, 503, { error: `${provider} 로그인 설정이 아직 완료되지 않았습니다.` });

    if (provider === "naver") {
      const state = createOAuthState();
      const callback = `${origin}/api/auth/naver/callback`;
      const url = new URL("https://nid.naver.com/oauth2.0/authorize");
      url.search = new URLSearchParams({ response_type: "code", client_id: process.env.NAVER_LOGIN_CLIENT_ID, redirect_uri: callback, state }).toString();
      res.setHeader("Set-Cookie", cookie(req, state));
      return redirect(res, url.toString());
    }

    const url = new URL(`${config.supabaseUrl}/auth/v1/authorize`);
    const params = new URLSearchParams({ provider, redirect_to: `${origin}/auth/callback/` });
    if (provider === "kakao") params.set("scopes", "profile_nickname profile_image");
    url.search = params.toString();
    return redirect(res, url.toString());
  } catch (error) {
    console.error("social auth start failed", error);
    return sendJson(res, 500, { error: "로그인을 시작하지 못했습니다." });
  }
};
