const assert = require("assert");
const { supabaseProjectRef, validateRuntimeEnvironment } = require("./environment");

assert.equal(supabaseProjectRef("https://abc123.supabase.co"), "abc123");
assert.throws(() => validateRuntimeEnvironment({ APP_ENV: "staging", DATA_ENVIRONMENT: "production" }));
assert.throws(() => validateRuntimeEnvironment({
  APP_ENV: "staging",
  DATA_ENVIRONMENT: "staging",
  SUPABASE_URL: "https://prodref.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "test-only-placeholder",
  EXPECTED_SUPABASE_PROJECT_REF: "stagingref",
}));
assert.doesNotThrow(() => validateRuntimeEnvironment({
  APP_ENV: "staging",
  DATA_ENVIRONMENT: "staging",
  SUPABASE_URL: "https://stagingref.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "test-only-placeholder",
  EXPECTED_SUPABASE_PROJECT_REF: "stagingref",
  AUTH_SUPABASE_URL: "https://stagingref.supabase.co",
  AUTH_SUPABASE_ANON_KEY: "test-anon",
  AUTH_SUPABASE_SERVICE_ROLE_KEY: "test-service-role",
  EXPECTED_AUTH_SUPABASE_PROJECT_REF: "stagingref",
}));
assert.throws(() => validateRuntimeEnvironment({
  APP_ENV: "production",
  DATA_ENVIRONMENT: "production",
  SUPABASE_URL: "https://productionref.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "production-service-role",
  EXPECTED_SUPABASE_PROJECT_REF: "productionref",
  AUTH_SUPABASE_URL: "https://stagingref.supabase.co",
  AUTH_SUPABASE_ANON_KEY: "staging-anon",
  AUTH_SUPABASE_SERVICE_ROLE_KEY: "staging-service-role",
  EXPECTED_AUTH_SUPABASE_PROJECT_REF: "stagingref",
}), /same environment project/);
assert.throws(() => validateRuntimeEnvironment({
  APP_ENV: "staging",
  DATA_ENVIRONMENT: "staging",
  SUPABASE_URL: "https://stagingref.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "staging-service-role",
  EXPECTED_SUPABASE_PROJECT_REF: "stagingref",
}), /explicit AUTH_SUPABASE/);
assert.throws(() => validateRuntimeEnvironment({ APP_ENV: "production", DATA_ENVIRONMENT: "production" }));
assert.throws(() => validateRuntimeEnvironment({
  APP_ENV: "development",
  TURNSTILE_SITE_KEY: "site-only",
}));

console.log("Environment isolation tests passed");
