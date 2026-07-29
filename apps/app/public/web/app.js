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
    therapist: "김민재 센터장",
    managerCareer: "대학병원 재활의학과 근무\n근골격계 재활운동 지도 9년\n허리·수술 후 일상 복귀 프로그램 운영",
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
    therapist: "박서연 대표",
    managerCareer: "재활병원 근무\n직장인 자세·목·어깨 운동 지도\n소그룹 자세 분석 프로그램 운영",
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
    therapist: "이도윤 원장",
    managerCareer: "종합병원 근무\n수술 후 및 시니어 운동 지도\n보행·근력 회복 프로그램 운영",
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
    therapist: "최하린 대표",
    managerCareer: "스포츠재활센터 근무\n골프·테니스 컨디셔닝 지도\n어깨 가동성 프로그램 운영",
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
const heroSearchForm = document.querySelector("#heroSearchForm");
const heroSearchInput = document.querySelector("#heroSearchInput");
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
const mapArea = document.querySelector(".map-area");
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
let routeLocationState = "idle";
let routeLocationMessage = "";
let routeLocationRequestId = 0;
let routePlaceQuery = "";
let routePlaceResults = [];
let routePlaceSearchState = "idle";
let routePlaceSearchMessage = "";
let routePlaceRequestId = 0;
let routeMiniMap = null;
let routeMiniMarker = null;
let routeMiniOriginMarker = null;
let bookingSelectedDate = "";
let bookingSelectedSlot = null;
let bookingAvailability = null;
let bookingRequestId = 0;
const LEGACY_FAVORITES_KEY = "dail_favorite_centers";
const PENDING_FAVORITE_KEY = "dail_pending_favorite_center";
const favoriteCenterIds = new Set();
let favoriteSyncReady = false;
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

const PUBLIC_DAY_KEYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const PUBLIC_DEFAULT_SCHEDULE = {
  monday: { closed: false, open: "09:00", close: "21:00" },
  tuesday: { closed: false, open: "09:00", close: "21:00" },
  wednesday: { closed: false, open: "09:00", close: "21:00" },
  thursday: { closed: false, open: "09:00", close: "21:00" },
  friday: { closed: false, open: "09:00", close: "21:00" },
  saturday: { closed: false, open: "10:00", close: "17:00" },
  sunday: { closed: true, open: "10:00", close: "17:00" },
};

function normalizeOpeningSchedule(value) {
  const source = value && typeof value === "object" ? value : {};
  return Object.fromEntries(Object.keys(PUBLIC_DEFAULT_SCHEDULE).map((key) => {
    const fallback = PUBLIC_DEFAULT_SCHEDULE[key];
    const item = source[key] && typeof source[key] === "object" ? source[key] : {};
    return [key, {
      closed: Boolean(item.closed),
      open: /^\d{2}:(?:00|30)$/.test(item.open) ? item.open : fallback.open,
      close: /^\d{2}:(?:00|30)$/.test(item.close) ? item.close : fallback.close,
    }];
  }));
}

function koreaDateKey(value = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function bookingDateChoices(count = 14) {
  const today = new Date(`${koreaDateKey()}T00:00:00+09:00`);
  return Array.from({ length: count }, (_, index) => {
    const value = new Date(today.getTime() + index * 24 * 60 * 60 * 1000);
    const date = koreaDateKey(value);
    const weekday = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", weekday: "short" }).format(value);
    const day = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", day: "numeric" }).format(value);
    return { date, weekday, day, today: index === 0 };
  });
}

function formatBookingDateTime(startAt) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "long",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(startAt));
}

function publicOperatorText(value) {
  const text = String(value || "")
    .replace(/\s*[·|/–-]?\s*물리치료사\s*출신\s*/g, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/\s*[·|/–-]\s*$/g, "")
    .trim();
  return text || "센터장 정보";
}

