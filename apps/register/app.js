const API_BASE = window.location.origin;
const form = document.querySelector("#registrationForm");
const message = document.querySelector("#formMessage");
const submitButton = document.querySelector("#submitButton");
const licenseFields = document.querySelector("#licenseFields");
const licenseFileInput = document.querySelector("#licenseFileInput");
const degreeFields = document.querySelector("#degreeFields");
const degreeFileInput = document.querySelector("#degreeFileInput");
const qualificationImagePathInput = document.querySelector("#qualificationImagePathInput");
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
const registrationSteps = document.querySelector(".steps");
const registrationSuccess = document.querySelector("#registrationSuccess");
const successEmail = document.querySelector("#successEmail");
const successDashboardLink = document.querySelector("#successDashboardLink");
const registrationAuthGate = document.querySelector("#registrationAuthGate");
const registrationAuthLoading = document.querySelector("#registrationAuthLoading");
const registrationAuthActions = document.querySelector("#registrationAuthActions");
const registrationIdentity = document.querySelector("#registrationIdentity");
const registrationIdentityName = document.querySelector("#registrationIdentityName");
const registrationIdentityEmail = document.querySelector("#registrationIdentityEmail");
const registrationLogout = document.querySelector("#registrationLogout");
const existingApplicationStatus = document.querySelector("#existingApplicationStatus");
const applicationStatusBadge = document.querySelector("#applicationStatusBadge");
const applicationStatusTitle = document.querySelector("#applicationStatusTitle");
const applicationStatusMessage = document.querySelector("#applicationStatusMessage");
const mathChallenge = document.querySelector("#mathChallenge");
const challengePrompt = document.querySelector("#challengePrompt");
const challengeAnswer = document.querySelector("#challengeAnswer");
const challengeStatus = document.querySelector("#challengeStatus");
const turnstileChallenge = document.querySelector("#turnstileChallenge");
const companyWebsite = document.querySelector("#companyWebsite");
const eligibilityNotice = document.querySelector("#eligibilityNotice");
const registrationWeeklySchedule = document.querySelector("#registrationWeeklySchedule");
const scheduleSummaryElement = document.querySelector("#scheduleSummary");

let currentStep = 1;
let geocoderState = "loading";
let manualAddressMode = false;
let selectedBaseAddress = "";
let captchaConfig = null;
let turnstileWidgetId = null;
let registrationToken = "";
let formStartedAt = Date.now();
let publicConfig = { auth: { supabaseUrl: "", supabaseAnonKey: "", providers: {} } };
let authSession = null;
let authProfile = null;
let registrationModulesStarted = false;
let registrationSchedule = {};
const AUTH_STORAGE_KEY = "dail_auth_session";
const AUTH_RETURN_KEY = "dail_auth_return_to";
const partnerInviteToken = new URLSearchParams(window.location.search).get("invite") || "";
let partnerInvite = null;
const DAY_ROWS = [
  ["monday", "월요일"],
  ["tuesday", "화요일"],
  ["wednesday", "수요일"],
  ["thursday", "목요일"],
  ["friday", "금요일"],
  ["saturday", "토요일"],
  ["sunday", "일요일"],
];
const DEFAULT_SCHEDULE = {
  monday: { closed: false, open: "09:00", close: "21:00" },
  tuesday: { closed: false, open: "09:00", close: "21:00" },
  wednesday: { closed: false, open: "09:00", close: "21:00" },
  thursday: { closed: false, open: "09:00", close: "21:00" },
  friday: { closed: false, open: "09:00", close: "21:00" },
  saturday: { closed: false, open: "10:00", close: "17:00" },
  sunday: { closed: true, open: "10:00", close: "17:00" },
};

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatPhoneNumber(value) {
  const digits = String(value || "").replace(/\D/g, "").slice(0, 11);
  if (!digits) return "";
  if (digits.startsWith("02")) {
    if (digits.length <= 2) return digits;
    if (digits.length <= 5) return digits.slice(0, 2) + "-" + digits.slice(2);
    if (digits.length <= 9) return digits.slice(0, 2) + "-" + digits.slice(2, 5) + "-" + digits.slice(5);
    return digits.slice(0, 2) + "-" + digits.slice(2, 6) + "-" + digits.slice(6);
  }
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return digits.slice(0, 3) + "-" + digits.slice(3);
  return digits.slice(0, 3) + "-" + digits.slice(3, 7) + "-" + digits.slice(7);
}

