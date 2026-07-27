const sampleCenters = [
  {
    id: "core",
    name: "코어핏 무브센터",
    region: "gangnam",
    area: "서울 강남구",
    distance: "1.2km",
    rating: "4.9",
    reviews: "128",
    lead: "허리 통증 이후 재발 방지 운동과 체형 평가를 함께 진행합니다.",
    tags: ["허리", "수술 후", "필라테스", "1:1 평가"],
    therapist: "김민재 센터장 · 물리치료사 출신",
    price: "첫 평가 30,000원",
    conversion: "전화 상담 가능",
    address: "서울 강남구 강남대로",
    openingHours: "평일 09:00–21:00 · 토요일 10:00–17:00",
    lat: 37.4979,
    lng: 127.0276,
    fallbackX: "58%",
    fallbackY: "54%",
  },
  {
    id: "reform",
    name: "리폼무브 스튜디오",
    region: "mapo",
    area: "서울 마포구",
    distance: "3.8km",
    rating: "4.8",
    reviews: "94",
    lead: "직장인 목, 어깨 불편감과 자세 습관을 운동 루틴으로 관리합니다.",
    tags: ["어깨", "거북목", "소그룹", "자세 분석"],
    therapist: "박서연 대표 · 물리치료사 출신",
    price: "체험 수업 20,000원",
    conversion: "예약 후 방문",
    address: "서울 마포구 양화로",
    openingHours: "평일 10:00–22:00 · 토요일 10:00–16:00",
    lat: 37.5557,
    lng: 126.9236,
    fallbackX: "42%",
    fallbackY: "40%",
  },
  {
    id: "posture",
    name: "포스처랩 분당",
    region: "bundang",
    area: "경기 성남시 분당구",
    distance: "9.6km",
    rating: "4.7",
    reviews: "76",
    lead: "수술 후 일상 복귀와 고령자 근력 회복 프로그램에 강점이 있습니다.",
    tags: ["수술 후", "고령자", "근력", "보행"],
    therapist: "이도윤 원장 · 물리치료사 출신",
    price: "방문 상담 무료",
    conversion: "센터 문의",
    address: "경기 성남시 분당구 성남대로",
    openingHours: "평일 09:00–20:00 · 일요일 휴무",
    lat: 37.3827,
    lng: 127.1189,
    fallbackX: "73%",
    fallbackY: "68%",
  },
  {
    id: "shoulder",
    name: "숄더워크 랩",
    region: "gangnam",
    area: "서울 강남구",
    distance: "2.4km",
    rating: "4.9",
    reviews: "61",
    lead: "골프, 테니스 이용자를 위한 어깨 가동성 및 회전근개 운동을 제공합니다.",
    tags: ["어깨", "골프", "테니스", "가동성"],
    therapist: "최하린 대표 · 물리치료사 출신",
    price: "스포츠 평가 40,000원",
    conversion: "운동 영상 피드백 제공",
    address: "서울 강남구 도산대로",
    openingHours: "평일 08:00–21:00 · 주말 예약제",
    lat: 37.5243,
    lng: 127.0399,
    fallbackX: "64%",
    fallbackY: "34%",
  },
];

const API_BASE =
  window.MOVEMAP_API_BASE ||
  (window.location.protocol === "file:" ? "http://localhost:8090" : window.location.origin);
const centerList = document.querySelector("#centerList");
const resultCount = document.querySelector("#resultCount");
const detailPanel = document.querySelector("#detailPanel");
const searchInput = document.querySelector("#searchInput");
const regionButtons = document.querySelectorAll("[data-region]");
const checkboxes = document.querySelectorAll(".filter-grid input");
const areaSelect = document.querySelector("#areaSelect");
const mapElement = document.querySelector("#naverMap");
const mapStatus = document.querySelector("#mapStatus");
const mapFallback = document.querySelector("#mapFallback");
const locateButton = document.querySelector("#locateButton");
const zoomInButton = document.querySelector("#zoomInButton");
const zoomOutButton = document.querySelector("#zoomOutButton");
const sidebarPanel = document.querySelector(".sidebar");
const heroMapElement = document.querySelector("#heroNaverMap");
const heroMapStatus = document.querySelector("#heroMapStatus");
const heroLocateButton = document.querySelector("#heroLocateButton");
const activeFilters = document.querySelector("#activeFilters");
const centerExperienceOverlay = document.querySelector("#centerExperienceOverlay");
const centerExperienceSheet = document.querySelector("#centerExperienceSheet");
const centerExperienceContent = document.querySelector("#centerExperienceContent");
const centerExperienceScrim = document.querySelector("#centerExperienceScrim");

let selectedRegion = "all";
let selectedCategory = "";
let centers = sampleCenters;
let selectedId = "";
let naverMap = null;
let naverMarkers = [];
let clusterMarkers = [];
let lastTrackedViewId = "";
let userMarker = null;
let centerInfoWindow = null;
let heroMap = null;
let heroUserMarker = null;
let heroCenterMarkers = [];
let centerFocusTimers = [];
let clusterTransitionTimer = null;
let markerRevealTimer = null;
let panelGestureActive = false;
let centerExperienceId = "";
let centerExperienceView = "detail";
let routeMode = "public";
let routeOrigin = null;
let routeMiniMap = null;
let routeMiniMarker = null;
let publicConfig = {
  naverMapNcpKeyId: "",
  auth: { supabaseUrl: "", supabaseAnonKey: "", providers: {} },
  mobileApps: { iosAppStoreUrl: "", googlePlayStoreUrl: "" },
};
const CENTER_MARKER_MIN_ZOOM = 13;
const CENTER_DETAIL_ZOOM = 16;

function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function uiIcon(name, className = "") {
  return `<svg class="ui-icon ${className}" aria-hidden="true"><use href="/assets/ui-icons.svg#${name}"></use></svg>`;
}

function ratingIcons(rating) {
  const score = Math.max(0, Math.min(5, Number(rating) || 0));
  return Array.from({ length: 5 }, (_, index) => uiIcon("star", index < score ? "is-filled" : "")).join("");
}

function normalizeCenter(center) {
  const operatorText = String(center.therapist || "운영자 정보 확인 중")
    .replace(/물리치료사(?:\s*\d+년|\s*운영 확인|\s*면허 확인)?/g, "물리치료사 출신");
  return {
    ...center,
    region: center.region || "other",
    distance: center.distance || "신규",
    rating: center.rating || "신규",
    reviews: center.reviews || "0",
    lead: center.lead || "센터가 등록한 운동 프로그램 정보를 확인해보세요.",
    tags: Array.isArray(center.tags) && center.tags.length ? center.tags : ["운동 관리"],
    categories: Array.isArray(center.categories) ? center.categories : [],
    therapist: operatorText,
    price: center.price || "센터 문의",
    conversion: center.conversion || "신규 등록 센터",
    address: center.address || center.area || "",
    phone: center.phone || "",
    website: center.website || "",
    openingHours: center.openingHours || center.opening_hours || "운영시간은 센터에 문의해 주세요.",
    naverMapUrl: center.naverMapUrl || center.naver_map_url || "",
    photoUrl: center.photoUrl || "",
    photoUrls: Array.isArray(center.photoUrls)
      ? center.photoUrls.filter(Boolean)
      : (center.photoUrl ? [center.photoUrl] : []),
    lat: Number(center.lat) || 37.5665,
    lng: Number(center.lng) || 126.978,
    fallbackX: center.fallbackX || "52%",
    fallbackY: center.fallbackY || "50%",
  };
}

async function loadApprovedCenters() {
  try {
    const response = await fetch(`${API_BASE}/api/centers`, {
      headers: { "X-Movemap-Client": "web" },
    });
    if (!response.ok) throw new Error("centers unavailable");
    const data = await response.json();
    const approvedCenters = (data.centers || []).map(normalizeCenter);
    centers = approvedCenters;
    selectedId = centers.some((center) => center.id === selectedId) ? selectedId : "";
  } catch {
    centers = sampleCenters;
    selectedId = "";
  }
}

