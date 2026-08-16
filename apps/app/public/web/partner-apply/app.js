(() => {
  const form = document.getElementById("partnerApplicationForm");
  const formStatus = document.getElementById("formStatus");
  const submitButton = document.getElementById("submitButton");
  const successPanel = document.getElementById("successPanel");
  const newApplicationButton = document.getElementById("newApplicationButton");
  const contactPhone = document.getElementById("contactPhone");
  const centerName = document.getElementById("centerName");
  const centerNameOptional = document.getElementById("centerNameOptional");
  const message = document.getElementById("message");
  const messageCount = document.getElementById("messageCount");
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

  function updateCenterNameRequirement() {
    const stage = form.querySelector('input[name="centerStage"]:checked')?.value || "";
    const required = stage === "operating" || stage === "preparing";
    centerName.required = required;
    centerNameOptional.textContent = required ? "필수" : "선택";
    centerName.placeholder = required ? "센터명을 입력해 주세요" : "미정이라면 비워두셔도 됩니다";
  }

  function setStatus(text, field) {
    formStatus.textContent = text;
    formStatus.classList.toggle("is-visible", Boolean(text));
    if (!text) return;
    formStatus.focus({ preventScroll: true });
    const target = field === "interests"
      ? form.querySelector('input[name="interests"]')
      : field === "centerStage"
        ? form.querySelector('input[name="centerStage"]')
        : document.getElementById(field);
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
        challengeStatus.textContent = "사람 확인이 완료되었습니다.";
        challengeStatus.className = "success";
      },
      "expired-callback": () => {
        challengeStatus.textContent = "보안 확인 시간이 만료되었습니다. 다시 확인해 주세요.";
        challengeStatus.className = "error";
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
    challengeStatus.textContent = "간단한 계산 문제의 정답을 입력해 주세요.";
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
      const response = await fetch("/api/registration-challenge", {
        headers: { "X-DAIL-Source": "web" },
      });
      const config = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(config.error || "보안 확인을 불러오지 못했습니다.");
      captchaConfig = config;
      if (config.mode === "turnstile") {
        try {
          await loadTurnstile(config.siteKey);
          challengeStatus.textContent = "신청 전 보안 확인을 완료해 주세요.";
        } catch {
          if (!config.fallbackChallenge) throw new Error("보안 확인을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
          activateMathFallback(config.fallbackChallenge);
        }
      } else {
        activateMathFallback(config);
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
      throw new Error(data.error || "사람 확인에 실패했습니다.");
    }
    registrationToken = data.registrationToken;
    challengeStatus.textContent = "보안 확인이 완료되었습니다. 신청을 전송합니다.";
    challengeStatus.className = "success";
    return registrationToken;
  }

  async function submitApplication(event) {
    event.preventDefault();
    setStatus("");
    updateCenterNameRequirement();
    if (!form.reportValidity()) return;

    const formData = new FormData(form);
    const payload = {
      applicantName: formData.get("applicantName"),
      centerName: formData.get("centerName"),
      centerStage: formData.get("centerStage"),
      qualificationType: formData.get("qualificationType"),
      region: formData.get("region"),
      contactEmail: formData.get("contactEmail"),
      contactPhone: formData.get("contactPhone"),
      websiteUrl: formData.get("websiteUrl"),
      interests: formData.getAll("interests"),
      message: formData.get("message"),
      privacyConsent: formData.get("privacyConsent") === "on",
      companyWebsite: formData.get("companyWebsite"),
    };
    if (!payload.interests.length) {
      setStatus("관심 있는 안내를 하나 이상 선택해 주세요.", "interests");
      return;
    }

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
        throw Object.assign(new Error(result.error || "사전 신청을 접수하지 못했습니다."), { field: result.field });
      }
      form.hidden = true;
      successPanel.hidden = false;
      successPanel.scrollIntoView({ behavior: "smooth", block: "center" });
      document.getElementById("successTitle").focus({ preventScroll: true });
    } catch (error) {
      if (registrationToken) await loadRegistrationChallenge();
      setStatus(error.message || "사전 신청을 접수하지 못했습니다. 잠시 후 다시 시도해 주세요.", error.field);
    } finally {
      submitButton.disabled = false;
      submitButton.querySelector("span").textContent = "사전 신청 보내기";
    }
  }

  form.addEventListener("submit", submitApplication);
  form.addEventListener("input", clearInvalidState);
  form.addEventListener("change", (event) => {
    clearInvalidState(event);
    if (event.target.name === "centerStage") updateCenterNameRequirement();
  });
  contactPhone.addEventListener("input", () => { contactPhone.value = formatPhone(contactPhone.value); });
  message.addEventListener("input", updateMessageCount);

  newApplicationButton.addEventListener("click", async () => {
    form.reset();
    updateMessageCount();
    updateCenterNameRequirement();
    successPanel.hidden = true;
    form.hidden = false;
    await loadRegistrationChallenge();
    form.scrollIntoView({ behavior: "smooth", block: "start" });
    document.querySelector('input[name="centerStage"]').focus({ preventScroll: true });
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
  updateCenterNameRequirement();
  loadRegistrationChallenge();
})();
