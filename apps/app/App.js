import React, { useCallback, useRef, useState } from "react";
import Ionicons from "@expo/vector-icons/Ionicons";
import { BlurView } from "expo-blur";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { WebView } from "react-native-webview";

const API_BASE = String(
  process.env.EXPO_PUBLIC_API_BASE_URL || "https://dail.157-90-26-205.sslip.io"
).replace(/\/$/, "");

const NATIVE_PRESENTATION_SCRIPT = `
  (() => {
    const appOrigin = ${JSON.stringify(API_BASE)};
    if (location.origin !== appOrigin) return;

    const applyNativePresentation = () => {
      const root = document.documentElement;
      if (!root) return;

      const view = new URLSearchParams(location.search).get("appView") ||
        (new URLSearchParams(location.search).get("login") === "1" ? "login" : "content");
      root.classList.add("dail-native-app", "dail-app-surface", "dail-app-view-" + view);
      root.dataset.dailNativeApp = "true";
      root.style.width = "100%";
      root.style.maxWidth = "100%";
      root.style.overflowX = "hidden";

      if (document.body) {
        document.body.style.width = "100%";
        document.body.style.maxWidth = "100%";
        document.body.style.overflowX = "hidden";
      }

      if (!document.getElementById("dail-native-presentation")) {
        const style = document.createElement("style");
        style.id = "dail-native-presentation";
        style.textContent = \`
          html.dail-native-app, html.dail-native-app body { overscroll-behavior: none; }
          html.dail-native-app:not(.dail-app-view-map) body { padding-bottom: 104px !important; }
          html.dail-native-app body > header,
          html.dail-native-app body > footer { display: none !important; }
          html.dail-native-app [data-web-only] { display: none !important; }

          html.dail-app-view-map body { height: 100dvh; overflow: hidden !important; background: #eef1ee; }
          html.dail-app-view-map main#top { height: 100dvh; }
          html.dail-app-view-map main#top > section:not(#search) { display: none !important; }
          html.dail-app-view-map #search {
            width: 100% !important;
            height: 100dvh !important;
            min-height: 100dvh !important;
            padding: 0 !important;
            background: #eef1ee !important;
          }
          html.dail-app-view-map #search > .search-title { display: none !important; }
          html.dail-app-view-map #search .app-shell {
            width: 100% !important;
            height: 100dvh !important;
            min-height: 100dvh !important;
            overflow: hidden !important;
            border: 0 !important;
            border-radius: 0 !important;
            box-shadow: none !important;
          }
          html.dail-app-view-map #search .layout {
            width: 100% !important;
            height: 100% !important;
            min-height: 100% !important;
            display: block !important;
            position: relative !important;
          }
          html.dail-app-view-map #search .map-area {
            position: absolute !important;
            inset: 0 !important;
            width: 100% !important;
            height: 100% !important;
            min-height: 0 !important;
          }
          html.dail-app-view-map #search .sidebar {
            position: absolute !important;
            z-index: 20 !important;
            top: 12px !important;
            left: 12px !important;
            right: 12px !important;
            width: auto !important;
            height: auto !important;
            overflow: visible !important;
            border: 0 !important;
            background: transparent !important;
            pointer-events: none !important;
          }
          html.dail-app-view-map #search .search-panel {
            padding: 11px !important;
            overflow: hidden !important;
            border: 1px solid rgba(17,17,17,.08) !important;
            border-radius: 18px !important;
            background: rgba(255,255,255,.96) !important;
            box-shadow: 0 12px 34px rgba(17,17,17,.15) !important;
            backdrop-filter: blur(16px) !important;
            pointer-events: auto !important;
          }
          html.dail-app-view-map #search .search-box > span,
          html.dail-app-view-map #search .compact-filter,
          html.dail-app-view-map #search .filter-grid,
          html.dail-app-view-map #search .active-filters,
          html.dail-app-view-map #search .results-panel { display: none !important; }
          html.dail-app-view-map #search .search-box input {
            height: 48px !important;
            margin: 0 !important;
            padding: 0 15px !important;
            border-color: #deded9 !important;
            border-radius: 13px !important;
            background: #f7f7f5 !important;
            color: #111 !important;
            font-size: 16px !important;
          }
          html.dail-app-view-map #search .filter-row {
            margin-top: 9px !important;
            padding-bottom: 1px !important;
            flex-wrap: nowrap !important;
            overflow-x: auto !important;
            scrollbar-width: none !important;
          }
          html.dail-app-view-map #search .filter-row::-webkit-scrollbar { display: none !important; }
          html.dail-app-view-map #search .filter-row .chip {
            min-height: 34px !important;
            flex: 0 0 auto !important;
          }
          html.dail-app-view-map #search .map-toolbar { top: 126px !important; right: 12px !important; }
          html.dail-app-view-map #search .map-status { top: 128px !important; max-width: calc(100% - 130px); }
          html.dail-app-view-map #search .detail-panel { bottom: 98px !important; }

          html.dail-app-view-saved .account-hero,
          html.dail-app-view-saved .account-grid { display: none !important; }
          html.dail-app-view-account .account-hero,
          html.dail-app-view-account #favoritesSection { display: none !important; }
          html.dail-app-view-saved .account-shell,
          html.dail-app-view-account .account-shell {
            width: 100% !important;
            max-width: none !important;
            padding: 16px 14px 40px !important;
          }
          html.dail-app-view-saved .account-panel,
          html.dail-app-view-account .account-panel { border-radius: 18px !important; }

          html.dail-app-view-brand body,
          html.dail-app-view-register body,
          html.dail-app-view-account body,
          html.dail-app-view-saved body { background: #f7f7f5 !important; }

          html.dail-app-view-login main#top,
          html.dail-app-view-login body > footer { display: none !important; }
          html.dail-app-view-login body { min-height: 100dvh; background: #f7f7f5 !important; }
          html.dail-app-view-login .auth-overlay { padding: 14px 14px 104px !important; background: #f7f7f5 !important; }
          html.dail-app-view-login .auth-modal { max-height: calc(100dvh - 28px) !important; border-radius: 22px !important; }
        \`;
        (document.head || root).appendChild(style);
      }
    };

    applyNativePresentation();
    document.addEventListener("DOMContentLoaded", applyNativePresentation, { once: true });
  })();
  true;
`;

