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
const photoPathInput = document.querySelector("#photoPathInput");
const photoPreview = document.querySelector("#photoPreview");
const licenseFileInput = document.querySelector("#licenseFileInput");
const licenseImagePathInput = document.querySelector("#licenseImagePathInput");
const licensePreview = document.querySelector("#licensePreview");
let publicConfig = {
  naverMapNcpKeyId: "",
};
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

    const key = publicConfig.naverMapNcpKeyId;
    if (!key) {
      reject(new Error("Naver map key is missing"));
      return;
    }

    const script = document.createElement("script");
    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(key)}&submodules=geocoder&v=${Date.now()}`;
    script.async = true;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

async function loadPublicConfig() {
  try {
    const response = await fetch(`${API_BASE}/api/config`, {
      headers: { "X-Movemap-Client": "register" },
    });
    if (!response.ok) throw new Error("config unavailable");
    publicConfig = await response.json();
  } catch {
    publicConfig = { naverMapNcpKeyId: "" };
  }
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

function validateImageFile(file, required = false) {
  if (!file && !required) return;
  if (!file) throw new Error("면허 증빙 사진을 선택해 주세요.");
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error("JPG, PNG, WEBP 이미지만 올릴 수 있습니다.");
  }
  if (file.size > 3 * 1024 * 1024) throw new Error("이미지는 3MB 이하로 올려주세요.");
}

async function uploadPrivateImage(file, kind) {
  if (!file) return "";
  const response = await fetch(`${API_BASE}/api/uploads?kind=${encodeURIComponent(kind)}`, {
    method: "POST",
    headers: { "Content-Type": file.type, "X-Movemap-Client": "register" },
    body: file,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "비공개 이미지 업로드에 실패했습니다.");
  return data.path;
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
    photoPath: formData.get("photoPath"),
    licenseHolderName: formData.get("licenseHolderName"),
    licenseNumber: formData.get("licenseNumber"),
    licenseImagePath: formData.get("licenseImagePath"),
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
    const photoFile = photoFileInput.files[0];
    const licenseFile = licenseFileInput.files[0];
    validateImageFile(photoFile);
    validateImageFile(licenseFile, true);
    submitButton.textContent = "사진을 안전하게 업로드 중...";
    photoPathInput.value = await uploadPrivateImage(photoFile, "center-photo");
    licenseImagePathInput.value = await uploadPrivateImage(licenseFile, "license");
    submitButton.textContent = "신청 중...";
    const response = await fetch(`${API_BASE}/api/center-applications`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Movemap-Client": "register",
      },
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
    setMessage(error.message || "서버 연결을 확인해 주세요.", "error");
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "등록 신청하기";
  }
});

addressInput.addEventListener("input", syncNaverMapLink);
photoFileInput.addEventListener("change", async () => {
  try {
    const file = photoFileInput.files[0];
    validateImageFile(file);
    photoPathInput.value = "";
    renderPreview(photoPreview, file ? URL.createObjectURL(file) : "");
    setMessage("");
  } catch (error) {
    photoFileInput.value = "";
    photoPathInput.value = "";
    renderPreview(photoPreview, "");
    setMessage(error.message, "error");
  }
});
licenseFileInput.addEventListener("change", async () => {
  try {
    const file = licenseFileInput.files[0];
    validateImageFile(file, true);
    licenseImagePathInput.value = "";
    renderPreview(licensePreview, URL.createObjectURL(file));
    setMessage("");
  } catch (error) {
    licenseFileInput.value = "";
    licenseImagePathInput.value = "";
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
loadPublicConfig().finally(syncNaverMapLink);