async function loadPublicConfig() {
  try {
    const response = await fetch(`${API_BASE}/api/config`, {
      headers: { "X-Movemap-Client": "web" },
    });
    if (!response.ok) throw new Error("config unavailable");
    publicConfig = await response.json();
  } catch {
    publicConfig = {
      naverMapNcpKeyId: "",
      auth: { supabaseUrl: "", supabaseAnonKey: "", providers: {} },
      mobileApps: { iosAppStoreUrl: "", googlePlayStoreUrl: "" },
    };
  }
}

function configureMobileDownloadLinks() {
  const storeLinks = [
    { element: document.querySelector("#iosStoreLink"), url: publicConfig.mobileApps?.iosAppStoreUrl },
    { element: document.querySelector("#androidStoreLink"), url: publicConfig.mobileApps?.googlePlayStoreUrl },
  ];

  storeLinks.forEach(({ element, url }) => {
    if (!element) return;
    const isAvailable = Boolean(url);
    element.href = isAvailable ? url : "#app";
    element.setAttribute("aria-disabled", String(!isAvailable));
    if (isAvailable) {
      element.target = "_blank";
      element.rel = "noopener noreferrer";
    } else {
      element.removeAttribute("target");
      element.removeAttribute("rel");
    }
  });
}

document.querySelectorAll("[data-store-platform]").forEach((link) => {
  link.addEventListener("click", (event) => {
    if (link.getAttribute("aria-disabled") !== "true") return;
    event.preventDefault();
    const message = document.querySelector("#appDownloadMessage");
    if (message) message.textContent = "스토어 등록이 완료되면 이 버튼에서 바로 다운로드할 수 있습니다.";
  });
});

function clientIdempotencyKey() {
  return window.crypto?.randomUUID
    ? window.crypto.randomUUID()
    : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (character) => {
      const value = Math.floor(Math.random() * 16);
      return (character === "x" ? value : (value & 0x3) | 0x8).toString(16);
    });
}

async function trackEvent(type, centerId, detail = "") {
  const session = await activeAuthSession().catch(() => null);
  fetch(`${API_BASE}/api/events`, {
    method: "POST",
    headers: {
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      "Content-Type": "application/json",
      "X-Movemap-Client": "web",
      "X-DAIL-Source": "web",
      "Idempotency-Key": clientIdempotencyKey(),
    },
    body: JSON.stringify({
      type,
      centerId,
      detail,
      source: "web",
    }),
  }).catch(() => {});
}

function clearCenterFocusTimers() {
  centerFocusTimers.forEach((timer) => window.clearTimeout(timer));
  centerFocusTimers = [];
}

function queueCenterFocusStep(callback, delay) {
  const timer = window.setTimeout(() => {
    centerFocusTimers = centerFocusTimers.filter((item) => item !== timer);
    callback();
  }, delay);
  centerFocusTimers.push(timer);
}

function setMapGesturesEnabled(enabled) {
  if (!naverMap?.setOptions) return;
  naverMap.setOptions({
    draggable: enabled,
    scrollWheel: enabled,
    pinchZoom: enabled,
    keyboardShortcuts: enabled,
  });
}

function isolatePanelGesturesFromMap() {
  const panels = [sidebarPanel, detailPanel].filter(Boolean);
  const startGesture = (event) => {
    event.stopPropagation();
    panelGestureActive = true;
    setMapGesturesEnabled(false);
  };
  const keepGestureInsidePanel = (event) => {
    event.stopPropagation();
  };
  const endGesture = () => {
    panelGestureActive = false;
    setMapGesturesEnabled(true);
  };

  panels.forEach((panel) => {
    ["pointerdown", "mousedown", "touchstart", "wheel"].forEach((type) => {
      panel.addEventListener(type, startGesture, { passive: true });
    });
    ["pointermove", "mousemove", "touchmove"].forEach((type) => {
      panel.addEventListener(type, keepGestureInsidePanel, { passive: true });
    });
    ["pointerenter", "mouseenter", "focusin"].forEach((type) => {
      panel.addEventListener(type, () => setMapGesturesEnabled(false));
    });
    ["pointerleave", "mouseleave", "focusout"].forEach((type) => {
      panel.addEventListener(type, () => {
        if (!panelGestureActive) setMapGesturesEnabled(true);
      });
    });
  });

  ["pointerup", "mouseup", "touchend", "touchcancel"].forEach((type) => {
    window.addEventListener(type, endGesture, { passive: true });
  });
}

function matchesFilters(center) {
  const query = searchInput.value.trim().toLowerCase();
  const selectedTags = [...checkboxes].filter((box) => box.checked).map((box) => box.value);
  const text = [center.name, center.area, center.lead, center.tags.join(" "), center.categories.join(" ")].join(" ").toLowerCase();
  const regionMatch = selectedRegion === "all" || center.region === selectedRegion;
  const areaMatch = !areaSelect || areaSelect.value === "all" || center.area.includes(areaSelect.value);
  const queryMatch = !query || text.includes(query);
  const tagMatch = selectedTags.length === 0 || selectedTags.some((tag) => center.tags.includes(tag));
  const categoryMatch = !selectedCategory || center.categories.includes(selectedCategory);

  return regionMatch && areaMatch && queryMatch && tagMatch && categoryMatch;
}

function renderList() {
  const filtered = centers.filter(matchesFilters);
  resultCount.textContent = `${filtered.length}곳`;

  const selectedTags = [...checkboxes].filter((box) => box.checked).map((box) => box.value);
  const filterLabels = [
    searchInput.value.trim() && `검색: ${searchInput.value.trim()}`,
    selectedRegion !== "all" && document.querySelector(`[data-region="${selectedRegion}"]`)?.textContent.trim(),
    areaSelect?.value !== "all" && areaSelect.value,
    selectedCategory,
    ...selectedTags,
  ].filter(Boolean);
  activeFilters.innerHTML = filterLabels.length
    ? `<span>적용된 조건</span>${filterLabels.map((label) => `<b>${escapeHtml(label)}</b>`).join("")}<button id="resetFiltersButton" type="button">모두 지우기</button>`
    : `<span>센터명·지역·불편한 부위로 검색해보세요.</span>`;

  centerList.innerHTML = filtered
    .map(
      (center) => `
        <button class="center-card ${center.id === selectedId ? "active" : ""}" type="button" data-card-id="${center.id}">
          <div class="card-top">
            <div>
              <span class="badge badge-pt icon-label">${uiIcon("badge-check")}물리치료사 출신</span>
              <h3>${escapeHtml(center.name)}</h3>
              <p>${escapeHtml(center.lead)}</p>
            </div>
            <span class="favorite" aria-hidden="true">${uiIcon("heart")}</span>
          </div>
          <div class="meta-row">
            <span>${escapeHtml(center.area)}</span>
            <span>${escapeHtml(center.distance)}</span>
            <span class="rating icon-label">${uiIcon("star", "is-filled")}${escapeHtml(center.rating)}</span>
          </div>
          <div class="card-tags">${[...center.categories,...center.tags].slice(0, 3).map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}</div>
          <span class="card-cta icon-label">센터 상세 보기 ${uiIcon("arrow-right")}</span>
        </button>
      `
    )
    .join("") || `<div class="empty-state"><strong>조건에 맞는 센터를 찾지 못했어요.</strong><span>지역을 넓히거나 조건을 지우면 더 많은 센터를 볼 수 있습니다.</span><button id="emptyResetButton" type="button">검색 조건 초기화</button></div>`;

  const resetFilters = () => {
    searchInput.value = "";
    selectedRegion = "all";
    selectedCategory = "";
    if (areaSelect) areaSelect.value = "all";
    checkboxes.forEach((box) => { box.checked = false; });
    regionButtons.forEach((button) => button.classList.toggle("active", button.dataset.region === "all"));
    renderList();
  };
  document.querySelector("#resetFiltersButton")?.addEventListener("click", resetFilters);
  document.querySelector("#emptyResetButton")?.addEventListener("click", resetFilters);

  document.querySelectorAll("[data-card-id]").forEach((card) => {
    card.addEventListener("click", () => openCenterDetail(card.dataset.cardId));
  });

  if (selectedId && !filtered.some((center) => center.id === selectedId)) {
    clearSelectedCenter();
  }
}