function publicCareerText(value) {
  return String(value || "")
    .replace(/[ \t]*물리치료사[ \t]*출신[ \t]*/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function normalizeCenter(center) {
  return {
    ...center,
    region: center.region || "other",
    distance: center.distance && center.distance !== "신규" ? center.distance : "",
    rating: center.rating || "신규",
    reviews: center.reviews || "0",
    lead: center.lead || "센터가 등록한 운동 프로그램 정보를 확인해보세요.",
    tags: Array.isArray(center.tags) && center.tags.length ? center.tags : ["운동 관리"],
    categories: Array.isArray(center.categories) ? center.categories : [],
    therapist: publicOperatorText(center.therapist),
    managerCareer: publicCareerText(center.managerCareer || center.manager_career) || "센터장이 커리어 정보를 준비하고 있습니다.",
    price: center.price || "센터 문의",
    conversion: center.conversion || "신규 등록 센터",
    address: center.address || center.area || "",
    phone: center.phone || "",
    website: center.website || "",
    openingHours: center.openingHours || center.opening_hours || "운영시간은 센터에 문의해 주세요.",
    openingSchedule: normalizeOpeningSchedule(center.openingSchedule || center.opening_schedule),
    bookingSlotMinutes: Number(center.bookingSlotMinutes || center.booking_slot_minutes || 60),
    bookingEnabled: center.bookingEnabled !== false && center.booking_enabled !== false,
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
      (center) => {
        const saved = isFavoriteCenter(center.id);
        return `
        <article class="center-card ${center.id === selectedId ? "active" : ""}" data-card-id="${center.id}" tabindex="0" aria-label="${escapeHtml(center.name)} 센터 상세 보기">
          <div class="card-top">
            <div>
              <h3>${escapeHtml(center.name)}</h3>
              <p>${escapeHtml(center.lead)}</p>
            </div>
            <button type="button" class="favorite ${saved ? "is-saved" : ""}" data-card-favorite="${center.id}" aria-label="${escapeHtml(center.name)} 관심 ${saved ? "저장 해제" : "저장"}" aria-pressed="${saved}">
              ${uiIcon("heart")}
            </button>
          </div>
          <div class="meta-row">
            <span>${escapeHtml(center.area)}</span>
            ${center.distance ? `<span>${escapeHtml(center.distance)}</span>` : ""}
            ${center.rating === "신규"
              ? '<span class="rating is-new">신규 센터</span>'
              : `<span class="rating icon-label">${uiIcon("star", "is-filled")}${escapeHtml(center.rating)}</span>`}
          </div>
          <div class="card-tags">${[...center.categories,...center.tags].slice(0, 3).map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}</div>
          <span class="card-cta icon-label">센터 상세 보기 ${uiIcon("arrow-right")}</span>
        </article>
      `;
      }
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
    card.addEventListener("click", (event) => {
      if (event.target.closest("[data-card-favorite]")) return;
      openCenterDetail(card.dataset.cardId);
    });
    card.addEventListener("keydown", (event) => {
      if (event.target.closest("[data-card-favorite]") || !["Enter", " "].includes(event.key)) return;
      event.preventDefault();
      openCenterDetail(card.dataset.cardId);
    });
  });
  document.querySelectorAll("[data-card-favorite]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleFavoriteCenter(button.dataset.cardFavorite);
    });
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

function scrollCenterMapIntoView(behavior = "smooth") {
  if (!mapArea) return;
  const headerHeight = document.querySelector(".site-header")?.getBoundingClientRect().height || 0;
  const top = Math.max(0, window.scrollY + mapArea.getBoundingClientRect().top - headerHeight - 10);
  window.scrollTo({ top, left: 0, behavior });
  window.setTimeout(() => refreshNaverMapLayout(naverMap, mapElement), behavior === "smooth" ? 320 : 40);
}

function openCenterDetail(id) {
  detailPanel.hidden = true;
  detailPanel.innerHTML = "";
  selectCenter(id, { openDetail: true });
  window.requestAnimationFrame(() => scrollCenterMapIntoView("smooth"));
}

function mapPopupPhotoMarkup(center) {
  const photo = center.photoUrls?.[0] || center.photoUrl || "";
  if (photo) {
    return `<div class="map-popup-photo">
      <img src="${escapeHtml(photo)}" alt="${escapeHtml(center.name)} 센터 사진" loading="lazy" decoding="async" />
    </div>`;
  }
  return `<div class="map-popup-photo map-popup-photo-placeholder" role="img" aria-label="${escapeHtml(center.name)} 센터 기본 이미지">
    <span aria-hidden="true"><i></i>DAIL</span>
  </div>`;
}

function centerPopupContent(center) {
  return `<article class="map-popup">
    <button class="map-popup-close icon-only" type="button" aria-label="닫기" onclick="window.closeDailMapPopup()">${uiIcon("x")}</button>
    ${mapPopupPhotoMarkup(center)}
    <div class="map-popup-body">
      <div class="map-popup-heading"><h3>${escapeHtml(center.name)}</h3>${center.distance ? `<span class="map-popup-distance">${escapeHtml(center.distance)}</span>` : ""}</div>
      <p class="map-popup-category">DAIL 등록 운동센터</p>
      <p class="map-popup-location">${escapeHtml(center.area)}</p>
      <div class="map-popup-tags">${center.tags.slice(0,2).map(tag=>`<span>${escapeHtml(tag)}</span>`).join("")}</div>
      <div class="map-popup-actions"><button class="map-popup-cta icon-label" type="button" onclick="window.openDailCenterSheet('${escapeHtml(center.id)}')">상세보기 ${uiIcon("arrow-right")}</button><button class="map-popup-route icon-label" type="button" onclick="window.openDailRouteSheet('${escapeHtml(center.id)}')">${uiIcon("map-pin")}길찾기</button></div>
    </div>
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
  return favoriteCenterIds.has(centerId);
}

function legacyFavoriteIds() {
  try {
    const ids = JSON.parse(localStorage.getItem(LEGACY_FAVORITES_KEY) || "[]");
    return Array.isArray(ids) ? ids.filter((id) => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function updateFavoriteButton(centerId, { busy = false } = {}) {
  const saved = favoriteCenterIds.has(centerId);
  const button = centerExperienceContent?.querySelector("[data-center-favorite]");
  if (button) {
    button.classList.toggle("is-saved", saved);
    button.setAttribute("aria-pressed", String(saved));
    button.setAttribute("aria-busy", String(busy));
    button.disabled = busy;
    button.querySelector("span").textContent = busy
      ? (saved ? "해제 중…" : "저장 중…")
      : (saved ? "저장됨" : "관심 저장");
  }
  const syncMessage = centerExperienceContent?.querySelector("[data-favorite-sync-message]");
  if (syncMessage) {
    syncMessage.hidden = busy || !saved;
  }
  document.querySelectorAll(`[data-card-favorite="${centerId}"]`).forEach((cardButton) => {
    cardButton.classList.toggle("is-saved", saved);
    cardButton.setAttribute("aria-pressed", String(saved));
    cardButton.setAttribute("aria-busy", String(busy));
    cardButton.setAttribute("aria-label", `${centers.find((center) => center.id === centerId)?.name || "센터"} 관심 ${saved ? "저장 해제" : "저장"}`);
    cardButton.disabled = busy;
  });
}

async function saveFavoriteRequest(session, centerId, method = "POST") {
  return fetch(`${API_BASE}/api/favorites`, {
    method,
    keepalive: true,
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
      "X-DAIL-Source": "web",
    },
    body: JSON.stringify({ centerId }),
  });
}

async function loadFavoriteCenters(session = null, { applyPending = true } = {}) {
  const auth = session || await activeAuthSession();
  favoriteCenterIds.clear();
  favoriteSyncReady = false;
  if (!auth) return false;

  try {
    const response = await fetch(`${API_BASE}/api/favorites`, {
      headers: {
        Authorization: `Bearer ${auth.access_token}`,
        "X-DAIL-Source": "web",
      },
    });
    if (!response.ok) throw new Error("favorites unavailable");
    const data = await response.json();
    (data.favorites || []).forEach((item) => {
      if (item.center?.id) favoriteCenterIds.add(item.center.id);
    });

    const pendingId = applyPending ? sessionStorage.getItem(PENDING_FAVORITE_KEY) : "";
    const candidates = [...new Set([...legacyFavoriteIds(), pendingId].filter(Boolean))]
      .filter((id) => /^[0-9a-f-]{36}$/i.test(id));
    for (const centerId of candidates) {
      if (favoriteCenterIds.has(centerId)) continue;
      const saveResponse = await saveFavoriteRequest(auth, centerId);
      if (saveResponse.ok) favoriteCenterIds.add(centerId);
    }
    localStorage.removeItem(LEGACY_FAVORITES_KEY);
    if (applyPending) sessionStorage.removeItem(PENDING_FAVORITE_KEY);
    favoriteSyncReady = true;
    document.querySelectorAll("[data-card-favorite]").forEach((button) => updateFavoriteButton(button.dataset.cardFavorite));
    return true;
  } catch {
    return false;
  }
}

async function toggleFavoriteCenter(centerId) {
  const session = await activeAuthSession();
  if (!session) {
    sessionStorage.setItem(PENDING_FAVORITE_KEY, centerId);
    const message = document.querySelector("#authMessage");
    if (message) message.textContent = "로그인하면 관심 센터가 계정에 저장되고 다른 기기에서도 확인할 수 있습니다.";
    openAuth("login");
    return;
  }

  if (!favoriteSyncReady) {
    const loaded = await loadFavoriteCenters(session);
    if (!loaded) {
      const button = centerExperienceContent?.querySelector("[data-center-favorite]");
      if (button) button.title = "저장 상태를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.";
      return;
    }
  }
  const wasSaved = favoriteCenterIds.has(centerId);
  updateFavoriteButton(centerId, { busy: true });

  try {
    const response = await saveFavoriteRequest(session, centerId, wasSaved ? "DELETE" : "POST");
    if (!response.ok) throw new Error("favorite update failed");
    const data = await response.json().catch(() => ({}));
    if (wasSaved || data.saved === false) favoriteCenterIds.delete(centerId);
    else favoriteCenterIds.add(centerId);
    updateFavoriteButton(centerId);
  } catch {
    updateFavoriteButton(centerId);
    const button = centerExperienceContent?.querySelector("[data-center-favorite]");
    if (button) button.title = "관심 센터를 저장하지 못했습니다. 다시 시도해 주세요.";
  }
}

function centerBookingMarkup(center) {
  const dates = bookingDateChoices();
  bookingSelectedDate = dates.some((item) => item.date === bookingSelectedDate)
    ? bookingSelectedDate
    : dates[0].date;
  if (center.bookingEnabled === false) {
    return `<section id="centerBookingSection" class="center-sheet-section center-booking-section">
      <p class="center-sheet-kicker">온라인 예약</p>
      <div class="booking-disabled">${uiIcon("calendar")}<div><strong>현재 온라인 예약을 받고 있지 않아요</strong><p>전화로 가능한 시간을 확인해 주세요.</p></div></div>
    </section>`;
  }
  return `<section id="centerBookingSection" class="center-sheet-section center-booking-section">
    <div class="center-booking-heading"><div><p class="center-sheet-kicker">온라인 예약</p><h3>방문할 날짜와 시간을 선택하세요</h3></div><span>${center.bookingSlotMinutes}분 단위</span></div>
    <div class="booking-date-strip" role="list" aria-label="예약 날짜">
      ${dates.map((item) => `<button type="button" data-booking-date="${item.date}" class="${item.date === bookingSelectedDate ? "active" : ""}">
        <small>${item.today ? "오늘" : item.weekday}</small><strong>${item.day}</strong>
      </button>`).join("")}
    </div>
    <div id="bookingSlotPanel" class="booking-slot-panel"><p class="booking-loading">예약 가능한 시간을 확인하고 있습니다.</p></div>
    <div id="bookingFormPanel"></div>
  </section>`;
}

function renderBookingSlots(center) {
  const panel = centerExperienceContent?.querySelector("#bookingSlotPanel");
  const formPanel = centerExperienceContent?.querySelector("#bookingFormPanel");
  if (!panel || !formPanel) return;
  const slots = bookingAvailability?.slots || [];
  panel.innerHTML = slots.length
    ? `<div class="booking-slot-grid">${slots.map((slot) =>
        `<button type="button" data-booking-slot="${escapeHtml(slot.startAt)}" ${slot.available ? "" : "disabled"} class="${bookingSelectedSlot?.startAt === slot.startAt ? "active" : ""}">
          ${escapeHtml(slot.time)}${slot.available ? "" : `<small>${slot.unavailableReason === "booked" ? "예약됨" : "마감"}</small>`}
        </button>`
      ).join("")}</div>`
    : `<div class="booking-no-slots">${uiIcon("calendar")}<strong>선택한 날짜는 예약 가능한 시간이 없어요</strong><p>다른 날짜를 선택해 주세요.</p></div>`;
  formPanel.innerHTML = bookingSelectedSlot
    ? `<form id="centerBookingForm" class="center-booking-form">
        <div class="selected-booking-time">${uiIcon("calendar")}<div><span>선택한 예약 시간</span><strong>${escapeHtml(formatBookingDateTime(bookingSelectedSlot.startAt))}</strong></div></div>
        <div class="booking-form-grid">
          <label>이름<input name="customerName" maxlength="40" required value="${escapeHtml(currentUserProfile?.profile?.nickname || "")}" placeholder="예약자 이름" /></label>
          <label>전화번호<input name="customerPhone" inputmode="tel" maxlength="30" required placeholder="010-0000-0000" /></label>
          <label class="wide">불편한 부위<input name="painArea" maxlength="100" required placeholder="예: 오른쪽 어깨, 허리" /></label>
          <label class="wide">센터에 전할 내용 <small>선택</small><textarea name="customerNote" maxlength="500" rows="3" placeholder="운동 시 참고할 내용을 적어주세요. 진단서나 상세 의료기록은 입력하지 마세요."></textarea></label>
        </div>
        <label class="booking-consent"><input name="privacyConsent" type="checkbox" required /><span>예약 진행을 위해 이름, 전화번호, 불편 부위를 센터에 전달하는 데 동의합니다.</span></label>
        <button type="submit" class="booking-submit">이 시간으로 예약 요청</button>
        <p class="booking-form-message" aria-live="polite"></p>
      </form>`
    : "";
  panel.querySelectorAll("[data-booking-slot]").forEach((button) => {
    button.addEventListener("click", () => {
      bookingSelectedSlot = slots.find((slot) => slot.startAt === button.dataset.bookingSlot) || null;
      renderBookingSlots(center);
      centerExperienceContent?.querySelector("#centerBookingForm")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  });
  centerExperienceContent?.querySelector("#centerBookingForm")?.addEventListener("submit", (event) => submitCenterBooking(event, center));
}

async function loadBookingAvailability(center) {
  const panel = centerExperienceContent?.querySelector("#bookingSlotPanel");
  if (!panel) return;
  const requestId = ++bookingRequestId;
  bookingSelectedSlot = null;
  panel.innerHTML = '<p class="booking-loading">예약 가능한 시간을 확인하고 있습니다.</p>';
  centerExperienceContent.querySelector("#bookingFormPanel").innerHTML = "";
  try {
    const response = await fetch(`${API_BASE}/api/bookings?centerId=${encodeURIComponent(center.id)}&date=${encodeURIComponent(bookingSelectedDate)}`);
    const data = await response.json().catch(() => ({}));
    if (requestId !== bookingRequestId || centerExperienceId !== center.id) return;
    if (!response.ok) throw new Error(data.error || "예약 시간을 불러오지 못했습니다.");
    bookingAvailability = data;
    renderBookingSlots(center);
  } catch (error) {
    if (requestId !== bookingRequestId) return;
    panel.innerHTML = `<div class="booking-no-slots is-error">${uiIcon("info")}<strong>${escapeHtml(error.message)}</strong><button type="button" data-booking-retry>다시 시도</button></div>`;
    panel.querySelector("[data-booking-retry]")?.addEventListener("click", () => loadBookingAvailability(center));
  }
}

async function submitCenterBooking(event, center) {
  event.preventDefault();
  const form = event.currentTarget;
  const message = form.querySelector(".booking-form-message");
  const session = await activeAuthSession();
  if (!session) {
    message.textContent = "예약하려면 먼저 로그인해 주세요.";
    openAuth("login");
    return;
  }
  if (!bookingSelectedSlot) return;
  const values = new FormData(form);
  const button = form.querySelector('[type="submit"]');
  button.disabled = true;
  button.textContent = "예약 요청 중…";
  const response = await fetch(`${API_BASE}/api/bookings`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
      "Idempotency-Key": clientIdempotencyKey(),
      "X-DAIL-Source": "web",
    },
    body: JSON.stringify({
      centerId: center.id,
      startAt: bookingSelectedSlot.startAt,
      customerName: values.get("customerName"),
      customerPhone: values.get("customerPhone"),
      painArea: values.get("painArea"),
      customerNote: values.get("customerNote"),
      privacyConsent: values.get("privacyConsent") === "on",
    }),
  });
  const data = await response.json().catch(() => ({}));
  button.disabled = false;
  button.textContent = "이 시간으로 예약 요청";
  if (!response.ok) {
    message.textContent = data.error || "예약을 접수하지 못했습니다.";
    if (response.status === 409) loadBookingAvailability(center);
    return;
  }
  form.innerHTML = `<div class="booking-success">${uiIcon("circle-check")}<div><strong>예약 요청을 보냈습니다</strong><p>${escapeHtml(data.message || "센터 확인 후 예약이 확정됩니다.")}</p></div></div>`;
  trackEvent("contact_click", center.id, "booking_sheet");
}

function renderCenterExperienceDetail(center) {
  const tags = centerExperienceTags(center);
  const website = safeExternalUrl(center.website);
  const phoneLink = String(center.phone || "").replace(/[^\d+]/g, "");
  const saved = isFavoriteCenter(center.id);
  centerExperienceView = "detail";
  bookingSelectedDate = bookingDateChoices()[0].date;
  bookingSelectedSlot = null;
  bookingAvailability = null;
  centerExperienceContent.innerHTML = `
    <header class="center-sheet-header">
      <div><span>센터 상세</span><strong id="centerExperienceTitle">센터 정보</strong></div>
      <button class="center-sheet-close icon-only" type="button" data-center-sheet-close aria-label="센터 상세 닫기">${uiIcon("x")}</button>
    </header>
    <div class="center-sheet-scroll">
      ${centerPhotoMarkup(center)}
      <section class="center-sheet-summary">
        <h2>${escapeHtml(center.name)}</h2>
        <p class="center-sheet-rating">${center.rating === "신규"
          ? '<b class="center-sheet-new">신규 센터</b><span>아직 등록된 후기가 없어요</span>'
          : `<span class="stars">${ratingIcons(center.rating)}</span><b>${escapeHtml(center.rating)}</b><span>후기 ${escapeHtml(center.reviews)}개</span>`}
          ${center.distance ? `<i></i><span>${escapeHtml(center.distance)}</span>` : ""}</p>
        <p class="center-sheet-address icon-label">${uiIcon("map-pin")}<span>${escapeHtml(center.address || center.area)}</span></p>
      </section>
      <nav class="center-sheet-quick-actions" aria-label="센터 빠른 메뉴">
        <button type="button" data-center-booking>${uiIcon("calendar")}<span>예약</span></button>
        <button type="button" data-center-route>${uiIcon("map-pin")}<span>길찾기</span></button>
        <button type="button" data-center-phone ${phoneLink ? "" : "disabled"}>${uiIcon("phone-call")}<span>${phoneLink ? "전화" : "전화 준비중"}</span></button>
        <button type="button" data-center-favorite data-center-id="${escapeHtml(center.id)}" class="${saved ? "is-saved" : ""}" aria-pressed="${saved}">${uiIcon("heart")}<span>${saved ? "저장됨" : "관심 저장"}</span></button>
      </nav>
      <p class="favorite-sync-message" data-favorite-sync-message ${saved ? "" : "hidden"}>
        ${uiIcon("circle-check")} 이 센터를 저장했습니다. <a href="/account/#favorites">마이 DAIL에서 보기</a>
      </p>
      <section class="center-sheet-section">
        <p class="center-sheet-kicker">센터 소개</p>
        <h3>어떤 운동을 받을 수 있나요?</h3>
        <p class="center-sheet-description">${escapeHtml(center.lead)}</p>
        <div class="center-program-tags">${tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}</div>
      </section>
      <section class="center-sheet-section">
        <p class="center-sheet-kicker">센터장 정보</p>
        <button class="center-operator-card" type="button" data-center-operator aria-expanded="false">
          <span class="center-operator-avatar" aria-hidden="true">${uiIcon("user-cog")}</span>
          <div><strong>${escapeHtml(center.therapist)}</strong><span class="icon-label">${uiIcon("user-cog")} ${center.managerCareer ? "센터장 커리어 보기" : "커리어 등록 준비중"}</span></div>
          ${uiIcon("chevron-down")}
        </button>
        <div class="center-operator-career" data-center-operator-career hidden><b>주요 커리어</b><p>${escapeHtml(center.managerCareer || "센터장이 커리어 정보를 준비하고 있습니다.")}</p></div>
      </section>
      ${centerBookingMarkup(center)}
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
      <button class="center-sheet-contact-button icon-label" type="button" data-center-booking>${uiIcon("calendar")} 시간 예약</button>
    </footer>`;

  centerExperienceContent.querySelectorAll("[data-center-sheet-close]").forEach((button) => button.addEventListener("click", closeCenterExperience));
  centerExperienceContent.querySelectorAll("[data-center-route]").forEach((button) => button.addEventListener("click", () => renderCenterExperienceRoute(center)));
  centerExperienceContent.querySelector("[data-center-favorite]")?.addEventListener("click", () => toggleFavoriteCenter(center.id));
  centerExperienceContent.querySelectorAll("[data-center-booking]").forEach((button) => button.addEventListener("click", () => {
    centerExperienceContent.querySelector("#centerBookingSection")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }));
  centerExperienceContent.querySelector("[data-center-operator]")?.addEventListener("click", (event) => {
    const button = event.currentTarget;
    const expanded = button.getAttribute("aria-expanded") === "true";
    button.setAttribute("aria-expanded", String(!expanded));
    centerExperienceContent.querySelector("[data-center-operator-career]").hidden = expanded;
  });
  centerExperienceContent.querySelectorAll("[data-booking-date]").forEach((button) => button.addEventListener("click", () => {
    bookingSelectedDate = button.dataset.bookingDate;
    centerExperienceContent.querySelectorAll("[data-booking-date]").forEach((item) => item.classList.toggle("active", item === button));
    loadBookingAvailability(center);
  }));
  centerExperienceContent.querySelector("[data-center-phone]")?.addEventListener("click", () => {
    if (!phoneLink) return;
    trackEvent("contact_click", center.id, "phone_sheet");
    window.location.href = `tel:${phoneLink}`;
  });
  centerExperienceContent.querySelector("[data-center-contact]")?.addEventListener("click", () => trackEvent("contact_click", center.id, "phone_sheet"));
  if (center.bookingEnabled !== false) loadBookingAvailability(center);
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
    appname: /^https?:$/i.test(window.location.protocol) ? window.location.origin : "com.movemap.app",
  });
  if (routeOrigin) {
    params.set("slat", String(routeOrigin.lat));
    params.set("slng", String(routeOrigin.lng));
    params.set("sname", routeOrigin.label || "내 위치");
  }
  return `nmap://route/${modePath}?${params.toString()}`;
}

function naverWebRouteUrl(center) {
  if (!routeOrigin) return "https://map.naver.com/p/directions/";
  const toWebMercator = (point) => {
    const x = point.lng * 20037508.34 / 180;
    const boundedLatitude = Math.max(-85, Math.min(85, point.lat));
    const y = Math.log(Math.tan((90 + boundedLatitude) * Math.PI / 360)) / (Math.PI / 180);
    return { x, y: y * 20037508.34 / 180 };
  };
  const segment = (point, name, placeId = "") => {
    const projected = toWebMercator(point);
    return [
      projected.x,
      projected.y,
      encodeURIComponent(name),
      placeId,
      placeId ? "PLACE_POI" : "ADDRESS_POI",
    ].join(",");
  };
  const centerPlaceId = String(center.naverMapUrl || "").match(/\/place\/(\d+)/)?.[1] || "";
  const mode = routeMode === "walk" ? "walk" : routeMode === "car" ? "car" : "transit";
  const start = segment(routeOrigin, routeOrigin.label || "출발 위치", routeOrigin.naverPlaceId || "");
  const destination = segment(center, center.name, centerPlaceId);
  return `https://map.naver.com/p/directions/${start}/${destination}/-/${mode}`;
}

function renderRouteSummary(center) {
  const summary = centerExperienceContent?.querySelector("#routeSummary");
  if (!summary) return;
  if (!routeOrigin) {
    summary.innerHTML = "";
    return;
  }
  const distanceKm = haversineDistanceKm(routeOrigin, center);
  summary.innerHTML = `<div class="route-summary-result">
    <div><span>선택한 이동수단</span><strong>${routeModeLabel(routeMode)}</strong></div>
    <div><span>직선거리</span><strong>${distanceKm < 1 ? `${Math.round(distanceKm * 1000)}m` : `${distanceKm.toFixed(1)}km`}</strong></div>
  </div><p>${uiIcon("info")} 실제 경로와 소요 시간은 네이버 지도에서 확인할 수 있어요.</p>`;
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
    logoControlOptions: { position: naver.maps.Position.TOP_RIGHT },
  });
  routeMiniMarker = new naver.maps.Marker({
    position,
    map: routeMiniMap,
    icon: createMarkerIcon(true, center),
  });
  if (routeOrigin) {
    const originPosition = new naver.maps.LatLng(routeOrigin.lat, routeOrigin.lng);
    routeMiniOriginMarker = new naver.maps.Marker({
      position: originPosition,
      map: routeMiniMap,
      title: routeOrigin.label || "출발 위치",
      icon: createUserMarkerIcon(),
    });
    const bounds = new naver.maps.LatLngBounds(originPosition, position);
    routeMiniMap.fitBounds(bounds, { top: 46, right: 46, bottom: 46, left: 46 });
  }
}

