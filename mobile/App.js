import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Image,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { WebView } from "react-native-webview";

const API_BASE = "http://192.168.150.139:8090";
const MOBILE_MAP_URL = `http://192.168.150.139:8080/web/mobile-map.html?apiBase=${encodeURIComponent(API_BASE)}&v=20260709-access-logs`;

const sampleCenters = [
  {
    id: "core",
    name: "코어핏 무브센터",
    region: "강남",
    area: "서울 강남구",
    distance: "1.2km",
    rating: "4.9",
    reviews: "128",
    lead: "허리 통증 이후 재발 방지 운동과 체형 평가를 함께 진행합니다.",
    tags: ["허리", "수술 후", "필라테스", "1:1 평가"],
    therapist: "김민재 센터장 · 물리치료사 9년",
    price: "첫 평가 30,000원",
    lat: 37.4979,
    lng: 127.0276,
    x: "58%",
    y: "52%",
  },
  {
    id: "reform",
    name: "리폼무브 스튜디오",
    region: "마포",
    area: "서울 마포구",
    distance: "3.8km",
    rating: "4.8",
    reviews: "94",
    lead: "직장인 목, 어깨 불편감과 자세 습관을 운동 루틴으로 관리합니다.",
    tags: ["어깨", "거북목", "소그룹", "자세 분석"],
    therapist: "박서연 대표 · 물리치료사 7년",
    price: "체험 수업 20,000원",
    lat: 37.5557,
    lng: 126.9236,
    x: "34%",
    y: "36%",
  },
  {
    id: "posture",
    name: "포스처랩 분당",
    region: "분당",
    area: "경기 성남시 분당구",
    distance: "9.6km",
    rating: "4.7",
    reviews: "76",
    lead: "수술 후 일상 복귀와 고령자 근력 회복 프로그램에 강점이 있습니다.",
    tags: ["수술 후", "고령자", "근력", "보행"],
    therapist: "이도윤 원장 · 물리치료사 11년",
    price: "방문 상담 무료",
    lat: 37.3827,
    lng: 127.1189,
    x: "72%",
    y: "70%",
  },
  {
    id: "shoulder",
    name: "숄더워크 랩",
    region: "강남",
    area: "서울 강남구",
    distance: "2.4km",
    rating: "4.9",
    reviews: "61",
    lead: "골프, 테니스 이용자를 위한 어깨 가동성 및 회전근개 운동을 제공합니다.",
    tags: ["어깨", "골프", "테니스", "가동성"],
    therapist: "최하린 대표 · 물리치료사 8년",
    price: "스포츠 평가 40,000원",
    lat: 37.5243,
    lng: 127.0399,
    x: "64%",
    y: "28%",
  },
];

const regions = ["전체", "강남", "마포", "분당"];
const goals = ["허리", "어깨", "수술 후", "골프"];

