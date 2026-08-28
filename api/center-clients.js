const crypto = require("crypto");
const {
  enforceRateLimit,
  recordAuditLog,
  recordErrorLog,
  sendJson,
  supabaseRequest,
} = require("./_shared");
const { requireOwnerAccess } = require("./_platform-auth");
const {
  decryptClientField,
  encryptClientField,
  hashClientPhone,
  normalizedPhone,
} = require("./_sensitive-data");

const CLIENT_SELECT = [
  "id",
  "center_id",
  "full_name_encrypted",
  "phone_encrypted",
  "email_encrypted",
  "primary_concern_encrypted",
  "goal_encrypted",
  "notes_encrypted",
  "status",
  "privacy_consent_at",
  "created_at",
  "updated_at",
  "archived_at",
].join(",");
const CLIENT_SUMMARY_SELECT = [
  "id",
  "center_id",
  "full_name_encrypted",
  "phone_encrypted",
  "status",
  "created_at",
  "updated_at",
  "archived_at",
].join(",");

const FIELD_RULES = {
  fullName: { column: "full_name_encrypted", field: "full_name", max: 50, required: true },
  phone: { column: "phone_encrypted", field: "phone", max: 24, required: true },
  email: { column: "email_encrypted", field: "email", max: 254 },
  primaryConcern: { column: "primary_concern_encrypted", field: "primary_concern", max: 160 },
  goal: { column: "goal_encrypted", field: "goal", max: 500 },
  notes: { column: "notes_encrypted", field: "notes", max: 1000 },
};

function bodyValue(req) {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body || "{}");
    } catch {
      throw Object.assign(new Error("입력 내용을 확인해 주세요."), { statusCode: 400 });
    }
  }
  return {};
}

function cleanText(value, maxLength, label = "입력값") {
  const cleaned = String(value ?? "").trim();
  if (cleaned.length > maxLength) {
    throw Object.assign(new Error(`${label}은(는) ${maxLength}자 이하로 입력해 주세요.`), { statusCode: 400 });
  }
  return cleaned;
}

function validUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
}