function timeOptions(selected) {
  const options = [];
  for (let minutes = 0; minutes < 24 * 60; minutes += 30) {
    const value = String(Math.floor(minutes / 60)).padStart(2, "0") + ":" + String(minutes % 60).padStart(2, "0");
    options.push('<option value="' + value + '"' + (value === selected ? " selected" : "") + ">" + value + "</option>");
  }
  return options.join("");
}

function normalizeSchedule(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return Object.fromEntries(DAY_ROWS.map(function (row) {
    const key = row[0];
    const fallback = DEFAULT_SCHEDULE[key];
    const item = source[key] && typeof source[key] === "object" ? source[key] : {};
    return [key, {
      closed: item.closed === undefined ? fallback.closed : Boolean(item.closed),
      open: /^\d{2}:(?:00|30)$/.test(item.open) ? item.open : fallback.open,
      close: /^\d{2}:(?:00|30)$/.test(item.close) ? item.close : fallback.close,
    }];
  }));
}

function minutesFromTime(value) {
  const parts = String(value || "").split(":").map(Number);
  return parts[0] * 60 + parts[1];
}

function registrationScheduleSummary(value = registrationSchedule) {
  const schedule = normalizeSchedule(value);
  const weekday = ["monday", "tuesday", "wednesday", "thursday", "friday"].map(function (key) {
    return schedule[key];
  });
  const sameWeekday = weekday.every(function (item) {
    return item.closed === weekday[0].closed && item.open === weekday[0].open && item.close === weekday[0].close;
  });
  const parts = [];
  if (sameWeekday) {
    parts.push(weekday[0].closed ? "평일 휴무" : "평일 " + weekday[0].open + "–" + weekday[0].close);
  } else {
    DAY_ROWS.slice(0, 5).forEach(function (row) {
      const item = schedule[row[0]];
      parts.push(row[1].slice(0, 1) + " " + (item.closed ? "휴무" : item.open + "–" + item.close));
    });
  }
  DAY_ROWS.slice(5).forEach(function (row) {
    const item = schedule[row[0]];
    parts.push(row[1].slice(0, 1) + " " + (item.closed ? "휴무" : item.open + "–" + item.close));
  });
  return parts.join(" · ");
}

function scheduleIsValid() {
  const openDays = DAY_ROWS.filter(function (row) {
    return !registrationSchedule[row[0]].closed;
  });
  return openDays.length > 0 && openDays.every(function (row) {
    const item = registrationSchedule[row[0]];
    return minutesFromTime(item.close) > minutesFromTime(item.open);
  });
}

function renderRegistrationSchedule() {
  registrationSchedule = normalizeSchedule(registrationSchedule);
  registrationWeeklySchedule.innerHTML = DAY_ROWS.map(function (row) {
    const key = row[0];
    const label = row[1];
    const item = registrationSchedule[key];
    return '<div class="schedule-row ' + (item.closed ? "is-closed" : "") + '" data-schedule-day="' + key + '">' +
      "<strong>" + label + "</strong>" +
      '<label class="day-toggle"><input type="checkbox" data-schedule-closed ' + (item.closed ? "" : "checked") + " /><span>" + (item.closed ? "휴무" : "운영") + "</span></label>" +
      '<label><span>시작</span><select data-schedule-open ' + (item.closed ? "disabled" : "") + ">" + timeOptions(item.open) + "</select></label>" +
      "<i>–</i>" +
      '<label><span>종료</span><select data-schedule-close ' + (item.closed ? "disabled" : "") + ">" + timeOptions(item.close) + "</select></label>" +
      "</div>";
  }).join("");
  const summary = registrationScheduleSummary();
  form.elements.openingSchedule.value = JSON.stringify(registrationSchedule);
  form.elements.hours.value = summary;
  scheduleSummaryElement.textContent = scheduleIsValid()
    ? summary
    : "운영일을 하나 이상 선택하고 종료 시간을 시작 시간보다 늦게 설정해주세요.";
  scheduleSummaryElement.classList.toggle("error", !scheduleIsValid());
}

