const crypto = require("crypto");
const {
  enforceRateLimit,
  recordAuditLog,
  recordErrorLog,
  sendJson,
  supabaseRequest,
} = require("./_shared");
const { requireOwnerAccess } = require("./_platform-auth");
const { decryptClientField, encryptClientField } = require("./_sensitive-data");

const ASSESSMENT_SELECT = [
  "id",
  "center_id",
  "client_id",
  "assessed_on",
  "visit_kind",
  "template_key",
  "scores_encrypted",
  "narrative_encrypted",
  "sensitive_data_consent_at",
  "created_at",
  "updated_at",
].join(",");

const SCORE_FIELDS = {
  painVas: "통증 정도",
  dailyFunction: "일상 기능",
  movementConfidence: "움직임 자신감",
  balanceConfidence: "균형 자신감",
};

const ASSESSMENT_SIDES = new Set(["left", "right", "bilateral", "not_applicable"]);
const MAX_MEASUREMENT_ROWS = 12;

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

function validUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
}

function cleanText(value, maxLength, label) {
  const cleaned = String(value ?? "").trim();
  if (cleaned.length > maxLength) {
    throw Object.assign(new Error(`${label}은(는) ${maxLength}자 이하로 입력해 주세요.`), { statusCode: 400 });
  }
  return cleaned;
}

function todayInSeoul() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function validAssessmentDate(value) {
  const date = String(value || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const marker = new Date(`${date}T12:00:00+09:00`);
  return !Number.isNaN(marker.getTime()) && date >= "2000-01-01" && date <= todayInSeoul();
}

function scoreValue(value, label) {
  if (value === "" || value === null || value === undefined) return null;
  const score = Number(value);
  if (!Number.isInteger(score) || score < 0 || score > 10) {
    throw Object.assign(new Error(`${label} 점수는 0에서 10 사이의 정수로 입력해 주세요.`), { statusCode: 400 });
  }
  return score;
}

function requiredText(value, maxLength, label) {
  const cleaned = cleanText(value, maxLength, label);
  if (!cleaned) {
    throw Object.assign(new Error(`${label}을(를) 입력해 주세요.`), { statusCode: 400 });
  }
  return cleaned;
}

function sideValue(value, label) {
  const side = String(value || "not_applicable");
  if (!ASSESSMENT_SIDES.has(side)) {
    throw Object.assign(new Error(`${label}의 좌우 구분을 확인해 주세요.`), { statusCode: 400 });
  }
  return side;
}

function degreeValue(value, label) {
  if (value === "" || value === null || value === undefined) return null;
  const degree = Number(value);
  if (!Number.isInteger(degree) || degree < -90 || degree > 360) {
    throw Object.assign(new Error(`${label}은(는) -90도에서 360도 사이의 정수로 입력해 주세요.`), { statusCode: 400 });
  }
  return degree;
}

function normalizedRom(value) {
  if (!Array.isArray(value)) {
    throw Object.assign(new Error("ROM 측정값을 입력해 주세요."), { statusCode: 400 });
  }
  if (value.length > MAX_MEASUREMENT_ROWS) {
    throw Object.assign(new Error(`ROM은 최대 ${MAX_MEASUREMENT_ROWS}개까지 기록할 수 있습니다.`), { statusCode: 400 });
  }
  const rows = value.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw Object.assign(new Error(`ROM ${index + 1}번 항목을 확인해 주세요.`), { statusCode: 400 });
    }
    const joint = requiredText(item.joint, 60, `ROM ${index + 1}번 관절·부위`);
    const movement = requiredText(item.movement, 60, `ROM ${index + 1}번 동작`);
    const active = degreeValue(item.active, `ROM ${index + 1}번 AROM`);
    const passive = degreeValue(item.passive, `ROM ${index + 1}번 PROM`);
    if (active === null && passive === null) {
      throw Object.assign(new Error(`ROM ${index + 1}번 항목의 AROM 또는 PROM을 입력해 주세요.`), { statusCode: 400 });
    }
    return {
      joint,
      movement,
      side: sideValue(item.side, `ROM ${index + 1}번 항목`),
      active,
      passive,
      reference: cleanText(item.reference, 40, `ROM ${index + 1}번 참고 범위`),
      note: cleanText(item.note, 160, `ROM ${index + 1}번 비고`),
    };
  });
  if (!rows.length) {
    throw Object.assign(new Error("ROM 측정값을 하나 이상 입력해 주세요."), { statusCode: 400 });
  }
  return rows;
}

