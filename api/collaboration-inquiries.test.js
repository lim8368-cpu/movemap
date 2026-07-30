const assert = require("assert");

process.env.SUPABASE_URL = "https://supabase.test";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role";
process.env.ADMIN_SESSION_SECRET = "test-admin-session-secret";

const collaborationInquiries = require("./collaboration-inquiries");

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

function validRequest(ip = "203.0.113.10") {
  return {
    method: "POST",
    url: "/api/collaboration-inquiries",
    headers: {
      "content-type": "application/json",
      "user-agent": "DAIL test",
      "x-forwarded-for": ip,
    },
    body: {
      organizationType: "brand",
      organizationName: "일상 브랜드",
      contactName: "홍길동",
      contactEmail: "hello@example.com",
      contactPhone: "010-1234-5678",
      websiteUrl: "https://example.com",
      collaborationTypes: ["content-campaign", "service-partnership"],
      title: "DAIL과 함께 만드는 일상 캠페인",
      message: "전문 센터와 사용자를 연결하는 공동 콘텐츠와 캠페인을 함께 제안드리고 싶습니다.",
      privacyConsent: true,
      companyFax: "",
    },
  };
}

async function testValidInquiryIsStored() {
  let inserted;
  global.fetch = async function (url, init = {}) {
    const table = new URL(url).pathname.split("/").pop();
    const method = init.method || "GET";
    if (table === "collaboration_inquiries" && method === "POST") {
      inserted = JSON.parse(init.body);
      return jsonResponse([{ id: "inquiry-1" }], 201);
    }
    if (table === "audit_logs" && method === "POST") {
      return jsonResponse([{ id: "audit-1" }], 201);
    }
    throw new Error(`Unexpected request: ${method} ${url}`);
  };

  const res = responseRecorder();
  await collaborationInquiries(validRequest(), res);

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.id, "inquiry-1");
  assert.equal(inserted.organization_type, "brand");
  assert.equal(inserted.contact_email, "hello@example.com");
  assert.deepEqual(inserted.collaboration_types, ["content-campaign", "service-partnership"]);
  assert.equal(inserted.privacy_consent, true);
  assert.ok(inserted.ip_hash);
}

async function testInvalidInquiryIsRejectedBeforeStorage() {
  global.fetch = async function () {
    throw new Error("Invalid inquiry must not reach Supabase");
  };
  const req = validRequest("203.0.113.11");
  req.body.contactEmail = "invalid";
  const res = responseRecorder();

  await collaborationInquiries(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.field, "contactEmail");
}

async function testHoneypotIsAcceptedWithoutStorage() {
  global.fetch = async function () {
    throw new Error("Honeypot inquiry must not reach Supabase");
  };
  const req = validRequest("203.0.113.12");
  req.body.companyFax = "bot-filled";
  const res = responseRecorder();

  await collaborationInquiries(req, res);

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.ok, true);
}

(async () => {
  await testValidInquiryIsStored();
  await testInvalidInquiryIsRejectedBeforeStorage();
  await testHoneypotIsAcceptedWithoutStorage();
  console.log("collaboration inquiry tests passed");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
