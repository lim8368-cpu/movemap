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

  if (appEnv === "production" && !hasUrl) throw new Error("Production requires Supabase configuration");
  return { appEnv, dataEnv: dataEnv || "development", supabaseProjectRef: hasUrl ? supabaseProjectRef(env.SUPABASE_URL) : "" };
}

module.exports = { supabaseProjectRef, validateRuntimeEnvironment };