function normalizedMmt(value) {
  if (!Array.isArray(value)) {
    throw Object.assign(new Error("MMT 측정값을 입력해 주세요."), { statusCode: 400 });
  }
  if (value.length > MAX_MEASUREMENT_ROWS) {
    throw Object.assign(new Error(`MMT는 최대 ${MAX_MEASUREMENT_ROWS}개까지 기록할 수 있습니다.`), { statusCode: 400 });
  }
  const rows = value.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw Object.assign(new Error(`MMT ${index + 1}번 항목을 확인해 주세요.`), { statusCode: 400 });
    }
    if (item.grade === "" || item.grade === null || item.grade === undefined) {
      throw Object.assign(new Error(`MMT ${index + 1}번 등급을 입력해 주세요.`), { statusCode: 400 });
    }
    const grade = Number(item.grade);
    if (!Number.isInteger(grade) || grade < 0 || grade > 5) {
      throw Object.assign(new Error(`MMT ${index + 1}번 등급은 0에서 5 사이의 정수로 입력해 주세요.`), { statusCode: 400 });
    }
    return {
      movement: requiredText(item.movement, 80, `MMT ${index + 1}번 근육·동작`),
      side: sideValue(item.side, `MMT ${index + 1}번 항목`),
      grade,
      note: cleanText(item.note, 160, `MMT ${index + 1}번 비고`),
    };
  });
  if (!rows.length) {
    throw Object.assign(new Error("MMT 측정값을 하나 이상 입력해 주세요."), { statusCode: 400 });
  }
  return rows;
}

function normalizedInput(body) {
  const assessedOn = String(body.assessedOn || "");
  if (!validAssessmentDate(assessedOn)) {
    throw Object.assign(new Error("평가 날짜를 확인해 주세요."), { statusCode: 400 });
  }
  const visitKind = String(body.visitKind || "follow_up");
  if (!["initial", "follow_up", "discharge"].includes(visitKind)) {
    throw Object.assign(new Error("평가 구분을 확인해 주세요."), { statusCode: 400 });
  }
  const templateKey = String(body.templateKey || "dail_visit_v1");
  if (templateKey !== "dail_visit_v1") {
    throw Object.assign(new Error("지원하지 않는 평가 양식입니다."), { statusCode: 400 });
  }
  const sourceScores = body.scores && typeof body.scores === "object" ? body.scores : {};
  const scores = Object.fromEntries(Object.entries(SCORE_FIELDS).map(([key, label]) => [
    key,
    scoreValue(sourceScores[key], label),
  ]));
  if (scores.painVas === null) {
    throw Object.assign(new Error("통증 정도(VAS)를 입력해 주세요."), { statusCode: 400 });
  }
  const sourceSoap = body.soap && typeof body.soap === "object" && !Array.isArray(body.soap) ? body.soap : {};
  const soap = {
    subjective: requiredText(sourceSoap.subjective ?? body.mainConcern, 1600, "SOAP 주관적 정보(S)"),
    objective: requiredText(sourceSoap.objective ?? body.notes, 2000, "SOAP 객관적 정보(O)"),
    assessment: requiredText(sourceSoap.assessment ?? body.notes, 2000, "SOAP 평가(A)"),
    plan: requiredText(sourceSoap.plan ?? body.nextPlan, 1600, "SOAP 계획(P)"),
  };
  const rom = normalizedRom(body.rom);
  const mmt = normalizedMmt(body.mmt);
  const narrative = {
    mainConcern: soap.subjective,
    notes: soap.assessment,
    nextPlan: soap.plan,
    soap,
    rom,
    mmt,
  };
  return { assessedOn, visitKind, templateKey, scores, narrative };
}

function parseEncryptedJson(payload, context) {
  const plaintext = decryptClientField(payload, context);
  if (!plaintext) return {};
  try {
    const parsed = JSON.parse(plaintext);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("invalid");
    return parsed;
  } catch {
    throw new Error("Encrypted assessment payload is invalid");
  }
}

function encryptJson(value, context) {
  return encryptClientField(JSON.stringify(value), context);
}

