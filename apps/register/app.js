const API_BASE = window.location.origin;
const form = document.querySelector("#registrationForm");
const message = document.querySelector("#formMessage");
const submitButton = document.querySelector("#submitButton");
const licenseFields = document.querySelector("#licenseFields");
const licenseFileInput = document.querySelector("#licenseFileInput");
const licenseImagePathInput = document.querySelector("#licenseImagePathInput");
const photoFileInput = document.querySelector("#photoFileInput");
const photoPathInput = document.querySelector("#photoPathInput");
const photoPathsInput = document.querySelector("#photoPathsInput");
const addressInput = document.querySelector("#addressInput");
const addressSearchButton = document.querySelector("#addressSearchButton");
const addressSearchButtonLabel = addressSearchButton.querySelector("span");
const addressSearchStatus = document.querySelector("#addressSearchStatus");
const addressResults = document.querySelector("#addressResults");
const selectedAddress = document.querySelector("#selectedAddress");
const selectedRoadAddress = document.querySelector("#selectedRoadAddress");
const selectedJibunAddress = document.querySelector("#selectedJibunAddress");
const selectedMapLink = document.querySelector("#selectedMapLink");
const detailAddressLabel = document.querySelector("#detailAddressLabel");
const detailAddressInput = document.querySelector("#detailAddressInput");
const manualAddressButton = document.querySelector("#manualAddressButton");
const areaInput = document.querySelector("#areaInput");
const naverMapUrlInput = document.querySelector("#naverMapUrlInput");
const latInput = document.querySelector("#latInput");
const lngInput = document.querySelector("#lngInput");

let currentStep = 1;
let geocoderState = "loading";
let manualAddressMode = false;
let selectedBaseAddress = "";

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showStep(step) {
  currentStep = step;
  document.querySelectorAll(".form-step").forEach(function (element) {
    element.classList.toggle("active", Number(element.dataset.step) === step);
  });
  document.querySelectorAll("[data-step-dot]").forEach(function (element) {
    const number = Number(element.dataset.stepDot);
    element.classList.toggle("active", number === step);
    element.classList.toggle("done", number < step);
  });
  if (step === 3) renderSummary();
  window.scrollTo({ top: 360, behavior: "smooth" });
}

function isTherapistBackground() {
  return new FormData(form).get("therapistBackground") === "yes";
}

function syncBackground() {
  const yes = isTherapistBackground();
  licenseFields.hidden = !yes;
  licenseFields.querySelectorAll("input").forEach(function (input) {
    input.required = yes;
  });
}

function setAddressStatus(text, tone) {
  addressSearchStatus.textContent = text;
  addressSearchStatus.className = "address-status" + (tone ? " " + tone : "");
}

function mapUrl(address) {
  return address ? "https://map.naver.com/p/search/" + encodeURIComponent(address) : "";
}

function areaFromAddress(result, address) {
  const elements = result.addressElements || [];
  const sido = elements.find(function (element) {
    return (element.types || []).includes("SIDO");
  });
  const sigugun = elements.find(function (element) {
    return (element.types || []).includes("SIGUGUN");
  });
  const area = [sido && sido.longName, sigugun && sigugun.longName].filter(Boolean).join(" ");
  return area || String(address || "").split(" ").slice(0, 2).join(" ");
}

function normalizedGeocodeResults(response) {
  if (response && response.v2 && Array.isArray(response.v2.addresses)) {
    return response.v2.addresses.map(function (item) {
      return {
        roadAddress: item.roadAddress || "",
        jibunAddress: item.jibunAddress || "",
        x: item.x,
        y: item.y,
        addressElements: item.addressElements || [],
      };
    });
  }
  const items = response && response.result && Array.isArray(response.result.items)
    ? response.result.items
    : [];
  return items.map(function (item) {
    return {
      roadAddress: item.isRoadAddress ? item.address : "",
      jibunAddress: item.isRoadAddress ? "" : item.address,
      x: item.point && item.point.x,
      y: item.point && item.point.y,
      addressElements: [],
    };
  });
}

function clearSelectedAddress() {
  selectedBaseAddress = "";
  selectedAddress.hidden = true;
  detailAddressLabel.hidden = true;
  areaInput.value = "";
  naverMapUrlInput.value = "";
  latInput.value = "";
  lngInput.value = "";
}

