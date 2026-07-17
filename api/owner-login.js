const { sendJson, supabaseRequest } = require("./_shared");
const {
  OWNER_SESSION_TTL_SECONDS,
  ownerSessionCookie,
  signOwnerSession,
  verifyOwnerPassword,
} = require("./_owner-auth");

const MAX_FAILURES = 5;
const LOCK_MS = 15 * 60 * 1000;

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });
  try {
    const body = req.body || {};
    const email = String(body.email || "").trim().toLowerCase().slice(0, 254);
    const password = String(body.password || "");
    if (!email || !password) return sendJson(res, 400, { error: "이메일과 비밀번호를 입력해 주세요." });

    const accounts = await supabaseRequest("center_owner_accounts", {
      query: `?select=*&email=eq.${encodeURIComponent(email)}&limit=1`,
    });
    const account = accounts[0];
    const locked = account?.locked_until && new Date(account.locked_until).getTime() > Date.now();
    if (locked) {
      res.setHeader("Retry-After", "900");
      return sendJson(res, 429, { error: "로그인 시도가 너무 많습니다. 15분 후 다시 시도해 주세요." });
    }

    if (!account || account.status !== "active" || !verifyOwnerPassword(password, account.password_scrypt)) {
      if (account) {
        const failedCount = Number(account.failed_count || 0) + 1;
        await supabaseRequest("center_owner_accounts", {
          method: "PATCH",
          query: `?id=eq.${encodeURIComponent(account.id)}`,
          body: {
            failed_count: failedCount,
            locked_until: failedCount >= MAX_FAILURES ? new Date(Date.now() + LOCK_MS).toISOString() : null,
            updated_at: new Date().toISOString(),
          },
        });
      }
      return sendJson(res, 401, { error: "이메일 또는 비밀번호가 올바르지 않습니다." });
    }

    await supabaseRequest("center_owner_accounts", {
      method: "PATCH",
      query: `?id=eq.${encodeURIComponent(account.id)}`,
      body: { failed_count: 0, locked_until: null, last_login_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    });
    const token = signOwnerSession(account);
    res.setHeader("Set-Cookie", ownerSessionCookie(token, req));
    sendJson(res, 200, { ok: true, expiresInSeconds: OWNER_SESSION_TTL_SECONDS });
  } catch (error) {
    console.error("center owner login failed", error);
    sendJson(res, 503, { error: "센터장 로그인 설정을 확인해 주세요." });
  }
};
