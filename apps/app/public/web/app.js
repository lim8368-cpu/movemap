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
    therapist: "김민재 센터장 · 물리치료사 9년",
    price: "첫 평가 30,000원",
    conversion: "상담 응답 평균 18분",
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
    therapist: "박서연 대표 · 물리치료사 7년",
    price: "체험 수업 20,000원",
    conversion: "이번 주 예약 가능",
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
    therapist: "이도윤 원장 · 물리치료사 11년",
    price: "방문 상담 무료",
    conversion: "재방문율 71%",
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
    therapist: "최하린 대표 · 물리치료사 8년",
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
const mapElement = document.querySelector("#naverMap");
const mapStatus = document.querySelector("#mapStatus");
const mapFallback = document.querySelector("#mapFallback");
const locateButton = document.querySelector("#locateButton");
const zoomInButton = document.querySelector("#zoomInButton");
const zoomOutButton = document.querySelector("#zoomOutButton");
const sidebarPanel = document.querySelector(".sidebar");

let selectedRegion = "all";
let centers = sampleCenters;
let selectedId = "";
let naverMap = null;
let naverMarkers = [];
let clusterMarkers = [];
let lastTrackedViewId = "";
let userMarker = null;
let centerFocusTimers = [];
let panelGestureActive = false;
let publicConfig = {
  naverMapNcpKeyId: "",
};
const CENTER_MARKER_MIN_ZOOM = 13;
const CENTER_DETAIL_ZOOM = 16;

function normalizeCenter(center) {
  return {
    ...center,
    region: center.region || "other",
    distance: center.distance || "신규",
    rating: center.rating || "신규",
    reviews: center.reviews || "0",
    lead: center.lead || "물리치료사가 운영하는 운동센터입니다.",
    tags: Array.isArray(center.tags) && center.tags.length ? center.tags : ["운동 관리"],
    therapist: center.therapist || "물리치료사 운영 확인",
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
    if (approvedCenters.length) {
      centers = approvedCenters;
      selectedId = centers.some((center) => center.id === selectedId) ? selectedId : "";
    }
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
    publicConfig = { naverMapNcpKeyId: "" };
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
  const text = [center.name, center.area, center.lead, center.tags.join(" ")].join(" ").toLowerCase();
  const regionMatch = selectedRegion === "all" || center.region === selectedRegion;
  const queryMatch = !query || text.includes(query);
  const tagMatch = selectedTags.length === 0 || selectedTags.some((tag) => center.tags.includes(tag));

  return regionMatch && queryMatch && tagMatch;
}

function renderList() {
  const filtered = centers.filter(matchesFilters);
  resultCount.textContent = `${filtered.length}곳`;

  centerList.innerHTML = filtered
    .map(
      (center) => `
        <button class="center-card ${center.id === selectedId ? "active" : ""}" type="button" data-card-id="${center.id}">
          <div class="card-top">
            <div>
              <h3>${center.name}</h3>
              <p>${center.lead}</p>
            </div>
            <span class="badge">자격 확인</span>
          </div>
          <div class="meta-row">
            <span>${center.area}</span>
            <span>${center.distance}</span>
            <span>평점 ${center.rating}</span>
          </div>
        </button>
      `
    )
    .join("");

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

  const photoSrc = center.photoDataUrl || center.photoUrl || "";
  const showPhoto = photoSrc && /^https?:\/\/|^data:image\//.test(photoSrc);

  detailPanel.hidden = false;
  document.body.classList.add("detail-open");
  detailPanel.innerHTML = `
    <div>
      <span class="badge">물리치료사 운영 확인</span>
      <h2>${center.name}</h2>
      ${
        showPhoto
          ? `<img class="center-detail-photo" src="${photoSrc}" alt="${center.name} 대표 사진" />`
          : ""
      }
      <p>${center.lead}</p>
      <p><strong>${center.therapist}</strong></p>
      <div class="tag-row">
        ${center.tags.map((tag) => `<span class="tag">${tag}</span>`).join("")}
      </div>
    </div>
    <div class="metric-box">
      <div class="metric">
        <strong>${center.rating}</strong>
        <span>이용자 평점 · 후기 ${center.reviews}개</span>
      </div>
      <div class="metric">
        <strong>${center.price}</strong>
        <span>진입 장벽을 낮춘 첫 방문 상품</span>
      </div>
      <div class="metric">
        <strong>${center.conversion}</strong>
        <span>센터장 홍보 성과 지표</span>
      </div>
      <button class="primary-button contact-button" type="button" data-contact-id="${center.id}">
        상담 요청 기록하기
      </button>
    </div>
  `;

  detailPanel.querySelector(".contact-button").addEventListener("click", () => {
    trackEvent("contact_click", center.id, "detail_panel");
  });
}

function openCenterDetail(id) {
  selectCenter(id, { openDetail: true });
}

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
    const targetZoom = options.openDetail ? CENTER_DETAIL_ZOOM : CENTER_MARKER_MIN_ZOOM;
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
      naverMap.__clusterAnimating = false;
      naverMap.__forceIndividualMarkers = true;
      syncMarkerVisibility();
    }, 360);
  }
  syncMarkerVisibility();
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
    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(key)}&v=${Date.now()}`;
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
      scaleControl: false,
      logoControl: true,
      mapDataControl: false,
      zoomControl: false,
    });

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

checkboxes.forEach((box) => box.addEventListener("change", renderList));
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

async function initApp() {
  await loadPublicConfig();
  await loadApprovedCenters();
  renderDetail();
  renderList();
  initNaverMap();
}

initApp();
