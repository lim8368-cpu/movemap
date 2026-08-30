const assert = require("node:assert/strict");
const crypto = require("crypto");

process.env.SUPABASE_URL = "https://supabase.test";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role";
process.env.ADMIN_SESSION_SECRET = "test-admin-session-secret";
process.env.OWNER_SESSION_SECRET = "test-owner-session-secret";
process.env.CENTER_CLIENT_DATA_KEYS = `v1:${crypto.randomBytes(32).toString("base64")}`;
process.env.CENTER_CLIENT_LOOKUP_SECRET = "test-center-client-lookup-secret-at-least-32-chars";

const handler = require("./center-client-assessments");
const { roleAllows } = require("./_platform-auth");
const { signOwnerSession } = require("./_owner-auth");

const CENTER_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CENTER_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CLIENT_A = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const OWNER_USER = "11111111-1111-4111-8111-111111111111";
const MANAGER_USER = "22222222-2222-4222-8222-222222222222";
const STAFF_USER = "33333333-3333-4333-8333-333333333333";
const VIEWER_USER = "44444444-4444-4444-8444-444444444444";
const memberships = new Map([
  [OWNER_USER, [{ id: "m-owner", center_id: CENTER_A, user_id: OWNER_USER, email: "owner@example.com", role: "owner", status: "active", permissions: [] }]],
  [MANAGER_USER, [{ id: "m-manager", center_id: CENTER_A, user_id: MANAGER_USER, email: "manager@example.com", role: "manager", status: "active", permissions: [] }]],
  [STAFF_USER, [{ id: "m-staff", center_id: CENTER_A, user_id: STAFF_USER, email: "staff@example.com", role: "staff", status: "active", permissions: [] }]],
  [VIEWER_USER, [{ id: "m-viewer", center_id: CENTER_A, user_id: VIEWER_USER, email: "viewer@example.com", role: "viewer", status: "active", permissions: ["manage_assessments"] }]],
]);
const clients = [{ id: CLIENT_A, center_id: CENTER_A, status: "active" }];
const assessments = [];
const audits = [];