function renderDetail() {
  const center = centers.find((item) => item.id === selectedId);
  if (!center) {
    detailPanel.hidden = true;
    detailPanel.innerHTML = "";
    document.body.classList.remove("detail-open");
    return;
  }

  detailPanel.hidden = false;
  document.body.classList.add("detail-open");
  detailPanel.innerHTML = centerPopupContent(center);
  detailPanel.querySelector(".map-popup-close").addEventListener("click", clearSelectedCenter);
}

async function loadCenterReviews(centerId) {
  const list = detailPanel.querySelector("#reviewList");
  if (!list) return;
  try {
    const response = await fetch(`${API_BASE}/api/reviews?centerId=${encodeURIComponent(centerId)}`);
    const data = await response.json();
    if (!response.ok) throw new Error();
    list.innerHTML = data.reviews.map((review) => `<article><strong class="review-title"><span class="stars">${ratingIcons(review.rating)}</span><span>${escapeHtml(review.nickname)}</span></strong><p>${escapeHtml(review.content)}</p><small>${new Date(review.created_at).toLocaleDateString("ko-KR")}</small></article>`).join("") || "<p>첫 후기를 남겨주세요.</p>";
  } catch { list.innerHTML = "<p>후기를 불러오지 못했습니다.</p>"; }
}

