const {
  requireAdminRole,
  recordAuditLog,
  recordErrorLog,
  sendJson,
  supabaseRequest,
} = require("./_shared");
const {
  normalizeSchedule,
  scheduleSummary,
} = require("./_booking");
const { normalizeCenterCategories } = require("./_center-categories");

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

  try {
    const applicationId = req.query.id;
    const action = String(req.query.action || "approve");
    const roles = ["delete", "update"].includes(action)
      ? ["super_admin", "admin"]
      : ["super_admin", "admin", "support"];
    const admin = await requireAdminRole(req, res, roles);
    if (!admin) return;
    if (!applicationId) return sendJson(res, 400, { error: "신청 ID가 필요합니다." });

    if (action === "delete") {
      await supabaseRequest("centers", { method: "DELETE", query: `?id=eq.${encodeURIComponent(applicationId)}` });
      await recordAuditLog(req, {
        actorUserId: admin.userId,
        actorRole: admin.role,
        action: "center.delete",
        targetType: "center",
        targetId: applicationId,
      });
      return sendJson(res, 200, { ok: true });
    }

    if (action === "update") {
      const body = await readBody(req);
      const allowed = ["name", "region", "area", "address", "naver_map_url", "lat", "lng", "lead", "tags", "categories", "therapist", "price", "conversion", "plan", "status"];
      const patch = Object.fromEntries(allowed.filter((key) => body[key] !== undefined).map((key) => [key, body[key]]));
      if (body.categories !== undefined) patch.categories = normalizeCenterCategories(body.categories);
      patch.updated_at = new Date().toISOString();
      await supabaseRequest("centers", { method: "PATCH", query: `?id=eq.${encodeURIComponent(applicationId)}`, body: patch });
      await recordAuditLog(req, {
        actorUserId: admin.userId,
        actorRole: admin.role,
        centerId: applicationId,
        action: "center.update",
        targetType: "center",
        targetId: applicationId,
        metadata: { fields: Object.keys(patch).filter((key) => key !== "updated_at").join(",") },
      });
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
        body: {
          status: "rejected",
          rejection_reason: reason,
          owner_password_scrypt: null,
          reviewed_at: new Date().toISOString(),
        },
      });
      await recordAuditLog(req, {
        actorUserId: admin.userId,
        actorRole: admin.role,
        action: "center_application.reject",
        targetType: "center_application",
        targetId: item.id,
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
        categories: normalizeCenterCategories(item.services),
        therapist: item.license_holder_name || `${item.owner_name} 센터장`,
        price: "센터 문의",
        conversion: "신규 등록 센터",
        plan: "free",
        photo_path: item.photo_path,
        photo_paths: item.photo_paths || (item.photo_path ? [item.photo_path] : []),
        opening_schedule: normalizeSchedule(item.opening_schedule),
        opening_hours: item.opening_hours || scheduleSummary(item.opening_schedule),
        status: "approved",
      },
    });

    const center = centers[0];
    let ownerAccountCreated = false;
    let ownerMembershipCreated = false;
    try {
      if (item.email && item.applicant_auth_user_id) {
        await supabaseRequest("center_memberships", {
          method: "POST",
          body: {
            center_id: center.id,
            user_id: item.applicant_auth_user_id,
            email: item.email,
            role: "owner",
            status: "active",
            accepted_at: new Date().toISOString(),
          },
        });
        ownerMembershipCreated = true;
      } else if (item.email && item.owner_password_scrypt) {
        const existingAccounts = await supabaseRequest("center_owner_accounts", {
          query: `?select=id&email=eq.${encodeURIComponent(item.email)}&limit=1`,
        });
        if (existingAccounts[0]) {
          throw new Error("이미 다른 센터장 계정에 사용 중인 이메일입니다.");
        }
        await supabaseRequest("center_owner_accounts", {
          method: "POST",
          body: {
            center_id: center.id,
            email: item.email,
            password_scrypt: item.owner_password_scrypt,
            status: "active",
          },
        });
        ownerAccountCreated = true;
      }

      await supabaseRequest("center_applications", {
        method: "PATCH",
        query: `?id=eq.${encodeURIComponent(item.id)}`,
        body: {
          status: "approved",
          owner_password_scrypt: null,
          reviewed_at: new Date().toISOString(),
        },
      });
    } catch (error) {
      if (ownerAccountCreated) {
        await supabaseRequest("center_owner_accounts", {
          method: "DELETE",
          query: `?center_id=eq.${encodeURIComponent(center.id)}`,
        }).catch(() => null);
      }
      if (ownerMembershipCreated) {
        await supabaseRequest("center_memberships", {
          method: "DELETE",
          query: `?center_id=eq.${encodeURIComponent(center.id)}`,
        }).catch(() => null);
      }
      await supabaseRequest("centers", {
        method: "DELETE",
        query: `?id=eq.${encodeURIComponent(center.id)}`,
      }).catch(() => null);
      throw error;
    }

    await recordAuditLog(req, {
      actorUserId: admin.userId,
      actorRole: admin.role,
      centerId: center.id,
      action: "center_application.approve",
      targetType: "center_application",
      targetId: item.id,
      metadata: { ownerAccountCreated, ownerMembershipCreated },
    });
    sendJson(res, 200, {
      ok: true,
      centerId: center.id,
      ownerAccountCreated,
      ownerMembershipCreated,
    });
  } catch (error) {
    console.error("approve api failed", error);
    await recordErrorLog(req, error, { errorCode: "center_approval_failed", statusCode: 500 });
    sendJson(res, 500, {
      error: /이미 다른 센터장 계정/.test(String(error.message || ""))
        ? error.message
        : "승인 처리에 실패했습니다.",
    });
  }
};
