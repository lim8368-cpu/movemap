const {
  recordOperationalAlert,
  supabaseRequest,
} = require("../api/_shared");

const alertCooldowns = new Map();
const ALERT_COOLDOWN_MS = 15 * 60 * 1000;

function threshold(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

async function alertOnce(key, details) {
  const now = Date.now();
  if ((alertCooldowns.get(key) || 0) > now) return;
  alertCooldowns.set(key, now + ALERT_COOLDOWN_MS);
  await recordOperationalAlert(details);
}

function startMonitoring() {
  const memoryThresholdMb = threshold("APP_MEMORY_ALERT_MB", 400);
  const cpuThresholdPercent = threshold("APP_CPU_ALERT_PERCENT", 85);
  const databaseSizeThresholdMb = threshold("APP_DB_SIZE_ALERT_MB", 400);
  const databaseConnectionThresholdPercent = threshold("APP_DB_CONNECTION_ALERT_PERCENT", 80);
  const intervalMs = threshold("APP_MONITOR_INTERVAL_MS", 60_000);
  let lastCpuUsage = process.cpuUsage();
  let lastMeasuredAt = process.hrtime.bigint();

  async function check() {
    const now = process.hrtime.bigint();
    const elapsedMicros = Number(now - lastMeasuredAt) / 1000;
    const cpuDelta = process.cpuUsage(lastCpuUsage);
    const cpuPercent = elapsedMicros > 0
      ? ((cpuDelta.user + cpuDelta.system) / elapsedMicros) * 100
      : 0;
    lastCpuUsage = process.cpuUsage();
    lastMeasuredAt = now;

    const rssMb = process.memoryUsage().rss / 1024 / 1024;
    if (rssMb >= memoryThresholdMb) {
      await alertOnce("memory", {
        alertType: "memory",
        severity: rssMb >= memoryThresholdMb * 1.25 ? "critical" : "warning",
        message: `애플리케이션 메모리 사용량이 ${rssMb.toFixed(1)}MB입니다.`,
        metricValue: Number(rssMb.toFixed(1)),
        thresholdValue: memoryThresholdMb,
      });
    }
    if (cpuPercent >= cpuThresholdPercent) {
      await alertOnce("cpu", {
        alertType: "cpu",
        severity: cpuPercent >= 95 ? "critical" : "warning",
        message: `애플리케이션 CPU 사용률이 ${cpuPercent.toFixed(1)}%입니다.`,
        metricValue: Number(cpuPercent.toFixed(1)),
        thresholdValue: cpuThresholdPercent,
      });
    }

    const dbStartedAt = Date.now();
    try {
      const [, metricRows] = await Promise.all([
        supabaseRequest("centers", { query: "?select=id&limit=1" }),
        supabaseRequest("rpc/dail_operational_metrics", { method: "POST", body: {} }),
      ]);
      const responseMs = Date.now() - dbStartedAt;
      const metrics = metricRows?.[0] || {};
      if (responseMs >= 2_000) {
        await alertOnce("database-latency", {
          alertType: "database",
          severity: responseMs >= 5_000 ? "critical" : "warning",
          message: `데이터베이스 응답이 ${responseMs}ms로 느립니다.`,
          metricValue: responseMs,
          thresholdValue: 2_000,
        });
      }
      if (Number(metrics.database_size_mb) >= databaseSizeThresholdMb) {
        await alertOnce("database-size", {
          alertType: "database",
          severity: Number(metrics.database_size_mb) >= databaseSizeThresholdMb * 1.2 ? "critical" : "warning",
          message: `데이터베이스 사용량이 ${metrics.database_size_mb}MB입니다.`,
          metricValue: Number(metrics.database_size_mb),
          thresholdValue: databaseSizeThresholdMb,
        });
      }
      const connectionPercent = Number(metrics.max_connections) > 0
        ? Number(metrics.active_connections) / Number(metrics.max_connections) * 100
        : 0;
      if (connectionPercent >= databaseConnectionThresholdPercent) {
        await alertOnce("database-connections", {
          alertType: "database",
          severity: connectionPercent >= 95 ? "critical" : "warning",
          message: `데이터베이스 연결 사용률이 ${connectionPercent.toFixed(1)}%입니다.`,
          metricValue: Number(connectionPercent.toFixed(1)),
          thresholdValue: databaseConnectionThresholdPercent,
          metadata: {
            activeConnections: Number(metrics.active_connections),
            maxConnections: Number(metrics.max_connections),
          },
        });
      }
    } catch (error) {
      await alertOnce("database-unavailable", {
        alertType: "database",
        severity: "critical",
        message: `데이터베이스 상태 확인 실패: ${error.message}`,
      });
    }
  }

  const timer = setInterval(() => {
    check().catch((error) => console.error("monitoring check failed", error.message));
  }, intervalMs);
  timer.unref();
  setTimeout(() => check().catch(() => {}), 5_000).unref();
  return timer;
}

module.exports = { startMonitoring };
