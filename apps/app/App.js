import React, { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { WebView } from "react-native-webview";

const API_BASE = String(
  process.env.EXPO_PUBLIC_API_BASE_URL || "http://localhost:8090"
).replace(/\/$/, "");

const SCREENS = [
  { id: "centers", label: "센터 찾기", icon: "⌖", path: "/" },
  { id: "register", label: "센터 등록", icon: "+", path: "/register/" },
  { id: "admin", label: "관리자", icon: "⚙", path: "/admin/" },
];

function screenForUrl(url) {
  try {
    const path = new URL(url).pathname;
    if (path.startsWith("/admin")) return "admin";
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

  const openScreen = useCallback((screen) => {
    setActiveScreen(screen.id);
    setCurrentUrl(`${API_BASE}${screen.path}`);
    setLoadFailed(false);
    setLoading(true);
  }, []);

  const allowNavigation = useCallback((request) => {
    try {
      const requested = new URL(request.url);
      const appOrigin = new URL(API_BASE).origin;

      if (["http:", "https:"].includes(requested.protocol) && requested.origin !== appOrigin) {
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
          originWhitelist={["http://*", "https://*", "about:*", "data:*", "blob:*"]}
          javaScriptEnabled
          domStorageEnabled
          sharedCookiesEnabled
          thirdPartyCookiesEnabled
          allowsBackForwardNavigationGestures
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          setSupportMultipleWindows={false}
          pullToRefreshEnabled
          onShouldStartLoadWithRequest={allowNavigation}
          onNavigationStateChange={(state) => {
            setActiveScreen(screenForUrl(state.url));
          }}
          onLoadStart={() => {
            setLoading(true);
            setLoadFailed(false);
          }}
          onLoadEnd={() => setLoading(false)}
          onError={() => {
            setLoading(false);
            setLoadFailed(true);
          }}
          onHttpError={(event) => {
            if (event.nativeEvent.statusCode >= 500) setLoadFailed(true);
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
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => {
                setLoadFailed(false);
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
              <Text style={[styles.tabIcon, active && styles.tabTextActive]}>{screen.icon}</Text>
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
  tabIcon: {
    color: "#77847e",
    fontSize: 19,
    fontWeight: "900",
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