function locationPermissionGuide() {
  if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
    return "iPhone 설정 → 개인정보 보호 및 보안 → 위치 서비스 → Safari 웹사이트에서 위치 접근을 허용해 주세요.";
  }
  if (/Safari/i.test(navigator.userAgent) && !/Chrome|Chromium/i.test(navigator.userAgent)) {
    return "Safari 설정 → 웹사이트 → 위치에서 이 사이트를 ‘허용’으로 바꾼 뒤 다시 시도해 주세요.";
  }
  return "브라우저 주소창의 위치 권한을 허용한 뒤 다시 시도해 주세요.";
}

function routeLocationFeedbackMarkup() {
  if (routeLocationState === "loading") {
    return `<section id="routeLocationFeedback" class="route-location-feedback is-loading" aria-live="assertive">
      <span class="route-location-spinner" aria-hidden="true"></span>
      <div><strong>현재 위치를 확인하고 있어요</strong><p>최대 8초 정도 걸릴 수 있습니다.</p></div>
    </section>`;
  }
  if (routeLocationState === "success") return "";
  if (routeLocationState === "error") {
    return `<section id="routeLocationFeedback" class="route-location-feedback is-error" role="alert">
      <span>${uiIcon("circle-alert")}</span>
      <div><strong>${escapeHtml(routeLocationMessage || "현재 위치를 확인하지 못했어요")}</strong><p>${escapeHtml(locationPermissionGuide())}</p><button type="button" data-route-retry>${uiIcon("locate")} 다시 시도</button></div>
    </section>`;
  }
  return "";
}

