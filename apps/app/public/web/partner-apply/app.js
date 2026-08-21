(() => {
  const form = document.getElementById("partnerApplicationForm");
  const formStatus = document.getElementById("formStatus");
  const submitButton = document.getElementById("submitButton");
  const successPanel = document.getElementById("successPanel");
  const newApplicationButton = document.getElementById("newApplicationButton");
  const centerName = document.getElementById("centerName");
  const contactPhone = document.getElementById("contactPhone");
  const message = document.getElementById("message");
  const messageCount = document.getElementById("messageCount");
  const addressQuery = document.getElementById("addressQuery");
  const addressSearchButton = document.getElementById("addressSearchButton");
  const addressSearchButtonLabel = addressSearchButton.querySelector("span");
  const addressSearchStatus = document.getElementById("addressSearchStatus");
  const addressResults = document.getElementById("addressResults");
  const addressConfirmation = document.getElementById("addressConfirmation");
  const addressDetail = document.getElementById("addressDetail");
  const selectedPlaceName = document.getElementById("selectedPlaceName");
  const selectedRoadAddress = document.getElementById("selectedRoadAddress");
  const selectedNaverMapLink = document.getElementById("selectedNaverMapLink");
  const challengeStatus = document.getElementById("challengeStatus");
  const turnstileChallenge = document.getElementById("turnstileChallenge");
  const companyWebsite = document.getElementById("companyWebsite");
  const partnerAuthGate = document.getElementById("partnerAuthGate");
  const partnerAuthButtons = [...document.querySelectorAll("[data-partner-auth-provider]")];
  const partnerAuthStatus = document.getElementById("partnerAuthStatus");
  const partnerAccountPanel = document.getElementById("partnerAccountPanel");
  const partnerAccountName = document.getElementById("partnerAccountName");
  const partnerAccountEmail = document.getElementById("partnerAccountEmail");
  const applicantName = document.getElementById("applicantName");
  const contactEmail = document.getElementById("contactEmail");

  const AUTH_STORAGE_KEY = "dail_auth_session";
  const AUTH_RETURN_KEY = "dail_auth_return_to";
  let captchaConfig = null;
  let turnstileWidgetId = null;
  let registrationToken = "";
  let formStartedAt = Date.now();
  let selectedLocation = null;
  let naverGeocoderPromise = null;
  let authConfig = { supabaseUrl: "", supabaseAnonKey: "", providers: {} };

  function storedSession() {
    try {
      return JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY) || "null");
    } catch {
      return null;
    }
  }

  async function loadAuthConfig() {
    try {
      const response = await fetch("/api/config", { headers: { "X-DAIL-Source": "web" } });
      const config = await response.json();
      if (!response.ok) throw new Error();
      authConfig = config.auth || authConfig;
    } catch {
      authConfig = { supabaseUrl: "", supabaseAnonKey: "", providers: {} };
    }
    partnerAuthButtons.forEach((button) => {
      const provider = button.dataset.partnerAuthProvider;
      const ready = Boolean(authConfig.providers?.[provider]);
      button.dataset.ready = String(ready);
      button.title = ready ? "" : `${providerName(provider)} 로그인 인증키 연결이 필요합니다.`;
      button.setAttribute("aria-describedby", "partnerAuthStatus");
    });
  }

  function providerName(provider) {
    if (provider === "kakao") return "카카오";
    if (provider === "naver") return "네이버";
    if (provider === "apple") return "Apple";
    return "소셜";
  }

  async function refreshSession(current) {
    if (!current?.refresh_token || !authConfig.supabaseUrl || !authConfig.supabaseAnonKey) return null;
    try {
      const response = await fetch(`${authConfig.supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
        method: "POST",
        headers: { apikey: authConfig.supabaseAnonKey, "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: current.refresh_token }),
      });
      if (!response.ok) return null;
      const next = await response.json();
      next.expires_at = Math.floor(Date.now() / 1000) + (Number(next.expires_in) || 3600);
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(next));
      return next;
    } catch {
      return null;
    }
  }

  async function activeSession(forceRefresh = false) {
    let current = storedSession();
    if (!current) return null;
    const expiresSoon = Number(current.expires_at || 0) < Math.floor(Date.now() / 1000) + 60;
    if (forceRefresh || expiresSoon) current = await refreshSession(current);
    if (!current) localStorage.removeItem(AUTH_STORAGE_KEY);
    return current;
  }

  function showAuthGate(message = "로그인 후 센터 정보를 입력할 수 있습니다.") {
    partnerAuthGate.hidden = false;
    partnerAccountPanel.hidden = true;
    form.hidden = true;
    partnerAuthStatus.textContent = message;
  }

  async function loadPartnerIdentity() {
    await loadAuthConfig();
    let session = await activeSession();
    if (!session?.access_token) {
      showAuthGate();
      return false;
    }
    let response = await fetch("/api/auth/profile", {
      headers: { Authorization: `Bearer ${session.access_token}`, "X-DAIL-Source": "web" },
    });
    if (response.status === 401) {
      session = await activeSession(true);
      if (session?.access_token) {
        response = await fetch("/api/auth/profile", {
          headers: { Authorization: `Bearer ${session.access_token}`, "X-DAIL-Source": "web" },
        });
      }
    }
    if (!session?.access_token || response.status === 401) {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      showAuthGate("로그인 시간이 만료되었습니다. 다시 로그인해 주세요.");
      return false;
    }
    if (!response.ok) {
      showAuthGate("계정 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
      return false;
    }
    const data = await response.json();
    const nickname = String(data.profile?.nickname || "").trim();
    const email = String(data.user?.email || "").trim();
    partnerAccountName.textContent = nickname || `DAIL ${providerName(data.user?.provider)} 계정`;
    partnerAccountEmail.textContent = email || "로그인 계정 연결 완료";
    if (!applicantName.value && nickname.length >= 2) applicantName.value = nickname;
    if (!contactEmail.value && email) contactEmail.value = email;
    partnerAuthGate.hidden = true;
    partnerAccountPanel.hidden = false;
    form.hidden = false;
    return true;
  }

  function formatPhone(value) {
    const digits = String(value || "").replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }

  function updateMessageCount() {
    messageCount.value = String(message.value.length);
    messageCount.textContent = String(message.value.length);
    message.style.height = "auto";
    message.style.height = `${Math.max(132, message.scrollHeight)}px`;
  }

  function setStatus(text, field) {
    formStatus.textContent = text;
    formStatus.classList.toggle("is-visible", Boolean(text));
    if (!text) return;
    formStatus.focus({ preventScroll: true });
    const target = field === "addressQuery" ? addressQuery : document.getElementById(field);
    if (target) {
      target.setAttribute("aria-invalid", "true");
      target.focus({ preventScroll: true });
      target.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  function clearInvalidState(event) {
    event.target.removeAttribute("aria-invalid");
    if (formStatus.classList.contains("is-visible")) setStatus("");
  }

  function setAddressStatus(text, tone = "") {
    addressSearchStatus.textContent = text;
    addressSearchStatus.className = `partner-address-status${tone ? ` ${tone}` : ""}`;
  }

  function regionFromAddress(value) {
    return String(value || "").trim().split(/\s+/).slice(0, 2).join(" ");
  }

  function clearSelectedLocation() {
    selectedLocation = null;
    addressConfirmation.hidden = true;
    addressDetail.value = "";
    selectedPlaceName.textContent = "";
    selectedRoadAddress.textContent = "";
    selectedNaverMapLink.href = "https://map.naver.com/";
  }

  function choosePlace(place) {
    const primaryAddress = place.roadAddress || place.address || "";
    selectedLocation = { ...place, primaryAddress };
    addressQuery.value = primaryAddress;
    addressQuery.setAttribute("aria-expanded", "false");
    addressQuery.removeAttribute("aria-invalid");
    addressResults.hidden = true;
    addressResults.innerHTML = "";
    selectedPlaceName.textContent = place.addressOnly ? "센터 주소" : place.name;
    selectedRoadAddress.textContent = primaryAddress;
    selectedNaverMapLink.href = place.naverMapUrl || `https://map.naver.com/p/search/${encodeURIComponent(place.name)}`;
    addressConfirmation.hidden = false;
    if (!centerName.value.trim() && !place.addressOnly) centerName.value = place.name;
    setAddressStatus("센터 위치를 확인했습니다.", "success");
    setStatus("");
  }

  function renderAddressResults(places) {
    addressResults.innerHTML = "";
    places.forEach((place) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "partner-address-result";
      button.setAttribute("role", "option");

      const copy = document.createElement("span");
      const name = document.createElement("strong");
      const address = document.createElement("small");
      const category = document.createElement("em");
      name.textContent = place.name;
      address.textContent = place.roadAddress || place.address || "주소 정보 없음";
      category.textContent = place.category || "네이버 지도 장소";
      copy.append(name, address);
      button.append(copy, category);
      button.addEventListener("click", () => choosePlace(place));
      addressResults.appendChild(button);
    });
    addressResults.hidden = false;
    addressQuery.setAttribute("aria-expanded", "true");
  }

  function waitForNaverGeocoder(timeoutMs = 5000) {
    return new Promise((resolve, reject) => {
      const startedAt = Date.now();
      const check = () => {
        if (window.naver?.maps?.Service?.geocode) {
          resolve();
          return;
        }
        if (Date.now() - startedAt >= timeoutMs) {
          reject(new Error("네이버 주소 검색을 불러오지 못했습니다."));
          return;
        }
        window.setTimeout(check, 50);
      };
      check();
    });
  }

  async function loadNaverGeocoder() {
    if (window.naver?.maps?.Service?.geocode) return;
    if (naverGeocoderPromise) return naverGeocoderPromise;

    naverGeocoderPromise = (async () => {
      const configResponse = await fetch("/api/config", {
        headers: { "X-DAIL-Source": "web" },
      });
      const config = await configResponse.json().catch(() => ({}));
      const key = String(config.naverMapNcpKeyId || "").trim();
      if (!configResponse.ok || !key) throw new Error("네이버 주소 검색을 준비하지 못했습니다.");

      const existing = document.querySelector("script[data-dail-naver-geocoder]");
      if (!existing) {
        const script = document.createElement("script");
        script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(key)}&submodules=geocoder`;
        script.async = true;
        script.dataset.dailNaverGeocoder = "true";
        await new Promise((resolve, reject) => {
          script.addEventListener("load", resolve, { once: true });
          script.addEventListener("error", () => reject(new Error("네이버 주소 검색을 불러오지 못했습니다.")), { once: true });
          document.head.appendChild(script);
        });
      }

      // The base Maps script finishes before its geocoder submodule is ready.
      // Wait for the submodule instead of treating the base script load as completion.
      await waitForNaverGeocoder();
    })();

    try {
      await naverGeocoderPromise;
    } catch (error) {
      naverGeocoderPromise = null;
      throw error;
    }
  }

  async function geocodeAddress(query) {
    await loadNaverGeocoder();
    return new Promise((resolve, reject) => {
      window.naver.maps.Service.geocode({ query }, (status, response) => {
        if (status !== window.naver.maps.Service.Status.OK) {
          reject(new Error("네이버 주소 검색에 연결하지 못했습니다."));
          return;
        }

        const addresses = Array.isArray(response?.v2?.addresses) ? response.v2.addresses : [];
        resolve(addresses.slice(0, 5).map((item, index) => {
          const roadAddress = String(item.roadAddress || "").trim();
          const jibunAddress = String(item.jibunAddress || "").trim();
          const primaryAddress = roadAddress || jibunAddress;
          return {
            id: `address-${item.x}-${item.y}-${index}`,
            name: primaryAddress || query,
            category: "도로명 주소",
            address: jibunAddress,
            roadAddress,
            lat: Number(item.y),
            lng: Number(item.x),
            naverPlaceId: "",
            naverMapUrl: `https://map.naver.com/p/search/${encodeURIComponent(primaryAddress || query)}`,
            addressOnly: true,
          };
        }).filter((place) => place.roadAddress || place.address));
      });
    });
  }

  async function searchAddress() {
    const query = addressQuery.value.replace(/\s+/g, " ").trim();
    if (query.length < 2) {
      clearSelectedLocation();
      setAddressStatus("센터명, 건물명 또는 주소를 두 글자 이상 입력해 주세요.", "error");
      addressQuery.focus();
      return;
    }
    addressSearchButton.disabled = true;
    addressSearchButtonLabel.textContent = "검색 중";
    addressResults.hidden = true;
    addressQuery.setAttribute("aria-expanded", "false");
    setAddressStatus("네이버 지도에서 센터 위치를 찾고 있습니다.", "loading");
    try {
      let places = [];
      let placeSearchError = null;
      try {
        const response = await fetch(`/api/place-search?q=${encodeURIComponent(query)}`, {
          headers: { "X-DAIL-Source": "web" },
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || "센터 위치를 검색하지 못했습니다.");
        places = Array.isArray(result.places) ? result.places : [];
      } catch (error) {
        placeSearchError = error;
      }

      if (!places.length) {
        try {
          places = await geocodeAddress(query);
        } catch (error) {
          if (placeSearchError) throw placeSearchError;
          throw error;
        }
      }
      if (!places.length) throw new Error("검색 결과가 없습니다. 센터명이나 도로명 주소를 다시 확인해 주세요.");
      clearSelectedLocation();
      renderAddressResults(places);
      setAddressStatus("검색 결과에서 센터의 정확한 위치를 선택해 주세요.");
    } catch (error) {
      clearSelectedLocation();
      setAddressStatus(error.message || "센터 위치 검색 중 오류가 발생했습니다.", "error");
    } finally {
      addressSearchButton.disabled = false;
      addressSearchButtonLabel.textContent = "네이버에서 찾기";
    }
  }

  async function loadTurnstile(siteKey) {
    await new Promise((resolve, reject) => {
      if (window.turnstile) return resolve();
      const existing = document.querySelector("script[data-dail-turnstile]");
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
      appearance: "interaction-only",
      callback: () => {
        challengeStatus.textContent = "요청 확인이 완료되었습니다.";
        turnstileChallenge.hidden = true;
      },
      "expired-callback": () => {
        challengeStatus.textContent = "요청 확인 시간이 만료되었습니다.";
        turnstileChallenge.hidden = false;
      },
      "error-callback": () => {
        challengeStatus.textContent = "요청 확인을 준비하지 못했습니다. 페이지를 새로고침해 주세요.";
      },
    });
  }

  async function loadRegistrationChallenge() {
    registrationToken = "";
    formStartedAt = Date.now();
    challengeStatus.textContent = "요청 확인을 준비하고 있습니다.";
    challengeStatus.className = "visually-hidden";
    if (window.turnstile && turnstileWidgetId !== null) {
      window.turnstile.remove(turnstileWidgetId);
      turnstileWidgetId = null;
    }
    turnstileChallenge.innerHTML = "";
    turnstileChallenge.hidden = true;
    try {
      const response = await fetch("/api/registration-challenge", {
        headers: { "X-DAIL-Source": "web" },
      });
      const config = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(config.error || "요청 확인을 준비하지 못했습니다.");
      captchaConfig = config;
      if (config.mode === "turnstile") {
        await loadTurnstile(config.siteKey);
      } else if (config.mode !== "signed_passive") {
        throw new Error("요청 확인을 준비하지 못했습니다. 잠시 후 다시 시도해 주세요.");
      }
    } catch (error) {
      captchaConfig = null;
      challengeStatus.textContent = error.message || "요청 확인을 준비하지 못했습니다.";
      challengeStatus.className = "visually-hidden";
    }
  }

  async function ensureRegistrationSession() {
    if (registrationToken) return registrationToken;
    if (!captchaConfig) throw new Error("요청 확인을 다시 불러와 주세요.");
    const turnstileToken = captchaConfig.mode === "turnstile" && window.turnstile
      ? window.turnstile.getResponse(turnstileWidgetId)
      : "";
    const response = await fetch("/api/registration-session", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-DAIL-Source": "web" },
      body: JSON.stringify({
        formStartedAt,
        companyWebsite: companyWebsite.value,
        challengeToken: captchaConfig.challengeToken || "",
        turnstileToken,
        challengeMode: captchaConfig.mode,
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      await loadRegistrationChallenge();
      throw new Error(data.error || "요청 확인에 실패했습니다.");
    }
    registrationToken = data.registrationToken;
    return registrationToken;
  }

  async function submitApplication(event) {
    event.preventDefault();
    setStatus("");
    if (!form.reportValidity()) return;
    if (!selectedLocation) {
      setStatus("네이버 검색 결과에서 센터의 정확한 위치를 선택해 주세요.", "addressQuery");
      return;
    }

    const formData = new FormData(form);
    const payload = {
      applicantName: formData.get("applicantName"),
      centerName: formData.get("centerName"),
      centerStage: "operating",
      qualificationType: formData.get("qualificationType"),
      region: regionFromAddress(selectedLocation.primaryAddress),
      address: selectedLocation.primaryAddress,
      addressDetail: addressDetail.value,
      roadAddress: selectedLocation.roadAddress || "",
      jibunAddress: selectedLocation.address || "",
      lat: selectedLocation.lat,
      lng: selectedLocation.lng,
      naverPlaceId: selectedLocation.naverPlaceId || "",
      naverMapUrl: selectedLocation.naverMapUrl || "",
      contactEmail: formData.get("contactEmail"),
      contactPhone: formData.get("contactPhone"),
      websiteUrl: formData.get("websiteUrl"),
      interests: ["early-partner"],
      message: formData.get("message"),
      privacyConsent: formData.get("privacyConsent") === "on",
      companyWebsite: formData.get("companyWebsite"),
    };

    submitButton.disabled = true;
    submitButton.querySelector("span").textContent = "신청을 보내는 중";
    try {
      const session = await activeSession();
      if (!session?.access_token) {
        showAuthGate("신청을 보내려면 카카오 로그인이 필요합니다.");
        throw new Error("카카오로 로그인한 뒤 다시 신청해 주세요.");
      }
      const token = await ensureRegistrationSession();
      const response = await fetch("/api/partner-applications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          "X-Registration-Token": token,
          "X-DAIL-Source": "web",
        },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw Object.assign(new Error(result.error || "신청을 접수하지 못했습니다."), { field: result.field });
      }
      form.hidden = true;
      successPanel.hidden = false;
      successPanel.scrollIntoView({ behavior: "smooth", block: "center" });
      document.getElementById("successTitle").focus({ preventScroll: true });
    } catch (error) {
      if (registrationToken) await loadRegistrationChallenge();
      setStatus(error.message || "신청을 접수하지 못했습니다. 잠시 후 다시 시도해 주세요.", error.field);
    } finally {
      submitButton.disabled = false;
      submitButton.querySelector("span").textContent = "파트너 센터 신청하기";
    }
  }

  form.addEventListener("submit", submitApplication);
  form.addEventListener("input", clearInvalidState);
  form.addEventListener("change", clearInvalidState);
  contactPhone.addEventListener("input", () => { contactPhone.value = formatPhone(contactPhone.value); });
  message.addEventListener("input", updateMessageCount);
  addressSearchButton.addEventListener("click", searchAddress);
  addressQuery.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    searchAddress();
  });
  addressQuery.addEventListener("input", () => {
    if (!selectedLocation) return;
    clearSelectedLocation();
    setAddressStatus("주소가 변경되었습니다. 네이버 검색 결과에서 다시 선택해 주세요.");
  });

  newApplicationButton.addEventListener("click", async () => {
    form.reset();
    updateMessageCount();
    clearSelectedLocation();
    addressResults.hidden = true;
    addressResults.innerHTML = "";
    setAddressStatus("검색 결과에서 센터의 정확한 위치를 선택해 주세요.");
    successPanel.hidden = true;
    form.hidden = false;
    await loadRegistrationChallenge();
    form.scrollIntoView({ behavior: "smooth", block: "start" });
    centerName.focus({ preventScroll: true });
  });

  partnerAuthButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const provider = button.dataset.partnerAuthProvider;
      if (button.dataset.ready !== "true") {
        partnerAuthStatus.textContent = `${providerName(provider)} 로그인은 인증키 연결 후 바로 사용할 수 있습니다.`;
        return;
      }
      sessionStorage.setItem(AUTH_RETURN_KEY, "/partner-apply/");
      location.href = `/api/auth/start?provider=${encodeURIComponent(provider)}`;
    });
  });

  updateMessageCount();
  loadPartnerIdentity().then((ready) => {
    if (ready) loadRegistrationChallenge();
  });
})();