const NAVER_MAP_STORE_URLS = {
  ios: {
    native: "itms-apps://apps.apple.com/kr/app/id311867728",
    web: "https://apps.apple.com/kr/app/id311867728",
  },
  android: {
    native: "market://details?id=com.nhn.android.nmap",
    web: "https://play.google.com/store/apps/details?id=com.nhn.android.nmap",
  },
};

const APP_SCREENS = {
  home: {
    id: "home",
    label: "홈",
    title: "DAIL",
    icon: "home-outline",
    activeIcon: "home",
  },
  centers: {
    id: "centers",
    label: "센터 찾기",
    title: "센터 찾기",
    subtitle: "지도에서 내 주변 전문 센터를 확인하세요",
    icon: "map-outline",
    activeIcon: "map",
    path: "/?appView=map",
  },
  saved: {
    id: "saved",
    label: "저장",
    title: "저장한 센터",
    subtitle: "관심 있는 센터를 한곳에서 비교하세요",
    icon: "heart-outline",
    activeIcon: "heart",
    path: "/account/?appView=saved#favorites",
  },
  account: {
    id: "account",
    label: "마이",
    title: "마이 DAIL",
    subtitle: "내 정보와 센터 운영 권한을 관리하세요",
    icon: "person-outline",
    activeIcon: "person",
    path: "/account/?appView=account",
  },
  brand: {
    id: "brand",
    label: "브랜드 이야기",
    title: "브랜드 이야기",
    subtitle: "다시 일상으로 이어지는 DAIL의 생각",
    icon: "book-outline",
    activeIcon: "book",
    path: "/brand/?appView=brand",
  },
  register: {
    id: "register",
    label: "센터 등록",
    title: "센터 등록",
    subtitle: "전문가가 운영하는 센터를 DAIL에 알려주세요",
    icon: "add-circle-outline",
    activeIcon: "add-circle",
    path: "/register/?appView=register",
  },
};

const TAB_SCREENS = [
  APP_SCREENS.home,
  APP_SCREENS.centers,
  APP_SCREENS.saved,
  APP_SCREENS.account,
];