function routePlaceResultsMarkup() {
  if (routePlaceSearchState === "loading") {
    return `<div class="route-place-status is-loading" aria-live="assertive">
      <span class="route-location-spinner" aria-hidden="true"></span>
      <div><strong>네이버에서 장소를 찾고 있어요</strong><p>건물·식당·역 이름과 주변 주소를 함께 확인합니다.</p></div>
    </div>`;
  }
  if (routePlaceSearchState === "error") {
    return `<div class="route-place-status is-error" role="alert">
      <span>${uiIcon("circle-alert")}</span>
      <div><strong>${escapeHtml(routePlaceSearchMessage || "장소를 검색하지 못했어요")}</strong><p>장소명을 조금 더 구체적으로 입력해 다시 검색해 주세요.</p></div>
    </div>`;
  }
  if (routePlaceSearchState === "empty") {
    return `<div class="route-place-status" aria-live="polite">
      <span>${uiIcon("search")}</span>
      <div><strong>검색 결과가 없어요</strong><p>지역명과 장소명을 함께 입력해 보세요. 예: 강남역 스타벅스</p></div>
    </div>`;
  }
  if (routePlaceSearchState === "selected" && routeOrigin) return "";
  if (routeOrigin) return "";
  if (routePlaceSearchState !== "results" || !routePlaceResults.length) {
    return `<p class="route-place-hint">${uiIcon("info")} 장소명으로 검색하거나 ‘내 위치’를 선택해 주세요.</p>`;
  }
  return `<section class="route-place-results" aria-label="출발 장소 검색 결과">
    <header><strong>${routePlaceResults.length}곳을 찾았어요</strong><span>네이버 장소 검색</span></header>
    ${routePlaceResults.map((place) => `<button type="button" data-route-place-id="${escapeHtml(place.id)}">
      <span class="route-place-result-icon">${uiIcon("map-pin")}</span>
      <span class="route-place-result-copy">
        <strong>${escapeHtml(place.name)}</strong>
        ${place.category ? `<small>${escapeHtml(place.category)}</small>` : ""}
        <em>${escapeHtml(place.roadAddress || place.address || "주소 정보 없음")}</em>
      </span>
      ${uiIcon("arrow-right")}
    </button>`).join("")}
  </section>`;
}

