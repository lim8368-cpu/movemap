const assert = require("assert");
const crypto = require("crypto");

process.env.SUPABASE_URL = "https://supabase.test";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role";
process.env.SUPABASE_ANON_KEY = "test-anon";
process.env.ADMIN_SESSION_SECRET = "test-admin-session-secret";
process.env.OWNER_SESSION_SECRET = "test-owner-session-secret";
process.env.REGISTRATION_CHALLENGE_SECRET = "test-registration-secret";

const events = require("./events");
const login = require("./login");
const reviews = require("./reviews");
const { requireAdminRole, signAdminSession } = require("./_shared");
const { ownerAccess, roleAllows } = require("./_platform-auth");
const { signOwnerSession } = require("./_owner-auth");
const { createMathChallenge, verifyHumanChallenge } = require("./_registration-security");

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

async function testPublicWriteProtection() {
  const eventResponse = responseRecorder();
  await events({
    method: "POST",
    url: "/api/events",
    headers: {},
    body: { type: "view", centerId: "center-1" },
  }, eventResponse);
  assert.equal(eventResponse.statusCode, 400);

  const reviewResponse = responseRecorder();
  await reviews({
    method: "POST",
    url: "/api/reviews",
    headers: {},
    body: {
      centerId: "center-1",
      rating: 5,
      content: "정말 친절하고 설명이 자세했습니다.",
    },
  }, reviewResponse);
  assert.equal(reviewResponse.statusCode, 401);
}

async function testSignedCaptcha() {
  const challenge = createMathChallenge();
  const [left, right] = challenge.prompt.match(/\d+/g).map(Number);
  const verified = await verifyHumanChallenge({ headers: {}, socket: {} }, {
    challengeToken: challenge.challengeToken,
    challengeAnswer: left + right,
    formStartedAt: Date.now() - 2_000,
    companyWebsite: "",
  });
  assert.equal(verified, true);
  const bot = await verifyHumanChallenge({ headers: {}, socket: {} }, {
    challengeToken: challenge.challengeToken,
    challengeAnswer: left + right,
    formStartedAt: Date.now(),
    companyWebsite: "",
  });
  assert.equal(bot, false);
}

async function testMembershipIsolationAndImmediateRevocation() {
  const token = signOwnerSession({
    auth_user_id: "11111111-1111-4111-8111-111111111111",
    center_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    email: "owner@example.com",
  });
  const req = {
    method: "GET",
    url: "/api/owner-dashboard?centerId=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    query: { centerId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" },
    headers: { authorization: `Bearer ${token}` },
  };
  let active = true;
  global.fetch = async function (url, init = {}) {
    const parsed = new URL(url);
    const table = parsed.pathname.split("/").pop();
    const method = init.method || "GET";
    if (table === "center_memberships" && method === "GET") {
      return jsonResponse(active ? [{
        id: "membership-1",
        center_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        user_id: "11111111-1111-4111-8111-111111111111",
        email: "owner@example.com",
        role: "owner",
        status: "active",
        permissions: [],
      }] : []);
    }
    if (table === "center_memberships" && method === "PATCH") return jsonResponse(null, 204);
    throw new Error(`Unexpected request: ${method} ${url}`);
  };

  const allowed = await ownerAccess(req, {
    centerId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    action: "edit_center",
  });
  assert.equal(allowed.centerId, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
  assert.equal(allowed.role, "owner");

  active = false;
  const revoked = await ownerAccess(req, {
    centerId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    action: "read",
  });
  assert.equal(revoked, null);
  assert.equal(roleAllows("viewer", "edit_center"), false);
  assert.equal(roleAllows("staff", "edit_center"), true);
  assert.equal(roleAllows("manager", "manage_members"), true);
}