function formatPhone(value) {
  const digits = normalizedPhone(value);
  if (digits.length === 11) return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  if (digits.startsWith("02") && digits.length === 10) return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6)}`;
  if (digits.startsWith("02") && digits.length === 9) return `${digits.slice(0, 2)}-${digits.slice(2, 5)}-${digits.slice(5)}`;
  if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  return cleanText(value, 24, "전화번호");
}

function normalizedInput(body, { partial = false } = {}) {
  const values = {};
  for (const [input, rule] of Object.entries(FIELD_RULES)) {
    if (partial && body[input] === undefined) continue;
    const labels = {
      fullName: "이용자 이름",
      phone: "전화번호",
      email: "이메일",
      primaryConcern: "주요 불편 사항",
      goal: "이용 목표",
      notes: "메모",
    };
    values[input] = cleanText(body[input], rule.max, labels[input]);
  }

  if ((!partial || values.fullName !== undefined) && (!values.fullName || values.fullName.length > FIELD_RULES.fullName.max)) {
    throw Object.assign(new Error("이용자 이름을 입력해 주세요."), { statusCode: 400 });
  }
  if (!partial || values.phone !== undefined) {
    const digits = normalizedPhone(values.phone);
    if (digits.length < 9 || digits.length > 11) {
      throw Object.assign(new Error("전화번호를 확인해 주세요."), { statusCode: 400 });
    }
    values.phone = formatPhone(digits);
  }
  if (values.email) {
    values.email = values.email.toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
      throw Object.assign(new Error("이메일 주소를 확인해 주세요."), { statusCode: 400 });
    }
  }
  return values;
}

function decryptRow(row) {
  const context = (field) => ({ centerId: row.center_id, clientId: row.id, field });
  return {
    id: row.id,
    full_name: decryptClientField(row.full_name_encrypted, context("full_name")),
    phone: decryptClientField(row.phone_encrypted, context("phone")),
    email: decryptClientField(row.email_encrypted, context("email")),
    primary_concern: decryptClientField(row.primary_concern_encrypted, context("primary_concern")),
    goal: decryptClientField(row.goal_encrypted, context("goal")),
    notes: decryptClientField(row.notes_encrypted, context("notes")),
    status: row.status,
    privacy_consent_at: row.privacy_consent_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    archived_at: row.archived_at,
  };
}

function decryptSummaryRow(row) {
  const context = (field) => ({ centerId: row.center_id, clientId: row.id, field });
  return {
    id: row.id,
    full_name: decryptClientField(row.full_name_encrypted, context("full_name")),
    phone: decryptClientField(row.phone_encrypted, context("phone")),
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
    archived_at: row.archived_at,
  };
}

async function clientSummaryRows(centerId) {
  return supabaseRequest("center_clients", {
    query: `?select=${CLIENT_SUMMARY_SELECT}&center_id=eq.${encodeURIComponent(centerId)}&order=created_at.desc&limit=500`,
  });
}

async function clientList(centerId) {
  return (await clientSummaryRows(centerId)).map(decryptSummaryRow);
}

async function existingClient(centerId, clientId) {
  const rows = await supabaseRequest("center_clients", {
    query: `?select=${CLIENT_SELECT}&id=eq.${encodeURIComponent(clientId)}&center_id=eq.${encodeURIComponent(centerId)}&limit=1`,
  });
  return rows[0] || null;
}

function encryptedPatch(values, centerId, clientId) {
  const patch = {};
  for (const [input, value] of Object.entries(values)) {
    const rule = FIELD_RULES[input];
    patch[rule.column] = encryptClientField(value, { centerId, clientId, field: rule.field });
  }
  if (values.phone !== undefined) patch.phone_lookup_hash = hashClientPhone(values.phone, centerId);
  return patch;
}

function rateLimitIdentity(access) {
  return access.userId || access.session?.accountId || `center:${access.centerId}`;
}

async function listClients(req, res, access) {
  if (!enforceRateLimit(req, res, {
    bucket: "center-clients-read",
    max: 120,
    windowMs: 15 * 60 * 1000,
    identity: rateLimitIdentity(access),
  })) return;
  const clientId = String(req.query?.clientId || "");
  if (clientId) {
    if (!validUuid(clientId)) return sendJson(res, 400, { error: "이용자 정보를 확인해 주세요." });
    const row = await existingClient(access.centerId, clientId);
    if (!row) return sendJson(res, 404, { error: "이용자를 찾을 수 없습니다." });
    return sendJson(res, 200, { client: decryptRow(row) });
  }
  sendJson(res, 200, { clients: await clientList(access.centerId) });
}

async function createClient(req, res, access) {
  if (!enforceRateLimit(req, res, {
    bucket: "center-clients-write",
    max: 30,
    windowMs: 15 * 60 * 1000,
    identity: rateLimitIdentity(access),
  })) return;
  const body = bodyValue(req);
  if (body.consentConfirmed !== true) {
    return sendJson(res, 400, { error: "개인정보 수집·이용 확인이 필요합니다." });
  }
  const values = normalizedInput(body);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const insert = {
    id,
    center_id: access.centerId,
    ...encryptedPatch(values, access.centerId, id),
    status: "active",
    privacy_consent_at: now,
    created_by_user_id: access.userId || null,
    updated_by_user_id: access.userId || null,
    archived_at: null,
    created_at: now,
    updated_at: now,
  };
  const rows = await supabaseRequest("center_clients", { method: "POST", body: insert });
  const row = rows[0] || insert;
  await recordAuditLog(req, {
    actorUserId: access.userId,
    actorRole: access.role,
    centerId: access.centerId,
    action: "center_client.create",
    targetType: "center_client",
    targetId: id,
    metadata: { status: "active" },
  });
  return sendJson(res, 201, {
    ok: true,
    client: decryptRow(row),
  });
}

async function updateClient(req, res, access) {
  if (!enforceRateLimit(req, res, {
    bucket: "center-clients-write",
    max: 30,
    windowMs: 15 * 60 * 1000,
    identity: rateLimitIdentity(access),
  })) return;
  const body = bodyValue(req);
  const clientId = String(body.clientId || "");
  if (!validUuid(clientId)) return sendJson(res, 400, { error: "이용자 정보를 확인해 주세요." });
  const current = await existingClient(access.centerId, clientId);
  if (!current) return sendJson(res, 404, { error: "이용자를 찾을 수 없습니다." });

  const values = normalizedInput(body, { partial: true });
  const patch = encryptedPatch(values, access.centerId, clientId);
  let nextStatus = current.status;
  if (body.status !== undefined) {
    nextStatus = String(body.status);
    if (!["active", "archived"].includes(nextStatus)) {
      return sendJson(res, 400, { error: "이용자 보관 상태를 확인해 주세요." });
    }
    patch.status = nextStatus;
    patch.archived_at = nextStatus === "archived" ? new Date().toISOString() : null;
  }
  if (!Object.keys(patch).length) return sendJson(res, 400, { error: "수정할 정보가 없습니다." });
  patch.updated_by_user_id = access.userId || null;
  patch.updated_at = new Date().toISOString();
  await supabaseRequest("center_clients", {
    method: "PATCH",
    query: `?id=eq.${encodeURIComponent(clientId)}&center_id=eq.${encodeURIComponent(access.centerId)}`,
    body: patch,
  });
  const updated = {
    ...current,
    ...patch,
    status: nextStatus,
    archived_at: patch.archived_at === undefined ? current.archived_at : patch.archived_at,
  };
  const statusChanged = nextStatus !== current.status;
  const action = statusChanged
    ? nextStatus === "archived" ? "center_client.archive" : "center_client.restore"
    : "center_client.update";
  await recordAuditLog(req, {
    actorUserId: access.userId,
    actorRole: access.role,
    centerId: access.centerId,
    action,
    targetType: "center_client",
    targetId: clientId,
    metadata: {
      status: nextStatus,
      changedFields: Object.keys(values).map((key) => FIELD_RULES[key].field).join(","),
    },
  });
  return sendJson(res, 200, {
    ok: true,
    client: decryptRow(updated),
  });
}

module.exports = async function handler(req, res) {
  try {
    if (!["GET", "POST", "PATCH"].includes(req.method)) {
      return sendJson(res, 405, { error: "Method not allowed" });
    }
    const body = req.method === "GET" ? {} : bodyValue(req);
    const centerId = String(req.query?.centerId || body.centerId || "");
    if (!validUuid(centerId)) {
      return sendJson(res, 400, { error: "관리할 센터를 확인해 주세요." });
    }
    const access = await requireOwnerAccess(req, res, {
      centerId,
      action: req.method === "GET" ? "read_clients" : "manage_clients",
    });
    if (!access) return;
    if (req.method === "GET") return await listClients(req, res, access);
    if (req.method === "POST") return await createClient(req, res, access);
    return await updateClient(req, res, access);
  } catch (error) {
    const statusCode = Number(error.statusCode) || 500;
    if (statusCode >= 500) {
      console.error("center clients api failed", error);
      await recordErrorLog(req, error, { errorCode: "center_clients_failed", statusCode });
    }
    return sendJson(res, statusCode, {
      error: statusCode >= 500 ? "이용자 명단을 처리하지 못했습니다." : error.message,
    });
  }
};
