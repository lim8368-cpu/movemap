const assert = require("assert");

process.env.SUPABASE_URL = "https://supabase.test";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role";
process.env.AUTH_SUPABASE_URL = "https://auth.supabase.test";
process.env.AUTH_SUPABASE_ANON_KEY = "test-auth-anon";
process.env.ADMIN_SESSION_SECRET = "test-admin-session-secret";
process.env.APP_ENV = "development";

const { privacyHash, signAdminSession } = require("./_shared");
const partnerApplications = require("./partner-applications");

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

function validRequest(ip = "203.0.113.30") {
  return {
    method: "POST",
    url: "/api/partner-applications",
    query: {},
    headers: {
      "content-type": "application/json",
      "user-agent": "DAIL test",
      "x-forwarded-for": ip,
      "x-registration-token": "verified-session-token",
      "x-dail-source": "web",
      authorization: "Bearer test-user-token",
    },
    body: {
      applicantName: "홍길동",
      centerName: "DAIL 움직임센터",
      qualificationType: "physical_therapist",
      region: "서울 강남구",
      address: "서울특별시 강남구 테헤란로 212",
      addressDetail: "3층 301호",
      roadAddress: "서울특별시 강남구 테헤란로 212",
      jibunAddress: "서울특별시 강남구 역삼동 718-5",
      lat: 37.5012,
      lng: 127.0396,
      naverPlaceId: "1234567890",
      naverMapUrl: "https://map.naver.com/p/entry/place/1234567890",
      contactEmail: "PARTNER@example.com",
      contactPhone: "01012345678",
      websiteUrl: "https://example.com",
      message: "출시 전 파트너 안내를 받고 싶습니다.",
      privacyConsent: true,
      companyWebsite: "",
    },
  };
}

function registrationSession(ip) {
  return {
    id: "session-1",
    token_hash: "ignored-by-fetch-mock",
    ip_hash: privacyHash(ip, "registration-ip"),
    captcha_provider: "signed_math",
    consumed_at: null,
    expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
  };
}

async function testValidApplicationIsStored() {
  const ip = "203.0.113.30";
  let inserted;
  global.fetch = async function (url, init = {}) {
    const parsed = new URL(url);
    const table = parsed.pathname.split("/").pop();
    const method = init.method || "GET";
    if (parsed.pathname === "/auth/v1/user") {
      return jsonResponse({ id: "auth-user-1", email: "kakao-user@example.com" });
    }
    if (table === "registration_sessions" && method === "GET") {
      return jsonResponse([registrationSession(ip)]);
    }
    if (table === "registration_sessions" && method === "PATCH") {
      return new Response(null, { status: 204 });
    }
    if (table === "partner_applications" && method === "GET") {
      return jsonResponse([]);
    }
    if (table === "partner_applications" && method === "POST") {
      inserted = JSON.parse(init.body);
      return jsonResponse([{ id: "partner-1" }], 201);
    }
    if (table === "audit_logs" && method === "POST") {
      return jsonResponse([{ id: "audit-1" }], 201);
    }
    throw new Error(`Unexpected request: ${method} ${url}`);
  };

  const res = responseRecorder();
  await partnerApplications(validRequest(ip), res);

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.id, "partner-1");
  assert.equal(inserted.contact_email, "partner@example.com");
  assert.equal(inserted.applicant_auth_user_id, "auth-user-1");
  assert.equal(inserted.contact_phone, "010-1234-5678");
  assert.equal(inserted.center_stage, "operating");
  assert.equal(inserted.address, "서울특별시 강남구 테헤란로 212 3층 301호");
  assert.equal(inserted.lat, 37.5012);
  assert.equal(inserted.lng, 127.0396);
  assert.equal(inserted.naver_place_id, "1234567890");
  assert.deepEqual(inserted.interests, ["early-partner"]);
  assert.ok(inserted.ip_hash);
}

async function testInvalidApplicationIsRejected() {
  const ip = "203.0.113.31";
  global.fetch = async function (url, init = {}) {
    const parsed = new URL(url);
    const table = parsed.pathname.split("/").pop();
    if (parsed.pathname === "/auth/v1/user") {
      return jsonResponse({ id: "auth-user-1", email: "kakao-user@example.com" });
    }
    if (table === "registration_sessions" && (init.method || "GET") === "GET") {
      return jsonResponse([registrationSession(ip)]);
    }
    throw new Error("Invalid application must not reach storage");
  };
  const req = validRequest(ip);
  req.body.contactPhone = "1234";
  const res = responseRecorder();

  await partnerApplications(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.field, "contactPhone");
}

async function testHoneypotIsAcceptedWithoutStorage() {
  global.fetch = async function () {
    throw new Error("Honeypot application must not reach Supabase");
  };
  const req = validRequest("203.0.113.32");
  req.body.companyWebsite = "bot-filled";
  const res = responseRecorder();

  await partnerApplications(req, res);

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.ok, true);
}

