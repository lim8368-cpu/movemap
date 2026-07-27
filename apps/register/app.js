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
const AUTH_STORAGE_KEY = "dail_auth_session";
const AUTH_RETURN_KEY = "dail_auth_return_to";

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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

function isTherapistBackground() {
  return new FormData(form).get("therapistBackground") === "yes";
}

function syncBackground() {
  const yes = isTherapistBackground();
  licenseFields.hidden = !yes;
  licenseFields.querySelectorAll("input").forEach(function (input) {
    input.required = yes;
    if (!yes) input.value = "";
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
    ["전화번호", data.get("phone")],
    ["센터 운영 계정", (authProfile?.profile?.nickname || authProfile?.user?.email || "현재 로그인 계정") + "에 권한 연결"],
    ["심사 연락 이메일", data.get("email")],
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
  });
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
      await loadTurnstile(config.siteKey);
      challengeStatus.textContent = "아래 보안 확인을 완료해 주세요.";
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

async function initRegistrationPage() {
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
    revealRegistration(profileData);
  } catch (error) {
    showLoginGate(error.message || "로그인 상태를 확인하지 못했습니다.");
  }
}

document.querySelectorAll("[data-registration-provider]").forEach(function (button) {
  button.addEventListener("click", function () {
    if (button.dataset.ready !== "true") return;
    sessionStorage.setItem(AUTH_RETURN_KEY, "/register/");
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
    const signupEmail = String(data.get("email") || "").trim().toLowerCase();
    const address = fullAddress();
    const baseAddress = addressInput.value.trim();
    const payload = {
      centerName: data.get("centerName"),
      ownerName: data.get("ownerName"),
      phone: data.get("phone"),
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
      licenseHolderName: isTherapistBackground() ? data.get("licenseHolderName") : "해당 없음",
      licenseNumber: isTherapistBackground() ? data.get("licenseNumber") : "해당 없음",
      licenseImagePath: isTherapistBackground() ? licenseImagePathInput.value : "not-applicable",
      services: Array.from(document.querySelectorAll('[name="specialties"]:checked'))
        .map(function (element) { return element.value; })
        .join(", "),
      memo: [data.get("hours"), data.get("memo")].filter(Boolean).join("\n"),
      consent: data.get("consent") === "on",
      therapistBackground: isTherapistBackground(),
      registrationToken: registrationToken,
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
