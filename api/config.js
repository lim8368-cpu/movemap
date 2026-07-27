const { runtimeEnvironment, sendJson } = require("./_shared");
const { publicAuthConfig } = require("./_user-auth");

function publicStoreUrl(value, allowedHost) {
  try {
    const url = new URL(String(value || "").trim());
    return url.protocol === "https:" && url.hostname === allowedHost ? url.toString() : "";
  } catch {
    return "";
  }
}

module.exports = function handler(req, res) {
  if (req.method !== "GET") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }

  sendJson(res, 200, {
    naverMapNcpKeyId: process.env.NAVER_MAP_NCP_KEY_ID || "",
    auth: publicAuthConfig(),
    mobileApps: {
      iosAppStoreUrl: publicStoreUrl(process.env.IOS_APP_STORE_URL, "apps.apple.com"),
      googlePlayStoreUrl: publicStoreUrl(process.env.GOOGLE_PLAY_STORE_URL, "play.google.com"),
    },
    environment: runtimeEnvironment(),
  });
};
