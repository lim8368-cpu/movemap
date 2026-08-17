(() => {
  const form = document.getElementById("collaborationForm");
  const formStatus = document.getElementById("formStatus");
  const submitButton = document.getElementById("submitButton");
  const successPanel = document.getElementById("successPanel");
  const newProposalButton = document.getElementById("newProposalButton");
  const message = document.getElementById("message");
  const messageCount = document.getElementById("messageCount");

  function updateMessageCount() {
    messageCount.value = String(message.value.length);
    messageCount.textContent = String(message.value.length);
  }

  function setStatus(text, field) {
    formStatus.textContent = text;
    formStatus.classList.toggle("is-visible", Boolean(text));
    if (!text) return;

    formStatus.focus({ preventScroll: true });
    const target = field === "collaborationTypes"
      ? form.querySelector('input[name="collaborationTypes"]')
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

  async function submitProposal(event) {
    event.preventDefault();
    setStatus("");

    if (!form.reportValidity()) return;

    const formData = new FormData(form);
    const payload = {
      organizationType: formData.get("organizationType"),
      organizationName: formData.get("organizationName"),
      contactName: formData.get("contactName"),
      contactEmail: formData.get("contactEmail"),
      contactPhone: formData.get("contactPhone"),
      websiteUrl: formData.get("websiteUrl"),
      collaborationTypes: formData.getAll("collaborationTypes"),
      title: formData.get("title"),
      message: formData.get("message"),
      privacyConsent: formData.get("privacyConsent") === "on",
      companyFax: formData.get("companyFax"),
    };

    if (!payload.collaborationTypes.length) {
      setStatus("희망하는 협업 유형을 하나 이상 선택해 주세요.", "collaborationTypes");
      return;
    }

    submitButton.disabled = true;
    submitButton.querySelector("span").textContent = "제안을 보내는 중";

    try {
      const response = await fetch("/api/collaboration-inquiries", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-DAIL-Source": "web",
        },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw Object.assign(new Error(result.error || "협업 제안을 접수하지 못했습니다."), {
          field: result.field,
        });
      }

      form.hidden = true;
      successPanel.hidden = false;
      successPanel.scrollIntoView({ behavior: "smooth", block: "center" });
      document.getElementById("successTitle").focus?.();
    } catch (error) {
      setStatus(error.message || "협업 제안을 접수하지 못했습니다. 잠시 후 다시 시도해 주세요.", error.field);
    } finally {
      submitButton.disabled = false;
      submitButton.querySelector("span").textContent = "협업 제안 보내기";
    }
  }

  form.addEventListener("submit", submitProposal);
  form.addEventListener("input", clearInvalidState);
  form.addEventListener("change", clearInvalidState);
  message.addEventListener("input", updateMessageCount);
  updateMessageCount();

  newProposalButton.addEventListener("click", () => {
    form.reset();
    updateMessageCount();
    successPanel.hidden = true;
    form.hidden = false;
    form.scrollIntoView({ behavior: "smooth", block: "start" });
    document.getElementById("organizationType").focus({ preventScroll: true });
  });

})();