async function submitReview(event, centerId) {
  event.preventDefault();
  const form = event.currentTarget;
  const message = form.querySelector(".review-message");
  const values = new FormData(form);
  const session = await activeAuthSession();
  if (!session) {
    message.textContent = "후기는 로그인한 이용자만 작성할 수 있습니다.";
    openAuth("login");
    return;
  }
  const idempotencyKey = clientIdempotencyKey();
  const response = await fetch(`${API_BASE}/api/reviews`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
      "X-DAIL-Source": "web",
    },
    body: JSON.stringify({
      centerId,
      rating: Number(values.get("rating")),
      content: values.get("content"),
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) { message.textContent = data.error || "후기 등록에 실패했습니다."; return; }
  form.reset(); message.textContent = data.message || "후기가 검토 대기 상태로 접수되었습니다.";
}

function openCenterDetail(id) {
  detailPanel.hidden = true;
  detailPanel.innerHTML = "";
  selectCenter(id, { openDetail: true });
}

function centerPopupContent(center) {
  return `<article class="map-popup">
    <button class="map-popup-close icon-only" type="button" aria-label="닫기" onclick="window.closeDailMapPopup()">${uiIcon("x")}</button>
    <div class="map-popup-heading"><h3>${escapeHtml(center.name)}</h3><span class="map-popup-distance">${escapeHtml(center.distance)}</span></div>
    <p class="map-popup-category">운동센터 · <b>물리치료사 출신</b></p>
    <p class="map-popup-location">${escapeHtml(center.area)}</p>
    <div class="map-popup-tags">${center.tags.slice(0,2).map(tag=>`<span>${escapeHtml(tag)}</span>`).join("")}</div>
    <div class="map-popup-actions"><button class="map-popup-cta icon-label" type="button" onclick="window.openDailCenterSheet('${escapeHtml(center.id)}')">상세보기 ${uiIcon("arrow-right")}</button><button class="map-popup-route icon-label" type="button" onclick="window.openDailRouteSheet('${escapeHtml(center.id)}')">${uiIcon("map-pin")}길찾기</button></div>
  </article>`;
}

function safeExternalUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function centerExperienceTags(center) {
  return [...new Set([...(center.categories || []), ...(center.tags || [])])].filter(Boolean);
}

function centerPhotoMarkup(center) {
  const photos = center.photoUrls?.length ? center.photoUrls : (center.photoUrl ? [center.photoUrl] : []);
  if (!photos.length) {
    return `<div class="center-sheet-hero center-sheet-hero-placeholder">
      <span class="center-sheet-hero-mark" aria-hidden="true"><i></i> DAIL</span>
      <div><b>센터가 등록한 정보</b><span>${escapeHtml(center.name)}</span></div>
    </div>`;
  }
  return `<div class="center-sheet-gallery" aria-label="센터 사진">
    ${photos.slice(0, 4).map((photo, index) => `<img src="${escapeHtml(photo)}" alt="${escapeHtml(center.name)} 센터 사진 ${index + 1}" loading="lazy" />`).join("")}
  </div>`;
}

function isFavoriteCenter(centerId) {
  try {
    return JSON.parse(localStorage.getItem("dail_favorite_centers") || "[]").includes(centerId);
  } catch {
    return false;
  }
}

function toggleFavoriteCenter(centerId) {
  let favorites = [];
  try {
    favorites = JSON.parse(localStorage.getItem("dail_favorite_centers") || "[]");
  } catch {
    favorites = [];
  }
  favorites = favorites.includes(centerId)
    ? favorites.filter((id) => id !== centerId)
    : [...favorites, centerId];
  localStorage.setItem("dail_favorite_centers", JSON.stringify(favorites));
  const button = centerExperienceContent?.querySelector("[data-center-favorite]");
  if (button) {
    const saved = favorites.includes(centerId);
    button.classList.toggle("is-saved", saved);
    button.setAttribute("aria-pressed", String(saved));
    button.querySelector("span").textContent = saved ? "저장됨" : "관심 저장";
  }
}

function renderCenterExperienceDetail(center) {
  const tags = centerExperienceTags(center);
  const website = safeExternalUrl(center.website);
  const phoneLink = String(center.phone || "").replace(/[^\d+]/g, "");
  const saved = isFavoriteCenter(center.id);
  centerExperienceView = "detail";
  centerExperienceContent.innerHTML = `
    <header class="center-sheet-header">
      <div><span>센터 상세</span><strong id="centerExperienceTitle">센터 정보</strong></div>
      <button class="center-sheet-close icon-only" type="button" data-center-sheet-close aria-label="센터 상세 닫기">${uiIcon("x")}</button>
    </header>
    <div class="center-sheet-scroll">
      ${centerPhotoMarkup(center)}
      <section class="center-sheet-summary">
        <span class="center-sheet-badge icon-label">${uiIcon("badge-check")} 물리치료사 출신</span>
        <h2>${escapeHtml(center.name)}</h2>
        <p class="center-sheet-rating"><span class="stars">${ratingIcons(center.rating)}</span><b>${escapeHtml(center.rating)}</b><span>후기 ${escapeHtml(center.reviews)}개</span><i></i><span>${escapeHtml(center.distance)}</span></p>
        <p class="center-sheet-address icon-label">${uiIcon("map-pin")}<span>${escapeHtml(center.address || center.area)}</span></p>
      </section>
      <nav class="center-sheet-quick-actions" aria-label="센터 빠른 메뉴">
        <button type="button" data-center-route>${uiIcon("map-pin")}<span>길찾기</span></button>
        <button type="button" data-center-phone ${phoneLink ? "" : "disabled"}>${uiIcon("phone-call")}<span>${phoneLink ? "전화" : "전화 준비중"}</span></button>
        <button type="button" data-center-favorite class="${saved ? "is-saved" : ""}" aria-pressed="${saved}">${uiIcon("heart")}<span>${saved ? "저장됨" : "관심 저장"}</span></button>
      </nav>
      <section class="center-sheet-section">
        <p class="center-sheet-kicker">센터 소개</p>
        <h3>어떤 운동을 받을 수 있나요?</h3>
        <p class="center-sheet-description">${escapeHtml(center.lead)}</p>
        <div class="center-program-tags">${tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}</div>
      </section>
      <section class="center-sheet-section">
        <p class="center-sheet-kicker">센터장 정보</p>
        <div class="center-operator-card">
          <span class="center-operator-avatar" aria-hidden="true">${uiIcon("user-cog")}</span>
          <div><strong>${escapeHtml(center.therapist)}</strong><span class="icon-label">${uiIcon("badge-check")} 출신 정보 확인</span></div>
        </div>
      </section>
      <section class="center-sheet-section">
        <p class="center-sheet-kicker">이용 안내</p>
        <h3>방문 전에 확인하세요</h3>
        <dl class="center-info-list">
          <div><dt>이용 금액</dt><dd>${escapeHtml(center.price)}</dd></div>
          <div><dt>운영 시간</dt><dd>${escapeHtml(center.openingHours)}</dd></div>
          <div><dt>주소</dt><dd>${escapeHtml(center.address || center.area)}</dd></div>
          ${center.phone ? `<div><dt>전화</dt><dd>${escapeHtml(center.phone)}</dd></div>` : ""}
          ${website ? `<div><dt>웹사이트</dt><dd><a href="${escapeHtml(website)}" target="_blank" rel="noopener noreferrer">센터 사이트 열기 ${uiIcon("external-link")}</a></dd></div>` : ""}
        </dl>
      </section>
      <section class="center-sheet-section">
        <div class="center-review-heading"><div><p class="center-sheet-kicker">이용 후기</p><h3>방문자가 남긴 후기</h3></div><span>${escapeHtml(center.reviews)}개</span></div>
        <div id="centerSheetReviewList" class="center-sheet-reviews"><p class="center-sheet-loading">후기를 불러오는 중입니다.</p></div>
      </section>
    </div>
    <footer class="center-sheet-footer">
      <button class="center-sheet-route-button icon-label" type="button" data-center-route>${uiIcon("map-pin")} 길찾기</button>
      ${phoneLink
        ? `<a class="center-sheet-contact-button icon-label" href="tel:${escapeHtml(phoneLink)}" data-center-contact>${uiIcon("phone-call")} 전화 상담</a>`
        : `<button class="center-sheet-contact-button" type="button" disabled>전화번호 등록 전</button>`}
    </footer>`;

  centerExperienceContent.querySelectorAll("[data-center-sheet-close]").forEach((button) => button.addEventListener("click", closeCenterExperience));
  centerExperienceContent.querySelectorAll("[data-center-route]").forEach((button) => button.addEventListener("click", () => renderCenterExperienceRoute(center)));
  centerExperienceContent.querySelector("[data-center-favorite]")?.addEventListener("click", () => toggleFavoriteCenter(center.id));
  centerExperienceContent.querySelector("[data-center-phone]")?.addEventListener("click", () => {
    if (!phoneLink) return;
    trackEvent("contact_click", center.id, "phone_sheet");
    window.location.href = `tel:${phoneLink}`;
  });
  centerExperienceContent.querySelector("[data-center-contact]")?.addEventListener("click", () => trackEvent("contact_click", center.id, "phone_sheet"));
  loadCenterSheetReviews(center.id);
}

async function loadCenterSheetReviews(centerId) {
  const list = centerExperienceContent?.querySelector("#centerSheetReviewList");
  if (!list) return;
  try {
    const response = await fetch(`${API_BASE}/api/reviews?centerId=${encodeURIComponent(centerId)}`);
    const data = await response.json();
    if (!response.ok) throw new Error();
    list.innerHTML = data.reviews?.length
      ? data.reviews.slice(0, 4).map((review) => `<article>
          <div><strong>${escapeHtml(review.nickname)}</strong><span class="stars">${ratingIcons(review.rating)}</span></div>
          <p>${escapeHtml(review.content)}</p>
          <time>${new Date(review.created_at).toLocaleDateString("ko-KR")}</time>
        </article>`).join("")
      : `<div class="center-sheet-empty"><span>${uiIcon("message-circle")}</span><strong>아직 등록된 후기가 없어요</strong><p>센터 정보를 확인하고 방문 후 첫 후기를 남겨보세요.</p></div>`;
  } catch {
    list.innerHTML = `<p class="center-sheet-loading">후기를 불러오지 못했습니다. 잠시 후 다시 확인해 주세요.</p>`;
  }
}

function haversineDistanceKm(origin, destination) {
  const toRadians = (degrees) => degrees * Math.PI / 180;
  const earthRadiusKm = 6371;
  const latitudeDistance = toRadians(destination.lat - origin.lat);
  const longitudeDistance = toRadians(destination.lng - origin.lng);
  const a = Math.sin(latitudeDistance / 2) ** 2
    + Math.cos(toRadians(origin.lat)) * Math.cos(toRadians(destination.lat))
    * Math.sin(longitudeDistance / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function routeEstimate(mode, distanceKm) {
  const speed = mode === "walk" ? 4.5 : mode === "car" ? 28 : 18;
  const minutes = Math.max(1, Math.round((distanceKm / speed) * 60));
  if (minutes < 60) return `약 ${minutes}분`;
  return `약 ${Math.floor(minutes / 60)}시간 ${minutes % 60}분`;
}

function routeModeLabel(mode) {
  return mode === "walk" ? "도보" : mode === "car" ? "자동차" : "대중교통";
}

function naverSearchUrl(center) {
  return safeExternalUrl(center.naverMapUrl)
    || `https://map.naver.com/p/search/${encodeURIComponent(center.address || center.name)}`;
}

function naverRouteScheme(center) {
  const modePath = routeMode === "walk" ? "walk" : routeMode === "car" ? "car" : "public";
  const params = new URLSearchParams({
    dlat: String(center.lat),
    dlng: String(center.lng),
    dname: center.name,
    appname: "com.movemap.app",
  });
  if (routeOrigin) {
    params.set("slat", String(routeOrigin.lat));
    params.set("slng", String(routeOrigin.lng));
    params.set("sname", "내 위치");
  }
  return `nmap://route/${modePath}?${params.toString()}`;
}

function renderRouteSummary(center) {
  const summary = centerExperienceContent?.querySelector("#routeSummary");
  if (!summary) return;
  if (!routeOrigin) {
    summary.innerHTML = `<div class="route-summary-placeholder">${uiIcon("locate")}<div><strong>현재 위치를 사용하면 예상 거리를 볼 수 있어요</strong><span>위치 정보는 길찾기 화면에서만 사용합니다.</span></div></div>`;
    return;
  }
  const distanceKm = haversineDistanceKm(routeOrigin, center);
  summary.innerHTML = `<div class="route-summary-result">
    <div><span>${routeModeLabel(routeMode)} 참고 시간</span><strong>${routeEstimate(routeMode, distanceKm)}</strong></div>
    <div><span>직선거리</span><strong>${distanceKm < 1 ? `${Math.round(distanceKm * 1000)}m` : `${distanceKm.toFixed(1)}km`}</strong></div>
  </div><p>${uiIcon("info")} 실제 경로·교통 상황이 반영되지 않은 참고값입니다. 정확한 안내는 네이버 지도에서 확인하세요.</p>`;
}

function mountRouteMiniMap(center) {
  const element = centerExperienceContent?.querySelector("#routeMiniMap");
  if (!element) return;
  if (!window.naver?.maps) {
    element.innerHTML = `<div class="route-map-fallback">${uiIcon("map-pin")}<span>${escapeHtml(center.address || center.area)}</span></div>`;
    return;
  }
  const position = new naver.maps.LatLng(center.lat, center.lng);
  routeMiniMap = new naver.maps.Map(element, {
    center: position,
    zoom: 15,
    zoomControl: false,
    mapDataControl: false,
    scaleControl: false,
    logoControlOptions: { position: naver.maps.Position.BOTTOM_LEFT },
  });
  routeMiniMarker = new naver.maps.Marker({
    position,
    map: routeMiniMap,
    icon: createMarkerIcon(true, center),
  });
}

function useCurrentLocationForRoute(center) {
  const button = centerExperienceContent?.querySelector("[data-route-location]");
  const status = centerExperienceContent?.querySelector("#routeLocationStatus");
  if (!navigator.geolocation) {
    if (status) status.textContent = "이 브라우저에서는 현재 위치를 사용할 수 없습니다.";
    return;
  }
  if (button) button.disabled = true;
  if (status) status.textContent = "현재 위치를 확인하고 있습니다…";
  navigator.geolocation.getCurrentPosition(
    (position) => {
      routeOrigin = { lat: position.coords.latitude, lng: position.coords.longitude };
      renderCenterExperienceRoute(center);
    },
    () => {
      if (button) button.disabled = false;
      if (status) status.textContent = "위치 권한을 허용하면 현재 위치에서 길을 찾을 수 있습니다.";
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
  );
}

function openNaverRoute(center) {
  trackEvent("contact_click", center.id, "route_sheet");
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (isMobile) {
    window.location.href = naverRouteScheme(center);
    return;
  }
  window.open(naverSearchUrl(center), "_blank", "noopener,noreferrer");
}

function renderCenterExperienceRoute(center) {
  centerExperienceView = "route";
  centerExperienceContent.innerHTML = `
    <header class="center-sheet-header">
      <button class="center-sheet-back icon-only" type="button" data-route-back aria-label="센터 상세로 돌아가기">${uiIcon("arrow-left")}</button>
      <div><span>지도에서 바로 확인</span><strong id="centerExperienceTitle">길찾기</strong></div>
      <button class="center-sheet-close icon-only" type="button" data-center-sheet-close aria-label="길찾기 닫기">${uiIcon("x")}</button>
    </header>
    <div class="center-sheet-scroll route-sheet-scroll">
      <div id="routeMiniMap" class="route-mini-map" aria-label="${escapeHtml(center.name)} 위치 지도"></div>
      <section class="route-destination-card">
        <div class="route-point">
          <i class="route-point-start"></i>
          <div><span>출발</span><strong>${routeOrigin ? "내 현재 위치" : "현재 위치를 설정해 주세요"}</strong></div>
          <button type="button" data-route-location>${uiIcon("locate")} ${routeOrigin ? "다시 찾기" : "현재 위치 사용"}</button>
        </div>
        <div class="route-line" aria-hidden="true"></div>
        <div class="route-point">
          <i class="route-point-end"></i>
          <div><span>도착</span><strong>${escapeHtml(center.name)}</strong><small>${escapeHtml(center.address || center.area)}</small></div>
        </div>
      </section>
      <p id="routeLocationStatus" class="route-location-status">${routeOrigin ? "현재 위치가 설정되었습니다." : "위치 권한은 버튼을 누를 때만 요청합니다."}</p>
      <section class="route-mode-section">
        <p class="center-sheet-kicker">이동 수단</p>
        <div class="route-mode-tabs" role="tablist" aria-label="이동 수단 선택">
          ${[
            ["public", "대중교통"],
            ["car", "자동차"],
            ["walk", "도보"],
          ].map(([mode, label]) => `<button type="button" role="tab" data-route-mode="${mode}" aria-selected="${routeMode === mode}" class="${routeMode === mode ? "active" : ""}">${label}</button>`).join("")}
        </div>
      </section>
      <section id="routeSummary" class="route-summary"></section>
      <section class="route-guide-card">
        <span>${uiIcon("info")}</span>
        <div><strong>정확한 경로는 네이버 지도에서 안내합니다</strong><p>DAIL에서는 센터 위치와 기본 정보를 확인하고, 외부 지도에서 실시간 교통과 도보 경로를 이어서 볼 수 있어요.</p></div>
      </section>
    </div>
    <footer class="center-sheet-footer route-sheet-footer">
      <button class="center-sheet-contact-button route-external-button icon-label" type="button" data-route-external>네이버 지도에서 길찾기 ${uiIcon("external-link")}</button>
    </footer>`;

  centerExperienceContent.querySelector("[data-route-back]")?.addEventListener("click", () => renderCenterExperienceDetail(center));
  centerExperienceContent.querySelector("[data-center-sheet-close]")?.addEventListener("click", closeCenterExperience);
  centerExperienceContent.querySelector("[data-route-location]")?.addEventListener("click", () => useCurrentLocationForRoute(center));
  centerExperienceContent.querySelectorAll("[data-route-mode]").forEach((button) => button.addEventListener("click", () => {
    routeMode = button.dataset.routeMode;
    renderCenterExperienceRoute(center);
  }));
  centerExperienceContent.querySelector("[data-route-external]")?.addEventListener("click", () => openNaverRoute(center));
  renderRouteSummary(center);
  window.requestAnimationFrame(() => mountRouteMiniMap(center));
}

let centerExperienceCloseTimer = null;
function openCenterExperience(id, view = "detail") {
  const center = centers.find((item) => item.id === id);
  if (!center || !centerExperienceOverlay || !centerExperienceContent) return;
  window.clearTimeout(centerExperienceCloseTimer);
  centerExperienceId = id;
  centerExperienceView = view;
  if (view === "detail") {
    routeOrigin = null;
    routeMode = "public";
  }
  centerExperienceOverlay.hidden = false;
  document.body.classList.add("center-experience-open");
  window.requestAnimationFrame(() => centerExperienceOverlay.classList.add("is-visible"));
  if (view === "route") renderCenterExperienceRoute(center);
  else {
    renderCenterExperienceDetail(center);
    trackEvent("center_view", center.id, "detail_sheet");
  }
  centerExperienceSheet.scrollTop = 0;
  window.setTimeout(() => centerExperienceContent.querySelector(".center-sheet-close")?.focus(), 50);
}

function closeCenterExperience() {
  if (!centerExperienceOverlay || centerExperienceOverlay.hidden) return;
  centerExperienceOverlay.classList.remove("is-visible");
  document.body.classList.remove("center-experience-open");
  centerExperienceCloseTimer = window.setTimeout(() => {
    centerExperienceOverlay.hidden = true;
    centerExperienceContent.innerHTML = "";
    centerExperienceId = "";
    centerExperienceView = "detail";
    routeOrigin = null;
    routeMiniMap = null;
    routeMiniMarker = null;
  }, 180);
}

function showCenterInfoWindow(center) {
  if (!naverMap || !center) return;
  centerInfoWindow?.close();
  centerInfoWindow = new naver.maps.InfoWindow({
    content: centerPopupContent(center),
    borderWidth: 0,
    backgroundColor: "transparent",
    disableAnchor: false,
    anchorColor: "#ffffff",
    anchorSize: new naver.maps.Size(14, 10),
    pixelOffset: new naver.maps.Point(0, -12),
  });
  const markerItem = naverMarkers.find(item => item.center.id === center.id);
  centerInfoWindow.open(naverMap, markerItem?.marker || new naver.maps.LatLng(center.lat, center.lng));
}

window.closeDailMapPopup = clearSelectedCenter;
window.openDailCenterSheet = id => openCenterExperience(id, "detail");
window.openDailRouteSheet = id => openCenterExperience(id, "route");
centerExperienceScrim?.addEventListener("click", closeCenterExperience);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && centerExperienceOverlay && !centerExperienceOverlay.hidden) {
    closeCenterExperience();
  }
});

function renderPins() {
  document.querySelectorAll(".pin").forEach((pin) => {
    pin.classList.toggle("selected", pin.dataset.id === selectedId);
  });

  naverMarkers.forEach(({ marker, center }) => {
    const isSelected = center.id === selectedId;
    marker.setIcon(createMarkerIcon(isSelected, center));
    marker.setZIndex(isSelected ? 1000 : 100);
  });
}

function shouldShowIndividualMarkers() {
  return (
    !naverMap ||
    naverMap.getZoom() >= CENTER_MARKER_MIN_ZOOM ||
    Boolean(selectedId) ||
    naverMap.__forceIndividualMarkers
  );
}

function markerCellSizeForZoom(zoom) {
  if (zoom <= 8) return 2.2;
  if (zoom <= 10) return 1.0;
  if (zoom <= 12) return 0.35;
  return 0.12;
}

function groupCentersForZoom() {
  const cellSize = markerCellSizeForZoom(naverMap.getZoom());
  const groups = new Map();

  centers.forEach((center) => {
    const key = `${Math.floor(center.lat / cellSize)}:${Math.floor(center.lng / cellSize)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(center);
  });

  return [...groups.values()];
}

function createClusterIcon(count, isOpening = false) {
  const size = count >= 10 ? 62 : 56;
  return {
    content: `<button class="cluster-marker ${count >= 10 ? "large" : ""} ${isOpening ? "is-opening" : ""}" type="button" aria-label="${count}개 센터 보기"><strong>${count}</strong><span>센터</span></button>`,
    size: new naver.maps.Size(size, size),
    anchor: new naver.maps.Point(size / 2, size / 2),
  };
}

function clusterCenter(group) {
  const lat = group.reduce((sum, center) => sum + center.lat, 0) / group.length;
  const lng = group.reduce((sum, center) => sum + center.lng, 0) / group.length;
  return new naver.maps.LatLng(lat, lng);
}

function targetZoomForCluster(group) {
  const latValues = group.map((center) => center.lat);
  const lngValues = group.map((center) => center.lng);
  const latSpan = Math.max(...latValues) - Math.min(...latValues);
  const lngSpan = Math.max(...lngValues) - Math.min(...lngValues);
  const span = Math.max(latSpan, lngSpan);

  if (span > 1.2) return 8;
  if (span > 0.45) return 10;
  if (span > 0.16) return 11;
  if (span > 0.06) return 12;
  return CENTER_MARKER_MIN_ZOOM;
}

function animateClusterZoom(group) {
  const targetCenter = clusterCenter(group);
  const targetZoom = Math.min(
    CENTER_MARKER_MIN_ZOOM,
    Math.max(naverMap.getZoom() + 2, targetZoomForCluster(group))
  );
  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  const duration = reduceMotion ? 0 : 680;
  const mapArea = mapElement.closest(".map-area");

  window.clearTimeout(clusterTransitionTimer);
  window.clearTimeout(markerRevealTimer);
  naverMap.stop?.();
  naverMap.__forceIndividualMarkers = false;
  naverMap.__clusterAnimating = true;
  mapArea?.classList.remove("is-revealing-centers");
  mapArea?.classList.add("is-cluster-transitioning");
  mapStatus.textContent = "선택한 지역으로 이동 중";

  if (duration && typeof naverMap.morph === "function") {
    naverMap.morph(targetCenter, targetZoom, {
      duration,
      easing: "easeOutCubic",
    });
  } else {
    naverMap.setCenter(targetCenter);
    naverMap.setZoom(targetZoom, true);
  }

  clusterTransitionTimer = window.setTimeout(() => {
    naverMap.__clusterAnimating = false;
    naverMap.__forceIndividualMarkers = true;
    mapArea?.classList.remove("is-cluster-transitioning");
    mapArea?.classList.add("is-revealing-centers");
    syncMarkerVisibility();
    markerRevealTimer = window.setTimeout(() => {
      mapArea?.classList.remove("is-revealing-centers");
    }, 380);
  }, duration + 90);
}

function zoomToCluster(group) {
  selectedId = "";
  renderDetail();
  renderPins();
  renderList();
  animateClusterZoom(group);
}

function clearClusterMarkers() {
  clusterMarkers.forEach((marker) => marker.setMap(null));
  clusterMarkers = [];
}

function rebuildClusterMarkers() {
  clearClusterMarkers();

  groupCentersForZoom().forEach((group) => {
    const position = clusterCenter(group);
    const marker = new naver.maps.Marker({
      position,
      map: naverMap,
      title: `${group.length}개 센터`,
      icon: createClusterIcon(group.length),
    });

    naver.maps.Event.addListener(marker, "click", (event) => {
      marker.setIcon(createClusterIcon(group.length, true));
      zoomToCluster(group);
      event?.domEvent?.stopPropagation?.();
    });

    clusterMarkers.push(marker);
  });
}

function syncMarkerVisibility() {
  if (naverMap?.__clusterAnimating) return;

  const showIndividuals = shouldShowIndividualMarkers();
  naverMarkers.forEach(({ marker }) => {
    marker.setMap(showIndividuals ? naverMap : null);
  });

  if (showIndividuals) {
    clearClusterMarkers();
  } else {
    rebuildClusterMarkers();
  }

  mapStatus.textContent = showIndividuals
    ? "센터 표시 중"
    : "숫자를 누르거나 확대하면 센터가 표시됩니다";
}

function handleMapZoomChanged() {
  if (naverMap.__clusterAnimating) return;

  if (naverMap.getZoom() < CENTER_MARKER_MIN_ZOOM) {
    selectedId = "";
    renderDetail();
    renderPins();
  }

  naverMap.__forceIndividualMarkers = false;
  syncMarkerVisibility();
}

function rebuildNaverMarkers() {
  naverMarkers.forEach(({ marker }) => marker.setMap(null));
  clearClusterMarkers();
  naverMarkers = centers.map((center) => {
    const marker = new naver.maps.Marker({
      position: new naver.maps.LatLng(center.lat, center.lng),
      map: naverMap,
      title: center.name,
      icon: createMarkerIcon(center.id === selectedId, center),
      zIndex: center.id === selectedId ? 1000 : 100,
    });

    naver.maps.Event.addListener(marker, "click", (event) => {
      openCenterDetail(center.id);
      event?.domEvent?.stopPropagation?.();
    });
    return { marker, center };
  });
  syncMarkerVisibility();
}

function clearSelectedCenter() {
  if (!selectedId && detailPanel.hidden) return;
  selectedId = "";
  centerInfoWindow?.close();
  renderDetail();
  renderPins();
  renderList();
  syncMarkerVisibility();
}

function selectCenter(id, options = {}) {
  selectedId = id;
  if (options.openDetail) {
    renderDetail();
  }
  renderPins();
  renderList();
  if (lastTrackedViewId !== id) {
    trackEvent("center_view", id, "select_center");
    lastTrackedViewId = id;
  }

  const center = centers.find((item) => item.id === id);
  if (naverMap && center) {
    const position = new naver.maps.LatLng(center.lat, center.lng);
    const targetZoom = options.openDetail || options.showPopup ? CENTER_DETAIL_ZOOM : CENTER_MARKER_MIN_ZOOM;
    clearCenterFocusTimers();
    naverMap.__forceIndividualMarkers = true;
    naverMap.__clusterAnimating = true;
    clearClusterMarkers();
    naverMap.setZoom(Math.max(naverMap.getZoom(), targetZoom), true);
    naverMap.setCenter(position);
    queueCenterFocusStep(() => {
      naverMap.setCenter(position);
    }, 120);
    queueCenterFocusStep(() => {
      naverMap.setCenter(position);
      renderPins();
      if (options.showPopup) showCenterInfoWindow(center);
      naverMap.__clusterAnimating = false;
      naverMap.__forceIndividualMarkers = true;
      syncMarkerVisibility();
    }, 360);
  }
  syncMarkerVisibility();
}

function renderHeroCenterMarkers() {
  heroCenterMarkers.forEach(marker => marker.setMap(null));
  heroCenterMarkers = centers.slice(0, 5).map(center => {
    const marker = new naver.maps.Marker({position:new naver.maps.LatLng(center.lat,center.lng),map:heroMap,title:center.name,icon:createMarkerIcon(false,center)});
    naver.maps.Event.addListener(marker,"click",()=>{document.querySelector("#search").scrollIntoView({behavior:"smooth"});window.setTimeout(()=>openCenterDetail(center.id),500)});
    return marker;
  });
}

function locateHeroMap() {
  if (!heroMap || !navigator.geolocation) return;
  heroMapStatus.innerHTML = '<span class="status-pulse"></span> 현재 위치를 확인하고 있어요';
  navigator.geolocation.getCurrentPosition(position=>{
    const point=new naver.maps.LatLng(position.coords.latitude,position.coords.longitude);
    heroMap.setCenter(point);heroMap.setZoom(14,true);
    heroUserMarker?.setMap(null);
    heroUserMarker=new naver.maps.Marker({position:point,map:heroMap,title:"현재 위치",icon:createUserMarkerIcon()});
    heroMapStatus.textContent="현재 위치 주변 센터";
  },()=>{heroMapStatus.textContent="위치 권한을 허용하면 내 주변에서 시작합니다"},{enableHighAccuracy:true,timeout:7000,maximumAge:120000});
}

function initHeroMap() {
  if (!heroMapElement || !window.naver?.maps) return;
  heroMap=new naver.maps.Map(heroMapElement,{center:new naver.maps.LatLng(37.5036,127.0247),zoom:12,minZoom:8,mapTypeId:naver.maps.MapTypeId.NORMAL,scaleControl:false,logoControl:true,mapDataControl:false,zoomControl:false,draggable:true,scrollWheel:false});
  refreshNaverMapLayout(heroMap, heroMapElement);
  renderHeroCenterMarkers();
  locateHeroMap();
}

function refreshNaverMapLayout(map, element) {
  if (!map || !element || !window.naver?.maps) return;

  const refresh = () => {
    if (!element.clientWidth || !element.clientHeight) return;
    map.setMapTypeId(naver.maps.MapTypeId.NORMAL);
    naver.maps.Event.trigger(map, "resize");
  };

  requestAnimationFrame(() => requestAnimationFrame(refresh));
  window.setTimeout(refresh, 350);
  window.setTimeout(refresh, 1200);

  if (window.ResizeObserver) {
    const observer = new ResizeObserver(refresh);
    observer.observe(element);
    window.setTimeout(() => observer.disconnect(), 5000);
  }
}

function getNaverMapKey() {
  const params = new URLSearchParams(window.location.search);
  return (
    params.get("naverKey") ||
    localStorage.getItem("NAVER_MAP_NCP_KEY_ID") ||
    publicConfig.naverMapNcpKeyId ||
    ""
  );
}

function loadNaverMapSdk(key) {
  return new Promise((resolve, reject) => {
    if (window.naver?.maps) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(key)}`;
    script.async = true;
    script.onload = () => {
      if (window.naver?.maps) {
        resolve();
        return;
      }

      reject(new Error("Naver Maps SDK loaded without maps object"));
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

function createMarkerIcon(isSelected, center) {
  const label = escapeHtml(center.name.slice(0, 9));
  const rating = center.rating && center.rating !== "신규" ? center.rating : "신규";
  const ratingMarkup = rating === "신규"
    ? `<span class="marker-new">신규</span>`
    : `${uiIcon("star", "is-filled")}<span>${escapeHtml(rating)}</span>`;
  const size = 156;

  return {
    content: `
      <button class="naver-marker ${isSelected ? "selected" : ""}" type="button" aria-label="${escapeHtml(center.name)} ${rating === "신규" ? "신규 센터" : `평점 ${escapeHtml(rating)}`}">
        <span class="marker-name">${label}</span>
        <span class="marker-rating icon-label">${ratingMarkup}</span>
      </button>
    `,
    size: new naver.maps.Size(size, 46),
    anchor: new naver.maps.Point(size / 2, 43),
  };
}

function createUserMarkerIcon() {
  return {
    content: `<div class="user-marker" aria-label="현재 위치"></div>`,
    size: new naver.maps.Size(28, 28),
    anchor: new naver.maps.Point(14, 14),
  };
}

function showFallbackMap() {
  mapElement.hidden = true;
  mapStatus.hidden = false;
  mapStatus.textContent = "네이버 지도 인증 확인 필요";
  mapFallback.hidden = false;
  mapFallback.querySelectorAll(".pin").forEach((pin) => pin.remove());

  centers.forEach((center) => {
    const pin = document.createElement("button");
    pin.className = "pin";
    pin.type = "button";
    pin.dataset.id = center.id;
    pin.style.setProperty("--x", center.fallbackX);
    pin.style.setProperty("--y", center.fallbackY);
    pin.textContent = center.name.slice(0, 4);
    pin.addEventListener("click", (event) => {
      event.stopPropagation();
      openCenterDetail(center.id);
    });
    mapFallback.appendChild(pin);
  });

  renderPins();
}

async function initNaverMap() {
  const key = getNaverMapKey();

  if (!key) {
    if (heroMapStatus) heroMapStatus.textContent = "지도를 준비하고 있어요";
    showFallbackMap();
    return;
  }

  try {
    await loadNaverMapSdk(key);
    mapElement.hidden = false;
    mapFallback.hidden = true;
    mapStatus.hidden = false;
    mapStatus.textContent = "네이버 지도";

    naverMap = new naver.maps.Map(mapElement, {
      center: new naver.maps.LatLng(37.5036, 127.0247),
      zoom: 12,
      minZoom: 7,
      mapTypeId: naver.maps.MapTypeId.NORMAL,
      scaleControl: false,
      logoControl: true,
      mapDataControl: false,
      zoomControl: false,
      overlayZoomEffect: "all",
      tileTransition: true,
      tileDuration: 320,
    });

    refreshNaverMapLayout(naverMap, mapElement);

    initHeroMap();

    isolatePanelGesturesFromMap();
    rebuildNaverMarkers();
    naver.maps.Event.addListener(naverMap, "zoom_changed", handleMapZoomChanged);
    naver.maps.Event.addListener(naverMap, "dragend", () => {
      naverMap.__forceIndividualMarkers = false;
      syncMarkerVisibility();
    });
    naver.maps.Event.addListener(naverMap, "click", clearSelectedCenter);
    centerMapOnUser();

    renderPins();
  } catch {
    showFallbackMap();
  }
}

function centerMapOnUser() {
  if (!naverMap || !navigator.geolocation) {
    mapStatus.textContent = "확대하면 센터가 표시됩니다";
    return;
  }

  mapStatus.textContent = "현재 위치 확인 중";
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const point = new naver.maps.LatLng(
        position.coords.latitude,
        position.coords.longitude
      );

      naverMap.setCenter(point);
      naverMap.setZoom(12, true);
      if (userMarker) userMarker.setMap(null);
      userMarker = new naver.maps.Marker({
        position: point,
        map: naverMap,
        title: "현재 위치",
        icon: createUserMarkerIcon(),
      });
      syncMarkerVisibility();
    },
    () => {
      mapStatus.textContent = "위치 권한을 허용하면 내 주변에서 시작합니다";
      syncMarkerVisibility();
    },
    { enableHighAccuracy: true, timeout: 7000, maximumAge: 120000 }
  );
}

regionButtons.forEach((button) => {
  button.addEventListener("click", () => {
    selectedRegion = button.dataset.region;
    regionButtons.forEach((item) => item.classList.toggle("active", item === button));
    renderList();
  });
});

document.querySelectorAll("[data-category]").forEach((link) => {
  link.addEventListener("click", () => {
    selectedCategory = link.dataset.category;
    window.setTimeout(renderList, 0);
  });
});

checkboxes.forEach((box) => box.addEventListener("change", renderList));
areaSelect?.addEventListener("change", renderList);
searchInput.addEventListener("input", renderList);
mapFallback.addEventListener("click", clearSelectedCenter);
zoomInButton.addEventListener("click", () => {
  if (naverMap) {
    naverMap.setZoom(naverMap.getZoom() + 1, true);
  }
});
zoomOutButton.addEventListener("click", () => {
  if (naverMap) {
    naverMap.setZoom(naverMap.getZoom() - 1, true);
  }
});
locateButton.addEventListener("click", () => {
  centerMapOnUser();
});
heroLocateButton?.addEventListener("click", locateHeroMap);
document.querySelectorAll("[data-feature-center]").forEach(card => {
  const showOnMap = () => {
    const centerName = card.querySelector("h3")?.textContent.trim();
    const matchedCenter = centers.find(center => center.id === card.dataset.featureCenter) || centers.find(center => center.name === centerName);
    if (!matchedCenter) return;
    const searchSection = document.querySelector("#search");
    searchSection.scrollIntoView({ behavior: "auto", block: "start" });
    window.setTimeout(() => {
      openCenterDetail(matchedCenter.id);
      searchSection.scrollIntoView({ behavior: "auto", block: "start" });
    }, 80);
  };
  card.addEventListener("click", showOnMap);
  card.addEventListener("keydown", event => {
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); showOnMap(); }
  });
});

async function initApp() {
  await loadPublicConfig();
  configureMobileDownloadLinks();
  captureAuthSessionFromHash();
  await initUserAuth();
  await loadApprovedCenters();
  renderDetail();
  renderList();
  initNaverMap();
}

initApp();

const AUTH_STORAGE_KEY="dail_auth_session";
const authOverlay=document.querySelector("#authOverlay"),authLoginView=document.querySelector("#authLoginView"),onboardingForm=document.querySelector("#onboardingForm"),accountView=document.querySelector("#accountView"),userMenuButton=document.querySelector("#userMenuButton"),headerLogoutButton=document.querySelector("#headerLogoutButton"),centerDashboardLink=document.querySelector("#centerDashboardLink");
let currentUserProfile=null;
function captureAuthSessionFromHash(){
  const hash=new URLSearchParams(location.hash.slice(1));
  const accessToken=hash.get("access_token"),refreshToken=hash.get("refresh_token");
  if(!accessToken||!refreshToken)return false;
  const expiresIn=Number(hash.get("expires_in")||3600);
  localStorage.setItem(AUTH_STORAGE_KEY,JSON.stringify({access_token:accessToken,refresh_token:refreshToken,expires_in:expiresIn,expires_at:Number(hash.get("expires_at"))||Math.floor(Date.now()/1000)+expiresIn,token_type:hash.get("token_type")||"bearer"}));
  history.replaceState(null,"",`${location.pathname}?auth=success`);
  return true;
}
function storedAuthSession(){try{return JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY)||"null")}catch{return null}}
function setAuthView(view){authLoginView.hidden=view!=="login";onboardingForm.hidden=view!=="onboarding";accountView.hidden=view!=="account"}
function openAuth(view="login"){setAuthView(view);authOverlay.hidden=false;document.body.style.overflow="hidden"}
function closeAuth(){authOverlay.hidden=true;document.body.style.overflow=""}
async function refreshAuthSession(session){
  if(!session?.refresh_token||!publicConfig.auth?.supabaseUrl)return null;
  const response=await fetch(`${publicConfig.auth.supabaseUrl}/auth/v1/token?grant_type=refresh_token`,{method:"POST",headers:{apikey:publicConfig.auth.supabaseAnonKey,"Content-Type":"application/json"},body:JSON.stringify({refresh_token:session.refresh_token})});
  if(!response.ok)return null;const next=await response.json();next.expires_at=Math.floor(Date.now()/1000)+(Number(next.expires_in)||3600);localStorage.setItem(AUTH_STORAGE_KEY,JSON.stringify(next));return next;
}
async function activeAuthSession(){let session=storedAuthSession();if(!session)return null;if(Number(session.expires_at||0)<Math.floor(Date.now()/1000)+60)session=await refreshAuthSession(session);if(!session)localStorage.removeItem(AUTH_STORAGE_KEY);return session}
async function loadUserProfile(){
  const session=await activeAuthSession();if(!session)return null;
  const response=await fetch("/api/auth/profile",{headers:{Authorization:`Bearer ${session.access_token}`}});if(response.status===401){localStorage.removeItem(AUTH_STORAGE_KEY);return null}if(!response.ok)return null;return response.json();
}
function renderAuthState(data){
  currentUserProfile=data;const nickname=data?.profile?.nickname||"회원";userMenuButton.textContent=data?`${nickname}님`:"로그인";userMenuButton.classList.toggle("signed-in",Boolean(data));headerLogoutButton.hidden=!data;
  centerDashboardLink.hidden=!data?.centerAccess?.hasActiveMembership;
  if(!data)return;document.querySelector("#accountNickname").textContent=nickname;document.querySelector("#accountEmail").textContent=data.user?.email||`${data.user?.provider||"소셜"} 계정`;
}
async function initUserAuth(){
  const providers=publicConfig.auth?.providers||{};document.querySelectorAll("[data-auth-provider]").forEach(button=>{const ready=Boolean(providers[button.dataset.authProvider]);button.dataset.ready=String(ready);button.title=ready?"":"개발자 로그인 키 설정 후 사용할 수 있습니다."});
  const data=await loadUserProfile();renderAuthState(data);
  if(data?.needsOnboarding){onboardingForm.elements.nickname.value=data.profile?.nickname||"";openAuth("onboarding")}
  const params=new URLSearchParams(location.search);if(params.get("auth")==="success"){history.replaceState(null,"",`${location.pathname}${location.hash}`);if(data?.needsOnboarding)openAuth("onboarding");else if(data)openAuth("account")}
  if(params.get("login")==="1"){history.replaceState(null,"",location.pathname);openAuth(data?"account":"login")}
}
userMenuButton?.addEventListener("click",()=>{if(currentUserProfile)location.href="/account/";else openAuth("login")});
document.querySelector("#authCloseButton")?.addEventListener("click",closeAuth);authOverlay?.addEventListener("click",event=>{if(event.target===authOverlay)closeAuth()});
document.querySelector("#accountFindCenters")?.addEventListener("click",closeAuth);
document.addEventListener("keydown",event=>{if(event.key==="Escape"&&!authOverlay.hidden)closeAuth()});
document.querySelectorAll("[data-auth-provider]").forEach(button=>button.addEventListener("click",()=>{const provider=button.dataset.authProvider;if(button.dataset.ready!=="true"){document.querySelector("#authMessage").textContent=`${provider==='kakao'?'카카오':provider==='naver'?'네이버':'Apple'} 개발자 설정이 필요합니다.`;return}location.href=`/api/auth/start?provider=${encodeURIComponent(provider)}`}));
onboardingForm?.addEventListener("submit",async event=>{event.preventDefault();const message=document.querySelector("#onboardingMessage"),session=await activeAuthSession();if(!session)return openAuth("login");const submit=onboardingForm.querySelector("[type=submit]");submit.disabled=true;message.textContent="";const response=await fetch("/api/auth/profile",{method:"PATCH",headers:{Authorization:`Bearer ${session.access_token}`,"Content-Type":"application/json"},body:JSON.stringify({nickname:onboardingForm.elements.nickname.value.trim(),acceptRequired:onboardingForm.elements.requiredAgreement.checked,marketingAgreed:onboardingForm.elements.marketingAgreement.checked})});const data=await response.json().catch(()=>({}));submit.disabled=false;if(!response.ok){message.textContent=data.error||"회원 정보를 저장하지 못했습니다.";return}renderAuthState(data);openAuth("account")});
async function logoutUser(){const session=storedAuthSession();if(session?.access_token&&publicConfig.auth?.supabaseUrl)fetch(`${publicConfig.auth.supabaseUrl}/auth/v1/logout`,{method:"POST",headers:{apikey:publicConfig.auth.supabaseAnonKey,Authorization:`Bearer ${session.access_token}`}}).catch(()=>{});localStorage.removeItem(AUTH_STORAGE_KEY);currentUserProfile=null;renderAuthState(null);closeAuth()}
headerLogoutButton?.addEventListener("click",logoutUser);
document.querySelector("#logoutButton")?.addEventListener("click",logoutUser);
document.querySelector("#deleteAccountButton")?.addEventListener("click",async()=>{if(!confirm("회원 정보와 계정을 삭제할까요? 삭제 후에는 복구할 수 없습니다."))return;const session=await activeAuthSession();if(!session)return;const response=await fetch("/api/auth/profile",{method:"DELETE",headers:{Authorization:`Bearer ${session.access_token}`}});if(!response.ok)return alert("회원 탈퇴를 처리하지 못했습니다.");localStorage.removeItem(AUTH_STORAGE_KEY);currentUserProfile=null;renderAuthState(null);closeAuth();alert("회원 탈퇴가 완료되었습니다.")});
