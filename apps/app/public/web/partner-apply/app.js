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
  const selectedAddress = document.getElementById("selectedAddress");
  const selectedPlaceName = document.getElementById("selectedPlaceName");
  const selectedRoadAddress = document.getElementById("selectedRoadAddress");
  const selectedNaverMapLink = document.getElementById("selectedNaverMapLink");
  const challengeStatus = document.getElementById("challengeStatus");
  const mathChallenge = document.getElementById("mathChallenge");
  const challengePrompt = document.getElementById("challengePrompt");
  const challengeAnswer = document.getElementById("challengeAnswer");
  const turnstileChallenge = document.getElementById("turnstileChallenge");
  const companyWebsite = document.getElementById("companyWebsite");
  const menuToggle = document.querySelector(".menu-toggle");
  const navigation = document.getElementById("partnerMainNav");

  let captchaConfig = null;
  let turnstileWidgetId = null;
  let registrationToken = "";
  let formStartedAt = Date.now();
  let selectedLocation = null;

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
    selectedAddress.hidden = true;
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
    selectedPlaceName.textContent = place.name;
    selectedRoadAddress.textContent = primaryAddress;
    selectedNaverMapLink.href = place.naverMapUrl || `https://map.naver.com/p/search/${encodeURIComponent(place.name)}`;
    selectedAddress.hidden = false;
    if (!centerName.value.trim()) centerName.value = place.name;
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
      const response = await fetch(`/api/place-search?q=${encodeURIComponent(query)}`, {
        headers: { "X-DAIL-Source": "web" },
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "센터 위치를 검색하지 못했습니다.");
      const places = Array.isArray(result.places) ? result.places : [];
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
        if (captchaConfig?.fallbackChallenge) activateMathFallback(captchaConfig.fallbackChallenge);
      },
    });
  }

  function activateMathFallback(fallbackChallenge) {
    captchaConfig = fallbackChallenge;
    turnstileChallenge.hidden = true;
    challengePrompt.textContent = fallbackChallenge.prompt;
    challengeAnswer.value = "";
    mathChallenge.hidden = false;
    challengeStatus.textContent = "아래 계산 문제의 정답을 입력해 주세요.";
    challengeStatus.className = "partner-security-note";
  }

  async function loadRegistrationChallenge() {
    registrationToken = "";
    formStartedAt = Date.now();
    challengeStatus.textContent = "요청 확인을 준비하고 있습니다.";
    challengeStatus.className = "visually-hidden";
    mathChallenge.hidden = true;
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
        try {
          await loadTurnstile(config.siteKey);
        } catch {
          if (!config.fallbackChallenge) throw new Error("요청 확인을 준비하지 못했습니다. 잠시 후 다시 시도해 주세요.");
          activateMathFallback(config.fallbackChallenge);
        }
      } else {
        activateMathFallback(config);
      }
    } catch (error) {
      captchaConfig = null;
      setStatus(error.message || "요청 확인을 준비하지 못했습니다.");
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
        challengeAnswer: challengeAnswer.value,
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
      const token = await ensureRegistrationSession();
      const response = await fetch("/api/partner-applications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
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

  if (menuToggle && navigation) {
    menuToggle.addEventListener("click", () => {
      const open = navigation.classList.toggle("open");
      menuToggle.setAttribute("aria-expanded", String(open));
    });
    navigation.addEventListener("click", () => {
      navigation.classList.remove("open");
      menuToggle.setAttribute("aria-expanded", "false");
    });
  }

  updateMessageCount();
  loadRegistrationChallenge();
})();
