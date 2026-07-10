const ENVIRONMENTS = {
  development: {
    name: "무브맵 Dev",
    slug: "movemap-dev",
    scheme: "movemap-dev",
    iosBundleIdentifier: "com.movemap.app.dev",
    androidPackage: "com.movemap.app.dev",
  },
  staging: {
    name: "무브맵 Test",
    slug: "movemap-staging",
    scheme: "movemap-staging",
    iosBundleIdentifier: "com.movemap.app.staging",
    androidPackage: "com.movemap.app.staging",
  },
  production: {
    name: "무브맵",
    slug: "movemap",
    scheme: "movemap",
    iosBundleIdentifier: "com.movemap.app",
    androidPackage: "com.movemap.app",
  },
};

function appEnvironment() {
  const value = process.env.APP_ENV || process.env.EAS_BUILD_PROFILE || "development";
  return ENVIRONMENTS[value] ? value : "development";
}

module.exports = () => {
  const appEnv = appEnvironment();
  const config = ENVIRONMENTS[appEnv];

  return {
    expo: {
      name: config.name,
      slug: config.slug,
      scheme: config.scheme,
      version: "0.1.0",
      orientation: "portrait",
      userInterfaceStyle: "light",
      assetBundlePatterns: ["**/*"],
      extra: {
        appEnv,
        apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL || "",
      },
      ios: {
        supportsTablet: true,
        bundleIdentifier: config.iosBundleIdentifier,
      },
      android: {
        package: config.androidPackage,
        adaptiveIcon: {
          backgroundColor: "#2f9b76",
        },
      },
    },
  };
};
