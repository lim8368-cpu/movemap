import React, { useCallback, useRef, useState } from "react";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  SafeAreaView,
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

const SCREENS = [
  { id: "centers", label: "센터 찾기", icon: "map-outline", activeIcon: "map", path: "/" },
  { id: "register", label: "센터 등록", icon: "add-circle-outline", activeIcon: "add-circle", path: "/register/" },
  { id: "account", label: "내 정보", icon: "person-circle-outline", activeIcon: "person-circle", path: "/?login=1" },
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
    const path = new URL(url).pathname;
    if (new URL(url).searchParams.get("login") === "1") return "account";
    if (path.startsWith("/register")) return "register";
    return "centers";
  } catch {
    return "centers";
  }
}

export default function App() {
  const webViewRef = useRef(null);
  const [activeScreen, setActiveScreen] = useState("centers");
  const [currentUrl, setCurrentUrl] = useState(`${API_BASE}/`);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [loadError, setLoadError] = useState("");

  const openScreen = useCallback((screen) => {
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

      return ["http:", "https:", "about:", "data:", "blob:"].includes(
        requested.protocol
      );
    } catch {
      return false;
    }
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      <View style={styles.webContainer}>
        <WebView
          ref={webViewRef}
          source={{ uri: currentUrl }}
          style={styles.webView}
          originWhitelist={["http://*", "https://*", "about:*", "data:*", "blob:*", "nmap://*"]}
          javaScriptEnabled
          domStorageEnabled
          sharedCookiesEnabled
          thirdPartyCookiesEnabled
          allowsBackForwardNavigationGestures
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          mixedContentMode="always"
          setSupportMultipleWindows={false}
          pullToRefreshEnabled
          onShouldStartLoadWithRequest={allowNavigation}
          onNavigationStateChange={(state) => {
            setActiveScreen(screenForUrl(state.url));
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
            <ActivityIndicator size="large" color="#2f9b76" />
            <Text style={styles.loadingText}>DAIL을 불러오는 중입니다</Text>
          </View>
        ) : null}

        {loadFailed ? (
          <View style={styles.errorOverlay}>
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

      <View style={styles.tabBar} accessibilityRole="tablist">
        {SCREENS.map((screen) => {
          const active = activeScreen === screen.id;
          return (
            <TouchableOpacity
              key={screen.id}
              style={[styles.tab, active && styles.tabActive]}
              onPress={() => openScreen(screen)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              activeOpacity={0.78}
            >
              <Ionicons
                name={active ? screen.activeIcon : screen.icon}
                size={21}
                color={active ? "#167354" : "#77847e"}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              />
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{screen.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  webContainer: {
    flex: 1,
    position: "relative",
    backgroundColor: "#f7faf8",
  },
  webView: {
    flex: 1,
    backgroundColor: "#f7faf8",
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: "rgba(247, 250, 248, 0.94)",
    zIndex: 2,
  },
  loadingText: {
    color: "#607069",
    fontSize: 14,
    fontWeight: "700",
  },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
    backgroundColor: "#f7faf8",
    zIndex: 3,
  },
  errorTitle: {
    color: "#17211d",
    fontSize: 20,
    fontWeight: "900",
  },
  errorText: {
    marginTop: 8,
    color: "#607069",
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
    borderRadius: 10,
    backgroundColor: "#2f9b76",
  },
  retryButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900",
  },
  tabBar: {
    minHeight: 66,
    flexDirection: "row",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#d9e3de",
    backgroundColor: "#ffffff",
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    borderTopWidth: 3,
    borderTopColor: "transparent",
  },
  tabActive: {
    borderTopColor: "#2f9b76",
    backgroundColor: "#eef6f1",
  },
  tabText: {
    color: "#77847e",
    fontSize: 12,
    fontWeight: "800",
  },
  tabTextActive: {
    color: "#167354",
  },
});