function jsonResponse(body, status = 200) {
  return new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function responseRecorder() {
  return {
    headers: {},
    statusCode: 200,
    setHeader(name, value) { this.headers[name] = value; },
    end(value) { this.body = value ? JSON.parse(value) : null; },
  };
}

function queryValue(url, key) {
  const value = url.searchParams.get(key) || "";
  return value.startsWith("eq.") ? value.slice(3) : value;
}

function request({ method = "GET", userId = OWNER_USER, centerId = CENTER_A, clientId = CLIENT_A, body = {} } = {}) {
  const token = signOwnerSession({ auth_user_id: userId, center_id: CENTER_A, email: "member@example.com" });
  return {
    method,
    url: `/api/center-client-assessments?centerId=${centerId}&clientId=${clientId}`,
    query: method === "GET" ? { centerId, clientId } : {},
    body: method === "GET" ? undefined : { centerId, clientId, ...body },
    headers: { authorization: `Bearer ${token}` },
    socket: { remoteAddress: "127.0.0.63" },
  };
}

function professionalDetails(overrides = {}) {
  return {
    intake: {
      primaryArea: "오른쪽 무릎",
      onsetDate: "2026-08-01",
      onsetMechanism: "러닝 이후 시작",
      aggravatingFactors: "계단 내려가기",
      easingFactors: "휴식",
      activityLimitation: "계단과 20분 이상 걷기 어려움",
      patientGoal: "통증 걱정 없이 출퇴근하기",
      precautions: "최근 수술 없음",
      referralStatus: "none",
    },
    goals: {
      shortTerm: "2주 이내 활동 시 통증을 4 이하로 낮춘다.",
      longTerm: "6주 이내 계단을 불편 없이 이용한다.",
      reviewOn: "2026-09-11",
      frequency: "주 2회, 6주",
    },
    evaluator: { name: "김다일", credential: "물리치료사" },
    functionalTests: [{ name: "30초 의자 일어서기", result: "10", unit: "회", condition: "팔짱", note: "마지막 2회 속도 저하" }],
    ...overrides,
  };
}

global.fetch = async function fetchMock(rawUrl, init = {}) {
  const url = new URL(rawUrl);
  const table = url.pathname.split("/").pop();
  const method = init.method || "GET";
  if (table === "center_memberships") {
    if (method === "PATCH") return jsonResponse(null, 204);
    return jsonResponse(memberships.get(queryValue(url, "user_id")) || []);
  }
  if (table === "center_clients") {
    return jsonResponse(clients.filter((row) => row.id === queryValue(url, "id") && row.center_id === queryValue(url, "center_id")));
  }
  if (table === "center_client_assessments") {
    if (method === "POST") {
      const row = JSON.parse(init.body);
      assessments.push(row);
      return jsonResponse([row], 201);
    }
    if (method === "PATCH") {
      const row = assessments.find((item) => item.id === queryValue(url, "id") && item.center_id === queryValue(url, "center_id"));
      if (row) Object.assign(row, JSON.parse(init.body));
      return jsonResponse(null, 204);
    }
    const centerId = queryValue(url, "center_id");
    const clientId = queryValue(url, "client_id");
    const id = queryValue(url, "id");
    return jsonResponse(assessments.filter((row) => row.center_id === centerId && row.client_id === clientId && (!id || row.id === id)));
  }
  if (table === "audit_logs" && method === "POST") {
    const row = JSON.parse(init.body);
    audits.push(row);
    return jsonResponse([row], 201);
  }
  if (["error_logs", "operational_alerts"].includes(table) && method === "POST") return jsonResponse([], 201);
  throw new Error(`Unexpected request: ${method} ${rawUrl}`);
};

async function call(req) {
  const res = responseRecorder();
  await handler(req, res);
  return res;
}

(async function run() {
  assert.equal(roleAllows("owner", "manage_assessments"), true);
  assert.equal(roleAllows("manager", "read_assessments"), true);
  assert.equal(roleAllows("staff", "read_assessments"), false);
  assert.equal(roleAllows("viewer", "manage_assessments", ["manage_assessments"]), false);

  assert.equal((await call(request({ centerId: "" }))).statusCode, 400);
  assert.equal((await call(request({ clientId: "invalid" }))).statusCode, 400);
  assert.equal((await call(request({ userId: STAFF_USER }))).statusCode, 403);
  assert.equal((await call(request({ userId: VIEWER_USER }))).statusCode, 403);
  assert.equal((await call(request({ centerId: CENTER_B }))).statusCode, 403);

  const noConsent = await call(request({
    method: "POST",
    body: { assessedOn: "2026-08-28", scores: { painVas: 5 }, consentConfirmed: false },
  }));
  assert.equal(noConsent.statusCode, 400);

  const badScore = await call(request({
    method: "POST",
    body: { assessedOn: "2026-08-28", scores: { painVas: 11 }, consentConfirmed: true },
  }));
  assert.equal(badScore.statusCode, 400);

  const missingMeasurements = await call(request({
    method: "POST",
    body: {
      assessedOn: "2026-08-28",
      scores: { painVas: 5 },
      soap: { subjective: "허리 불편", objective: "보행 관찰", assessment: "기능 제한", plan: "재평가" },
      consentConfirmed: true,
    },
  }));
  assert.equal(missingMeasurements.statusCode, 400);

  const created = await call(request({
    method: "POST",
    body: {
      assessedOn: "2026-08-28",
      visitKind: "follow_up",
      scores: { painVas: 6, painAtRest: 2, painWithActivity: 6, painWorst24h: 7, dailyFunction: 4, movementConfidence: 3, balanceConfidence: null },
      rom: [{ joint: "무릎", movement: "굴곡", side: "right", active: 115, passive: 125, reference: "135", endFeel: "단단함", pain: 6, note: "말기 범위 불편" }],
      mmt: [{ movement: "무릎 폄", side: "right", grade: 4, pain: 3, note: "저항 시 흔들림" }],
      soap: {
        subjective: "계단에서 통증 증가",
        objective: "우측 무릎 굴곡 범위 감소",
        assessment: "VAS 재평가",
        plan: "다음 방문에 균형 항목 추가",
      },
      ...professionalDetails(),
      consentConfirmed: true,
    },
  }));
  assert.equal(created.statusCode, 201);
  assert.equal(created.body.assessment.scores.painVas, 6);
  assert.equal(created.body.assessment.main_concern, "계단에서 통증 증가");
  assert.equal(created.body.assessment.rom[0].active, 115);
  assert.equal(created.body.assessment.mmt[0].grade, 4);
  assert.equal(created.body.assessment.functional_tests[0].unit, "회");
  assert.equal(created.body.assessment.intake.primaryArea, "오른쪽 무릎");
  assert.equal(created.body.assessment.goals.frequency, "주 2회, 6주");
  assert.equal(created.body.assessment.evaluator.credential, "물리치료사");
  assert.equal(created.body.assessment.soap.objective, "우측 무릎 굴곡 범위 감소");
  const storedText = JSON.stringify(assessments[0]);
  for (const plaintext of ["계단에서 통증 증가", "우측 무릎 굴곡 범위 감소", "VAS 재평가", "다음 방문에 균형 항목 추가", "무릎 폄"]) {
    assert.equal(storedText.includes(plaintext), false);
  }

  const list = await call(request({ userId: MANAGER_USER }));
  assert.equal(list.statusCode, 200);
  assert.equal(list.body.assessments.length, 1);
  assert.equal(list.body.assessments[0].scores.dailyFunction, 4);

  const updated = await call(request({
    method: "PATCH",
    body: {
      assessmentId: created.body.assessment.id,
      assessedOn: "2026-08-28",
      visitKind: "discharge",
      scores: { painVas: 2, dailyFunction: 8 },
      rom: [{ joint: "무릎", movement: "굴곡", side: "right", active: 130, passive: 135, reference: "135", endFeel: "정상", pain: 1, note: "" }],
      mmt: [{ movement: "무릎 폄", side: "right", grade: 5, pain: 0, note: "" }],
      soap: {
        subjective: "일상 활동 개선",
        objective: "계단 오르기 독립 수행",
        assessment: "목표 범위에 도달",
        plan: "자율 관리",
      },
      ...professionalDetails({
        intake: { ...professionalDetails().intake, activityLimitation: "계단 이용 가능, 장거리 보행 시 피로" },
        goals: { ...professionalDetails().goals, reviewOn: "2026-10-01" },
      }),
    },
  }));
  assert.equal(updated.statusCode, 200);
  assert.equal(updated.body.assessment.visit_kind, "discharge");
  assert.equal(updated.body.assessment.scores.painVas, 2);
  assert.deepEqual(audits.map((row) => row.action), [
    "center_client_assessment.create",
    "center_client_assessment.update",
  ]);
  const auditText = JSON.stringify(audits);
  assert.equal(auditText.includes("일상 활동 개선"), false);
  assert.equal(auditText.includes("자율 관리"), false);

  console.log("Center client assessments API tests passed");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
