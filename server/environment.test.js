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
}));
assert.throws(() => validateRuntimeEnvironment({ APP_ENV: "production", DATA_ENVIRONMENT: "production" }));

console.log("Environment isolation tests passed");