function resetRoutePlaceSearch() {
  routePlaceQuery = "";
  routePlaceResults = [];
  routePlaceSearchState = "idle";
  routePlaceSearchMessage = "";
  routePlaceRequestId += 1;
}

async function searchRoutePlace(event, center) {
  event?.preventDefault();
  const input = centerExperienceContent?.querySelector("#routePlaceInput");
  const query = String(input?.value || routePlaceQuery).replace(/\s+/g, " ").trim();
  routePlaceQuery = query;
  if (query.length < 2) {
    routePlaceSearchState = "error";
    routePlaceSearchMessage = "장소 이름을 2자 이상 입력해 주세요";
    renderCenterExperienceRoute(center);
    window.requestAnimationFrame(() => centerExperienceContent?.querySelector("#routePlaceInput")?.focus());
    return;
  }

  routePlaceSearchState = "loading";
  routePlaceSearchMessage = "";
  routePlaceResults = [];
  const requestId = ++routePlaceRequestId;
  renderCenterExperienceRoute(center);

  try {
    const response = await fetch(`/api/place-search?q=${encodeURIComponent(query)}`, {
      headers: { Accept: "application/json", "X-Dail-Source": "web" },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "장소를 검색하지 못했어요");
    if (requestId !== routePlaceRequestId || centerExperienceView !== "route") return;
    routePlaceResults = Array.isArray(data.places) ? data.places : [];
    routePlaceSearchState = routePlaceResults.length ? "results" : "empty";
  } catch (error) {
    if (requestId !== routePlaceRequestId || centerExperienceView !== "route") return;
    routePlaceResults = [];
    routePlaceSearchState = "error";
    routePlaceSearchMessage = error?.message || "네이버 장소 검색에 연결하지 못했어요";
  }
  renderCenterExperienceRoute(center);
}

function selectRoutePlace(id, center) {
  const place = routePlaceResults.find((item) => item.id === id);
  if (!place) return;
  routeOrigin = {
    lat: Number(place.lat),
    lng: Number(place.lng),
    label: place.name,
    address: place.roadAddress || place.address || "",
    source: "place",
    naverPlaceId: place.naverPlaceId || "",
  };
  routePlaceQuery = place.name;
  routePlaceResults = [];
  routePlaceSearchState = "selected";
  routePlaceSearchMessage = "";
  routeLocationState = "idle";
  routeLocationMessage = "";
  renderCenterExperienceRoute(center);
}

function changeRouteOrigin(center) {
  routeOrigin = null;
  routeLocationState = "idle";
  routeLocationMessage = "";
  routeLocationRequestId += 1;
  resetRoutePlaceSearch();
  renderCenterExperienceRoute(center);
  window.requestAnimationFrame(() => centerExperienceContent?.querySelector("#routePlaceInput")?.focus());
}

async function useCurrentLocationForRoute(center) {
  if (!window.isSecureContext || !navigator.geolocation) {
    routeLocationState = "error";
    routeLocationMessage = "이 브라우저에서는 현재 위치를 사용할 수 없어요";
    renderCenterExperienceRoute(center);
    return;
  }

  routeLocationState = "loading";
  routeLocationMessage = "";
  renderCenterExperienceRoute(center);

  const requestId = ++routeLocationRequestId;
  let settled = false;
  const finish = (callback) => {
    if (settled || requestId !== routeLocationRequestId) return;
    settled = true;
    window.clearTimeout(watchdog);
    callback();
  };
  const watchdog = window.setTimeout(() => finish(() => {
    routeLocationState = "error";
    routeLocationMessage = "위치 확인 시간이 초과됐어요";
    renderCenterExperienceRoute(center);
  }), 8500);

  navigator.geolocation.getCurrentPosition(
    (position) => finish(() => {
      routeOrigin = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        label: "내 현재 위치",
        address: "",
        source: "current",
      };
      resetRoutePlaceSearch();
      routeLocationState = "success";
      routeLocationMessage = "";
      renderCenterExperienceRoute(center);
    }),
    (error) => finish(() => {
      routeLocationState = "error";
      routeLocationMessage = error?.code === 1
        ? "Safari의 위치 권한이 꺼져 있어요"
        : error?.code === 2
          ? "현재 위치 정보를 가져올 수 없어요"
          : "위치 확인 시간이 초과됐어요";
      renderCenterExperienceRoute(center);
    }),
    { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
  );
}

function openNaverRoute(center) {
  trackEvent("contact_click", center.id, "route_sheet");
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (isMobile) {
    window.location.href = naverRouteScheme(center);
    return;
  }
  window.open(routeOrigin ? naverWebRouteUrl(center) : naverSearchUrl(center), "_blank", "noopener,noreferrer");
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
      <div id="routeMiniMap" class="route-mini-map ${routeOrigin ? "has-origin" : ""}" aria-label="${escapeHtml(center.name)} 위치 지도"></div>
      <section class="route-destination-card">
        <div class="route-origin-heading">
          <div class="route-point-heading"><i class="route-point-start"></i><span>출발</span></div>
          ${routeOrigin
            ? `<button class="route-origin-change" type="button" data-route-origin-change>변경</button>`
            : `<button class="route-current-location" type="button" data-route-location ${routeLocationState === "loading" ? "disabled" : ""}>${uiIcon("locate")} ${routeLocationState === "loading" ? "확인 중" : "내 위치"}</button>`}
        </div>
        ${routeOrigin
          ? `<div class="route-origin-current">${uiIcon(routeOrigin.source === "current" ? "locate" : "map-pin")}<div><strong>${escapeHtml(routeOrigin.label)}</strong>${routeOrigin.address ? `<small>${escapeHtml(routeOrigin.address)}</small>` : ""}</div></div>`
          : `<form id="routePlaceForm" class="route-place-form" role="search">
              <label class="sr-only" for="routePlaceInput">출발 장소</label>
              ${uiIcon("search")}
              <input id="routePlaceInput" name="place" type="search" value="${escapeHtml(routePlaceQuery)}" placeholder="건물, 식당, 지하철역 검색" autocomplete="off" enterkeyhint="search" />
              <button type="submit">검색</button>
            </form>`}
        <div class="route-line" aria-hidden="true"></div>
        <div class="route-point">
          <i class="route-point-end"></i>
          <div><span>도착</span><strong>${escapeHtml(center.name)}</strong><small>${escapeHtml(center.address || center.area)}</small></div>
        </div>
      </section>
      <div id="routePlaceFeedback" class="route-place-feedback">${routePlaceResultsMarkup()}</div>
      ${routeLocationFeedbackMarkup()}
      ${routeOrigin ? `<section class="route-mode-section">
          <p class="center-sheet-kicker">이동 수단</p>
          <div class="route-mode-tabs" role="tablist" aria-label="이동 수단 선택">
            ${[
              ["public", "대중교통"],
              ["car", "자동차"],
              ["walk", "도보"],
            ].map(([mode, label]) => `<button type="button" role="tab" data-route-mode="${mode}" aria-selected="${routeMode === mode}" class="${routeMode === mode ? "active" : ""}">${label}</button>`).join("")}
          </div>
        </section>
        <section id="routeSummary" class="route-summary"></section>` : ""}
    </div>
    <footer class="center-sheet-footer route-sheet-footer">
      <button class="center-sheet-contact-button route-external-button icon-label" type="button" data-route-external ${routeOrigin ? "" : "disabled"}>
        ${routeOrigin ? `네이버 지도에서 ${routeModeLabel(routeMode)} 길찾기 ${uiIcon("external-link")}` : "출발지를 먼저 선택해 주세요"}
      </button>
    </footer>`;

  centerExperienceContent.querySelector("[data-route-back]")?.addEventListener("click", () => renderCenterExperienceDetail(center));
  centerExperienceContent.querySelector("[data-center-sheet-close]")?.addEventListener("click", closeCenterExperience);
  centerExperienceContent.querySelector("[data-route-location]")?.addEventListener("click", () => useCurrentLocationForRoute(center));
  centerExperienceContent.querySelector("[data-route-retry]")?.addEventListener("click", () => useCurrentLocationForRoute(center));
  centerExperienceContent.querySelector("[data-route-origin-change]")?.addEventListener("click", () => changeRouteOrigin(center));
  centerExperienceContent.querySelector("#routePlaceForm")?.addEventListener("submit", (event) => searchRoutePlace(event, center));
  centerExperienceContent.querySelectorAll("[data-route-place-id]").forEach((button) => button.addEventListener("click", () => {
    selectRoutePlace(button.dataset.routePlaceId, center);
  }));
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
    routeLocationState = "idle";
    routeLocationMessage = "";
    resetRoutePlaceSearch();
  }
  centerExperienceOverlay.hidden = false;
  document.body.classList.add("center-experience-open");
  window.requestAnimationFrame(() => centerExperienceOverlay.classList.add("is-visible"));
  if (view === "route") renderCenterExperienceRoute(center);
  else {
    renderCenterExperienceDetail(center);
    trackEvent("center_view", center.id, "detail_sheet");
  }
  const sheetScroller = centerExperienceContent.querySelector(".center-sheet-scroll");
  if (sheetScroller) sheetScroller.scrollTop = 0;
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
    routeLocationState = "idle";
    routeLocationMessage = "";
    routeLocationRequestId += 1;
    bookingRequestId += 1;
    bookingSelectedDate = "";
    bookingSelectedSlot = null;
    bookingAvailability = null;
    resetRoutePlaceSearch();
    routeMiniMap = null;
    routeMiniMarker = null;
    routeMiniOriginMarker = null;
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
  heroMapStatus.innerHTML = '<span class="status-pulse"></span> 내 위치 버튼을 누르면 주변을 찾아드려요';
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
    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(key)}&submodules=geocoder`;
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
    mapStatus.textContent = "센터 표시 중";

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
heroSearchForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  searchInput.value = heroSearchInput?.value.trim() || "";
  renderList();
  document.querySelector("#search")?.scrollIntoView({ behavior: "smooth", block: "start" });
  window.setTimeout(() => searchInput.focus({ preventScroll: true }), 320);
});
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
  const requestedCenterId = new URLSearchParams(location.search).get("center");
  if (requestedCenterId && centers.some((center) => center.id === requestedCenterId)) {
    selectCenter(requestedCenterId, { openDetail: true });
    document.querySelector("#search")?.scrollIntoView({ block: "start" });
    history.replaceState(null, "", `${location.pathname}#search`);
  }
}

