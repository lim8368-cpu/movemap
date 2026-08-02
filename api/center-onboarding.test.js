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
const ownerLogin = require("./owner-login");
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
    headers: {
      "x-registration-token": token,
      authorization: "Bearer social-access-token",
    },
    body: {
      centerName: "물리치료사 운동센터",
      ownerName: "홍길동",
      phone: "010-1234-5678",
      email: "owner@example.com",
      area: "서울 중구",
      address: "서울 중구 세종대로 110",
      therapistBackground: true,
      licenseHolderName: "홍길동",
      licenseNumber: "PT-12345",
      licenseImagePath: "registration/registration-session-1/license.png",
      services: "허리·골반, 수술 후 회복",
      openingSchedule: {
        monday: { closed: false, open: "09:00", close: "20:00" },
        saturday: { closed: false, open: "10:00", close: "15:00" },
        sunday: { closed: true, open: "10:00", close: "17:00" },
      },
      consent: true,
    },
  };
}

async function testRegistrationSessionIsRequired() {
  global.fetch = async function (url, init = {}) {
    if (String(url).endsWith("/auth/v1/user")) {
      return jsonResponse({ id: "auth-user-1", email: "owner@example.com" });
    }
    if (String(url).includes("/rest/v1/registration_sessions")) return jsonResponse([]);
    throw new Error(`Unexpected request: ${init.method || "GET"} ${url}`);
  };
  const res = responseRecorder();
  await centerApplications(applicationRequest("expired-token"), res);
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.code, "registration_session_required");
}

