const {
  adminIdentityFromRequest,
  requireAdminRole,
  recordAuditLog,
  recordErrorLog,
  sendJson,
  supabaseRequest,
} = require("./_shared");

function processSnapshot() {
  const memory = process.memoryUsage();
  const cpu = process.cpuUsage();
  return {
    uptimeSeconds: Math.round(process.uptime()),
    memory: {
      rssMb: Number((memory.rss / 1024 / 1024).toFixed(1)),
      heapUsedMb: Number((memory.heapUsed / 1024 / 1024).toFixed(1)),
      heapTotalMb: Number((memory.heapTotal / 1024 / 1024).toFixed(1)),
      externalMb: Number((memory.external / 1024 / 1024).toFixed(1)),
    },
    cpu: {
      userSeconds: Number((cpu.user / 1_000_000).toFixed(2)),
      systemSeconds: Number((cpu.system / 1_000_000).toFixed(2)),
    },
    nodeVersion: process.version,
    environment: process.env.APP_ENV || "development",
    checkedAt: new Date().toISOString(),
  };
}

module.exports = async function handler(req, res) {
  if (!await requireAdminRole(req, res, ["super_admin", "admin"])) return;
  const admin = adminIdentityFromRequest(req) || {};

  if (req.method === "GET") {
    const startedAt = Date.now();
    try {
      const [, databaseMetrics, alerts, errors] = await Promise.all([
        supabaseRequest("centers", { query: "?select=id&limit=1" }),
        supabaseRequest("rpc/dail_operational_metrics", { method: "POST", body: {} }),
        supabaseRequest("operational_alerts", {
          query: "?select=*&status=in.(open,acknowledged)&order=created_at.desc&limit=50",
        }),
        supabaseRequest("error_logs", {
          query: "?select=*&resolved_at=is.null&order=created_at.desc&limit=25",
        }),
      ]);
      return sendJson(res, 200, {
        status: alerts.some((item) => item.severity === "critical" && item.status === "open")
          ? "critical"
          : alerts.some((item) => item.status === "open") ? "warning" : "healthy",
        process: processSnapshot(),
        database: {
          healthy: true,
          responseMs: Date.now() - startedAt,
          sizeMb: Number(databaseMetrics?.[0]?.database_size_mb || 0),
          activeConnections: Number(databaseMetrics?.[0]?.active_connections || 0),
          maxConnections: Number(databaseMetrics?.[0]?.max_connections || 0),
        },
        alerts,
        unresolvedErrors: errors,
      });
    } catch (error) {
      await recordErrorLog(req, error, {
        errorCode: "operations_status_failed",
        statusCode: 503,
        source: "monitoring",
      });
      return sendJson(res, 503, {
        status: "critical",
        process: processSnapshot(),
        database: { healthy: false, responseMs: Date.now() - startedAt },
        alerts: [],
        unresolvedErrors: [],
      });
    }
  }

  if (req.method === "PATCH") {
    const id = String(req.body?.id || "").trim();
    const status = String(req.body?.status || "").trim();
    if (!id || !["acknowledged", "resolved"].includes(status)) {
      return sendJson(res, 400, { error: "알림 ID와 처리 상태를 확인해 주세요." });
    }
    try {
      const now = new Date().toISOString();
      const body = status === "acknowledged"
        ? {
          status,
          acknowledged_by_user_id: admin.userId || null,
          acknowledged_at: now,
        }
        : { status, resolved_at: now };
      await supabaseRequest("operational_alerts", {
        method: "PATCH",
        query: `?id=eq.${encodeURIComponent(id)}`,
        body,
      });
      const rows = await supabaseRequest("operational_alerts", {
        query: `?select=*&id=eq.${encodeURIComponent(id)}&limit=1`,
      });
      if (!rows?.length) return sendJson(res, 404, { error: "알림을 찾을 수 없습니다." });
      await recordAuditLog(req, {
        actorUserId: admin.userId,
        actorRole: admin.role || "admin",
        action: `operational_alert.${status}`,
        targetType: "operational_alert",
        targetId: id,
      });
      return sendJson(res, 200, { alert: rows[0] });
    } catch (error) {
      await recordErrorLog(req, error, {
        errorCode: "operational_alert_update_failed",
        statusCode: 500,
        source: "admin",
      });
      return sendJson(res, 500, { error: "알림 상태를 변경하지 못했습니다." });
    }
  }

  return sendJson(res, 405, { error: "Method not allowed" });
};