function selectAddressResult(result) {
  const roadAddress = result.roadAddress || result.jibunAddress;
  const jibunAddress = result.jibunAddress && result.jibunAddress !== roadAddress
    ? result.jibunAddress
    : "";
  selectedBaseAddress = roadAddress;
  manualAddressMode = false;
  addressInput.value = roadAddress;
  areaInput.value = areaFromAddress(result, roadAddress);
  latInput.value = String(result.y || "");
  lngInput.value = String(result.x || "");
  naverMapUrlInput.value = mapUrl(roadAddress);
  selectedRoadAddress.textContent = roadAddress;
  selectedJibunAddress.textContent = jibunAddress ? "지번 " + jibunAddress : "";
  selectedMapLink.href = naverMapUrlInput.value;
  selectedAddress.hidden = false;
  detailAddressLabel.hidden = false;
  addressResults.hidden = true;
  addressInput.setAttribute("aria-expanded", "false");
  addressResults.innerHTML = "";
  manualAddressButton.hidden = true;
  setAddressStatus("선택한 위치가 맞는지 확인하고 상세 주소를 입력해주세요.", "success");
  detailAddressInput.focus();
}

function renderAddressResults(results) {
  addressResults.innerHTML = "";
  results.slice(0, 5).forEach(function (result) {
    const roadAddress = result.roadAddress || result.jibunAddress;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "address-result";
    button.setAttribute("role", "option");
    button.innerHTML = "<strong>" + escapeHtml(roadAddress) + "</strong>" +
      (result.jibunAddress && result.jibunAddress !== roadAddress
        ? "<small>지번 " + escapeHtml(result.jibunAddress) + "</small>"
        : "") +
      "<span>이 위치 선택</span>";
    button.addEventListener("click", function () {
      selectAddressResult(result);
    });
    addressResults.appendChild(button);
  });
  addressResults.hidden = false;
  addressInput.setAttribute("aria-expanded", "true");
}

function geocodeAddress(query) {
  return new Promise(function (resolve, reject) {
    if (!window.naver || !window.naver.maps || !window.naver.maps.Service) {
      reject(new Error("네이버 주소 검색을 불러오지 못했습니다."));
      return;
    }
    window.naver.maps.Service.geocode({ query: query }, function (status, response) {
      if (status !== window.naver.maps.Service.Status.OK) {
        reject(new Error("네이버 지도에서 주소를 확인하지 못했습니다."));
        return;
      }
      resolve(normalizedGeocodeResults(response));
    });
  });
}

async function searchAddress() {
  const query = addressInput.value.trim();
  if (!query) {
    setAddressStatus("도로명 주소를 입력해주세요.", "error");
    addressInput.focus();
    return;
  }
  if (geocoderState !== "ready") {
    setAddressStatus("주소 검색을 아직 준비 중입니다. 잠시 후 다시 눌러주세요.", "error");
    return;
  }
  addressSearchButton.disabled = true;
  addressSearchButtonLabel.textContent = "확인 중...";
  manualAddressMode = false;
  addressResults.hidden = true;
  addressInput.setAttribute("aria-expanded", "false");
  manualAddressButton.hidden = true;
  setAddressStatus("네이버 지도에서 도로명 주소를 찾고 있습니다.", "loading");
  try {
    const results = await geocodeAddress(query);
    if (!results.length) {
      clearSelectedAddress();
      setAddressStatus("검색 결과가 없습니다. 도로명과 건물번호를 확인해주세요.", "error");
      manualAddressButton.hidden = false;
      return;
    }
    if (results.length === 1) {
      selectAddressResult(results[0]);
      return;
    }
    renderAddressResults(results);
    setAddressStatus("주소가 여러 개 검색되었습니다. 센터 위치를 선택해주세요.", "ready");
  } catch (error) {
    clearSelectedAddress();
    setAddressStatus(error.message || "주소 검색 중 오류가 발생했습니다.", "error");
    manualAddressButton.hidden = false;
  } finally {
    addressSearchButton.disabled = false;
    addressSearchButtonLabel.textContent = "주소 확인";
  }
}