function decryptRow(row) {
  const context = (field) => ({ centerId: row.center_id, clientId: row.id, field });
  const scores = parseEncryptedJson(row.scores_encrypted, context("assessment_scores"));
  const narrative = parseEncryptedJson(row.narrative_encrypted, context("assessment_narrative"));
  const sourceSoap = narrative.soap && typeof narrative.soap === "object" && !Array.isArray(narrative.soap)
    ? narrative.soap
    : {};
  const soap = {
    subjective: sourceSoap.subjective || narrative.mainConcern || "",
    objective: sourceSoap.objective || narrative.notes || "",
    assessment: sourceSoap.assessment || narrative.notes || "",
    plan: sourceSoap.plan || narrative.nextPlan || "",
  };
  return {
    id: row.id,
    client_id: row.client_id,
    assessed_on: row.assessed_on,
    visit_kind: row.visit_kind,
    template_key: row.template_key,
    scores,
    rom: Array.isArray(narrative.rom) ? narrative.rom : [],
    mmt: Array.isArray(narrative.mmt) ? narrative.mmt : [],
    soap,
    main_concern: soap.subjective,
    notes: soap.assessment,
    next_plan: soap.plan,
    sensitive_data_consent_at: row.sensitive_data_consent_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function existingClient(centerId, clientId) {
  const rows = await supabaseRequest("center_clients", {
    query: `?select=id,status&id=eq.${encodeURIComponent(clientId)}&center_id=eq.${encodeURIComponent(centerId)}&limit=1`,
  });
  return rows[0] || null;
}

async function existingAssessment(centerId, clientId, assessmentId) {
  const rows = await supabaseRequest("center_client_assessments", {
    query: `?select=${ASSESSMENT_SELECT}&id=eq.${encodeURIComponent(assessmentId)}&client_id=eq.${encodeURIComponent(clientId)}&center_id=eq.${encodeURIComponent(centerId)}&limit=1`,
  });
  return rows[0] || null;
}

function rateLimitIdentity(access) {
  return access.userId || access.session?.accountId || `center:${access.centerId}`;
}

async function listAssessments(req, res, access, clientId) {
  if (!enforceRateLimit(req, res, {
    bucket: "center-client-assessments-read",
    max: 120,
    windowMs: 15 * 60 * 1000,
    identity: rateLimitIdentity(access),
  })) return;
  if (!await existingClient(access.centerId, clientId)) {
    return sendJson(res, 404, { error: "이용자를 찾을 수 없습니다." });
  }
  const assessmentId = String(req.query?.assessmentId || "");
  if (assessmentId) {
    if (!validUuid(assessmentId)) return sendJson(res, 400, { error: "평가 기록을 확인해 주세요." });
    const row = await existingAssessment(access.centerId, clientId, assessmentId);
    if (!row) return sendJson(res, 404, { error: "평가 기록을 찾을 수 없습니다." });
    return sendJson(res, 200, { assessment: decryptRow(row) });
  }
  const rows = await supabaseRequest("center_client_assessments", {
    query: `?select=${ASSESSMENT_SELECT}&client_id=eq.${encodeURIComponent(clientId)}&center_id=eq.${encodeURIComponent(access.centerId)}&order=assessed_on.desc,created_at.desc&limit=100`,
  });
  return sendJson(res, 200, { assessments: rows.map(decryptRow) });
}

async function createAssessment(req, res, access, clientId, body) {
  if (!enforceRateLimit(req, res, {
    bucket: "center-client-assessments-write",
    max: 30,
    windowMs: 15 * 60 * 1000,
    identity: rateLimitIdentity(access),
  })) return;
  if (body.consentConfirmed !== true) {
    return sendJson(res, 400, { error: "민감정보 기록 동의 확인이 필요합니다." });
  }
  const client = await existingClient(access.centerId, clientId);
  if (!client) return sendJson(res, 404, { error: "이용자를 찾을 수 없습니다." });
  if (client.status === "archived") {
    return sendJson(res, 409, { error: "보관된 이용자는 다시 이용 중으로 전환한 뒤 평가해 주세요." });
  }
  const values = normalizedInput(body);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const context = (field) => ({ centerId: access.centerId, clientId: id, field });
  const insert = {
    id,
    center_id: access.centerId,
    client_id: clientId,
    assessed_on: values.assessedOn,
    visit_kind: values.visitKind,
    template_key: values.templateKey,
    scores_encrypted: encryptJson(values.scores, context("assessment_scores")),
    narrative_encrypted: encryptJson(values.narrative, context("assessment_narrative")),
    sensitive_data_consent_at: now,
    created_by_user_id: access.userId,
    updated_by_user_id: access.userId,
    created_at: now,
    updated_at: now,
  };
  const rows = await supabaseRequest("center_client_assessments", { method: "POST", body: insert });
  const row = rows[0] || insert;
  await recordAuditLog(req, {
    actorUserId: access.userId,
    actorRole: access.role,
    centerId: access.centerId,
    action: "center_client_assessment.create",
    targetType: "center_client_assessment",
    targetId: id,
    metadata: { clientId, templateKey: values.templateKey, visitKind: values.visitKind },
  });
  return sendJson(res, 201, { ok: true, assessment: decryptRow(row) });
}

async function updateAssessment(req, res, access, clientId, body) {
  if (!enforceRateLimit(req, res, {
    bucket: "center-client-assessments-write",
    max: 30,
    windowMs: 15 * 60 * 1000,
    identity: rateLimitIdentity(access),
  })) return;
  const assessmentId = String(body.assessmentId || "");
  if (!validUuid(assessmentId)) return sendJson(res, 400, { error: "평가 기록을 확인해 주세요." });
  const current = await existingAssessment(access.centerId, clientId, assessmentId);
  if (!current) return sendJson(res, 404, { error: "평가 기록을 찾을 수 없습니다." });
  const values = normalizedInput(body);
  const context = (field) => ({ centerId: access.centerId, clientId: assessmentId, field });
  const patch = {
    assessed_on: values.assessedOn,
    visit_kind: values.visitKind,
    template_key: values.templateKey,
    scores_encrypted: encryptJson(values.scores, context("assessment_scores")),
    narrative_encrypted: encryptJson(values.narrative, context("assessment_narrative")),
    updated_by_user_id: access.userId,
    updated_at: new Date().toISOString(),
  };
  await supabaseRequest("center_client_assessments", {
    method: "PATCH",
    query: `?id=eq.${encodeURIComponent(assessmentId)}&client_id=eq.${encodeURIComponent(clientId)}&center_id=eq.${encodeURIComponent(access.centerId)}`,
    body: patch,
  });
  await recordAuditLog(req, {
    actorUserId: access.userId,
    actorRole: access.role,
    centerId: access.centerId,
    action: "center_client_assessment.update",
    targetType: "center_client_assessment",
    targetId: assessmentId,
    metadata: { clientId, templateKey: values.templateKey, visitKind: values.visitKind },
  });
  return sendJson(res, 200, { ok: true, assessment: decryptRow({ ...current, ...patch }) });
}

module.exports = async function handler(req, res) {
  try {
    if (!["GET", "POST", "PATCH"].includes(req.method)) {
      return sendJson(res, 405, { error: "Method not allowed" });
    }
    const body = req.method === "GET" ? {} : bodyValue(req);
    const centerId = String(req.query?.centerId || body.centerId || "");
    const clientId = String(req.query?.clientId || body.clientId || "");
    if (!validUuid(centerId)) return sendJson(res, 400, { error: "관리할 센터를 확인해 주세요." });
    if (!validUuid(clientId)) return sendJson(res, 400, { error: "평가할 이용자를 확인해 주세요." });
    const access = await requireOwnerAccess(req, res, {
      centerId,
      action: req.method === "GET" ? "read_assessments" : "manage_assessments",
    });
    if (!access) return;
    if (access.legacy || !access.userId) {
      return sendJson(res, 403, { error: "민감정보 평가는 DAIL 계정으로 다시 로그인한 뒤 사용할 수 있습니다." });
    }
    if (req.method === "GET") return await listAssessments(req, res, access, clientId);
    if (req.method === "POST") return await createAssessment(req, res, access, clientId, body);
    return await updateAssessment(req, res, access, clientId, body);
  } catch (error) {
    const statusCode = Number(error.statusCode) || 500;
    if (statusCode >= 500) {
      console.error("center client assessments api failed", error);
      await recordErrorLog(req, error, { errorCode: "center_client_assessments_failed", statusCode });
    }
    return sendJson(res, statusCode, {
      error: statusCode >= 500 ? "이용자 평가 기록을 처리하지 못했습니다." : error.message,
    });
  }
};
