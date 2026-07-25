const assert = require("assert");

process.env.SUPABASE_URL = "https://dataref.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role";
process.env.AUTH_SUPABASE_URL = "https://dataref.supabase.co";
process.env.AUTH_SUPABASE_ANON_KEY = "test-anon";
process.env.AUTH_SUPABASE_SERVICE_ROLE_KEY = "test-service-role";

const { syncUserProfile } = require("./_user-auth");

function jsonResponse(body, status = 200) {
  return new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function testVerifiedEmailClaimsLegacyIdentity() {
  const calls = [];
  global.fetch = async function (url, init = {}) {
    const parsed = new URL(url);
    const method = init.method || "GET";
    calls.push({ path: parsed.pathname, method, body: init.body ? JSON.parse(init.body) : null });
    if (parsed.pathname === "/rest/v1/user_profiles" && method === "GET") {
      if (parsed.searchParams.has("email")) {
        return jsonResponse([{
          user_id: "11111111-1111-4111-8111-111111111111",
          email: "member@example.com",
          nickname: "기존 회원",
          provider: "kakao",
        }]);
      }
      return jsonResponse([]);
    }
    if (method === "PATCH") {
      return jsonResponse(null, 204);
    }
    throw new Error(`Unexpected request: ${method} ${url}`);
  };

  const profile = await syncUserProfile({
    id: "22222222-2222-4222-8222-222222222222",
    email: "Member@Example.com",
    email_confirmed_at: "2026-07-25T00:00:00Z",
    app_metadata: { provider: "kakao" },
    user_metadata: {},
  });

  assert.equal(profile.user_id, "22222222-2222-4222-8222-222222222222");
  assert.equal(profile.nickname, "기존 회원");
  const profileClaim = calls.find((call) =>
    call.path.endsWith("/user_profiles") &&
    call.method === "PATCH" &&
    call.body?.user_id === "22222222-2222-4222-8222-222222222222"
  );
  assert(profileClaim);
  assert.equal(calls.some((call) => call.path.endsWith("/reviews") && call.method === "PATCH"), true);
}

async function testUnconfirmedEmailCannotClaimLegacyIdentity() {
  const paths = [];
  global.fetch = async function (url, init = {}) {
    const parsed = new URL(url);
    paths.push(parsed.pathname);
    if (parsed.pathname === "/rest/v1/user_profiles" && (init.method || "GET") === "GET") {
      return jsonResponse([]);
    }
    if (parsed.pathname === "/rest/v1/user_profiles" && init.method === "POST") {
      return jsonResponse([JSON.parse(init.body)], 201);
    }
    throw new Error(`Unexpected request: ${init.method || "GET"} ${url}`);
  };

  await syncUserProfile({
    id: "33333333-3333-4333-8333-333333333333",
    email: "unconfirmed@example.com",
    app_metadata: { provider: "email" },
    user_metadata: {},
  });
  assert.equal(paths.filter((path) => path.endsWith("/user_profiles")).length, 2);
}

(async () => {
  await testVerifiedEmailClaimsLegacyIdentity();
  await testUnconfirmedEmailCannotClaimLegacyIdentity();
  console.log("Auth environment isolation tests passed");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