async function loadNaverGeocoder() {
  addressSearchButton.disabled = true;
  try {
    const response = await fetch(API_BASE + "/api/config");
    const config = await response.json();
    const key = String(config.naverMapNcpKeyId || "").trim();
    if (!key) throw new Error("네이버 지도 설정이 필요합니다.");
    await new Promise(function (resolve, reject) {
      const startedAt = Date.now();
      let timer;
      function waitUntilReady() {
        if (window.naver && window.naver.maps && window.naver.maps.Service) {
          window.clearTimeout(timer);
          resolve();
          return;
        }
        if (Date.now() - startedAt >= 10000) {
          reject(new Error("네이버 주소 검색 모듈을 불러오지 못했습니다."));
          return;
        }
        timer = window.setTimeout(waitUntilReady, 100);
      }
      if (window.naver && window.naver.maps && window.naver.maps.Service) {
        resolve();
        return;
      }
      const script = document.createElement("script");
      script.src = "https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=" +
        encodeURIComponent(key) + "&submodules=geocoder";
      script.async = true;
      script.onload = waitUntilReady;
      script.onerror = function () {
        window.clearTimeout(timer);
        reject(new Error("네이버 주소 검색에 연결하지 못했습니다."));
      };
      document.head.appendChild(script);
    });
    geocoderState = "ready";
    addressSearchButton.disabled = false;
    setAddressStatus("도로명 주소를 입력한 뒤 네이버 지도에서 확인해주세요.", "ready");
  } catch (error) {
    geocoderState = "unavailable";
    manualAddressMode = true;
    addressSearchButton.disabled = true;
    detailAddressLabel.hidden = false;
    setAddressStatus("현재 주소 자동 검색을 사용할 수 없어 직접 입력으로 전환했습니다.", "error");
  }
}

function validateStep(step) {
  const panel = document.querySelector('[data-step="' + step + '"]');
  if (step === 2 && !document.querySelector('[name="specialties"]:checked')) {
    window.alert("전문 분야를 하나 이상 선택해주세요.");
    return false;
  }
  const invalid = Array.from(panel.querySelectorAll("input,textarea")).find(function (element) {
    return !element.checkValidity();
  });
  if (invalid) {
    invalid.reportValidity();
    invalid.focus();
    return false;
  }
  if (
    step === 1 &&
    geocoderState === "ready" &&
    !manualAddressMode &&
    (!latInput.value || !lngInput.value)
  ) {
    setAddressStatus("입력한 도로명 주소를 네이버 지도에서 확인해주세요.", "error");
    addressSearchButton.focus();
    return false;
  }
  return true;
}

function fullAddress() {
  return [addressInput.value.trim(), detailAddressInput.value.trim()].filter(Boolean).join(" ");
}

function renderSummary() {
  const data = new FormData(form);
  const specialties = Array.from(document.querySelectorAll('[name="specialties"]:checked'))
    .map(function (element) { return element.value; })
    .join(", ");
  const rows = [
    ["센터명", data.get("centerName")],
    ["대표자", data.get("ownerName")],
    ["전화번호", data.get("phone")],
    ["이메일", data.get("email")],
    ["주소", fullAddress()],
    ["지도 위치", latInput.value && lngInput.value ? "네이버 지도 확인 완료" : "운영팀 확인 예정"],
    ["물리치료사 출신", isTherapistBackground() ? "예" : "아니오"],
    ["전문 분야", specialties],
    ["운영 시간", data.get("hours") || "미입력"],
  ];
  document.querySelector("#reviewSummary").innerHTML = rows.map(function (row) {
    return "<dt>" + escapeHtml(row[0]) + "</dt><dd>" + escapeHtml(row[1]) + "</dd>";
  }).join("");
}

function validateImage(file, required) {
  if (!file && !required) return;
  if (!file) throw new Error("확인 서류를 선택해주세요.");
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error("JPG, PNG, WEBP 이미지만 올릴 수 있습니다.");
  }
  if (file.size > 3 * 1024 * 1024) throw new Error("이미지는 3MB 이하로 올려주세요.");
}

async function upload(file, kind) {
  if (!file) return "";
  const response = await fetch(
    API_BASE + "/api/uploads?kind=" + encodeURIComponent(kind),
    {
      method: "POST",
      headers: { "Content-Type": file.type, "X-Movemap-Client": "register" },
      body: file,
    }
  );
  const data = await response.json().catch(function () { return {}; });
  if (!response.ok) throw new Error(data.error || "이미지 업로드에 실패했습니다.");
  return data.path;
}

