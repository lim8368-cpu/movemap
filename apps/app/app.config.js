const PROFILES = {
  development: {
    name: "DAIL Dev",
    slug: "movemap-dev",
    scheme: "movemap-dev",
    identifier: "com.movemap.app.dev",
  },
  staging: {
    name: "DAIL Test",
    slug: "movemap-staging",
    scheme: "movemap-staging",
    identifier: "com.movemap.app.staging",
  },
  production: {
    name: "DAIL",
    slug: "movemap",
    scheme: "movemap",
    identifier: "com.movemap.app",
  },
};

module.exports = () => {
  const appEnv = process.env.APP_ENV || process.env.EAS_BUILD_PROFILE || "development";
  const profile = PROFILES[appEnv];
  if (!profile) throw new Error(`Unsupported APP_ENV: ${appEnv}`);

  return {
    expo: {
      name: profile.name,
      slug: profile.slug,
      scheme: profile.scheme,
      version: "0.1.0",
      orientation: "portrait",
      userInterfaceStyle: "light",
      icon: "./public/web/assets/dail-logo-primary.png",
      assetBundlePatterns: ["**/*"],
      extra: { appEnv },
      ios: {
        supportsTablet: true,
        bundleIdentifier: profile.identifier,
        icon: "./public/web/assets/dail-logo-primary.png",
        infoPlist: {
          NSCameraUsageDescription: "센터 등록에 필요한 센터 및 면허 증빙 사진을 촬영할 때 사용합니다.",
          NSPhotoLibraryUsageDescription: "센터 등록에 필요한 센터 및 면허 증빙 사진을 선택할 때 사용합니다.",
          NSLocalNetworkUsageDescription: "개발 중인 DAIL 웹사이트를 같은 Wi-Fi의 Mac에서 불러올 때 사용합니다.",
          NSAppTransportSecurity: {
            NSAllowsLocalNetworking: true,
            NSAllowsArbitraryLoadsInWebContent: true,
          },
        },
      },
      android: {
        package: profile.identifier,
        permissions: ["CAMERA"],
        adaptiveIcon: {
          foregroundImage: "./public/web/assets/dail-logo-primary.png",
          backgroundColor: "#ffffff",
        },
      },
    },
  };
};