initApp();

const AUTH_STORAGE_KEY="dail_auth_session";
const authOverlay=document.querySelector("#authOverlay"),authLoginView=document.querySelector("#authLoginView"),onboardingForm=document.querySelector("#onboardingForm"),accountView=document.querySelector("#accountView"),userMenuButton=document.querySelector("#userMenuButton"),headerAccountLink=document.querySelector("#headerAccountLink"),headerLogoutButton=document.querySelector("#headerLogoutButton"),centerDashboardLink=document.querySelector("#centerDashboardLink");
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
  currentUserProfile=data;const nickname=data?.profile?.nickname||"회원";userMenuButton.textContent=data?`${nickname}님`:"로그인";userMenuButton.classList.toggle("signed-in",Boolean(data));userMenuButton.setAttribute("aria-label",data?`${nickname}님 계정`:"로그인");headerAccountLink.hidden=!data;headerLogoutButton.hidden=!data;
  centerDashboardLink.hidden=!data?.centerAccess?.hasActiveMembership;
  if(!data)return;document.querySelector("#accountNickname").textContent=nickname;document.querySelector("#accountEmail").textContent=data.user?.email||`${data.user?.provider||"소셜"} 계정`;
}
async function initUserAuth(){
  const providers=publicConfig.auth?.providers||{};document.querySelectorAll("[data-auth-provider]").forEach(button=>{const ready=Boolean(providers[button.dataset.authProvider]);button.dataset.ready=String(ready);button.title=ready?"":"개발자 로그인 키 설정 후 사용할 수 있습니다."});
  const data=await loadUserProfile();renderAuthState(data);if(data)await loadFavoriteCenters(null,{applyPending:!data.needsOnboarding});else{favoriteCenterIds.clear();favoriteSyncReady=false}
  if(data?.needsOnboarding){onboardingForm.elements.nickname.value=data.profile?.nickname||"";openAuth("onboarding")}
  const params=new URLSearchParams(location.search);if(params.get("auth")==="success"){history.replaceState(null,"",`${location.pathname}${location.hash}`);if(data?.needsOnboarding)openAuth("onboarding");else if(data)openAuth("account")}
  if(params.get("login")==="1"){history.replaceState(null,"",location.pathname);openAuth(data?"account":"login")}
}
userMenuButton?.addEventListener("click",()=>{if(currentUserProfile)location.href="/account/";else openAuth("login")});
document.querySelector("#authCloseButton")?.addEventListener("click",closeAuth);authOverlay?.addEventListener("click",event=>{if(event.target===authOverlay)closeAuth()});
document.querySelector("#accountFindCenters")?.addEventListener("click",closeAuth);
document.addEventListener("keydown",event=>{if(event.key==="Escape"&&!authOverlay.hidden)closeAuth()});
document.querySelectorAll("[data-auth-provider]").forEach(button=>button.addEventListener("click",()=>{const provider=button.dataset.authProvider;if(button.dataset.ready!=="true"){document.querySelector("#authMessage").textContent=`${provider==='kakao'?'카카오':provider==='naver'?'네이버':'Apple'} 개발자 설정이 필요합니다.`;return}location.href=`/api/auth/start?provider=${encodeURIComponent(provider)}`}));
onboardingForm?.addEventListener("submit",async event=>{event.preventDefault();const message=document.querySelector("#onboardingMessage"),session=await activeAuthSession();if(!session)return openAuth("login");const submit=onboardingForm.querySelector("[type=submit]");submit.disabled=true;message.textContent="";const response=await fetch("/api/auth/profile",{method:"PATCH",headers:{Authorization:`Bearer ${session.access_token}`,"Content-Type":"application/json"},body:JSON.stringify({nickname:onboardingForm.elements.nickname.value.trim(),acceptRequired:onboardingForm.elements.requiredAgreement.checked,marketingAgreed:onboardingForm.elements.marketingAgreement.checked})});const data=await response.json().catch(()=>({}));submit.disabled=false;if(!response.ok){message.textContent=data.error||"회원 정보를 저장하지 못했습니다.";return}renderAuthState(data);await loadFavoriteCenters(session);openAuth("account")});
async function logoutUser(){const session=storedAuthSession();if(session?.access_token&&publicConfig.auth?.supabaseUrl)fetch(`${publicConfig.auth.supabaseUrl}/auth/v1/logout`,{method:"POST",headers:{apikey:publicConfig.auth.supabaseAnonKey,Authorization:`Bearer ${session.access_token}`}}).catch(()=>{});localStorage.removeItem(AUTH_STORAGE_KEY);currentUserProfile=null;favoriteCenterIds.clear();favoriteSyncReady=false;renderAuthState(null);if(centerExperienceId)updateFavoriteButton(centerExperienceId);closeAuth()}
headerLogoutButton?.addEventListener("click",logoutUser);
document.querySelector("#logoutButton")?.addEventListener("click",logoutUser);
document.querySelector("#deleteAccountButton")?.addEventListener("click",async()=>{if(!confirm("회원 정보와 계정을 삭제할까요? 삭제 후에는 복구할 수 없습니다."))return;const session=await activeAuthSession();if(!session)return;const response=await fetch("/api/auth/profile",{method:"DELETE",headers:{Authorization:`Bearer ${session.access_token}`}});if(!response.ok)return alert("회원 탈퇴를 처리하지 못했습니다.");localStorage.removeItem(AUTH_STORAGE_KEY);currentUserProfile=null;renderAuthState(null);closeAuth();alert("회원 탈퇴가 완료되었습니다.")});
