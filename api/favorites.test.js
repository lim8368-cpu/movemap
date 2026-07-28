const assert = require("node:assert/strict");

process.env.SUPABASE_URL = "https://data.supabase.test";
process.env.SUPABASE_SERVICE_ROLE_KEY = "data-service-role";
process.env.AUTH_SUPABASE_URL = "https://auth.supabase.test";
process.env.AUTH_SUPABASE_ANON_KEY = "auth-anon-key";

const favorites = require("./favorites");

const USER_ID = "11111111-1111-4111-8111-111111111111";
const CENTER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

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

async function testLoginRequired() {
  const res = responseRecorder();
  await favorites({ method: "GET", headers: {} }, res);
  assert.equal(res.statusCode, 401);
}

async function testFavoriteList() {
  global.fetch = async (url) => {
    const parsed = new URL(url);
    if (parsed.origin === "https://auth.supabase.test" && parsed.pathname === "/auth/v1/user") {
      return jsonResponse({ id: USER_ID, email: "member@example.com" });
    }
    if (parsed.pathname === "/rest/v1/user_favorites") {
      return jsonResponse([{ center_id: CENTER_ID, created_at: "2026-07-28T00:00:00.000Z" }]);
    }
    if (parsed.pathname === "/rest/v1/centers") {
      return jsonResponse([{
        id: CENTER_ID,
        name: "DAIL 테스트 센터",
        region: "other",
        area: "서울 강남구",
        address: "서울 강남구 테스트로 1",
        tags: ["허리", "자세"],
        status: "approved",
      }]);
    }
    if (parsed.pathname === "/rest/v1/reviews") {
      return jsonResponse([
        { center_id: CENTER_ID, rating: 5 },
        { center_id: CENTER_ID, rating: 4 },
      ]);
    }
    throw new Error(`Unexpected request: ${url}`);
  };

  const res = responseRecorder();
  await favorites({
    method: "GET",
    headers: { authorization: "Bearer valid-token" },
  }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.favorites.length, 1);
  assert.equal(res.body.favorites[0].center.name, "DAIL 테스트 센터");
  assert.equal(res.body.favorites[0].center.rating, "4.5");
}

async function testFavoriteCreateAndDelete() {
  let created = false;
  let deleted = false;
  global.fetch = async (url, init = {}) => {
    const parsed = new URL(url);
    const method = init.method || "GET";
    if (parsed.origin === "https://auth.supabase.test" && parsed.pathname === "/auth/v1/user") {
      return jsonResponse({ id: USER_ID, email: "member@example.com" });
    }
    if (parsed.pathname === "/rest/v1/centers") return jsonResponse([{ id: CENTER_ID }]);
    if (parsed.pathname === "/rest/v1/user_favorites" && method === "GET") return jsonResponse([]);
    if (parsed.pathname === "/rest/v1/user_favorites" && method === "POST") {
      created = true;
      return jsonResponse([{ user_id: USER_ID, center_id: CENTER_ID }], 201);
    }
    if (parsed.pathname === "/rest/v1/user_favorites" && method === "DELETE") {
      deleted = true;
      return jsonResponse(null, 204);
    }
    throw new Error(`Unexpected request: ${method} ${url}`);
  };

  const createRes = responseRecorder();
  await favorites({
    method: "POST",
    headers: { authorization: "Bearer valid-token" },
    body: { centerId: CENTER_ID },
  }, createRes);
  assert.equal(createRes.statusCode, 200);
  assert.equal(createRes.body.saved, true);
  assert.equal(created, true);

  const deleteRes = responseRecorder();
  await favorites({
    method: "DELETE",
    headers: { authorization: "Bearer valid-token" },
    body: { centerId: CENTER_ID },
  }, deleteRes);
  assert.equal(deleteRes.statusCode, 200);
  assert.equal(deleteRes.body.saved, false);
  assert.equal(deleted, true);
}

(async function run() {
  const originalFetch = global.fetch;
  try {
    await testLoginRequired();
    await testFavoriteList();
    await testFavoriteCreateAndDelete();
    console.log("favorites api tests passed");
  } finally {
    global.fetch = originalFetch;
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
