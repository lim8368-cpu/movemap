const assert = require("node:assert/strict");
const crypto = require("crypto");

process.env.SUPABASE_URL = "https://supabase.test";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role";
process.env.ADMIN_SESSION_SECRET = "test-admin-session-secret";
process.env.OWNER_SESSION_SECRET = "test-owner-session-secret";
process.env.CENTER_CLIENT_DATA_KEYS = `v1:${crypto.randomBytes(32).toString("base64")}`;
process.env.CENTER_CLIENT_LOOKUP_SECRET = "test-center-client-lookup-secret-at-least-32-chars";

const centerClients = require("./center-clients");
const { roleAllows } = require("./_platform-auth");
const { signOwnerSession } = require("./_owner-auth");

const CENTER_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CENTER_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const OWNER_USER = "11111111-1111-4111-8111-111111111111";
const MANAGER_USER = "22222222-2222-4222-8222-222222222222";
const STAFF_USER = "33333333-3333-4333-8333-333333333333";
const STAFF_ALLOWED_USER = "44444444-4444-4444-8444-444444444444";
const VIEWER_USER = "55555555-5555-4555-8555-555555555555";

const membershipsByUser = new Map([
  [OWNER_USER, [{ id: "membership-owner", center_id: CENTER_A, user_id: OWNER_USER, email: "owner@example.com", role: "owner", status: "active", permissions: [] }]],
  [MANAGER_USER, [{ id: "membership-manager", center_id: CENTER_A, user_id: MANAGER_USER, email: "manager@example.com", role: "manager", status: "active", permissions: [] }]],
  [STAFF_USER, [{ id: "membership-staff", center_id: CENTER_A, user_id: STAFF_USER, email: "staff@example.com", role: "staff", status: "active", permissions: [] }]],
  [STAFF_ALLOWED_USER, [{ id: "membership-staff-allowed", center_id: CENTER_A, user_id: STAFF_ALLOWED_USER, email: "allowed@example.com", role: "staff", status: "active", permissions: ["read_clients", "manage_clients"] }]],
  [VIEWER_USER, [{ id: "membership-viewer", center_id: CENTER_A, user_id: VIEWER_USER, email: "viewer@example.com", role: "viewer", status: "active", permissions: [] }]],
]);

const storedClients = [];
const auditEntries = [];
const insertedBodies = [];

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
  const raw = url.searchParams.get(key) || "";
  return raw.startsWith("eq.") ? raw.slice(3) : raw;
}

function userIdFromMembershipQuery(url) {
  return queryValue(url, "user_id");
}

function membershipToken(userId) {
  return signOwnerSession({
    auth_user_id: userId,
    center_id: CENTER_A,
    email: "member@example.com",
  });
}

function request({ method = "GET", userId = OWNER_USER, centerId = CENTER_A, clientId = "", body = {} } = {}) {
  const query = { centerId };
  if (clientId) query.clientId = clientId;
  return {
    method,
    url: `/api/center-clients?centerId=${centerId}${clientId ? `&clientId=${clientId}` : ""}`,
    query: method === "GET" ? query : {},
    body: method === "GET" ? undefined : { centerId, ...body },
    headers: { authorization: `Bearer ${membershipToken(userId)}` },
    socket: { remoteAddress: "127.0.0.45" },
  };
}

global.fetch = async function fetchMock(rawUrl, init = {}) {
  const url = new URL(rawUrl);
  const table = url.pathname.split("/").pop();
  const method = init.method || "GET";

  if (table === "center_memberships") {
    if (method === "PATCH") return jsonResponse(null, 204);
    return jsonResponse(membershipsByUser.get(userIdFromMembershipQuery(url)) || []);
  }

  if (table === "center_clients") {
    if (method === "POST") {
      const body = JSON.parse(init.body);
      insertedBodies.push(body);
      storedClients.push(body);
      return jsonResponse([body], 201);
    }
    if (method === "PATCH") {
      const id = queryValue(url, "id");
      const centerId = queryValue(url, "center_id");
      const patch = JSON.parse(init.body);
      const row = storedClients.find((item) => item.id === id && item.center_id === centerId);
      if (row) Object.assign(row, patch);
      return jsonResponse(null, 204);
    }
    const centerId = queryValue(url, "center_id");
    const id = queryValue(url, "id");
    return jsonResponse(storedClients.filter((item) =>
      item.center_id === centerId && (!id || item.id === id)
    ));
  }

  if (table === "audit_logs" && method === "POST") {
    const body = JSON.parse(init.body);
    auditEntries.push(body);
    return jsonResponse([body], 201);
  }

  if (table === "error_logs" && method === "POST") return jsonResponse([], 201);
  if (table === "operational_alerts" && method === "POST") return jsonResponse([], 201);
  throw new Error(`Unexpected request: ${method} ${rawUrl}`);
};

async function call(req) {
  const res = responseRecorder();
  await centerClients(req, res);
  return res;
}