const HOME_ACTIONS = [
  {
    screen: APP_SCREENS.centers,
    eyebrow: "MAP",
    title: "센터 찾기",
    description: "내 주변 센터를 지도에서 바로 확인해요",
    icon: "map-outline",
    primary: true,
  },
  {
    screen: APP_SCREENS.saved,
    eyebrow: "SAVED",
    title: "저장한 센터",
    description: "관심 센터를 모아서 비교해요",
    icon: "heart-outline",
  },
  {
    screen: APP_SCREENS.brand,
    eyebrow: "STORY",
    title: "브랜드 이야기",
    description: "DAIL이 지키는 기준을 확인해요",
    icon: "book-outline",
  },
  {
    screen: APP_SCREENS.register,
    eyebrow: "PARTNER",
    title: "센터 등록",
    description: "전문가 센터를 직접 등록해요",
    icon: "add-circle-outline",
  },
];

async function openNaverMap(url) {
  try {
    await Linking.openURL(url);
    return;
  } catch {
    // 네이버 지도 앱이 없으면 운영체제별 앱 스토어로 안내한다.
  }

  const storeUrls = NAVER_MAP_STORE_URLS[Platform.OS];
  if (!storeUrls) {
    Alert.alert("네이버 지도를 열 수 없습니다", "네이버 지도 앱을 설치한 뒤 다시 시도해 주세요.");
    return;
  }

  try {
    await Linking.openURL(storeUrls.native);
  } catch {
    try {
      await Linking.openURL(storeUrls.web);
    } catch {
      Alert.alert(
        "앱 스토어를 열 수 없습니다",
        "네이버 지도 앱을 직접 설치한 뒤 다시 시도해 주세요."
      );
    }
  }
}

function screenForUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.origin !== new URL(API_BASE).origin) return null;
    if (parsed.pathname.startsWith("/auth/callback")) return null;
    const appView = parsed.searchParams.get("appView");
    if (appView === "map") return "centers";
    if (appView && APP_SCREENS[appView]) return appView;
    if (parsed.searchParams.get("login") === "1") return "account";
    if (parsed.pathname.startsWith("/register")) return "register";
    if (parsed.pathname.startsWith("/brand")) return "brand";
    if (parsed.pathname.startsWith("/collaboration")) return "brand";
    if (parsed.pathname.startsWith("/center-dashboard")) return "account";
    if (parsed.pathname.startsWith("/account")) {
      return parsed.hash === "#favorites" ? "saved" : "account";
    }
    if (parsed.pathname === "/" && (parsed.searchParams.has("center") || parsed.hash === "#search")) {
      return "centers";
    }
    if (parsed.pathname === "/") return "home";
    return null;
  } catch {
    return null;
  }
}