async function testUnverifiedLocationIsRejected() {
  const ip = "203.0.113.33";
  global.fetch = async function (url, init = {}) {
    const parsed = new URL(url);
    const table = parsed.pathname.split("/").pop();
    if (parsed.pathname === "/auth/v1/user") {
      return jsonResponse({ id: "auth-user-1", email: "kakao-user@example.com" });
    }
    if (table === "registration_sessions" && (init.method || "GET") === "GET") {
      return jsonResponse([registrationSession(ip)]);
    }
    throw new Error("Invalid location must not reach storage");
  };
  const req = validRequest(ip);
  req.body.lat = "";
  req.body.lng = "";
  const res = responseRecorder();

  await partnerApplications(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.field, "addressQuery");
}

async function testUnsupportedQualificationIsRejected() {
  const ip = "203.0.113.34";
  global.fetch = async function (url, init = {}) {
    const parsed = new URL(url);
    const table = parsed.pathname.split("/").pop();
    if (parsed.pathname === "/auth/v1/user") {
      return jsonResponse({ id: "auth-user-1", email: "kakao-user@example.com" });
    }
    if (table === "registration_sessions" && (init.method || "GET") === "GET") {
      return jsonResponse([registrationSession(ip)]);
    }
    throw new Error("Unsupported qualification must not reach storage");
  };
  const req = validRequest(ip);
  req.body.qualificationType = "other";
  const res = responseRecorder();

  await partnerApplications(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.field, "qualificationType");
}

async function testAdminApprovalCreatesCenterAndOwnerMembership() {
  let insertedCenter;
  let insertedMembership;
  let updatedApplication;
  global.fetch = async function (url, init = {}) {
    const parsed = new URL(url);
    const table = parsed.pathname.split("/").pop();
    const method = init.method || "GET";
    if (table === "partner_applications" && method === "GET") {
      return jsonResponse([{
        id: "partner-1",
        applicant_auth_user_id: "auth-user-1",
        applicant_name: "홍길동",
        center_name: "DAIL 움직임센터",
        qualification_type: "physical_therapist",
        region: "서울 강남구",
        address: "서울특별시 강남구 테헤란로 212 3층 301호",
        road_address: "서울특별시 강남구 테헤란로 212",
        lat: 37.5012,
        lng: 127.0396,
        naver_map_url: "https://map.naver.com/p/entry/place/1234567890",
        contact_email: "partner@example.com",
        contact_phone: "010-1234-5678",
        website_url: "https://example.com/",
        message: "허리와 골반 움직임 프로그램을 운영합니다.",
        status: "qualified",
        approved_center_id: null,
      }]);
    }
    if (table === "centers" && method === "GET") return jsonResponse([]);
    if (table === "centers" && method === "POST") {
      insertedCenter = JSON.parse(init.body);
      return jsonResponse([{ id: "center-1" }], 201);
    }
    if (table === "center_memberships" && method === "GET") return jsonResponse([]);
    if (table === "center_memberships" && method === "POST") {
      insertedMembership = JSON.parse(init.body);
      return jsonResponse([{ id: "membership-1" }], 201);
    }
    if (table === "partner_applications" && method === "PATCH") {
      updatedApplication = JSON.parse(init.body);
      return new Response(null, { status: 204 });
    }
    if (table === "partner_registration_invitations" && method === "PATCH") {
      return new Response(null, { status: 204 });
    }
    if (table === "audit_logs" && method === "POST") return jsonResponse([{ id: "audit-1" }], 201);
    throw new Error(`Unexpected request: ${method} ${url}`);
  };

  const req = {
    method: "PATCH",
    url: "/api/partner-applications",
    query: {},
    headers: { authorization: `Bearer ${signAdminSession({ role: "super_admin" })}` },
    body: { id: "partner-1", action: "approve", adminNote: "자격 확인 완료" },
  };
  const res = responseRecorder();
  await partnerApplications(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.centerId, "center-1");
  assert.equal(insertedCenter.partner_application_id, "partner-1");
  assert.equal(insertedCenter.phone, "010-1234-5678");
  assert.equal(insertedMembership.user_id, "auth-user-1");
  assert.equal(insertedMembership.role, "owner");
  assert.equal(insertedMembership.status, "active");
  assert.equal(updatedApplication.status, "converted");
  assert.equal(updatedApplication.approved_center_id, "center-1");
}

(async () => {
  await testValidApplicationIsStored();
  await testInvalidApplicationIsRejected();
  await testHoneypotIsAcceptedWithoutStorage();
  await testUnverifiedLocationIsRejected();
  await testUnsupportedQualificationIsRejected();
  await testAdminApprovalCreatesCenterAndOwnerMembership();
  console.log("partner application tests passed");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