(async function run() {
  assert.equal(roleAllows("owner", "manage_clients"), true);
  assert.equal(roleAllows("manager", "read_clients"), true);
  assert.equal(roleAllows("staff", "read_clients"), false);
  assert.equal(roleAllows("viewer", "read_clients"), false);
  assert.equal(roleAllows("staff", "manage_clients", ["manage_clients"]), false);
  assert.equal(roleAllows("viewer", "manage_clients", ["manage_clients"]), false);
  assert.equal(roleAllows("unknown", "read_clients", ["read_clients"]), false);

  const noConsent = await call(request({
    method: "POST",
    body: { fullName: "동의 없음", phone: "010-1000-1000", consentConfirmed: false },
  }));
  assert.equal(noConsent.statusCode, 400);

  const badInput = await call(request({
    method: "POST",
    body: { fullName: "입력 오류", phone: "12", email: "invalid", consentConfirmed: true },
  }));
  assert.equal(badInput.statusCode, 400);

  const missingCenter = await call(request({ centerId: "" }));
  assert.equal(missingCenter.statusCode, 400);

  const tooLong = await call(request({
    method: "POST",
    body: { fullName: "가".repeat(51), phone: "010-1000-1000", consentConfirmed: true },
  }));
  assert.equal(tooLong.statusCode, 400);

  const create = await call(request({
    method: "POST",
    body: {
      fullName: "김다일",
      phone: "01012345678",
      email: "CLIENT@EXAMPLE.COM",
      primaryConcern: "어깨 움직임이 불편함",
      goal: "일상 활동 복귀",
      notes: "오후 연락 선호",
      consentConfirmed: true,
    },
  }));
  assert.equal(create.statusCode, 201);
  assert.equal(create.body.ok, true);
  assert.equal(create.body.client.full_name, "김다일");
  assert.equal(create.body.client.phone, "010-1234-5678");
  assert.equal(create.body.client.email, "client@example.com");
  assert.equal(create.body.client.status, "active");

  const storedText = JSON.stringify(insertedBodies[0]);
  for (const plaintext of ["김다일", "01012345678", "010-1234-5678", "client@example.com", "어깨 움직임이 불편함", "일상 활동 복귀", "오후 연락 선호"]) {
    assert.equal(storedText.includes(plaintext), false, `database payload leaked ${plaintext}`);
  }
  assert.equal(typeof insertedBodies[0].phone_lookup_hash, "string");
  assert.ok(insertedBodies[0].phone_lookup_hash.length > 20);

  const list = await call(request());
  assert.equal(list.statusCode, 200);
  assert.deepEqual(Object.keys(list.body.clients[0]), [
    "id", "full_name", "phone", "status", "created_at", "updated_at", "archived_at",
  ]);
  assert.equal(JSON.stringify(list.body).includes("오후 연락 선호"), false);

  const detail = await call(request({ clientId: create.body.client.id }));
  assert.equal(detail.statusCode, 200);
  assert.equal(detail.body.client.email, "client@example.com");
  assert.equal(detail.body.client.notes, "오후 연락 선호");

  const staffDenied = await call(request({ userId: STAFF_USER }));
  assert.equal(staffDenied.statusCode, 403);
  const viewerDenied = await call(request({ userId: VIEWER_USER }));
  assert.equal(viewerDenied.statusCode, 403);
  const crossCenterDenied = await call(request({ centerId: CENTER_B }));
  assert.equal(crossCenterDenied.statusCode, 403);
  const managerAllowed = await call(request({ userId: MANAGER_USER }));
  assert.equal(managerAllowed.statusCode, 200);
  const explicitStaffDenied = await call(request({ userId: STAFF_ALLOWED_USER }));
  assert.equal(explicitStaffDenied.statusCode, 403);

  const clientId = create.body.client.id;
  const archive = await call(request({
    method: "PATCH",
    userId: MANAGER_USER,
    body: { clientId, status: "archived", notes: "보관 전 확인 완료" },
  }));
  assert.equal(archive.statusCode, 200);
  assert.equal(archive.body.client.status, "archived");
  assert.ok(archive.body.client.archived_at);
  assert.equal(archive.body.client.notes, "보관 전 확인 완료");

  const restore = await call(request({
    method: "PATCH",
    userId: OWNER_USER,
    body: { clientId, status: "active", goal: "걷기 활동 복귀" },
  }));
  assert.equal(restore.statusCode, 200);
  assert.equal(restore.body.client.status, "active");
  assert.equal(restore.body.client.archived_at, null);
  assert.equal(restore.body.client.goal, "걷기 활동 복귀");

  assert.deepEqual(auditEntries.map((entry) => entry.action), [
    "center_client.create",
    "center_client.archive",
    "center_client.restore",
  ]);
  const auditText = JSON.stringify(auditEntries);
  for (const pii of ["김다일", "010-1234-5678", "client@example.com", "어깨 움직임이 불편함", "보관 전 확인 완료", "걷기 활동 복귀"]) {
    assert.equal(auditText.includes(pii), false, `audit log leaked ${pii}`);
  }

  const missing = await call(request({
    method: "PATCH",
    body: { clientId: "99999999-9999-4999-8999-999999999999", status: "archived" },
  }));
  assert.equal(missing.statusCode, 404);

  console.log("Center clients API tests passed");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
