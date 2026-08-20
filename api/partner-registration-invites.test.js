const assert = require("assert");

process.env.SUPABASE_URL = "https://supabase.test";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role";
process.env.ADMIN_SESSION_SECRET = "test-admin-session-secret";
process.env.ALLOW_LEGACY_ADMIN_LOGIN = "true";
process.env.PARTNER_INVITE_ENFORCEMENT = "enabled";
delete process.env.RESEND_API_KEY;
delete process.env.TRANSACTIONAL_EMAIL_FROM;

const partnerInvitations = require("./partner-registration-invites");
const {
  findActivePartnerRegistrationInvitation,
  INVITE_TTL_SECONDS,
  partnerInviteTokenHash,
} = require("./_partner-registration-invite");
const { signAdminSession } = require("./_shared");

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

function adminRequest(method, body = {}, query = {}) {
  return {
    method,
    url: "/api/partner-registration-invites",
    query,
    body,
    headers: {
      authorization: `Bearer ${signAdminSession()}`,
      host: "dail.life",
      "x-forwarded-proto": "https",
    },
  };
}

async function testCreateValidateAndRevokeInvitation() {
  const application = {
    id: "partner-1",
    applicant_name: "홍길동",
    center_name: "DAIL 움직임센터",
    contact_email: "partner@example.com",
    status: "qualified",
  };
  let invitationBody;
  let applicationStatus = "qualified";
  let revoked = false;

  global.fetch = async function (url, init = {}) {
    const parsed = new URL(url);
    const table = parsed.pathname.split("/").pop();
    const method = init.method || "GET";
    if (table === "partner_applications" && method === "GET") {
      return jsonResponse([{ ...application, status: applicationStatus }]);
    }
    if (table === "partner_applications" && method === "PATCH") {
      const body = JSON.parse(init.body);
      applicationStatus = body.status || applicationStatus;
      return jsonResponse(null, 204);
    }
    if (table === "partner_registration_invitations" && method === "POST") {
      invitationBody = JSON.parse(init.body);
      return jsonResponse([{ id: "invite-1", ...invitationBody }], 201);
    }
    if (table === "partner_registration_invitations" && method === "GET") {
      return jsonResponse(revoked ? [] : [{ id: "invite-1", ...invitationBody }]);
    }
    if (table === "partner_registration_invitations" && method === "PATCH") {
      const body = JSON.parse(init.body);
      if (body.status === "revoked" && invitationBody) revoked = true;
      return jsonResponse(null, 204);
    }
    if (table === "audit_logs" && method === "POST") return jsonResponse([{ id: "audit-1" }], 201);
    throw new Error(`Unexpected request: ${method} ${url}`);
  };

  const createdAt = Date.now();
  const createResponse = responseRecorder();
  await partnerInvitations(adminRequest("POST", { id: application.id }), createResponse);
  assert.equal(createResponse.statusCode, 201);
  assert.equal(createResponse.body.emailSent, false);
  assert.equal(createResponse.body.emailStatus, "not_configured");
  assert.match(createResponse.body.inviteUrl, /^https:\/\/dail\.life\/register\/\?invite=/);
  assert.equal(applicationStatus, "invited");

  const token = new URL(createResponse.body.inviteUrl).searchParams.get("invite");
  assert.equal(invitationBody.token_hash, partnerInviteTokenHash(token));
  assert.notEqual(invitationBody.token_hash, token);
  const ttlSeconds = Math.round((new Date(invitationBody.expires_at).getTime() - createdAt) / 1000);
  assert.ok(Math.abs(ttlSeconds - INVITE_TTL_SECONDS) <= 2);

  const validateResponse = responseRecorder();
  await partnerInvitations({
    method: "GET",
    url: "/api/partner-registration-invites",
    query: { token },
    headers: {},
  }, validateResponse);
  assert.equal(validateResponse.statusCode, 200);
  assert.equal(validateResponse.body.valid, true);
  assert.equal(validateResponse.body.application.contactEmail, application.contact_email);

  const revokeResponse = responseRecorder();
  await partnerInvitations(adminRequest("DELETE", { id: "invite-1" }), revokeResponse);
  assert.equal(revokeResponse.statusCode, 200);
  assert.equal(revokeResponse.body.status, "revoked");
  assert.equal(applicationStatus, "qualified");

  const invalidResponse = responseRecorder();
  await partnerInvitations({
    method: "GET",
    url: "/api/partner-registration-invites",
    query: { token },
    headers: {},
  }, invalidResponse);
  assert.equal(invalidResponse.statusCode, 403);
}

async function testExpiredInvitationIsClosed() {
  let expiredPatch;
  global.fetch = async function (url, init = {}) {
    const parsed = new URL(url);
    const table = parsed.pathname.split("/").pop();
    const method = init.method || "GET";
    if (table === "partner_registration_invitations" && method === "GET") {
      return jsonResponse([{
        id: "invite-expired",
        partner_application_id: "partner-expired",
        email: "expired@example.com",
        status: "pending",
        expires_at: new Date(Date.now() - 1_000).toISOString(),
      }]);
    }
    if (table === "partner_registration_invitations" && method === "PATCH") {
      expiredPatch = JSON.parse(init.body);
      return jsonResponse(null, 204);
    }
    throw new Error(`Unexpected request: ${method} ${url}`);
  };
  const invitation = await findActivePartnerRegistrationInvitation("expired-token");
  assert.equal(invitation, null);
  assert.equal(expiredPatch.status, "expired");
}

(async function run() {
  const originalFetch = global.fetch;
  try {
    await testCreateValidateAndRevokeInvitation();
    await testExpiredInvitationIsClosed();
    console.log("Partner registration invitation tests passed");
  } finally {
    global.fetch = originalFetch;
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