document.querySelectorAll('[name="therapistBackground"]').forEach(function (element) {
  element.addEventListener("change", syncBackground);
});

document.querySelectorAll("[data-next]").forEach(function (button) {
  button.addEventListener("click", function () {
    if (validateStep(currentStep)) showStep(Number(button.dataset.next));
  });
});

document.querySelectorAll("[data-prev]").forEach(function (button) {
  button.addEventListener("click", function () {
    showStep(Number(button.dataset.prev));
  });
});

addressSearchButton.addEventListener("click", searchAddress);
addressInput.addEventListener("keydown", function (event) {
  if (event.key === "Enter") {
    event.preventDefault();
    searchAddress();
  }
});
addressInput.addEventListener("input", function () {
  if (selectedBaseAddress && addressInput.value !== selectedBaseAddress) {
    clearSelectedAddress();
    setAddressStatus("주소가 변경되었습니다. 네이버 지도에서 다시 확인해주세요.", "ready");
  }
});

manualAddressButton.addEventListener("click", function () {
  manualAddressMode = true;
  clearSelectedAddress();
  detailAddressLabel.hidden = false;
  manualAddressButton.hidden = true;
  setAddressStatus("주소를 직접 입력합니다. 지도 위치는 등록 검토 중 운영팀이 확인합니다.", "ready");
  addressInput.focus();
});

form.addEventListener("submit", async function (event) {
  event.preventDefault();
  if (!validateStep(3)) return;
  message.textContent = "";
  submitButton.disabled = true;
  submitButton.textContent = "신청 중...";
  try {
    const photoFiles = Array.from(photoFileInput.files).slice(0, 5);
    if (photoFileInput.files.length > 5) {
      throw new Error("센터 사진은 최대 5장까지 올릴 수 있습니다.");
    }
    photoFiles.forEach(function (file) { validateImage(file, false); });
    const licenseFile = licenseFileInput.files[0];
    validateImage(licenseFile, isTherapistBackground());
    const photoPaths = [];
    for (const file of photoFiles) {
      photoPaths.push(await upload(file, "center-photo"));
    }
    photoPathInput.value = photoPaths[0] || "";
    photoPathsInput.value = JSON.stringify(photoPaths);
    licenseImagePathInput.value = await upload(licenseFile, "license");
    const data = new FormData(form);
    const address = fullAddress();
    const baseAddress = addressInput.value.trim();
    const payload = {
      centerName: data.get("centerName"),
      ownerName: data.get("ownerName"),
      phone: data.get("phone"),
      email: data.get("email"),
      area: areaInput.value || baseAddress.split(" ").slice(0, 2).join(" "),
      address: address,
      naverMapUrl: naverMapUrlInput.value || mapUrl(baseAddress),
      lat: latInput.value,
      lng: lngInput.value,
      website: "",
      photoUrl: "",
      photoPath: photoPathInput.value,
      photoPaths: photoPaths,
      licenseHolderName: isTherapistBackground() ? data.get("licenseHolderName") : "해당 없음",
      licenseNumber: isTherapistBackground() ? data.get("licenseNumber") : "해당 없음",
      licenseImagePath: isTherapistBackground() ? licenseImagePathInput.value : "not-applicable",
      services: Array.from(document.querySelectorAll('[name="specialties"]:checked'))
        .map(function (element) { return element.value; })
        .join(", "),
      memo: [data.get("hours"), data.get("memo")].filter(Boolean).join("\n"),
      consent: data.get("consent") === "on",
      therapistBackground: isTherapistBackground(),
    };
    const response = await fetch(API_BASE + "/api/center-applications", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Movemap-Client": "register" },
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(function () { return {}; });
    if (!response.ok) throw new Error(result.error || "등록 신청에 실패했습니다.");
    form.reset();
    clearSelectedAddress();
    syncBackground();
    showStep(1);
    window.alert("등록 신청이 접수되었습니다. 검토 후 안내드리겠습니다.");
  } catch (error) {
    message.textContent = error.message || "서버 연결을 확인해주세요.";
    message.className = "message error";
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "등록 신청하기";
  }
});

syncBackground();
loadNaverGeocoder();
