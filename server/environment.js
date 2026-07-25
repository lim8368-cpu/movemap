const ALLOWED_ENVIRONMENTS = new Set(["development", "staging", "production"]);

function supabaseProjectRef(urlValue) {
  if (!urlValue) return "";
  const hostname = new URL(urlValue).hostname.toLowerCase();
  const suffix = ".supabase.co";
  return hostname.endsWith(suffix) ? hostname.slice(0, -suffix.length) : "";
}

function validateRuntimeEnvironment(env = process.env) {
  const appEnv = env.APP_ENV || "development";
  const dataEnv = env.DATA_ENVIRONMENT || "";
  if (!ALLOWED_ENVIRONMENTS.has(appEnv)) throw new Error(`Invalid APP_ENV: ${appEnv}`);

  if (appEnv !== "development" && dataEnv !== appEnv) {
    throw new Error(`DATA_ENVIRONMENT must equal APP_ENV (${appEnv})`);
  }

  const hasUrl = Boolean(env.SUPABASE_URL);
  const hasKey = Boolean(env.SUPABASE_SERVICE_ROLE_KEY);
  if (hasUrl !== hasKey) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set together");
  const hasTurnstileSiteKey = Boolean(env.TURNSTILE_SITE_KEY);
  const hasTurnstileSecretKey = Boolean(env.TURNSTILE_SECRET_KEY);
  if (hasTurnstileSiteKey !== hasTurnstileSecretKey) {
    throw new Error("TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY must be set together");
  }

  if (hasUrl) {
    const actualRef = supabaseProjectRef(env.SUPABASE_URL);
    const expectedRef = String(env.EXPECTED_SUPABASE_PROJECT_REF || "").toLowerCase();
    if (!actualRef) throw new Error("SUPABASE_URL must use a *.supabase.co project URL");
    if (!expectedRef || actualRef !== expectedRef) {
      throw new Error("SUPABASE_URL does not match EXPECTED_SUPABASE_PROJECT_REF");
    }
  }

  const authValues = [
    env.AUTH_SUPABASE_URL,
    env.AUTH_SUPABASE_ANON_KEY,
    env.AUTH_SUPABASE_SERVICE_ROLE_KEY,
  ];
  const hasAnyAuthValue = authValues.some(Boolean);
  const hasAllAuthValues = authValues.every(Boolean);
  if (hasAnyAuthValue && !hasAllAuthValues) {
    throw new Error("AUTH_SUPABASE_URL, AUTH_SUPABASE_ANON_KEY, and AUTH_SUPABASE_SERVICE_ROLE_KEY must be set together");
  }

  const authUrl = env.AUTH_SUPABASE_URL || env.SUPABASE_URL || "";
  const authRef = authUrl ? supabaseProjectRef(authUrl) : "";
  if (authUrl && !authRef) throw new Error("AUTH_SUPABASE_URL must use a *.supabase.co project URL");

  if (appEnv !== "development" && hasUrl) {
    if (!hasAllAuthValues) {
      throw new Error(`${appEnv} requires explicit AUTH_SUPABASE configuration`);
    }
    const expectedAuthRef = String(env.EXPECTED_AUTH_SUPABASE_PROJECT_REF || "").toLowerCase();
    if (!expectedAuthRef || authRef !== expectedAuthRef) {
      throw new Error("AUTH_SUPABASE_URL does not match EXPECTED_AUTH_SUPABASE_PROJECT_REF");
    }
    if (authRef !== supabaseProjectRef(env.SUPABASE_URL)) {
      throw new Error("AUTH_SUPABASE_URL and SUPABASE_URL must use the same environment project");
    }
  }

  if (appEnv === "production" && !hasUrl) throw new Error("Production requires Supabase configuration");
  return {
    appEnv,
    dataEnv: dataEnv || "development",
    supabaseProjectRef: hasUrl ? supabaseProjectRef(env.SUPABASE_URL) : "",
    authSupabaseProjectRef: authRef,
  };
}

module.exports = { supabaseProjectRef, validateRuntimeEnvironment };