async function testTherapistCenterApplicationUsesAuthenticatedSocialAccount() {
  let insertedApplication;
  let registrationConsumed = false;
  global.fetch = async function (url, init = {}) {
    const parsed = new URL(url);
    const method = init.method || "GET";
    if (parsed.pathname === "/auth/v1/user") {
      return jsonResponse({ id: "auth-user-1", email: "owner@example.com" });
    }
    const table = parsed.pathname.split("/").pop();
    if (table === "registration_sessions" && method === "GET") {
      return jsonResponse([{
        id: "registration-session-1",
        ip_hash: privacyHash("unknown", "registration-ip"),
        upload_paths: ["registration/registration-session-1/license.png"],
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
  assert.equal(insertedApplication.therapist_background, true);
  assert.equal(insertedApplication.license_holder_name, "홍길동");
  assert.equal(insertedApplication.license_number, "PT-12345");
  assert.equal(insertedApplication.license_image_path, "registration/registration-session-1/license.png");
  assert.equal(insertedApplication.opening_schedule.monday.open, "09:00");
  assert.match(insertedApplication.opening_hours, /월 09:00–20:00/);
  assert.equal(insertedApplication.owner_password_scrypt, null);
  assert.equal(insertedApplication.applicant_auth_user_id, "auth-user-1");
  assert.equal(insertedApplication.registration_session_id, "registration-session-1");
  assert.equal(insertedApplication.services, "허리·골반, 수술 후 회복");
  assert.equal("password" in insertedApplication, false);
  assert.equal(registrationConsumed, true);
}

async function testSportsScienceCenterApplicationUsesDegreeCertificateAndLegacyScheduleFallback() {
  let insertedApplication;
  let applicationPosts = 0;
  global.fetch = async function (url, init = {}) {
    const parsed = new URL(url);
    const method = init.method || "GET";
    if (parsed.pathname === "/auth/v1/user") {
      return jsonResponse({ id: "auth-user-1", email: "owner@example.com" });
    }
    const table = parsed.pathname.split("/").pop();
    if (table === "registration_sessions" && method === "GET") {
      return jsonResponse([{
        id: "registration-session-1",
        ip_hash: privacyHash("unknown", "registration-ip"),
        upload_paths: ["registration/registration-session-1/qualification/degree.pdf"],
        expires_at: new Date(Date.now() + 60_000).toISOString(),
        consumed_at: null,
      }]);
    }
    if (table === "registration_sessions" && method === "PATCH") return jsonResponse(null, 204);
    if (table === "center_applications" && method === "GET") return jsonResponse([]);
    if (table === "center_applications" && method === "POST") {
      applicationPosts += 1;
      const body = JSON.parse(init.body);
      if (applicationPosts === 1) {
        assert.ok(body.opening_schedule);
        return jsonResponse({ message: "Could not find the 'opening_hours' column of 'center_applications' in the schema cache" }, 400);
      }
      insertedApplication = body;
      return jsonResponse([{ id: "application-sports-1" }], 201);
    }
    if (table === "audit_logs" && method === "POST") return jsonResponse([{ id: "audit-sports-1" }], 201);
    throw new Error(`Unexpected request: ${method} ${url}`);
  };
  const req = applicationRequest();
  req.headers["x-registration-token"] = "sports-registration-token";
  req.body.qualificationType = "sports_science";
  req.body.therapistBackground = false;
  req.body.qualificationHolderName = "김체육";
  req.body.qualificationNumber = "석사 · 한국대학교 · 스포츠과학과";
  req.body.qualificationImagePath = "registration/registration-session-1/qualification/degree.pdf";
  req.body.degreeLevel = "석사";
  req.body.degreeSchool = "한국대학교";
  req.body.degreeMajor = "스포츠과학과";
  req.body.licenseHolderName = "김체육";
  req.body.licenseNumber = req.body.qualificationNumber;
  req.body.licenseImagePath = req.body.qualificationImagePath;
  const res = responseRecorder();
  await centerApplications(req, res);
  assert.equal(res.statusCode, 202);
  assert.equal(applicationPosts, 2);
  assert.equal(insertedApplication.therapist_background, false);
  assert.equal(insertedApplication.license_holder_name, "김체육");
  assert.equal(insertedApplication.license_number, "석사 · 한국대학교 · 스포츠과학과");
  assert.equal(insertedApplication.license_image_path, "registration/registration-session-1/qualification/degree.pdf");
  assert.equal("opening_schedule" in insertedApplication, false);
  assert.match(insertedApplication.memo, /\[DAIL 운영시간\]/);
  assert.match(insertedApplication.memo, /\[DAIL 운영일정\]/);
}

async function testCenterApplicationRequiresAuthenticatedAccount() {
  global.fetch = async function () {
    throw new Error("Unauthenticated application must not reach Supabase");
  };
  const req = applicationRequest();
  delete req.headers.authorization;
  const res = responseRecorder();
  await centerApplications(req, res);
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.error, "로그인이 필요합니다.");
}

async function testApprovalCreatesOwnerMembership() {
  let membershipBody;
  let centerBody;
  let applicationPatch;
  const application = {
    id: "application-1",
    status: "pending",
    center_name: "물리치료사 운동센터",
    owner_name: "홍길동",
    email: "owner@example.com",
    applicant_auth_user_id: "auth-user-1",
    owner_password_scrypt: null,
    therapist_background: true,
    license_holder_name: "홍길동",
    area: "서울 중구",
    address: "서울 중구 세종대로 110",
    services: "자세교정, 스포츠재활",
    opening_schedule: {
      monday: { closed: false, open: "08:00", close: "19:00" },
      saturday: { closed: true, open: "10:00", close: "17:00" },
      sunday: { closed: true, open: "10:00", close: "17:00" },
    },
    opening_hours: "월 08:00–19:00",
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
  assert.equal(centerBody.therapist, "홍길동");
  assert.deepEqual(centerBody.categories, ["자세·균형", "스포츠 복귀"]);
  assert.equal(centerBody.opening_schedule.monday.open, "08:00");
  assert.equal(centerBody.opening_hours, "월 08:00–19:00");
  assert.equal(membershipBody.user_id, "auth-user-1");
  assert.equal(membershipBody.role, "owner");
  assert.equal(membershipBody.status, "active");
  assert.equal(applicationPatch.owner_password_scrypt, null);
  assert.equal(applicationPatch.status, "approved");
}

async function testSocialSessionCreatesOwnerDashboardSession() {
  global.fetch = async function (url, init = {}) {
    const parsed = new URL(url);
    const method = init.method || "GET";
    if (parsed.pathname === "/auth/v1/user") {
      return jsonResponse({ id: "auth-user-1", email: "owner@example.com" });
    }
    const table = parsed.pathname.split("/").pop();
    if (table === "center_memberships" && method === "GET") {
      return jsonResponse([{
        id: "membership-1",
        center_id: "center-1",
        user_id: "auth-user-1",
        email: "owner@example.com",
        role: "owner",
        status: "active",
      }]);
    }
    if (table === "audit_logs" && method === "POST") {
      return jsonResponse([{ id: "audit-3" }], 201);
    }
    throw new Error(`Unexpected request: ${method} ${url}`);
  };
  const res = responseRecorder();
  await ownerLogin({
    method: "POST",
    url: "/api/owner-login",
    headers: { authorization: "Bearer social-access-token" },
    body: {},
  }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.centers[0].centerId, "center-1");
  assert.match(String(res.headers["Set-Cookie"]), /^dail_center_session=/);
}

(async function run() {
  const originalFetch = global.fetch;
  try {
    await testRegistrationSessionIsRequired();
    await testCenterApplicationRequiresAuthenticatedAccount();
    await testSportsScienceCenterApplicationUsesDegreeCertificateAndLegacyScheduleFallback();
    await testTherapistCenterApplicationUsesAuthenticatedSocialAccount();
    await testApprovalCreatesOwnerMembership();
    await testSocialSessionCreatesOwnerDashboardSession();
    console.log("Center onboarding tests passed");
  } finally {
    global.fetch = originalFetch;
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
