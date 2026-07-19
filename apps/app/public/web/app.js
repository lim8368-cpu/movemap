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
let panelGestureActive = false;
let publicConfig = {
  naverMapNcpKeyId: "",
  auth: { supabaseUrl: "", supabaseAnonKey: "", providers: {} },
};
const CENTER_MARKER_MIN_ZOOM = 13;
const CENTER_DETAIL_ZOOM = 16;

function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
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
    publicConfig = { naverMapNcpKeyId: "", auth: { supabaseUrl: "", supabaseAnonKey: "", providers: {} } };
  }
}

function trackEvent(type, centerId, detail = "") {
  fetch(`${API_BASE}/api/events`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Movemap-Client": "web",
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
              <span class="badge badge-pt">✓ 물리치료사 출신</span>
              <h3>${escapeHtml(center.name)}</h3>
              <p>${escapeHtml(center.lead)}</p>
            </div>
            <span class="favorite" aria-hidden="true">♡</span>
          </div>
          <div class="meta-row">
            <span>${escapeHtml(center.area)}</span>
            <span>${escapeHtml(center.distance)}</span>
            <span class="rating">★ ${escapeHtml(center.rating)}</span>
          </div>
          <div class="card-tags">${[...center.categories,...center.tags].slice(0, 3).map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}</div>
          <span class="card-cta">센터 상세 보기 <span aria-hidden="true">→</span></span>
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
  detailPanel.querySelector(".map-popup-cta").addEventListener("click", () => trackEvent("contact_click", center.id, "map_popup"));
}

async function loadCenterReviews(centerId) {
  const list = detailPanel.querySelector("#reviewList");
  if (!list) return;
  try {
    const response = await fetch(`${API_BASE}/api/reviews?centerId=${encodeURIComponent(centerId)}`);
    const data = await response.json();
    if (!response.ok) throw new Error();
    list.innerHTML = data.reviews.map((review) => `<article><strong>${"★".repeat(review.rating)} <span>${escapeHtml(review.nickname)}</span></strong><p>${escapeHtml(review.content)}</p><small>${new Date(review.created_at).toLocaleDateString("ko-KR")}</small></article>`).join("") || "<p>첫 후기를 남겨주세요.</p>";
  } catch { list.innerHTML = "<p>후기를 불러오지 못했습니다.</p>"; }
}

async function submitReview(event, centerId) {
  event.preventDefault();
  const form = event.currentTarget;
  const message = form.querySelector(".review-message");
  const values = new FormData(form);
  const response = await fetch(`${API_BASE}/api/reviews`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ centerId, rating: Number(values.get("rating")), nickname: values.get("nickname"), content: values.get("content") }) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) { message.textContent = data.error || "후기 등록에 실패했습니다."; return; }
  form.reset(); message.textContent = "후기가 등록되었습니다."; await loadCenterReviews(centerId);
}

function openCenterDetail(id) {
  detailPanel.hidden = true;
  detailPanel.innerHTML = "";
  selectCenter(id, { openDetail: true });
}

function centerPopupContent(center) {
  return `<article class="map-popup">
    <button class="map-popup-close" type="button" aria-label="닫기" onclick="window.closeDailMapPopup()">×</button>
    <div class="map-popup-heading"><h3>${escapeHtml(center.name)}</h3><span class="map-popup-distance">${escapeHtml(center.distance)}</span></div>
    <p class="map-popup-category">운동센터 · <b>물리치료사 출신</b></p>
    <p class="map-popup-location">${escapeHtml(center.area)}</p>
    <div class="map-popup-tags">${center.tags.slice(0,2).map(tag=>`<span>${escapeHtml(tag)}</span>`).join("")}</div>
    <div class="map-popup-actions"><button class="map-popup-cta" type="button" onclick="window.trackDailContact('${escapeHtml(center.id)}')">상세보기</button><button class="map-popup-route" type="button">길찾기</button></div>
  </article>`;
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
window.trackDailContact = id => trackEvent("contact_click", id, "map_popup");

function renderPins() {
  document.querySelectorAll(".pin").forEach((pin) => {
    pin.classList.toggle("selected", pin.dataset.id === selectedId);
  });

  naverMarkers.forEach(({ marker, center }) => {
    marker.setIcon(createMarkerIcon(center.id === selectedId, center));
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

function createClusterIcon(count) {
  const size = count >= 10 ? 58 : 50;
  return {
    content: `<button class="cluster-marker ${count >= 10 ? "large" : ""}" type="button">${count}</button>`,
    size: new naver.maps.Size(size, size),
    anchor: new naver.maps.Point(size / 2, size / 2),
  };
}

function clusterCenter(group) {
  const lat = group.reduce((sum, center) => sum + center.lat, 0) / group.length;
  const lng = group.reduce((sum, center) => sum + center.lng, 0) / group.length;
  return new naver.maps.LatLng(lat, lng);
}

function boundsForCenters(group) {
  const bounds = new naver.maps.LatLngBounds();
  group.forEach((center) => {
    bounds.extend(new naver.maps.LatLng(center.lat, center.lng));
  });
  return bounds;
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
  naverMap.__clusterAnimating = true;
  naverMap.fitBounds(boundsForCenters(group), {
    top: 150,
    right: 220,
    bottom: 220,
    left: 150,
  });
  window.setTimeout(() => {
    naverMap.__clusterAnimating = false;
    syncMarkerVisibility();
  }, 320);
}

function zoomToCluster(group) {
  selectedId = "";
  renderDetail();
  renderPins();
  renderList();
  naverMap.__forceIndividualMarkers = true;

  if (group.length === 1) {
    const center = group[0];
    naverMap.panTo(new naver.maps.LatLng(center.lat, center.lng));
    naverMap.setZoom(CENTER_MARKER_MIN_ZOOM, true);
    window.setTimeout(syncMarkerVisibility, 180);
    return;
  }

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
      zoomToCluster(group);
      event?.domEvent?.stopPropagation?.();
    });

    clusterMarkers.push(marker);
  });
}

function syncMarkerVisibility() {
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
  if (naverMap.__clusterAnimating) {
    syncMarkerVisibility();
    return;
  }

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
  const label = center.name.slice(0, 7);
  const rating = center.rating && center.rating !== "신규" ? center.rating : "신규";
  const size = 112;

  return {
    content: `
      <button class="naver-marker ${isSelected ? "selected" : ""}" type="button">
        <span class="marker-name">${label}</span>
        <span class="marker-rating">★ ${rating}</span>
      </button>
    `,
    size: new naver.maps.Size(size, 42),
    anchor: new naver.maps.Point(size / 2, 10),
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
  captureAuthSessionFromHash();
  await initUserAuth();
  await loadApprovedCenters();
  renderDetail();
  renderList();
  initNaverMap();
}

initApp();

const AUTH_STORAGE_KEY="dail_auth_session";
const authOverlay=document.querySelector("#authOverlay"),authLoginView=document.querySelector("#authLoginView"),onboardingForm=document.querySelector("#onboardingForm"),accountView=document.querySelector("#accountView"),userMenuButton=document.querySelector("#userMenuButton"),headerLogoutButton=document.querySelector("#headerLogoutButton");
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