function showStep(step) {
  syncBackground();
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

function qualificationType() {
  return String(new FormData(form).get("qualificationType") || "");
}

function isTherapistBackground() {
  return qualificationType() === "physical_therapist";
}

function syncBackground() {
  const selected = qualificationType();
  const isTherapist = selected === "physical_therapist";
  const isSportsScience = selected === "sports_science";
  licenseFields.hidden = !isTherapist;
  degreeFields.hidden = !isSportsScience;
  eligibilityNotice.hidden = Boolean(selected);
  licenseFields.querySelectorAll("input").forEach(function (input) {
    if (input.type !== "file") input.required = isTherapist;
    if (!isTherapist) input.value = "";
  });
  degreeFields.querySelectorAll("input,select").forEach(function (input) {
    if (input.type !== "file") input.required = isSportsScience;
    if (!isSportsScience) input.value = "";
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
    window.alert("주요 회복 분야를 하나 이상 선택해주세요.");
    return false;
  }
  if (step === 2 && !scheduleIsValid()) {
    scheduleSummaryElement.classList.add("error");
    scheduleSummaryElement.textContent = "운영일을 하나 이상 선택하고 종료 시간을 시작 시간보다 늦게 설정해주세요.";
    registrationWeeklySchedule.querySelector("select:not(:disabled),input")?.focus();
    return false;
  }
  if (step === 2) {
    const credentialFile = isTherapistBackground() ? licenseFileInput.files[0] : degreeFileInput.files[0];
    try {
      validateUploadFile(credentialFile, true, true);
    } catch (error) {
      window.alert(error.message);
      (isTherapistBackground() ? licenseFileInput : degreeFileInput).focus();
      return false;
    }
  }
  const invalid = Array.from(panel.querySelectorAll("input,textarea,select")).find(function (element) {
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

function showRegistrationSuccess(email) {
  successEmail.textContent = email;
  successDashboardLink.href = "/account/";
  registrationSteps.hidden = true;
  form.hidden = true;
  registrationSuccess.hidden = false;
  registrationSuccess.focus({ preventScroll: true });
  registrationSuccess.scrollIntoView({ behavior: "smooth", block: "center" });
}

function renderSummary() {
  const data = new FormData(form);
  const specialties = Array.from(document.querySelectorAll('[name="specialties"]:checked'))
    .map(function (element) { return element.value; })
    .join(", ");
  const rows = [
    ["센터명", data.get("centerName")],
    ["대표자", data.get("ownerName")],
    ["전화번호", formatPhoneNumber(data.get("phone"))],
    ["센터 운영 계정", (authProfile?.profile?.nickname || authProfile?.user?.email || "현재 로그인 계정") + "에 권한 연결"],
    ["심사 연락 이메일", data.get("email")],
    ["주소", fullAddress()],
    ["지도 위치", latInput.value && lngInput.value ? "네이버 지도 확인 완료" : "운영팀 확인 예정"],
    ["전문 자격", isTherapistBackground()
      ? "물리치료사 면허 · " + data.get("licenseHolderName")
      : "체육학 " + data.get("degreeLevel") + " · " + data.get("degreeSchool")],
    ["제출 서류", isTherapistBackground() ? "물리치료사 면허 확인 서류" : "체육학 학위 인증서"],
    ["주요 회복 분야", specialties],
    ["운영 시간", data.get("hours") || "미입력"],
  ];
  document.querySelector("#reviewSummary").innerHTML = rows.map(function (row) {
    return "<dt>" + escapeHtml(row[0]) + "</dt><dd>" + escapeHtml(row[1]) + "</dd>";
  }).join("");
}

async function loadTurnstile(siteKey) {
  await new Promise(function (resolve, reject) {
    if (window.turnstile) return resolve();
    const existing = document.querySelector('script[data-dail-turnstile]');
    if (existing) {
      existing.addEventListener("load", resolve, { once: true });
      existing.addEventListener("error", reject, { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    script.dataset.dailTurnstile = "true";
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
  turnstileChallenge.hidden = false;
  turnstileWidgetId = window.turnstile.render(turnstileChallenge, {
    sitekey: siteKey,
    language: "ko",
    theme: "light",
    callback: function () {
      challengeStatus.textContent = "사람 확인이 완료되었습니다.";
      challengeStatus.className = "success";
    },
    "expired-callback": function () {
      challengeStatus.textContent = "보안 확인 시간이 만료되었습니다. 다시 확인해 주세요.";
      challengeStatus.className = "error";
    },
    "error-callback": function () {
      if (captchaConfig?.fallbackChallenge) activateSignedMathFallback(captchaConfig.fallbackChallenge);
    },
  });
}

function activateSignedMathFallback(fallbackChallenge) {
  captchaConfig = fallbackChallenge;
  turnstileChallenge.hidden = true;
  challengePrompt.textContent = fallbackChallenge.prompt;
  challengeAnswer.value = "";
  mathChallenge.hidden = false;
  challengeStatus.textContent = "보안 위젯 대신 간단한 계산 확인을 진행합니다.";
  challengeStatus.className = "";
}

async function loadRegistrationChallenge() {
  registrationToken = "";
  formStartedAt = Date.now();
  challengeStatus.textContent = "보안 확인을 준비하고 있습니다.";
  challengeStatus.className = "";
  mathChallenge.hidden = true;
  if (window.turnstile && turnstileWidgetId !== null) {
    window.turnstile.remove(turnstileWidgetId);
    turnstileWidgetId = null;
  }
  turnstileChallenge.innerHTML = "";
  turnstileChallenge.hidden = true;
  try {
    const response = await fetch(API_BASE + "/api/registration-challenge", {
      headers: { "X-DAIL-Source": "register" },
    });
    const config = await response.json();
    if (!response.ok) throw new Error(config.error || "보안 확인을 불러오지 못했습니다.");
    captchaConfig = config;
    if (config.mode === "turnstile") {
      try {
        await loadTurnstile(config.siteKey);
        challengeStatus.textContent = "아래 보안 확인을 완료해 주세요.";
      } catch {
        if (!config.fallbackChallenge) throw new Error("보안 확인을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
        activateSignedMathFallback(config.fallbackChallenge);
      }
    } else {
      challengePrompt.textContent = config.prompt;
      challengeAnswer.value = "";
      mathChallenge.hidden = false;
      challengeStatus.textContent = "간단한 계산 문제의 정답을 입력해 주세요.";
    }
  } catch (error) {
    captchaConfig = null;
    challengeStatus.textContent = error.message || "보안 확인을 준비하지 못했습니다.";
    challengeStatus.className = "error";
  }
}

async function ensureRegistrationSession() {
  if (registrationToken) return registrationToken;
  if (!captchaConfig) throw new Error("보안 확인을 다시 불러와 주세요.");
  challengeStatus.textContent = "보안 확인 중입니다.";
  challengeStatus.className = "";
  const turnstileToken = captchaConfig.mode === "turnstile" && window.turnstile
    ? window.turnstile.getResponse(turnstileWidgetId)
    : "";
  const response = await fetch(API_BASE + "/api/registration-session", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-DAIL-Source": "register",
    },
    body: JSON.stringify({
      formStartedAt,
      companyWebsite: companyWebsite.value,
      challengeToken: captchaConfig.challengeToken || "",
      challengeAnswer: challengeAnswer.value,
      turnstileToken,
      challengeMode: captchaConfig.mode,
    }),
  });
  const data = await response.json().catch(function () { return {}; });
  if (!response.ok) {
    if (window.turnstile && turnstileWidgetId !== null) window.turnstile.reset(turnstileWidgetId);
    await loadRegistrationChallenge();
    throw new Error(data.error || "사람 확인에 실패했습니다.");
  }
  registrationToken = data.registrationToken;
  challengeStatus.textContent = "보안 확인이 완료되었습니다. 신청을 전송합니다.";
  challengeStatus.className = "success";
  return registrationToken;
}

function validateUploadFile(file, required, credential = false) {
  if (!file && !required) return;
  if (!file) throw new Error("확인 서류를 선택해주세요.");
  const allowed = credential
    ? ["image/jpeg", "image/png", "image/webp", "application/pdf"]
    : ["image/jpeg", "image/png", "image/webp"];
  if (!allowed.includes(file.type)) {
    throw new Error(credential ? "JPG, PNG, WEBP 또는 PDF 파일만 올릴 수 있습니다." : "JPG, PNG, WEBP 이미지만 올릴 수 있습니다.");
  }
  const limit = credential ? 5 : 3;
  if (file.size > limit * 1024 * 1024) throw new Error("파일은 " + limit + "MB 이하로 올려주세요.");
}

async function upload(file, kind) {
  if (!file) return "";
  const response = await fetch(
    API_BASE + "/api/uploads?kind=" + encodeURIComponent(kind),
    {
      method: "POST",
      headers: {
        "Content-Type": file.type,
        "X-Movemap-Client": "register",
        "X-DAIL-Source": "register",
        "X-Registration-Token": registrationToken,
        "Authorization": "Bearer " + authSession.access_token,
      },
      body: file,
    }
  );
  const data = await response.json().catch(function () { return {}; });
  if (!response.ok) throw new Error(data.error || "이미지 업로드에 실패했습니다.");
  return data.path;
}

function storedAuthSession() {
  try {
    return JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY) || "null");
  } catch {
    return null;
  }
}

async function refreshAuthSession(session) {
  const auth = publicConfig.auth || {};
  if (!session?.refresh_token || !auth.supabaseUrl || !auth.supabaseAnonKey) return null;
  const response = await fetch(auth.supabaseUrl + "/auth/v1/token?grant_type=refresh_token", {
    method: "POST",
    headers: {
      "apikey": auth.supabaseAnonKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ refresh_token: session.refresh_token }),
  });
  if (!response.ok) return null;
  const next = await response.json();
  next.expires_at = Math.floor(Date.now() / 1000) + (Number(next.expires_in) || 3600);
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(next));
  return next;
}

async function activeAuthSession() {
  let session = storedAuthSession();
  if (!session) return null;
  if (Number(session.expires_at || 0) < Math.floor(Date.now() / 1000) + 60) {
    session = await refreshAuthSession(session);
  }
  if (!session) localStorage.removeItem(AUTH_STORAGE_KEY);
  return session;
}

function providerLabel(provider) {
  if (provider === "kakao") return "카카오";
  if (provider === "naver") return "네이버";
  if (provider === "apple") return "Apple";
  return "소셜";
}

function startRegistrationModules() {
  if (registrationModulesStarted) return;
  registrationModulesStarted = true;
  syncBackground();
  registrationSchedule = normalizeSchedule(registrationSchedule);
  renderRegistrationSchedule();
  loadNaverGeocoder();
  loadRegistrationChallenge();
}

function showApplicationStatus(application) {
  if (!application) {
    existingApplicationStatus.hidden = true;
    return false;
  }
  const status = String(application.status || "");
  if (status === "pending") {
    applicationStatusBadge.textContent = "심사 중";
    applicationStatusBadge.className = "pending";
    applicationStatusTitle.textContent = (application.center_name || "센터") + " 등록 신청을 검토하고 있습니다";
    applicationStatusMessage.textContent = "승인 또는 보완 안내 전까지 같은 계정으로 새 신청을 제출할 수 없습니다.";
    existingApplicationStatus.hidden = false;
    registrationSteps.hidden = true;
    form.hidden = true;
    return true;
  }
  if (status === "rejected") {
    applicationStatusBadge.textContent = "보완 필요";
    applicationStatusBadge.className = "rejected";
    applicationStatusTitle.textContent = (application.center_name || "이전 신청") + "의 보완 사항을 확인해주세요";
    applicationStatusMessage.textContent = application.rejection_reason || "신청 정보를 보완해 다시 제출할 수 있습니다.";
    existingApplicationStatus.hidden = false;
  } else {
    existingApplicationStatus.hidden = true;
  }
  return false;
}

function revealRegistration(profileData) {
  authProfile = profileData;
  registrationAuthGate.hidden = true;
  registrationIdentity.hidden = false;
  const nickname = profileData.profile?.nickname || profileData.user?.email || "DAIL 회원";
  const provider = providerLabel(profileData.user?.provider);
  registrationIdentityName.textContent = nickname + " · " + provider + " 계정";
  registrationIdentityEmail.textContent = profileData.user?.email || "이메일 비공개 계정";
  const ownerNameInput = form.elements.ownerName;
  const emailInput = form.elements.email;
  if (!ownerNameInput.value) ownerNameInput.value = profileData.profile?.nickname || "";
  if (!emailInput.value && profileData.user?.email && !profileData.user.email.endsWith(".invalid")) {
    emailInput.value = profileData.user.email;
  }
  if (partnerInvite?.application) {
    if (!form.elements.centerName.value) form.elements.centerName.value = partnerInvite.application.centerName || "";
    if (!form.elements.ownerName.value) form.elements.ownerName.value = partnerInvite.application.applicantName || "";
    emailInput.value = partnerInvite.application.contactEmail || emailInput.value;
    emailInput.readOnly = true;
  }
  const pending = showApplicationStatus(profileData.centerAccess?.latestApplication);
  if (!pending) {
    registrationSteps.hidden = false;
    form.hidden = false;
    startRegistrationModules();
  }
}

function showLoginGate(messageText) {
  authSession = null;
  authProfile = null;
  registrationAuthGate.hidden = false;
  registrationIdentity.hidden = true;
  existingApplicationStatus.hidden = true;
  registrationSteps.hidden = true;
  form.hidden = true;
  registrationAuthLoading.textContent = messageText || "센터를 신청할 DAIL 계정으로 로그인해주세요.";
  registrationAuthActions.hidden = false;
}

function showInviteError(messageText) {
  authSession = null;
  authProfile = null;
  registrationAuthGate.hidden = false;
  registrationIdentity.hidden = true;
  existingApplicationStatus.hidden = true;
  registrationSteps.hidden = true;
  form.hidden = true;
  registrationAuthGate.querySelector("h2").textContent = "센터 등록 초대 링크를 확인해주세요";
  registrationAuthGate.querySelector(":scope > p:not(.registration-auth-eyebrow)").textContent = "정식 센터 등록은 파트너 신청과 서류 검토가 완료된 센터에만 안내됩니다.";
  registrationAuthLoading.innerHTML = escapeHtml(messageText || "유효한 초대 링크가 아닙니다.") + '<br /><a href="/partner-apply/">파트너 센터 신청하기</a>';
  registrationAuthActions.hidden = true;
}

async function validatePartnerInvite() {
  if (!partnerInviteToken) return null;
  const response = await fetch(API_BASE + "/api/partner-registration-invites?token=" + encodeURIComponent(partnerInviteToken));
  const result = await response.json().catch(function () { return {}; });
  if (!response.ok || !result.valid) throw new Error(result.error || "유효한 센터 등록 초대 링크가 아닙니다.");
  return result;
}

async function initRegistrationPage() {
  try {
    partnerInvite = await validatePartnerInvite();
    if (!partnerInvite) {
      showInviteError("먼저 파트너 센터 신청을 남겨주세요. 서류 검토 후 정식 등록 링크를 보내드립니다.");
      return;
    }
  } catch (error) {
    showInviteError(error.message);
    return;
  }
  try {
    const response = await fetch(API_BASE + "/api/config");
    publicConfig = await response.json();
  } catch {
    publicConfig = { auth: { supabaseUrl: "", supabaseAnonKey: "", providers: {} } };
  }
  const providers = publicConfig.auth?.providers || {};
  document.querySelectorAll("[data-registration-provider]").forEach(function (button) {
    const ready = Boolean(providers[button.dataset.registrationProvider]);
    button.dataset.ready = String(ready);
    button.disabled = !ready;
    button.title = ready ? "" : "로그인 설정을 준비하고 있습니다.";
  });
  authSession = await activeAuthSession();
  if (!authSession?.access_token) {
    showLoginGate();
    return;
  }
  try {
    const response = await fetch(API_BASE + "/api/auth/profile", {
      headers: { "Authorization": "Bearer " + authSession.access_token },
    });
    if (response.status === 401) {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      showLoginGate("로그인 시간이 만료되었습니다. 다시 로그인해주세요.");
      return;
    }
    const profileData = await response.json().catch(function () { return {}; });
    if (!response.ok) throw new Error(profileData.error || "계정 정보를 불러오지 못했습니다.");
    const invitedEmail = String(partnerInvite?.application?.contactEmail || "").trim().toLowerCase();
    const signedInEmail = String(profileData.user?.email || "").trim().toLowerCase();
    if (!signedInEmail || signedInEmail !== invitedEmail) {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      showLoginGate("파트너 신청에 사용한 " + invitedEmail + " 계정으로 로그인해 주세요.");
      return;
    }
    revealRegistration(profileData);
  } catch (error) {
    showLoginGate(error.message || "로그인 상태를 확인하지 못했습니다.");
  }
}

document.querySelectorAll("[data-registration-provider]").forEach(function (button) {
  button.addEventListener("click", function () {
    if (button.dataset.ready !== "true") return;
    sessionStorage.setItem(AUTH_RETURN_KEY, "/register/?invite=" + encodeURIComponent(partnerInviteToken));
    location.href = "/api/auth/start?provider=" + encodeURIComponent(button.dataset.registrationProvider);
  });
});

registrationLogout.addEventListener("click", async function () {
  const auth = publicConfig.auth || {};
  if (authSession?.access_token && auth.supabaseUrl && auth.supabaseAnonKey) {
    fetch(auth.supabaseUrl + "/auth/v1/logout", {
      method: "POST",
      headers: {
        "apikey": auth.supabaseAnonKey,
        "Authorization": "Bearer " + authSession.access_token,
      },
    }).catch(function () {});
  }
  localStorage.removeItem(AUTH_STORAGE_KEY);
  showLoginGate("다른 DAIL 계정으로 로그인해주세요.");
});

document.querySelectorAll('[name="qualificationType"]').forEach(function (element) {
  element.addEventListener("change", function () {
    syncBackground();
    if (currentStep === 1 && validateStep(1)) {
      showStep(2);
    }
  });
});

form.elements.phone.addEventListener("input", function (event) {
  const formatted = formatPhoneNumber(event.target.value);
  if (event.target.value !== formatted) event.target.value = formatted;
});

registrationWeeklySchedule.addEventListener("change", function (event) {
  const row = event.target.closest("[data-schedule-day]");
  if (!row) return;
  const day = row.dataset.scheduleDay;
  if (event.target.matches("[data-schedule-closed]")) {
    registrationSchedule[day].closed = !event.target.checked;
  } else if (event.target.matches("[data-schedule-open]")) {
    registrationSchedule[day].open = event.target.value;
  } else if (event.target.matches("[data-schedule-close]")) {
    registrationSchedule[day].close = event.target.value;
  }
  renderRegistrationSchedule();
});

document.querySelectorAll("[data-schedule-copy]").forEach(function (button) {
  button.addEventListener("click", function () {
    if (button.dataset.scheduleCopy === "weekdays") {
      ["tuesday", "wednesday", "thursday", "friday"].forEach(function (day) {
        registrationSchedule[day] = { ...registrationSchedule.monday };
      });
    } else {
      registrationSchedule.sunday = { ...registrationSchedule.saturday };
    }
    renderRegistrationSchedule();
  });
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
  authSession = await activeAuthSession();
  if (!authSession?.access_token) {
    showLoginGate("로그인 시간이 만료되었습니다. 다시 로그인해주세요.");
    registrationAuthGate.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }
  message.textContent = "";
  submitButton.disabled = true;
  submitButton.textContent = "신청 중...";
  try {
    await ensureRegistrationSession();
    const photoFiles = Array.from(photoFileInput.files).slice(0, 5);
    if (photoFileInput.files.length > 5) {
      throw new Error("센터 사진은 최대 5장까지 올릴 수 있습니다.");
    }
    photoFiles.forEach(function (file) { validateUploadFile(file, false); });
    const credentialFile = isTherapistBackground() ? licenseFileInput.files[0] : degreeFileInput.files[0];
    validateUploadFile(credentialFile, true, true);
    const photoPaths = [];
    for (const file of photoFiles) {
      photoPaths.push(await upload(file, "center-photo"));
    }
    photoPathInput.value = photoPaths[0] || "";
    photoPathsInput.value = JSON.stringify(photoPaths);
    qualificationImagePathInput.value = await upload(credentialFile, "qualification");
    const data = new FormData(form);
    const signupEmail = String(data.get("email") || "").trim().toLowerCase();
    const address = fullAddress();
    const baseAddress = addressInput.value.trim();
    const payload = {
      centerName: data.get("centerName"),
      ownerName: data.get("ownerName"),
      phone: formatPhoneNumber(data.get("phone")),
      email: signupEmail,
      area: areaInput.value || baseAddress.split(" ").slice(0, 2).join(" "),
      address: address,
      naverMapUrl: naverMapUrlInput.value || mapUrl(baseAddress),
      lat: latInput.value,
      lng: lngInput.value,
      website: "",
      photoUrl: "",
      photoPath: photoPathInput.value,
      photoPaths: photoPaths,
      qualificationType: qualificationType(),
      qualificationHolderName: isTherapistBackground() ? data.get("licenseHolderName") : data.get("degreeHolderName"),
      qualificationNumber: isTherapistBackground()
        ? data.get("licenseNumber")
        : [data.get("degreeLevel"), data.get("degreeSchool"), data.get("degreeMajor")].filter(Boolean).join(" · "),
      qualificationImagePath: qualificationImagePathInput.value,
      licenseHolderName: isTherapistBackground() ? data.get("licenseHolderName") : data.get("degreeHolderName"),
      licenseNumber: isTherapistBackground()
        ? data.get("licenseNumber")
        : [data.get("degreeLevel"), data.get("degreeSchool"), data.get("degreeMajor")].filter(Boolean).join(" · "),
      licenseImagePath: qualificationImagePathInput.value,
      degreeLevel: isTherapistBackground() ? "" : data.get("degreeLevel"),
      degreeSchool: isTherapistBackground() ? "" : data.get("degreeSchool"),
      degreeMajor: isTherapistBackground() ? "" : data.get("degreeMajor"),
      services: Array.from(document.querySelectorAll('[name="specialties"]:checked'))
        .map(function (element) { return element.value; })
        .join(", "),
      openingSchedule: registrationSchedule,
      openingHours: data.get("hours"),
      memo: data.get("memo"),
      consent: data.get("consent") === "on",
      therapistBackground: isTherapistBackground(),
      registrationToken: registrationToken,
      partnerInviteToken: partnerInviteToken,
    };
    const response = await fetch(API_BASE + "/api/center-applications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Movemap-Client": "register",
        "X-DAIL-Source": "register",
        "X-Registration-Token": registrationToken,
        "Authorization": "Bearer " + authSession.access_token,
      },
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(function () { return {}; });
    if (!response.ok) {
      if (result.code === "registration_session_required") {
        registrationToken = "";
        await loadRegistrationChallenge();
      }
      throw new Error(result.error || "등록 신청에 실패했습니다.");
    }
    form.reset();
    registrationSchedule = normalizeSchedule({});
    renderRegistrationSchedule();
    clearSelectedAddress();
    syncBackground();
    registrationToken = "";
    showRegistrationSuccess(signupEmail);
  } catch (error) {
    message.textContent = error.message || "서버 연결을 확인해주세요.";
    message.className = "message error";
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "등록 신청하기";
  }
});

initRegistrationPage();