function HomeScreen({ onOpen }) {
  return (
    <ScrollView
      style={styles.homeScroll}
      contentContainerStyle={styles.homeContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.homeHeader}>
        <View style={styles.homeBrand}>
          <View style={styles.homeBrandMark}>
            <View style={styles.homeBrandRing} />
            <View style={styles.homeBrandDot} />
          </View>
          <View>
            <Text style={styles.homeBrandName}>DAIL</Text>
            <Text style={styles.homeBrandTagline}>다시 일상으로</Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.profileShortcut}
          onPress={() => onOpen(APP_SCREENS.account)}
          accessibilityRole="button"
          accessibilityLabel="마이 DAIL 열기"
          activeOpacity={0.76}
        >
          <Ionicons name="person-outline" size={21} color="#111111" />
        </TouchableOpacity>
      </View>

      <View style={styles.homeHero}>
        <View style={styles.homeHeroGlowOne} />
        <View style={styles.homeHeroGlowTwo} />
        <Text style={styles.homeHeroEyebrow}>DAIL · DAILY RECOVERY</Text>
        <Text style={styles.homeHeroTitle}>오늘도 나다운 일상에{`\n`}조금 더 가까워지도록</Text>
        <Text style={styles.homeHeroText}>
          전문 자격을 확인한 운동센터를 찾고, 나에게 맞는 회복을 시작해보세요.
        </Text>
      </View>

      <View style={styles.homeSectionHeading}>
        <View>
          <Text style={styles.homeSectionEyebrow}>QUICK MENU</Text>
          <Text style={styles.homeSectionTitle}>무엇을 도와드릴까요?</Text>
        </View>
        <Text style={styles.homeSectionHint}>원하는 메뉴를 선택하세요</Text>
      </View>

      <View style={styles.actionGrid}>
        {HOME_ACTIONS.map((action) => (
          <TouchableOpacity
            key={action.screen.id}
            style={[styles.actionCard, action.primary && styles.actionCardPrimary]}
            onPress={() => onOpen(action.screen)}
            accessibilityRole="button"
            accessibilityLabel={`${action.title}, ${action.description}`}
            activeOpacity={0.82}
          >
            <View style={[styles.actionIcon, action.primary && styles.actionIconPrimary]}>
              <Ionicons
                name={action.icon}
                size={23}
                color={action.primary ? "#ffffff" : "#158187"}
              />
            </View>
            <View style={styles.actionCopy}>
              <Text style={[styles.actionEyebrow, action.primary && styles.actionTextOnDark]}>
                {action.eyebrow}
              </Text>
              <Text style={[styles.actionTitle, action.primary && styles.actionTextOnDark]}>
                {action.title}
              </Text>
              <Text style={[styles.actionDescription, action.primary && styles.actionDescriptionOnDark]}>
                {action.description}
              </Text>
            </View>
            <View style={[styles.actionArrow, action.primary && styles.actionArrowPrimary]}>
              <Ionicons
                name="arrow-forward"
                size={16}
                color={action.primary ? "#111111" : "#343434"}
              />
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={styles.trustCard}
        onPress={() => onOpen(APP_SCREENS.brand)}
        accessibilityRole="button"
        activeOpacity={0.82}
      >
        <View style={styles.trustIcon}>
          <Ionicons name="shield-checkmark-outline" size={22} color="#158187" />
        </View>
        <View style={styles.trustCopy}>
          <Text style={styles.trustTitle}>전문 자격 서류를 확인한 센터만</Text>
          <Text style={styles.trustDescription}>물리치료사 면허 또는 체육학 학위를 확인합니다.</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#737a76" />
      </TouchableOpacity>
    </ScrollView>
  );
}

function AppScreenHeader({ screen, onBack }) {
  const isStandalone = screen.id === "brand" || screen.id === "register";
  return (
    <View style={styles.screenHeader}>
      {isStandalone ? (
        <TouchableOpacity
          style={styles.screenBackButton}
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="홈으로 돌아가기"
          activeOpacity={0.76}
        >
          <Ionicons name="chevron-back" size={23} color="#111111" />
        </TouchableOpacity>
      ) : (
        <View style={styles.screenHeaderMark}>
          <View style={styles.screenHeaderDot} />
        </View>
      )}
      <View style={styles.screenHeaderCopy}>
        <Text style={styles.screenHeaderTitle}>{screen.title}</Text>
        <Text style={styles.screenHeaderSubtitle} numberOfLines={1}>{screen.subtitle}</Text>
      </View>
      <TouchableOpacity
        style={styles.screenHomeButton}
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel="DAIL 홈"
        activeOpacity={0.76}
      >
        <Ionicons name="home-outline" size={19} color="#111111" />
      </TouchableOpacity>
    </View>
  );
}

export default function App() {
  const webViewRef = useRef(null);
  const [activeScreen, setActiveScreen] = useState("home");
  const [currentUrl, setCurrentUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [loadError, setLoadError] = useState("");

  const openScreen = useCallback((screen) => {
    if (screen.id === "home") {
      setActiveScreen("home");
      setCurrentUrl("");
      setLoading(false);
      setLoadFailed(false);
      setLoadError("");
      return;
    }

    setActiveScreen(screen.id);
    setCurrentUrl(`${API_BASE}${screen.path}`);
    setLoadFailed(false);
    setLoadError("");
    setLoading(true);
  }, []);

  const allowNavigation = useCallback((request) => {
    try {
      const requested = new URL(request.url);
      const appOrigin = new URL(API_BASE).origin;

      if (requested.protocol === "nmap:") {
        openNaverMap(request.url);
        return false;
      }

      const authHosts = ["kauth.kakao.com", "accounts.kakao.com", "nid.naver.com", "appleid.apple.com"];
      const isAuthHost = authHosts.includes(requested.hostname) || requested.hostname.endsWith(".supabase.co");
      if (["http:", "https:"].includes(requested.protocol) && requested.origin !== appOrigin && !isAuthHost) {
        Linking.openURL(request.url).catch(() => {});
        return false;
      }

      return ["http:", "https:", "about:", "data:", "blob:"].includes(requested.protocol);
    } catch {
      return false;
    }
  }, []);

  const screen = APP_SCREENS[activeScreen] || APP_SCREENS.home;
  const showingHome = activeScreen === "home";

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {showingHome ? (
        <HomeScreen onOpen={openScreen} />
      ) : (
        <View style={styles.screenContainer}>
          <AppScreenHeader screen={screen} onBack={() => openScreen(APP_SCREENS.home)} />
          <View style={styles.webContainer}>
            <WebView
              key={currentUrl}
              ref={webViewRef}
              source={{ uri: currentUrl }}
              style={styles.webView}
              originWhitelist={["http://*", "https://*", "about:*", "data:*", "blob:*", "nmap://*"]}
              javaScriptEnabled
              domStorageEnabled
              sharedCookiesEnabled
              thirdPartyCookiesEnabled
              applicationNameForUserAgent="DAIL-App"
              allowsBackForwardNavigationGestures
              directionalLockEnabled
              showsHorizontalScrollIndicator={false}
              bounces={false}
              overScrollMode="never"
              injectedJavaScriptBeforeContentLoaded={NATIVE_PRESENTATION_SCRIPT}
              injectedJavaScript={NATIVE_PRESENTATION_SCRIPT}
              allowsInlineMediaPlayback
              mediaPlaybackRequiresUserAction={false}
              mixedContentMode="always"
              setSupportMultipleWindows={false}
              pullToRefreshEnabled={activeScreen !== "centers"}
              onShouldStartLoadWithRequest={allowNavigation}
              onNavigationStateChange={(state) => {
                const nextScreen = screenForUrl(state.url);
                if (nextScreen) setActiveScreen(nextScreen);
              }}
              onLoadStart={() => {
                setLoading(true);
                setLoadFailed(false);
                setLoadError("");
              }}
              onLoadEnd={() => setLoading(false)}
              onError={(event) => {
                setLoading(false);
                setLoadFailed(true);
                setLoadError(event.nativeEvent.description || "WebView 연결 오류");
              }}
              onHttpError={(event) => {
                setLoading(false);
                setLoadFailed(true);
                setLoadError(`HTTP ${event.nativeEvent.statusCode}`);
              }}
              onContentProcessDidTerminate={() => {
                setLoadFailed(true);
                setLoadError("웹 화면 프로세스가 종료되었습니다.");
              }}
              renderLoading={() => null}
            />

            {loading ? (
              <View style={styles.loadingOverlay} pointerEvents="none">
                <ActivityIndicator size="large" color="#158187" />
                <Text style={styles.loadingText}>{screen.title} 화면을 불러오는 중입니다</Text>
              </View>
            ) : null}

            {loadFailed ? (
              <View style={styles.errorOverlay}>
                <View style={styles.errorIcon}>
                  <Ionicons name="cloud-offline-outline" size={28} color="#7c514b" />
                </View>
                <Text style={styles.errorTitle}>화면을 불러오지 못했습니다</Text>
                <Text style={styles.errorText}>인터넷 연결을 확인한 뒤 다시 시도해 주세요.</Text>
                <Text style={styles.errorDetail}>{loadError || currentUrl}</Text>
                <TouchableOpacity
                  style={styles.retryButton}
                  onPress={() => {
                    setLoadFailed(false);
                    setLoadError("");
                    setLoading(true);
                    webViewRef.current?.reload();
                  }}
                  activeOpacity={0.84}
                >
                  <Text style={styles.retryButtonText}>다시 불러오기</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        </View>
      )}

      <View style={styles.tabDock} pointerEvents="box-none">
        <View style={styles.tabGlassShadow}>
          <BlurView
            intensity={Platform.OS === "ios" ? 78 : 36}
            tint={Platform.OS === "ios" ? "systemChromeMaterialLight" : "light"}
            experimentalBlurMethod={Platform.OS === "android" ? "none" : undefined}
            style={styles.tabGlass}
          >
            <View style={styles.tabGlassHighlight} pointerEvents="none" />
            <View style={styles.tabBar} accessibilityRole="tablist">
              {TAB_SCREENS.map((tabScreen) => {
                const active = activeScreen === tabScreen.id;
                return (
                  <TouchableOpacity
                    key={tabScreen.id}
                    style={[styles.tab, active && styles.tabActive]}
                    onPress={() => openScreen(tabScreen)}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: active }}
                    activeOpacity={0.72}
                  >
                    <View style={[styles.tabIconWrap, active && styles.tabIconWrapActive]}>
                      <Ionicons
                        name={active ? tabScreen.activeIcon : tabScreen.icon}
                        size={21}
                        color={active ? "#111111" : "#686d69"}
                        accessibilityElementsHidden
                        importantForAccessibility="no-hide-descendants"
                      />
                    </View>
                    <Text style={[styles.tabText, active && styles.tabTextActive]}>{tabScreen.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </BlurView>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  homeScroll: {
    flex: 1,
    backgroundColor: "#f7f7f5",
  },
  homeContent: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 116,
  },
  homeHeader: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  homeBrand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  homeBrandMark: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 13,
    backgroundColor: "#111111",
  },
  homeBrandRing: {
    width: 21,
    height: 21,
    borderWidth: 2,
    borderColor: "#50a1a5",
    borderRadius: 11,
  },
  homeBrandDot: {
    position: "absolute",
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#50a1a5",
  },
  homeBrandName: {
    color: "#111111",
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  homeBrandTagline: {
    marginTop: 1,
    color: "#6c716e",
    fontSize: 10,
    fontWeight: "700",
  },
  profileShortcut: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#d9dbd7",
    borderRadius: 14,
    backgroundColor: "#ffffff",
  },
  homeHero: {
    minHeight: 218,
    padding: 24,
    overflow: "hidden",
    justifyContent: "flex-end",
    borderRadius: 26,
    backgroundColor: "#111111",
  },
  homeHeroGlowOne: {
    position: "absolute",
    top: -52,
    right: -35,
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: "rgba(21,129,135,.22)",
  },
  homeHeroGlowTwo: {
    position: "absolute",
    top: 30,
    right: 64,
    width: 72,
    height: 72,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.18)",
    borderRadius: 36,
  },
  homeHeroEyebrow: {
    marginBottom: 12,
    color: "#50a1a5",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.5,
  },
  homeHeroTitle: {
    color: "#ffffff",
    fontSize: 25,
    fontWeight: "900",
    lineHeight: 35,
    letterSpacing: -0.7,
  },
  homeHeroText: {
    maxWidth: 290,
    marginTop: 12,
    color: "#bfc4c1",
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 20,
  },
  homeSectionHeading: {
    marginTop: 28,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  homeSectionEyebrow: {
    marginBottom: 5,
    color: "#158187",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.4,
  },
  homeSectionTitle: {
    color: "#111111",
    fontSize: 21,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  homeSectionHint: {
    paddingBottom: 2,
    color: "#898d8a",
    fontSize: 10,
    fontWeight: "600",
  },
  actionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 12,
  },
  actionCard: {
    width: "48.4%",
    aspectRatio: 1,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#dedfdc",
    borderRadius: 22,
    backgroundColor: "#ffffff",
  },
  actionCardPrimary: {
    borderColor: "#111111",
    backgroundColor: "#111111",
  },
  actionIcon: {
    width: 43,
    height: 43,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: "#f3f9f9",
  },
  actionIconPrimary: {
    backgroundColor: "rgba(255,255,255,.16)",
  },
  actionCopy: {
    flex: 1,
    justifyContent: "flex-end",
  },
  actionEyebrow: {
    marginBottom: 4,
    color: "#666963",
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  actionTitle: {
    color: "#111111",
    fontSize: 17,
    fontWeight: "900",
    letterSpacing: -0.35,
  },
  actionDescription: {
    marginTop: 6,
    paddingRight: 8,
    color: "#737874",
    fontSize: 10,
    fontWeight: "600",
    lineHeight: 15,
  },
  actionTextOnDark: {
    color: "#ffffff",
  },
  actionDescriptionOnDark: {
    color: "#d4d4cf",
  },
  actionArrow: {
    position: "absolute",
    right: 14,
    top: 15,
    width: 29,
    height: 29,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 15,
    backgroundColor: "#f2f3f1",
  },
  actionArrowPrimary: {
    backgroundColor: "#ffffff",
  },
  trustCard: {
    minHeight: 82,
    marginTop: 14,
    paddingHorizontal: 15,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#d9dedb",
    borderRadius: 20,
    backgroundColor: "#f3f9f9",
  },
  trustIcon: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: "#ffffff",
  },
  trustCopy: {
    flex: 1,
  },
  trustTitle: {
    color: "#111111",
    fontSize: 13,
    fontWeight: "900",
  },
  trustDescription: {
    marginTop: 5,
    color: "#666963",
    fontSize: 10,
    fontWeight: "600",
    lineHeight: 15,
  },
  screenContainer: {
    flex: 1,
    backgroundColor: "#f7f7f5",
  },
  screenHeader: {
    minHeight: 66,
    paddingHorizontal: 15,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#dedfdc",
    backgroundColor: "#ffffff",
  },
  screenHeaderMark: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 11,
    backgroundColor: "#111111",
  },
  screenHeaderDot: {
    width: 10,
    height: 10,
    borderWidth: 3,
    borderColor: "#50a1a5",
    borderRadius: 5,
  },
  screenBackButton: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 13,
    backgroundColor: "#f3f3f1",
  },
  screenHeaderCopy: {
    flex: 1,
    minWidth: 0,
  },
  screenHeaderTitle: {
    color: "#111111",
    fontSize: 17,
    fontWeight: "900",
    letterSpacing: -0.3,
  },
  screenHeaderSubtitle: {
    marginTop: 3,
    color: "#747a76",
    fontSize: 10,
    fontWeight: "600",
  },
  screenHomeButton: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#dedfdc",
    borderRadius: 13,
    backgroundColor: "#ffffff",
  },
  webContainer: {
    flex: 1,
    position: "relative",
    backgroundColor: "#f7f7f5",
  },
  webView: {
    flex: 1,
    backgroundColor: "#f7f7f5",
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: "rgba(247,247,245,.96)",
    zIndex: 2,
  },
  loadingText: {
    color: "#666963",
    fontSize: 13,
    fontWeight: "700",
  },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
    backgroundColor: "#f7f7f5",
    zIndex: 3,
  },
  errorIcon: {
    width: 58,
    height: 58,
    marginBottom: 15,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 19,
    backgroundColor: "#f2eae8",
  },
  errorTitle: {
    color: "#111111",
    fontSize: 20,
    fontWeight: "900",
  },
  errorText: {
    marginTop: 8,
    color: "#666963",
    fontSize: 14,
    textAlign: "center",
  },
  errorDetail: {
    marginTop: 10,
    color: "#8b5048",
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
  },
  retryButton: {
    minWidth: 150,
    minHeight: 46,
    marginTop: 20,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: "#111111",
  },
  retryButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900",
  },
  tabDock: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: Platform.OS === "ios" ? 8 : 10,
    zIndex: 50,
    paddingHorizontal: 12,
  },
  tabGlassShadow: {
    minHeight: 72,
    borderRadius: 31,
    backgroundColor: "rgba(248,248,246,.58)",
    shadowColor: "#0b1720",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: Platform.OS === "ios" ? 0.2 : 0.12,
    shadowRadius: 22,
    elevation: 16,
  },
  tabGlass: {
    minHeight: 72,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,.88)",
    borderRadius: 31,
    backgroundColor: "rgba(249,249,247,.46)",
  },
  tabGlassHighlight: {
    position: "absolute",
    top: 1,
    left: 24,
    right: 24,
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,.96)",
  },
  tabBar: {
    minHeight: 70,
    paddingHorizontal: 6,
    paddingVertical: 5,
    flexDirection: "row",
    backgroundColor: "transparent",
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "transparent",
    borderRadius: 24,
  },
  tabActive: {
    borderColor: "rgba(255,255,255,.86)",
    backgroundColor: "rgba(255,255,255,.58)",
    shadowColor: "#111111",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  tabIconWrap: {
    width: 36,
    height: 31,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
  },
  tabIconWrapActive: {
    backgroundColor: "rgba(255,255,255,.42)",
  },
  tabText: {
    color: "#72756f",
    fontSize: 10,
    fontWeight: "800",
  },
  tabTextActive: {
    color: "#111111",
  },
});
