const assert = require("assert");

process.env.SUPABASE_URL = "https://supabase.test";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role";
process.env.SUPABASE_ANON_KEY = "test-anon";
process.env.AUTH_SUPABASE_URL = "https://supabase.test";
process.env.AUTH_SUPABASE_ANON_KEY = "test-anon";
process.env.AUTH_SUPABASE_SERVICE_ROLE_KEY = "test-service-role";
process.env.ADMIN_SESSION_SECRET = "test-admin-session-secret";

const centerApplications = require("./center-applications");
const approveCenter = require("./approve-center");
const { privacyHash, signAdminSession } = require("./_shared");

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

function applicationRequest(token = "registration-token") {
  return {
    method: "POST",
    url: "/api/center-applications",
    headers: { "x-registration-token": token },
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
  };
}

async function testRegistrationSessionIsRequired() {
  global.fetch = async function (url, init = {}) {
    if (String(url).includes("/rest/v1/registration_sessions")) return jsonResponse([]);
    throw new Error(`Unexpected request: ${init.method || "GET"} ${url}`);
  };
  const res = responseRecorder();
  await centerApplications(applicationRequest("expired-token"), res);
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.code, "registration_session_required");
}

async function testGeneralCenterApplicationUsesSupabaseAuth() {
  let insertedApplication;
  let registrationConsumed = false;
  global.fetch = async function (url, init = {}) {
    const parsed = new URL(url);
    const method = init.method || "GET";
    if (parsed.pathname === "/auth/v1/token") {
      return jsonResponse({ error: "invalid credentials" }, 400);
    }
    if (parsed.pathname === "/auth/v1/signup") {
      return jsonResponse({
        user: {
          id: "auth-user-1",
          email: "owner@example.com",
          identities: [{ id: "identity-1" }],
        },
      });
    }
    const table = parsed.pathname.split("/").pop();
    if (table === "registration_sessions" && method === "GET") {
      return jsonResponse([{
        id: "registration-session-1",
        ip_hash: privacyHash("unknown", "registration-ip"),
        upload_paths: [],
        expires_at: new Date(Date.now() + 60_000).toISOString(),
        consumed_at: null,
      }]);
    }
    if (table === "registration_sessions" && method === "PATCH") {
      registrationConsumed = true;
      return jsonResponse(null, 204);
    }
    if (table === "center_applications" && method === "GET") return jsonResponse([]);
    if (table === "center_applications" && method === "POST") {
      insertedApplication = JSON.parse(init.body);
      return jsonResponse([{ id: "application-1" }], 201);
    }
    if (table === "audit_logs" && method === "POST") {
      return jsonResponse([{ id: "audit-1" }], 201);
    }
    throw new Error(`Unexpected request: ${method} ${url}`);
  };

  const res = responseRecorder();
  await centerApplications(applicationRequest(), res);

  assert.equal(res.statusCode, 202);
  assert.equal(insertedApplication.therapist_background, false);
  assert.equal(insertedApplication.license_holder_name, "해당 없음");
  assert.equal(insertedApplication.license_number, "해당 없음");
  assert.equal(insertedApplication.license_image_path, null);
  assert.equal(insertedApplication.owner_password_scrypt, null);
  assert.equal(insertedApplication.applicant_auth_user_id, "auth-user-1");
  assert.equal(insertedApplication.registration_session_id, "registration-session-1");
  assert.equal("password" in insertedApplication, false);
  assert.equal(registrationConsumed, true);
}

async function testApprovalCreatesOwnerMembership() {
  let membershipBody;
  let centerBody;
  let applicationPatch;
  const application = {
    id: "application-1",
    status: "pending",
    center_name: "일반 운동센터",
    owner_name: "홍길동",
    email: "owner@example.com",
    applicant_auth_user_id: "auth-user-1",
    owner_password_scrypt: null,
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
    if (table === "center_memberships" && method === "POST") {
      membershipBody = JSON.parse(init.body);
      return jsonResponse([{ id: "membership-1" }], 201);
    }
    if (table === "center_applications" && method === "PATCH") {
      applicationPatch = JSON.parse(init.body);
      return jsonResponse(null, 204);
    }
    if (table === "audit_logs" && method === "POST") {
      return jsonResponse([{ id: "audit-2" }], 201);
    }
    throw new Error(`Unexpected request: ${method} ${url}`);
  };

  const res = responseRecorder();
  const token = signAdminSession();
  await approveCenter({
    method: "POST",
    url: "/api/approve-center?id=application-1",
    query: { id: "application-1" },
    headers: { cookie: `movemap_admin_session=${encodeURIComponent(token)}` },
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ownerMembershipCreated, true);
  assert.equal(res.body.ownerAccountCreated, false);
  assert.equal(centerBody.therapist, "홍길동 센터장");
  assert.equal(membershipBody.user_id, "auth-user-1");
  assert.equal(membershipBody.role, "owner");
  assert.equal(membershipBody.status, "active");
  assert.equal(applicationPatch.owner_password_scrypt, null);
  assert.equal(applicationPatch.status, "approved");
}

(async function run() {
  const originalFetch = global.fetch;
  try {
    await testRegistrationSessionIsRequired();
    await testGeneralCenterApplicationUsesSupabaseAuth();
    await testApprovalCreatesOwnerMembership();
    console.log("Center onboarding tests passed");
  } finally {
    global.fetch = originalFetch;
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