export default function App() {
  const [centers, setCenters] = useState(sampleCenters);
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState("전체");
  const [goal, setGoal] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [mapWebFailed, setMapWebFailed] = useState(false);
  const mapRef = useRef(null);
  const scrollRef = useRef(null);
  const mapCardY = useRef(0);
  const detailProgress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    async function loadCenters() {
      try {
        const response = await fetch(`${API_BASE}/api/centers`, {
          headers: { "X-Movemap-Client": "mobile-app" },
        });
        if (!response.ok) return;
        const data = await response.json();
        const approvedCenters = (data.centers || []).map((center) => ({
          ...center,
          region: center.area?.includes("강남")
            ? "강남"
            : center.area?.includes("마포")
              ? "마포"
              : center.area?.includes("분당") || center.area?.includes("성남")
                ? "분당"
                : "전체",
          distance: center.distance || "신규",
          rating: center.rating || "신규",
          reviews: center.reviews || "0",
          lead: center.lead || "물리치료사가 운영하는 운동센터입니다.",
          tags: Array.isArray(center.tags) && center.tags.length ? center.tags : ["운동 관리"],
          therapist: center.therapist || "물리치료사 운영 확인",
          price: center.price || "센터 문의",
          photoUrl: center.photoUrl || "",
          photoDataUrl: center.photoDataUrl || "",
          lat: Number(center.lat) || 37.5665,
          lng: Number(center.lng) || 126.978,
          x: center.fallbackX || "52%",
          y: center.fallbackY || "50%",
        }));

        if (approvedCenters.length) {
          setCenters(approvedCenters);
          setSelectedId((currentId) =>
            approvedCenters.some((center) => center.id === currentId)
              ? currentId
              : ""
          );
        }
      } catch {}
    }

    loadCenters();
  }, []);

  const filteredCenters = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return centers.filter((center) => {
      const text = [center.name, center.area, center.lead, center.tags.join(" ")]
        .join(" ")
        .toLowerCase();
      const matchesQuery = !normalizedQuery || text.includes(normalizedQuery);
      const matchesRegion = region === "전체" || center.region === region;
      const matchesGoal = !goal || center.tags.includes(goal);

      return matchesQuery && matchesRegion && matchesGoal;
    });
  }, [centers, goal, query, region]);

  const selectedCenter = centers.find((center) => center.id === selectedId);
  const selectedPhoto =
    selectedCenter?.photoDataUrl || selectedCenter?.photoUrl || "";
  const showSelectedPhoto = /^https?:\/\/|^data:image\//.test(selectedPhoto);

  function scrollToMap() {
    scrollRef.current?.scrollTo({
      y: Math.max(mapCardY.current - 10, 0),
      animated: true,
    });
  }

  function selectCenter(id, options = {}) {
    detailProgress.stopAnimation();
    setSelectedId(id);
    if (options.scrollToMap) {
      scrollToMap();
    }
    Animated.timing(detailProgress, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
    mapRef.current?.postMessage(JSON.stringify({ type: "focus_center", id }));
  }

  function clearSelectedCenter() {
    if (!selectedId) return;
    detailProgress.stopAnimation();
    Animated.timing(detailProgress, {
      toValue: 0,
      duration: 220,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setSelectedId("");
    });
  }

  function handleMapMessage(event) {
    try {
      const message = JSON.parse(event.nativeEvent.data);
      if (message.type === "center_select" && message.id) {
        selectCenter(message.id, { scrollToMap: false });
      }
      if (message.type === "clear_selection") {
        clearSelectedCenter();
      }
    } catch {}
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <View style={styles.logo}>
          <Text style={styles.logoText}>M</Text>
        </View>
        <View style={styles.headerText}>
          <Text style={styles.appName}>무브맵</Text>
          <Text style={styles.caption}>물리치료사 운동센터 지도</Text>
        </View>
        <TouchableOpacity style={styles.outlineButton} activeOpacity={0.82}>
          <Text style={styles.outlineButtonText}>등록</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[
          styles.content,
          selectedCenter && styles.contentWithDetail,
        ]}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>내 주변 전문가 찾기</Text>
          <Text style={styles.title}>통증 이후 운동을 이어갈 센터를 찾으세요</Text>
          <Text style={styles.description}>
            물리치료사가 운영하는 센터를 위치, 목적, 후기, 첫 방문 가격으로 비교합니다.
          </Text>
        </View>

        <View style={styles.searchBox}>
          <Text style={styles.inputLabel}>검색</Text>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="지역, 센터명, 증상 검색"
            placeholderTextColor="#8a9992"
            style={styles.input}
            returnKeyType="search"
          />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          {regions.map((item) => (
            <TouchableOpacity
              key={item}
              style={[styles.chip, region === item && styles.chipActive]}
              onPress={() => setRegion(item)}
              activeOpacity={0.82}
            >
              <Text style={[styles.chipText, region === item && styles.chipTextActive]}>
                {item}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.goalGrid}>
          {goals.map((item) => (
            <TouchableOpacity
              key={item}
              style={[styles.goalButton, goal === item && styles.goalButtonActive]}
              onPress={() => setGoal(goal === item ? "" : item)}
              activeOpacity={0.82}
            >
              <Text style={[styles.goalText, goal === item && styles.goalTextActive]}>
                {item}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View
          style={styles.mapCard}
          onLayout={(event) => {
            mapCardY.current = event.nativeEvent.layout.y;
          }}
        >
          <View style={styles.mapHeader}>
            <Text style={styles.sectionTitle}>센터 지도</Text>
            <Text style={styles.resultText}>{filteredCenters.length}곳</Text>
          </View>
          <View style={styles.map}>
            {mapWebFailed ? (
              <>
                <View style={styles.river} />
                <Text style={[styles.mapLabel, styles.mapLabelMapo]}>마포</Text>
                <Text style={[styles.mapLabel, styles.mapLabelGangnam]}>강남</Text>
                <Text style={[styles.mapLabel, styles.mapLabelBundang]}>분당</Text>
                {centers.map((center) => (
                  <TouchableOpacity
                    key={center.id}
                    style={[
                      styles.pin,
                      { left: center.x, top: center.y },
                      selectedCenter?.id === center.id && styles.pinSelected,
                    ]}
                    onPress={() => selectCenter(center.id, { scrollToMap: true })}
                    activeOpacity={0.82}
                  >
                    <Text style={styles.pinText}>{center.name.slice(0, 2)}</Text>
                  </TouchableOpacity>
                ))}
              </>
            ) : (
              <WebView
                ref={mapRef}
                source={{ uri: MOBILE_MAP_URL }}
                style={styles.webMap}
                javaScriptEnabled
                domStorageEnabled
                originWhitelist={["*"]}
                overScrollMode="never"
                onError={() => setMapWebFailed(true)}
                onHttpError={() => setMapWebFailed(true)}
                onMessage={handleMapMessage}
              />
            )}
          </View>
        </View>

        <View style={styles.listHeader}>
          <Text style={styles.sectionTitle}>추천 센터</Text>
          <Text style={styles.resultText}>홍보용 노출 카드</Text>
        </View>
        {filteredCenters.map((center) => (
          <TouchableOpacity
            key={center.id}
            style={[styles.centerCard, selectedCenter?.id === center.id && styles.centerCardActive]}
            onPress={() => selectCenter(center.id, { scrollToMap: true })}
            activeOpacity={0.82}
          >
            <View style={styles.centerCardTop}>
              <Text style={styles.cardTitle}>{center.name}</Text>
              <Text style={styles.cardRating}>★ {center.rating}</Text>
            </View>
            <Text style={styles.cardLead}>{center.lead}</Text>
            <Text style={styles.cardMeta}>
              {center.area} · {center.distance}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      {selectedCenter ? (
        <Animated.View
          style={[
            styles.detailOverlay,
            {
              opacity: detailProgress,
              transform: [
                {
                  translateY: detailProgress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [220, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.detailCard}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>물리치료사 운영 확인</Text>
            </View>
            <Text style={styles.centerName}>{selectedCenter.name}</Text>
            {showSelectedPhoto ? (
              <Image source={{ uri: selectedPhoto }} style={styles.centerPhoto} />
            ) : null}
            <Text style={styles.centerLead} numberOfLines={2}>
              {selectedCenter.lead}
            </Text>
            <Text style={styles.therapist}>{selectedCenter.therapist}</Text>
            <View style={styles.tagRow}>
              {selectedCenter.tags.map((tag) => (
                <Text key={tag} style={styles.tag} numberOfLines={1}>
                  {tag}
                </Text>
              ))}
            </View>
            <View style={styles.metricRow}>
              <View style={styles.metric}>
                <Text style={styles.metricValue}>{selectedCenter.rating}</Text>
                <Text style={styles.metricLabel}>후기 {selectedCenter.reviews}개</Text>
              </View>
              <View style={styles.metric}>
                <Text style={styles.metricValue}>{selectedCenter.price}</Text>
                <Text style={styles.metricLabel}>첫 방문 상품</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.primaryButton} activeOpacity={0.86}>
              <Text style={styles.primaryButtonText}>상담 요청하기</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      ) : null}
    </SafeAreaView>
  );
}

const colors = {
  ink: "#17211d",
  muted: "#607069",
  line: "#d9e3de",
  mint: "#2f9b76",
  mintDark: "#167354",
  soft: "#eef6f1",
  amber: "#d98922",
  blue: "#316fa8",
  rose: "#c55f6a",
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f7faf8",
  },
  header: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    backgroundColor: "#ffffff",
  },
  logo: {
    width: 42,
    height: 42,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.mint,
  },
  logoText: {
    color: "#ffffff",
    fontSize: 21,
    fontWeight: "900",
  },
  headerText: {
    flex: 1,
    marginLeft: 12,
  },
  appName: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "900",
  },
  caption: {
    marginTop: 2,
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
  },
  outlineButton: {
    minWidth: 64,
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.mint,
    borderRadius: 8,
    backgroundColor: "#ffffff",
  },
  outlineButtonText: {
    color: colors.mintDark,
    fontWeight: "900",
  },
  content: {
    padding: 20,
    paddingBottom: 36,
  },
  contentWithDetail: {
    paddingBottom: 360,
  },
  hero: {
    marginBottom: 20,
  },
  eyebrow: {
    marginBottom: 8,
    color: colors.mintDark,
    fontSize: 13,
    fontWeight: "900",
  },
  title: {
    color: colors.ink,
    fontSize: 32,
    lineHeight: 38,
    fontWeight: "900",
  },
  description: {
    marginTop: 12,
    color: colors.muted,
    fontSize: 15,
    lineHeight: 23,
    fontWeight: "600",
  },
  searchBox: {
    marginBottom: 14,
  },
  inputLabel: {
    marginBottom: 8,
    color: colors.muted,
    fontSize: 13,
    fontWeight: "900",
  },
  input: {
    height: 50,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    backgroundColor: "#ffffff",
    color: colors.ink,
    fontSize: 16,
    fontWeight: "700",
  },
  chipRow: {
    gap: 8,
    paddingBottom: 14,
  },
  chip: {
    minHeight: 36,
    paddingHorizontal: 15,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: "#ffffff",
  },
  chipActive: {
    borderColor: colors.ink,
    backgroundColor: colors.ink,
  },
  chipText: {
    color: colors.muted,
    fontWeight: "900",
  },
  chipTextActive: {
    color: "#ffffff",
  },
  goalGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 20,
  },
  goalButton: {
    width: "48%",
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    backgroundColor: "#ffffff",
  },
  goalButtonActive: {
    borderColor: colors.mint,
    backgroundColor: colors.soft,
  },
  goalText: {
    color: colors.muted,
    fontWeight: "900",
  },
  goalTextActive: {
    color: colors.mintDark,
  },
  mapCard: {
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#ffffff",
  },
  mapHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "900",
  },
  resultText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "900",
  },
  map: {
    height: 310,
    position: "relative",
    backgroundColor: "#eef4ef",
  },
  river: {
    position: "absolute",
    left: -24,
    right: -24,
    top: 112,
    height: 58,
    transform: [{ rotate: "-8deg" }],
    backgroundColor: "rgba(49, 111, 168, 0.18)",
  },
  mapLabel: {
    position: "absolute",
    color: "rgba(23, 33, 29, 0.28)",
    fontSize: 24,
    fontWeight: "900",
  },
  mapLabelMapo: {
    left: "24%",
    top: "22%",
  },
  mapLabelGangnam: {
    left: "52%",
    top: "48%",
  },
  mapLabelBundang: {
    left: "66%",
    top: "74%",
  },
  pin: {
    position: "absolute",
    width: 44,
    height: 44,
    marginLeft: -22,
    marginTop: -44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
    backgroundColor: colors.mint,
    shadowColor: colors.mintDark,
    shadowOpacity: 0.25,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  pinSelected: {
    borderWidth: 4,
    borderColor: "#ffffff",
  },
  pinText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "900",
  },
  detailCard: {
    maxHeight: 310,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    backgroundColor: "#ffffff",
  },
  detailOverlay: {
    position: "absolute",
    left: 14,
    right: 14,
    bottom: 10,
    zIndex: 20,
    shadowColor: "#1d392e",
    shadowOpacity: 0.18,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 14 },
    elevation: 12,
  },
  badge: {
    alignSelf: "flex-start",
    minHeight: 26,
    justifyContent: "center",
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: colors.mint,
  },
  badgeText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "900",
  },
  centerName: {
    marginTop: 8,
    color: colors.ink,
    fontSize: 20,
    fontWeight: "900",
  },
  centerPhoto: {
    width: "100%",
    height: 86,
    marginTop: 8,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    backgroundColor: "#eef4ef",
  },
  centerLead: {
    marginTop: 6,
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },
  therapist: {
    marginTop: 6,
    color: colors.ink,
    fontSize: 13,
    fontWeight: "900",
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 8,
  },
  tag: {
    maxWidth: 96,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: colors.soft,
    color: colors.mintDark,
    fontSize: 12,
    fontWeight: "900",
  },
  metricRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },
  metric: {
    flex: 1,
    minHeight: 54,
    justifyContent: "center",
    paddingHorizontal: 12,
    borderLeftWidth: 3,
    borderLeftColor: colors.mint,
    backgroundColor: "#f8fbf9",
  },
  metricValue: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "900",
  },
  metricLabel: {
    marginTop: 4,
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
  },
  primaryButton: {
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
    borderRadius: 8,
    backgroundColor: colors.mint,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
  },
  listHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  centerCard: {
    marginBottom: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    backgroundColor: "#ffffff",
  },
  centerCardActive: {
    borderColor: colors.mint,
    backgroundColor: "#fbfffd",
  },
  centerCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  cardTitle: {
    flex: 1,
    color: colors.ink,
    fontSize: 17,
    fontWeight: "900",
  },
  cardRating: {
    color: colors.amber,
    fontSize: 14,
    fontWeight: "900",
  },
  cardLead: {
    marginTop: 8,
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "600",
  },
  cardMeta: {
    marginTop: 10,
    color: colors.muted,
    fontSize: 13,
    fontWeight: "900",
  },
});
