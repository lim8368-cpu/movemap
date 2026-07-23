const {
  recordAuditLog,
  recordErrorLog,
  requireAdminRole,
  sendJson,
  supabaseRequest,
} = require("./_shared");
const {
  createAuthUser,
  findAuthUserByEmail,
  updateAuthUser,
} = require("./_user-auth");

module.exports = async function handler(req, res) {
  const admin = await requireAdminRole(req, res, ["super_admin", "admin"]);
  if (!admin) return;
  try {
    if (req.method === "GET") {
      const accounts = await supabaseRequest("center_memberships", {
        query: "?select=id,center_id,user_id,email,role,status,last_active_at,created_at&role=eq.owner&order=created_at.desc",
      });
      return sendJson(res, 200, { accounts });
    }
    if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });
    const body = req.body || {};
    const centerId = String(body.centerId || "").trim();
    const email = String(body.email || "").trim().toLowerCase().slice(0, 254);
    const password = String(body.password || "");
    if (!centerId || !/^\S+@\S+\.\S+$/.test(email)) {
      return sendJson(res, 400, { error: "센터와 올바른 이메일이 필요합니다." });
    }
    if (password.length < 10 || password.length > 128) {
      return sendJson(res, 400, { error: "비밀번호는 10자 이상 128자 이하로 입력해 주세요." });
    }
    const centers = await supabaseRequest("centers", {
      query: `?select=id&id=eq.${encodeURIComponent(centerId)}&limit=1`,
    });
    if (!centers[0]) return sendJson(res, 404, { error: "센터를 찾을 수 없습니다." });

    let user = await findAuthUserByEmail(email);
    if (user) {
      await updateAuthUser(user.id, {
        password,
        email_confirm: true,
        user_metadata: {
          ...(user.user_metadata || {}),
          account_type: "center_member",
        },
      });
    } else {
      const created = await createAuthUser({
        email,
        password,
        metadata: { account_type: "center_member" },
      });
      user = created?.user || created;
    }
    if (!user?.id) throw new Error("Supabase Auth user creation failed");

    const existing = await supabaseRequest("center_memberships", {
      query: `?select=id&center_id=eq.${encodeURIComponent(centerId)}&user_id=eq.${encodeURIComponent(user.id)}&limit=1`,
    });
    const membership = {
      center_id: centerId,
      user_id: user.id,
      email,
      role: "owner",
      status: "active",
      accepted_at: new Date().toISOString(),
      revoked_at: null,
      updated_at: new Date().toISOString(),
    };
    if (existing[0]) {
      await supabaseRequest("center_memberships", {
        method: "PATCH",
        query: `?id=eq.${encodeURIComponent(existing[0].id)}`,
        body: membership,
      });
    } else {
      await supabaseRequest("center_memberships", { method: "POST", body: membership });
    }
    await recordAuditLog(req, {
      actorUserId: admin.userId,
      actorRole: admin.role,
      centerId,
      action: existing[0] ? "center_owner.reset" : "center_owner.create",
      targetType: "center_membership",
      targetId: user.id,
    });
    return sendJson(res, 200, { ok: true, userId: user.id });
  } catch (error) {
    console.error("owner account api failed", error);
    await recordErrorLog(req, error, {
      errorCode: "center_owner_account_failed",
      statusCode: 400,
      source: "admin",
    });
    return sendJson(res, 400, { error: error.message || "센터장 계정을 저장하지 못했습니다." });
  }
};
