const assert = require("assert");

process.env.SUPABASE_URL = "https://supabase.test";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role";
process.env.ADMIN_SESSION_SECRET = "test-admin-session-secret";

const centerApplications = require("./center-applications");
const approveCenter = require("./approve-center");
const { signAdminSession } = require("./_shared");
const { verifyOwnerPassword } = require("./_owner-auth");

function responseRecorder() {
  return {
    headers: {},
    statusCode: 200,
    setHeader(name, value) { this.headers[name] = value; },
    end(value) { this.body = value ? JSON.parse(value) : null; },
  };
}

function jsonResponse(body, status = 200) {
  return new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function testGeneralCenterApplication() {
  let insertedApplication;
  global.fetch = async function (url, init = {}) {
    const parsed = new URL(url);
    const table = parsed.pathname.split("/").pop();
    const method = init.method || "GET";
    if (table === "center_owner_accounts" && method === "GET") return jsonResponse([]);
    if (table === "center_applications" && method === "GET") return jsonResponse([]);
    if (table === "center_applications" && method === "POST") {
      insertedApplication = JSON.parse(init.body);
      return jsonResponse([{ id: "application-1" }], 201);
    }
    throw new Error(`Unexpected request: ${method} ${url}`);
  };

  const res = responseRecorder();
  await centerApplications({
    method: "POST",
    body: {
      centerName: "일반 운동센터",
      ownerName: "홍길동",
      phone: "010-1234-5678",
      email: "owner@example.com",
      password: "secure-pass-123",
      area: "서울 중구",
      address: "서울 중구 세종대로 110",
      therapistBackground: false,
      consent: true,
    },
  }, res);

  assert.equal(res.statusCode, 202);
  assert.equal(insertedApplication.therapist_background, false);
  assert.equal(insertedApplication.license_holder_name, "해당 없음");
  assert.equal(insertedApplication.license_number, "해당 없음");
  assert.equal(insertedApplication.license_image_path, null);
  assert.equal(verifyOwnerPassword("secure-pass-123", insertedApplication.owner_password_scrypt), true);
  assert.equal("password" in insertedApplication, false);
}

async function testApprovalActivatesOwnerAccount() {
  let ownerAccountBody;
  let centerBody;
  let applicationPatch;
  const application = {
    id: "application-1",
    status: "pending",
    center_name: "일반 운동센터",
    owner_name: "홍길동",
    email: "owner@example.com",
    owner_password_scrypt: testApprovalActivatesOwnerAccount.passwordHash,
    therapist_background: false,
    area: "서울 중구",
    address: "서울 중구 세종대로 110",
    services: "자세교정",
    photo_paths: [],
  };

  global.fetch = async function (url, init = {}) {
    const parsed = new URL(url);
    const table = parsed.pathname.split("/").pop();
    const method = init.method || "GET";
    if (table === "center_applications" && method === "GET") return jsonResponse([application]);
    if (table === "centers" && method === "POST") {
      centerBody = JSON.parse(init.body);
      return jsonResponse([{ id: "center-1" }], 201);
    }
    if (table === "center_owner_accounts" && method === "GET") return jsonResponse([]);
    if (table === "center_owner_accounts" && method === "POST") {
      ownerAccountBody = JSON.parse(init.body);
      return jsonResponse([{ id: "account-1" }], 201);
    }
    if (table === "center_applications" && method === "PATCH") {
      applicationPatch = JSON.parse(init.body);
      return jsonResponse(null, 204);
    }
    throw new Error(`Unexpected request: ${method} ${url}`);
  };

  const res = responseRecorder();
  const token = signAdminSession();
  await approveCenter({
    method: "POST",
    query: { id: "application-1" },
    headers: { cookie: `movemap_admin_session=${encodeURIComponent(token)}` },
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ownerAccountCreated, true);
  assert.equal(centerBody.therapist, "홍길동 센터장");
  assert.equal(ownerAccountBody.email, "owner@example.com");
  assert.equal(ownerAccountBody.password_scrypt, application.owner_password_scrypt);
  assert.equal(applicationPatch.owner_password_scrypt, null);
  assert.equal(applicationPatch.status, "approved");
}

(async function run() {
  const originalFetch = global.fetch;
  try {
    await testGeneralCenterApplication();
    const captureRes = responseRecorder();
    let capturedHash;
    global.fetch = async function (url, init = {}) {
      const parsed = new URL(url);
      const table = parsed.pathname.split("/").pop();
      const method = init.method || "GET";
      if (method === "GET") return jsonResponse([]);
      if (table === "center_applications" && method === "POST") {
        capturedHash = JSON.parse(init.body).owner_password_scrypt;
        return jsonResponse([{ id: "hash-source" }], 201);
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    };
    await centerApplications({
      method: "POST",
      body: {
        centerName: "해시 확인 센터",
        ownerName: "홍길동",
        phone: "010-1234-5678",
        email: "hash@example.com",
        password: "secure-pass-123",
        area: "서울 중구",
        address: "서울 중구 세종대로 110",
        therapistBackground: false,
        consent: true,
      },
    }, captureRes);
    testApprovalActivatesOwnerAccount.passwordHash = capturedHash;
    await testApprovalActivatesOwnerAccount();
    console.log("Center onboarding tests passed");
  } finally {
    global.fetch = originalFetch;
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
