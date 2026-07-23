const {
  adminIdentityFromRequest,
  requireAdminRole,
  recordAuditLog,
  recordErrorLog,
  sendJson,
  supabaseRequest,
} = require("./_shared");

function boundedLimit(value, fallback = 100) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(1, Math.min(250, Math.round(parsed))) : fallback;
}

module.exports = async function handler(req, res) {
  if (!await requireAdminRole(req, res, ["super_admin", "admin"])) return;
  if (req.method !== "GET") return sendJson(res, 405, { error: "Method not allowed" });

  const admin = adminIdentityFromRequest(req) || {};
  const limit = boundedLimit(req.query?.limit);
  try {
    const [accessLogs, auditLogs, errorLogs, alerts] = await Promise.all([
      supabaseRequest("access_logs", {
        query: `?select=*&order=created_at.desc&limit=${limit}`,
      }),
      supabaseRequest("audit_logs", {
        query: `?select=*&order=created_at.desc&limit=${limit}`,
      }),
      supabaseRequest("error_logs", {
        query: `?select=*&order=created_at.desc&limit=${Math.min(limit, 100)}`,
      }),
      supabaseRequest("operational_alerts", {
        query: `?select=*&order=created_at.desc&limit=${Math.min(limit, 100)}`,
      }),
    ]);

    await recordAuditLog(req, {
      actorUserId: admin.userId,
      actorRole: admin.role || "admin",
      action: "observability.logs.read",
      targetType: "observability",
      metadata: { limit },
    });

    return sendJson(res, 200, {
      totals: {
        accessLogs: accessLogs.length,
        auditLogs: auditLogs.length,
        errorLogs: errorLogs.length,
        openAlerts: alerts.filter((item) => item.status === "open").length,
      },
      accessLogs: accessLogs.map((item) => ({
        id: item.id,
        requestId: item.request_id,
        actorUserId: item.actor_user_id,
        actorRole: item.actor_role,
        centerId: item.center_id,
        source: item.source,
        method: item.method,
        path: item.path,
        statusCode: item.status_code,
        durationMs: item.duration_ms,
        ip: item.ip_hash ? `${String(item.ip_hash).slice(0, 10)}…` : "",
        userAgent: item.user_agent,
        createdAt: item.created_at,
      })),
      auditLogs: auditLogs.map((item) => ({
        id: item.id,
        actorUserId: item.actor_user_id,
        actorRole: item.actor_role,
        centerId: item.center_id,
        action: item.action,
        targetType: item.target_type,
        targetId: item.target_id,
        success: item.success,
        metadata: item.metadata || {},
        createdAt: item.created_at,
      })),
      errorLogs: errorLogs.map((item) => ({
        id: item.id,
        source: item.source,
        errorCode: item.error_code,
        message: item.message,
        path: item.path,
        statusCode: item.status_code,
        fingerprint: item.fingerprint,
        resolvedAt: item.resolved_at,
        createdAt: item.created_at,
      })),
      alerts,
    });
  } catch (error) {
    await recordErrorLog(req, error, {
      errorCode: "observability_logs_read_failed",
      statusCode: 500,
      source: "admin",
    });
    return sendJson(res, 500, { error: "운영 로그를 불러오지 못했습니다." });
  }
};
