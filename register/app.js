const API_BASE = `${window.location.origin}`;
const form = document.querySelector("#registrationForm");
const submitButton = document.querySelector("#submitButton");
const message = document.querySelector("#formMessage");
const addressInput = document.querySelector("#addressInput");
const naverMapLink = document.querySelector("#naverMapLink");
const naverMapUrlInput = document.querySelector("#naverMapUrlInput");
const mapLinkHint = document.querySelector("#mapLinkHint");
const latInput = document.querySelector("#latInput");
const lngInput = document.querySelector("#lngInput");
const photoFileInput = document.querySelector("#photoFileInput");
const photoDataUrlInput = document.querySelector("#photoDataUrlInput");
const photoPreview = document.querySelector("#photoPreview");
const licenseFileInput = document.querySelector("#licenseFileInput");
const licenseImageDataUrlInput = document.querySelector("#licenseImageDataUrlInput");
const licensePreview = document.querySelector("#licensePreview");
const NAVER_MAP_NCP_KEY_ID = "lae0rqg0zj";
let geocodeTimer = null;

function createNaverMapUrl(address) {
  const query = String(address || "").trim();
  if (!query) return "";
  return `https://map.naver.com/p/search/${encodeURIComponent(query)}`;
}

function syncNaverMapLink() {
  const url = createNaverMapUrl(addressInput.value);
  naverMapUrlInput.value = url;
  latInput.value = "";
  lngInput.value = "";

  if (!url) {
    naverMapLink.href = "#";
    naverMapLink.classList.add("disabled");
    mapLinkHint.textContent = "주소를 입력하면 지도 링크가 자동으로 준비됩니다.";
    return;
  }

  naverMapLink.href = url;
  naverMapLink.classList.remove("disabled");
  mapLinkHint.textContent = "주소 위치를 확인하는 중입니다.";
  queueGeocode();
}

function loadNaverMapSdk() {
  return new Promise((resolve, reject) => {
    if (window.naver?.maps?.Service) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(NAVER_MAP_NCP_KEY_ID)}&submodules=geocoder&v=${Date.now()}`;
    script.async = true;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

async function geocodeAddress() {
  const address = addressInput.value.trim();
  if (!address) return;

  try {
    await loadNaverMapSdk();
    if (!window.naver?.maps?.Service) throw new Error("geocoder unavailable");

    window.naver.maps.Service.geocode({ query: address }, (status, response) => {
      const result = response?.v2?.addresses?.[0];
      if (status !== window.naver.maps.Service.Status.OK || !result) {
        mapLinkHint.textContent = "지도 링크는 준비됐지만 좌표는 승인 시 지역 기준으로 잡힙니다.";
        return;
      }

      latInput.value = result.y;
      lngInput.value = result.x;
      mapLinkHint.textContent = "네이버 지도 위치가 자동으로 연결되었습니다.";
    });
  } catch {
    mapLinkHint.textContent = "지도 링크는 준비됐지만 좌표는 승인 시 지역 기준으로 잡힙니다.";
  }
}

function queueGeocode() {
  window.clearTimeout(geocodeTimer);
  geocodeTimer = window.setTimeout(geocodeAddress, 700);
}

function setMessage(text, type = "") {
  message.textContent = text;
  message.className = `message ${type}`.trim();
}

function readImageFile(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve("");
      return;
    }

    if (file.size > 850_000) {
      reject(new Error("사진은 850KB 이하로 올려주세요."));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("사진을 읽지 못했습니다."));
    reader.readAsDataURL(file);
  });
}

function renderPreview(container, dataUrl) {
  if (!dataUrl) {
    container.hidden = true;
    container.innerHTML = "";
    return;
  }

  container.hidden = false;
  container.innerHTML = `<img src="${dataUrl}" alt="" />`;
}

function formToPayload(formData) {
  return {
    centerName: formData.get("centerName"),
    ownerName: formData.get("ownerName"),
    phone: formData.get("phone"),
    area: formData.get("area"),
    address: formData.get("address"),
    naverMapUrl: formData.get("naverMapUrl"),
    lat: formData.get("lat"),
    lng: formData.get("lng"),
    website: formData.get("website"),
    photoUrl: formData.get("photoUrl"),
    photoDataUrl: formData.get("photoDataUrl"),
    licenseHolderName: formData.get("licenseHolderName"),
    licenseNumber: formData.get("licenseNumber"),
    licenseImageDataUrl: formData.get("licenseImageDataUrl"),
    services: formData.get("services"),
    memo: formData.get("memo"),
    consent: formData.get("consent") === "on",
  };
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  setMessage("");
  submitButton.disabled = true;
  submitButton.textContent = "신청 중...";

  try {
    const response = await fetch(`${API_BASE}/api/center-applications`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formToPayload(new FormData(form))),
    });
    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error || "등록 신청에 실패했습니다.", "error");
      return;
    }

    form.reset();
    syncNaverMapLink();
    renderPreview(photoPreview, "");
    renderPreview(licensePreview, "");
    setMessage("등록 신청이 접수되었습니다. 운영자 확인 후 연락드릴게요.", "success");
  } catch (error) {
    setMessage("서버 연결을 확인해 주세요.", "error");
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "등록 신청하기";
  }
});

addressInput.addEventListener("input", syncNaverMapLink);
photoFileInput.addEventListener("change", async () => {
  try {
    const dataUrl = await readImageFile(photoFileInput.files[0]);
    photoDataUrlInput.value = dataUrl;
    renderPreview(photoPreview, dataUrl);
    setMessage("");
  } catch (error) {
    photoFileInput.value = "";
    photoDataUrlInput.value = "";
    renderPreview(photoPreview, "");
    setMessage(error.message, "error");
  }
});
licenseFileInput.addEventListener("change", async () => {
  try {
    const dataUrl = await readImageFile(licenseFileInput.files[0]);
    licenseImageDataUrlInput.value = dataUrl;
    renderPreview(licensePreview, dataUrl);
    setMessage("");
  } catch (error) {
    licenseFileInput.value = "";
    licenseImageDataUrlInput.value = "";
    renderPreview(licensePreview, "");
    setMessage(error.message, "error");
  }
});
naverMapLink.addEventListener("click", (event) => {
  if (naverMapLink.classList.contains("disabled")) {
    event.preventDefault();
    addressInput.focus();
  }
});
syncNaverMapLink();