async function testAdminRoleIsRechecked() {
  const token = signAdminSession({
    userId: "22222222-2222-4222-8222-222222222222",
    email: "support@example.com",
    role: "support",
    aal: "aal2",
  });
  const req = {
    method: "GET",
    url: "/api/stats",
    headers: { authorization: `Bearer ${token}` },
  };
  const res = responseRecorder();
  let active = true;
  global.fetch = async function (url, init = {}) {
    const parsed = new URL(url);
    const table = parsed.pathname.split("/").pop();
    if (table === "platform_user_roles" && (init.method || "GET") === "GET") {
      return jsonResponse(active ? [{ role: "support", status: "active", mfa_required: true }] : []);
    }
    throw new Error(`Unexpected request: ${init.method || "GET"} ${url}`);
  };
  const allowed = await requireAdminRole(req, res, ["support"]);
  assert.equal(allowed.role, "support");
  active = false;
  const revokedResponse = responseRecorder();
  const revoked = await requireAdminRole(req, revokedResponse, ["support"]);
  assert.equal(revoked, null);
  assert.equal(revokedResponse.statusCode, 403);
}

async function testExistingBootstrapAdminReceivesMissingPlatformRole() {
  const email = "bootstrap-admin@example.com";
  const password = "bootstrap-password";
  const salt = Buffer.from("platform-bootstrap-test-salt");
  const passwordHash = crypto.scryptSync(password, salt, 64);
  const accessToken = [
    Buffer.from(JSON.stringify({ alg: "none" })).toString("base64url"),
    Buffer.from(JSON.stringify({ aal: "aal1" })).toString("base64url"),
    "signature",
  ].join(".");
  const user = {
    id: "33333333-3333-4333-8333-333333333333",
    email,
    factors: [],
    user_metadata: {},
  };
  let roleCreated = false;
  let authUserUpdated = false;

  process.env.AUTH_SUPABASE_URL = "https://supabase.test";
  process.env.AUTH_SUPABASE_ANON_KEY = "test-anon";
  process.env.AUTH_SUPABASE_SERVICE_ROLE_KEY = "test-service-role";
  process.env.SUPER_ADMIN_EMAIL = email;
  process.env.ADMIN_PASSWORD_SCRYPT =
    `scrypt$${salt.toString("base64url")}$${passwordHash.toString("base64url")}`;

  global.fetch = async function (url, init = {}) {
    const parsed = new URL(url);
    const method = init.method || "GET";
    if (parsed.pathname === "/rest/v1/admin_login_attempts" && method === "GET") {
      return jsonResponse([]);
    }
    if (parsed.pathname === "/auth/v1/token" && method === "POST") {
      return jsonResponse({
        access_token: accessToken,
        refresh_token: "refresh-token",
        user,
      });
    }
    if (parsed.pathname === "/auth/v1/admin/users" && method === "GET") {
      return jsonResponse({ users: [user] });
    }
    if (parsed.pathname === `/auth/v1/admin/users/${user.id}` && method === "PUT") {
      authUserUpdated = true;
      return jsonResponse(user);
    }
    if (parsed.pathname === "/rest/v1/platform_user_roles" && method === "GET") {
      return jsonResponse(roleCreated ? [{
        user_id: user.id,
        email,
        role: "super_admin",
        status: "active",
        mfa_required: true,
      }] : []);
    }
    if (parsed.pathname === "/rest/v1/platform_user_roles" && method === "POST") {
      roleCreated = true;
      return jsonResponse(null, 201);
    }
    throw new Error(`Unexpected request: ${method} ${url}`);
  };

  const res = responseRecorder();
  await login({
    method: "POST",
    url: "/api/login",
    headers: {},
    socket: { remoteAddress: "127.0.0.20" },
    body: { email, password },
  }, res);

  assert.equal(res.statusCode, 403);
  assert.equal(res.body.code, "mfa_required");
  assert.equal(roleCreated, true);
  assert.equal(authUserUpdated, true);
}

(async function run() {
  const originalFetch = global.fetch;
  try {
    await testPublicWriteProtection();
    await testSignedCaptcha();
    await testMembershipIsolationAndImmediateRevocation();
    await testAdminRoleIsRechecked();
    await testExistingBootstrapAdminReceivesMissingPlatformRole();
    console.log("Platform security tests passed");
  } finally {
    global.fetch = originalFetch;
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
