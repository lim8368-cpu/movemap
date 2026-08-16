const assert = require("assert");

process.env.SUPABASE_URL = "https://supabase.test";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role";
process.env.ADMIN_SESSION_SECRET = "test-admin-session-secret";
process.env.APP_ENV = "development";

const { privacyHash } = require("./_shared");
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
    },
    body: {
      applicantName: "홍길동",
      centerName: "DAIL 움직임센터",
      centerStage: "operating",
      qualificationType: "physical_therapist",
      region: "서울 강남구",
      contactEmail: "PARTNER@example.com",
      contactPhone: "01012345678",
      websiteUrl: "https://example.com",
      interests: ["early-partner", "launch-news"],
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
  assert.equal(inserted.contact_phone, "010-1234-5678");
  assert.equal(inserted.center_stage, "operating");
  assert.deepEqual(inserted.interests, ["early-partner", "launch-news"]);
  assert.ok(inserted.ip_hash);
}

async function testInvalidApplicationIsRejected() {
  const ip = "203.0.113.31";
  global.fetch = async function (url, init = {}) {
    const parsed = new URL(url);
    const table = parsed.pathname.split("/").pop();
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

(async () => {
  await testValidApplicationIsStored();
  await testInvalidApplicationIsRejected();
  await testHoneypotIsAcceptedWithoutStorage();
  console.log("partner application tests passed");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
