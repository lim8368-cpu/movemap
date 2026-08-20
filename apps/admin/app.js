const API_BASE = window.location.protocol === "file:" ? "http://localhost:8090" : window.location.origin;
const loginPanel = document.querySelector("#loginPanel");
const dashboard = document.querySelector("#dashboard");
const loginForm = document.querySelector("#loginForm");
const loginEmail = document.querySelector("#loginEmail");
const loginPassword = document.querySelector("#loginPassword");
const loginMessage = document.querySelector("#loginMessage");
const mfaPanel = document.querySelector("#mfaPanel");
const mfaForm = document.querySelector("#mfaForm");
const adminInvitePanel = document.querySelector("#adminInvitePanel");
const adminInviteForm = document.querySelector("#adminInviteForm");
const togglePassword = document.querySelector("#togglePassword");
const refreshButton = document.querySelector("#refreshButton");
const logoutButton = document.querySelector("#logoutButton");
const centerDialog = document.querySelector("#centerDialog");
const centerForm = document.querySelector("#centerForm");
const toast = document.querySelector("#toast");

localStorage.removeItem("MOVEMAP_ADMIN_TOKEN");

let sessionToken = "";
let dashboardData = null;
let accessData = { totals: { accessLogs: 0 }, accessLogs: [] };
let operationsData = null;
let platformRolesData = { roles: [] };
let currentAdminRole = "";
let applicationFilter = "pending";
let partnerApplicationFilter = "new";
let activeLogTab = "events";
let toastTimer = 0;
let pendingMfaAccessToken = "";
let pendingMfaFactorId = "";
let pendingMfaChallengeId = "";
const adminInviteHash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
const adminInviteAccessToken = String(adminInviteHash.get("access_token") || "");
const adminInviteType = String(adminInviteHash.get("type") || "");

function adminHeaders(extra) {
  return Object.assign(
    {},
    extra || {},
    sessionToken ? { Authorization: "Bearer " + sessionToken } : {},
    { "X-Movemap-Client": "admin" }
  );
}

function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function uiIcon(name, className) {
  return '<svg class="ui-icon ' + (className || "") + '" aria-hidden="true"><use href="/assets/ui-icons.svg#' + name + '"></use></svg>';
}

function formatNumber(value) {
  return new Intl.NumberFormat("ko-KR").format(Number(value) || 0);
}

function formatDate(value, includeYear) {
  if (!value) return "-";
  const options = includeYear
    ? { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }
    : { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" };
  return new Intl.DateTimeFormat("ko-KR", options).format(new Date(value));
}

function shortUserAgent(value) {
  const userAgent = String(value || "");
  if (!userAgent) return "-";
  if (userAgent.includes("Expo")) return "Expo 앱";
  if (userAgent.includes("iPhone")) return "iPhone · Safari";
  if (userAgent.includes("Android")) return "Android";
  if (userAgent.includes("Safari") && !userAgent.includes("Chrome")) return "Safari";
  if (userAgent.includes("Chrome")) return "Chrome";
  return userAgent.slice(0, 38);
}

function eventLabel(type) {
  const labels = {
    view: "센터 상세 조회",
    contact: "상담 연결 클릭",
    favorite: "관심 센터 저장",
    review: "후기 등록",
  };
  return labels[type] || String(type || "활동");
}

function eventIcon(type) {
  if (type === "contact") return uiIcon("phone-call");
  if (type === "favorite") return uiIcon("heart");
  if (type === "review") return uiIcon("star");
  return uiIcon("mouse-pointer-click");
}

function sourceLabel(source) {
  const labels = {
    web: "웹",
    app: "앱",
    admin: "최고 관리자",
    owner: "센터 관리자",
    "center-dashboard": "센터 관리자",
    register: "센터 등록",
    ios: "iOS 앱",
    android: "Android 앱",
    "admin-page": "관리자 페이지",
  };
  return labels[source] || String(source || "-");
}

function statusLabel(status) {
  const labels = {
    approved: "지도 노출 중",
    hidden: "숨김",
    pending: "승인 대기",
    rejected: "반려",
    active: "활성",
    disabled: "비활성",
    received: "신규 접수",
    reviewing: "검토 중",
    contacted: "연락 완료",
    qualified: "정식 등록 후보",
    invited: "등록 초대 완료",
    converted: "정식 등록 전환",
    closed: "종료",
  };
  return labels[status] || String(status || "-");
}

function showToast(message, isError) {
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.toggle("error", Boolean(isError));
  toast.hidden = false;
  toastTimer = window.setTimeout(function () {
    toast.hidden = true;
  }, 3200);
}

function emptyState(title, copy) {
  return '<div class="empty-state"><span>' + uiIcon("circle-check") + '</span><strong>' + escapeHtml(title) + "</strong><p>" + escapeHtml(copy) + "</p></div>";
}

function centerNameFor(centerId) {
  const center = (dashboardData && dashboardData.centers || []).find(function (item) {
    return item.id === centerId;
  });
  return center ? center.name : centerId || "센터 미지정";
}

function missingProfileFields(center) {
  const fields = [
    ["address", center.address],
    ["lead", center.lead],
    ["tags", center.tags && center.tags.length],
    ["therapist", center.therapist],
    ["price", center.price],
  ];
  return fields.filter(function (item) { return !item[1]; }).map(function (item) { return item[0]; });
}

function imageMarkup(src, label, typeLabel) {
  if (!src) return "";
  return '<a class="application-image" href="' + escapeHtml(src) + '" target="_blank" rel="noreferrer">' +
    '<img src="' + escapeHtml(src) + '" alt="' + escapeHtml(label) + '" />' +
    "<small>" + escapeHtml(typeLabel) + "</small></a>";
}

function showLogin() {
  loginForm.hidden = false;
  mfaPanel.hidden = true;
  adminInvitePanel.hidden = true;
  loginPanel.hidden = false;
  dashboard.hidden = true;
  logoutButton.hidden = true;
}

function showDashboard() {
  loginPanel.hidden = true;
  dashboard.hidden = false;
  logoutButton.hidden = false;
}

async function mfaRequest(action, body) {
  const response = await fetch(API_BASE + "/api/admin-mfa", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + pendingMfaAccessToken,
      "X-Movemap-Client": "admin",
    },
    body: JSON.stringify(Object.assign({ action: action }, body || {})),
  });
  const data = await response.json().catch(function () { return {}; });
  if (!response.ok) throw new Error(data.error || "MFA 인증을 처리하지 못했습니다.");
  return data;
}

function mfaFactors(value) {
  const factors = value && value.factors || {};
  const candidates = Array.isArray(factors.totp)
    ? factors.totp
    : Array.isArray(factors.all) ? factors.all.filter(function (item) {
      return item.factor_type === "totp";
    }) : [];
  return candidates.filter(function (item) {
    return !item.status || item.status === "verified";
  });
}

function mfaQrImageSource(value) {
  const source = String(value || "").trim();
  if (!source) return "";
  if (/^(?:data:image|https?:|blob:)/i.test(source)) return source;
  if (source.startsWith("<svg") || source.startsWith("<?xml")) {
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(source);
  }
  return "";
}

async function beginMfa(mfa) {
  pendingMfaAccessToken = mfa.accessToken || "";
  loginForm.hidden = true;
  mfaPanel.hidden = false;
  document.querySelector("#mfaMessage").textContent = "";
  const enrollment = document.querySelector("#mfaEnrollment");
  enrollment.hidden = true;
  let factor = mfaFactors(mfa)[0];
  if (!factor) {
    const enrolled = await mfaRequest("enroll", { friendlyName: "DAIL 최고 관리자" });
    factor = enrolled.result || {};
    const totp = factor.totp || {};
    document.querySelector("#mfaGuide").textContent =
      "처음 한 번만 인증 앱에 QR 코드를 등록한 뒤 6자리 코드를 입력하세요.";
    const qr = document.querySelector("#mfaQrCode");
    const qrSource = mfaQrImageSource(totp.qr_code);
    qr.hidden = !qrSource;
    if (qrSource) qr.src = qrSource;
    document.querySelector("#mfaSecret").textContent = totp.secret || "";
    enrollment.hidden = false;
  } else {
    document.querySelector("#mfaGuide").textContent = "인증 앱에 표시된 6자리 코드를 입력하세요.";
  }
  pendingMfaFactorId = factor.id || factor.factor_id || "";
  const challenged = await mfaRequest("challenge", { factorId: pendingMfaFactorId });
  pendingMfaChallengeId = challenged.result?.id || challenged.result?.challenge_id || "";
  document.querySelector("#mfaCode").focus();
}

async function login() {
  loginMessage.textContent = "";
  const submitButton = loginForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  submitButton.textContent = "확인 중...";
  try {
    const response = await fetch(API_BASE + "/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Movemap-Client": "admin" },
      body: JSON.stringify({ email: loginEmail.value.trim(), password: loginPassword.value }),
    });
    const data = await response.json().catch(function () { return {}; });
    if (data.code === "mfa_required" && data.mfa) {
      await beginMfa(data.mfa);
      return;
    }
    if (!response.ok) {
      loginMessage.textContent = data.error || "로그인에 실패했습니다.";
      return;
    }
    sessionToken = data.token || "";
    loginPassword.value = "";
    await loadStats();
  } catch (error) {
    const target = mfaPanel.hidden ? loginMessage : document.querySelector("#mfaMessage");
    target.textContent = error?.message || "서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.";
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "운영 대시보드 들어가기";
  }
}

async function loadStats(showFeedback) {
  refreshButton.disabled = true;
  const originalLabel = refreshButton.textContent;
  refreshButton.textContent = "불러오는 중...";
  try {
    const responses = await Promise.all([
      fetch(API_BASE + "/api/stats", { headers: adminHeaders() }),
      fetch(API_BASE + "/api/access-logs", { headers: adminHeaders() }),
      fetch(API_BASE + "/api/operations", { headers: adminHeaders() }),
      fetch(API_BASE + "/api/platform-users", { headers: adminHeaders() }),
    ]);
    if (responses[0].status === 401) {
      sessionToken = "";
      showLogin();
      return;
    }
    if (!responses[0].ok) {
      const error = await responses[0].json().catch(function () { return {}; });
      throw new Error(error.error || "관리자 데이터를 불러오지 못했습니다.");
    }
    dashboardData = await responses[0].json();
    accessData = responses[1].ok
      ? await responses[1].json()
      : { totals: { accessLogs: 0 }, accessLogs: [] };
    operationsData = responses[2].ok ? await responses[2].json() : null;
    platformRolesData = responses[3].ok ? await responses[3].json() : { roles: [] };
    showDashboard();
    renderDashboard();
    if (showFeedback) showToast("최신 운영 데이터를 불러왔습니다.");
  } catch (error) {
    if (!dashboardData) showLogin();
    loginMessage.textContent = error.message;
    showToast(error.message, true);
  } finally {
    refreshButton.disabled = false;
    refreshButton.textContent = originalLabel;
  }
}

function renderDashboard() {
  currentAdminRole = dashboardData.admin?.role || "super_admin";
  const totals = dashboardData.totals || {};
  const views = Number(totals.views) || 0;
  const contacts = Number(totals.contactClicks) || 0;
  const rate = views ? Math.round(contacts / views * 100) : 0;
  const incomplete = dashboardData.centers.filter(function (center) {
    return missingProfileFields(center).length > 0;
  }).length;
  const missingAccounts = dashboardData.centers.filter(function (center) {
    return !center.ownerAccount;
  }).length;

  document.querySelector("#totalCenters").textContent = formatNumber(totals.centers);
  document.querySelector("#totalPending").textContent = formatNumber(totals.pendingCenters);
  document.querySelector("#totalNewPartners").textContent = formatNumber(totals.newPartnerApplications);
  document.querySelector("#partnerMetricCopy").textContent = totals.partnerApplications
    ? "누적 사전 신청 " + formatNumber(totals.partnerApplications) + "건"
    : "연락 전 사전 신청";
  document.querySelector("#totalViews").textContent = formatNumber(views);
  document.querySelector("#totalContacts").textContent = formatNumber(contacts);
  document.querySelector("#contactRate").textContent = rate + "%";
  document.querySelector("#navPendingCount").textContent = formatNumber(totals.pendingCenters);
  document.querySelector("#navPartnerCount").textContent = formatNumber(totals.newPartnerApplications);
  document.querySelector("#navPendingReviewCount").textContent = formatNumber(totals.pendingReviews);
  document.querySelector("#pendingReviewLabel").textContent =
    "승인 대기 " + formatNumber(totals.pendingReviews) + "건";
  document.querySelector("#centerHealthCopy").textContent = incomplete
    ? "프로필 보완 필요 " + incomplete + "곳"
    : "모든 센터 프로필 기본 정보 완료";
  document.querySelector("#lastRefreshedAt").textContent = formatDate(new Date());
  document.querySelector("#totalAccessLogsLabel").textContent =
    "접속 기록 " + formatNumber(accessData.totals && accessData.totals.accessLogs) + "건";

  renderActionChecklist(totals.pendingCenters || 0, totals.newPartnerApplications || 0, incomplete, missingAccounts);
  renderOverviewEvents();
  renderPartnerApplications();
  renderApplications();
  renderReviewModeration();
  renderDirectory();
  renderLogs();
  renderOperations();
  renderPlatformRoles();
  applyAdminRoleView();
}

function applyAdminRoleView() {
  const elevated = ["super_admin", "admin"].includes(currentAdminRole);
  const superAdmin = currentAdminRole === "super_admin";
  const analyst = currentAdminRole === "analyst";
  const operationsSection = document.querySelector("#operationsSection");
  operationsSection.hidden = !elevated;
  document.querySelector('a[href="#operationsSection"]').hidden = !elevated;
  document.querySelector(".operations-card:last-child").hidden = !superAdmin;
  document.querySelector("#applicationsSection").hidden = analyst;
  document.querySelector('a[href="#applicationsSection"]').hidden = analyst;
  document.querySelector("#partnerApplicationsSection").hidden = analyst;
  document.querySelector('a[href="#partnerApplicationsSection"]').hidden = analyst;
  document.querySelector("#reviewsAdminSection").hidden = analyst;
  document.querySelector('a[href="#reviewsAdminSection"]').hidden = analyst;
  document.querySelectorAll('[data-log-tab="access"], [data-log-tab="audit"], [data-log-tab="errors"]').forEach(function (button) {
    button.hidden = !elevated;
  });
}

function renderActionChecklist(pending, newPartners, incomplete, missingAccounts) {
  const items = [
    {
      href: "#partnerApplicationsSection",
      icon: "user-cog",
      warning: newPartners > 0,
      title: "신규 파트너 사전 신청",
      copy: newPartners ? "신청 정보를 확인하고 첫 연락 상태를 기록하세요." : "새로 확인할 사전 신청이 없습니다.",
      value: formatNumber(newPartners) + "건",
    },
    {
      href: "#applicationsSection",
      icon: "circle-alert",
      warning: pending > 0,
      title: "승인 대기 신청",
      copy: pending ? "신청 자료를 검토하고 승인 또는 반려하세요." : "새로 처리할 신청이 없습니다.",
      value: formatNumber(pending) + "건",
    },
    {
      href: "#centersSection",
      icon: "list-checks",
      warning: incomplete > 0,
      title: "프로필 정보 보완",
      copy: "주소·소개·태그·운영자·가격 기본 항목 기준",
      value: formatNumber(incomplete) + "곳",
    },
    {
      href: "#centersSection",
      icon: "user-cog",
      warning: missingAccounts > 0,
      title: "센터장 계정 미등록",
      copy: "센터가 직접 정보를 관리할 수 있도록 계정을 발급하세요.",
      value: formatNumber(missingAccounts) + "곳",
    },
  ];
  document.querySelector("#actionChecklist").innerHTML = items.map(function (item) {
    return '<a class="action-item ' + (item.warning ? "warning" : "") + '" href="' + item.href + '">' +
      "<span>" + uiIcon(item.icon) + "</span><div><strong>" + item.title + "</strong><small>" + item.copy +
      "</small></div><b>" + item.value + "</b></a>";
  }).join("");
}

function partnerStageLabel(stage) {
  return ({
    operating: "센터 운영 중",
    preparing: "오픈 준비 중",
    planning: "창업 검토 중",
  })[stage] || stage || "-";
}

function partnerQualificationLabel(type) {
  return ({
    physical_therapist: "물리치료사 면허",
    sports_science: "체육학 관련 학위",
    other: "그 외 전문 배경",
  })[type] || type || "-";
}

function partnerInterestLabel(value) {
  return ({
    "early-partner": "출시 전 파트너",
    "launch-news": "출시 소식",
    "product-feedback": "센터장 의견 전달",
    "promotion-consulting": "센터 소개 상담",
  })[value] || value;
}

function partnerInvitationStatusLabel(status) {
  return ({
    pending: "사용 대기",
    used: "등록 완료",
    revoked: "취소됨",
    expired: "만료됨",
  })[status] || "발급 전";
}

function partnerInvitationEmailLabel(status) {
  return ({
    sent: "이메일 발송 완료",
    queued: "이메일 발송 중",
    failed: "이메일 발송 실패 · 링크를 직접 전달해 주세요",
    not_configured: "자동 메일 미설정 · 링크를 직접 전달해 주세요",
  })[status] || "이메일 발송 정보 없음";
}

function partnerInvitationSummary(invitation) {
  if (!invitation) return "";
  const canRevoke = invitation.status === "pending";
  return '<div class="partner-invite-status ' + escapeHtml(invitation.status) + '"><div><strong>' +
    escapeHtml(partnerInvitationStatusLabel(invitation.status)) + '</strong><small>' +
    escapeHtml(formatDate(invitation.expiresAt, true)) + '까지 유효</small><small>' +
    escapeHtml(partnerInvitationEmailLabel(invitation.emailStatus)) + '</small></div>' +
    (canRevoke ? '<button type="button" data-revoke-partner-invite="' + escapeHtml(invitation.id) + '">초대 취소</button>' : "") +
    '</div><p class="partner-invite-privacy">보안을 위해 링크 원문은 저장하지 않습니다. 다시 전달하려면 새 링크를 발급해 주세요.</p>';
}

function partnerMatchesFilter(item) {
  if (partnerApplicationFilter === "new") return item.status === "received";
  if (partnerApplicationFilter === "active") {
    return ["reviewing", "contacted", "qualified", "invited"].includes(item.status);
  }
  return true;
}

function renderPartnerApplications() {
  const search = document.querySelector("#partnerApplicationSearch").value.trim().toLowerCase();
  const applications = (dashboardData.partnerApplications || []).filter(function (item) {
    if (!partnerMatchesFilter(item)) return false;
    if (!search) return true;
    return [item.applicantName, item.centerName, item.region, item.address, item.contactEmail, item.contactPhone]
      .some(function (value) { return String(value || "").toLowerCase().includes(search); });
  });
  document.querySelector("#partnerApplicationResultCount").textContent = formatNumber(applications.length) + "건";
  const container = document.querySelector("#partnerApplications");
  if (!applications.length) {
    container.innerHTML = emptyState(
      partnerApplicationFilter === "new" ? "새로 확인할 사전 신청이 없습니다." : "조건에 맞는 사전 신청이 없습니다.",
      partnerApplicationFilter === "new" ? "신청이 접수되면 이곳에 바로 표시됩니다." : "검색어 또는 상태 필터를 바꿔보세요."
    );
    return;
  }

  container.innerHTML = applications.map(function (item) {
    const website = item.websiteUrl
      ? '<a class="icon-label" href="' + escapeHtml(item.websiteUrl) + '" target="_blank" rel="noreferrer">웹·SNS ' + uiIcon("external-link") + "</a>"
      : "";
    const mapLink = item.naverMapUrl
      ? '<a class="partner-location" href="' + escapeHtml(item.naverMapUrl) + '" target="_blank" rel="noreferrer">' +
        uiIcon("map-pin") + '<span><strong>' + escapeHtml(item.address || item.region) +
        '</strong><small>네이버 지도에서 위치 보기</small></span>' + uiIcon("external-link") + "</a>"
      : '<div class="partner-location">' + uiIcon("map-pin") + '<span><strong>' +
        escapeHtml(item.address || item.region) + "</strong><small>저장된 센터 주소</small></span></div>";
    const statusOptions = ["received", "reviewing", "contacted", "qualified", "invited", "converted", "closed"].map(function (status) {
      return '<option value="' + status + '"' + (item.status === status ? " selected" : "") + ">" + escapeHtml(statusLabel(status)) + "</option>";
    }).join("");
    const canInvite = ["qualified", "invited"].includes(item.status);
    const activeInvitation = item.registrationInvitation?.status === "pending" ? item.registrationInvitation : null;
    const inviteButtonLabel = activeInvitation ? "새 링크 재발급" : "정식 등록 초대 링크 발급";
    return '<article class="partner-application-item"><div class="partner-application-summary"><header><div><p>' +
      '운영 센터</p><h3>' + escapeHtml(item.centerName) +
      '</h3></div><span class="status-badge ' + escapeHtml(item.status) + '">' + escapeHtml(statusLabel(item.status)) +
      '</span></header><div class="partner-person"><strong>' + escapeHtml(item.applicantName) +
      '</strong><span>' + escapeHtml(partnerQualificationLabel(item.qualificationType)) +
      '</span></div>' + mapLink + '<div class="partner-contact"><a href="tel:' + escapeHtml(item.contactPhone.replace(/-/g, "")) + '">' +
      uiIcon("phone-call") + escapeHtml(item.contactPhone) + '</a><a href="mailto:' + escapeHtml(item.contactEmail) + '">' +
      uiIcon("message-circle") + escapeHtml(item.contactEmail) + "</a>" + website +
      "</div>" +
      (item.message ? '<blockquote>' + escapeHtml(item.message) + "</blockquote>" : "") +
      '<footer><span>접수 ' + formatDate(item.createdAt, true) + '</span><span>' + escapeHtml(sourceLabel(item.source)) +
      (item.lastContactedAt ? " · 최근 연락 " + formatDate(item.lastContactedAt, true) : "") +
      '</span></footer></div><div class="partner-application-actions"><label>처리 상태<select data-partner-status="' +
      escapeHtml(item.id) + '">' + statusOptions + '</select></label><label>운영 메모<textarea data-partner-note="' +
      escapeHtml(item.id) + '" rows="4" maxlength="2000" placeholder="통화 내용, 다음 연락 일정 등">' +
      escapeHtml(item.adminNote || "") + '</textarea></label><button type="button" data-save-partner="' +
      escapeHtml(item.id) + '">상태와 메모 저장</button><div class="partner-invite-action"><p>서류 검토가 끝난 센터에만 정식 등록 링크를 발급하세요. 새 링크를 발급하면 기존 링크는 즉시 취소되며, 새 링크는 14일 동안 한 번만 사용할 수 있습니다.</p>' +
      partnerInvitationSummary(item.registrationInvitation) + '<button type="button" data-create-partner-invite="' +
      escapeHtml(item.id) + '" data-has-active-invite="' + (activeInvitation ? "true" : "false") + '"' +
      (canInvite ? "" : ' disabled title="처리 상태를 정식 등록 후보로 저장한 뒤 발급할 수 있습니다."') + '>' +
      escapeHtml(inviteButtonLabel) + '</button><div data-partner-invite-result="' +
      escapeHtml(item.id) + '" hidden></div></div></div></article>';
  }).join("");
}

async function updatePartnerApplication(id) {
  const status = document.querySelector('[data-partner-status="' + CSS.escape(id) + '"]').value;
  const adminNote = document.querySelector('[data-partner-note="' + CSS.escape(id) + '"]').value.trim();
  const button = document.querySelector('[data-save-partner="' + CSS.escape(id) + '"]');
  button.disabled = true;
  button.textContent = "저장 중";
  try {
    const response = await fetch(API_BASE + "/api/partner-applications", {
      method: "PATCH",
      headers: adminHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ id: id, status: status, adminNote: adminNote }),
    });
    const result = await response.json().catch(function () { return {}; });
    if (!response.ok) throw new Error(result.error || "사전 신청 상태를 저장하지 못했습니다.");
    await loadStats(false);
    showToast("파트너 신청 상태와 메모를 저장했습니다.");
  } catch (error) {
    showToast(error.message, true);
    button.disabled = false;
    button.textContent = "상태와 메모 저장";
  }
}

async function copyInviteLink(value) {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    const field = document.createElement("textarea");
    field.value = value;
    field.style.position = "fixed";
    field.style.opacity = "0";
    document.body.appendChild(field);
    field.select();
    const copied = document.execCommand("copy");
    field.remove();
    return copied;
  }
}

async function createPartnerInvite(id) {
  const button = document.querySelector('[data-create-partner-invite="' + CSS.escape(id) + '"]');
  const resultBox = document.querySelector('[data-partner-invite-result="' + CSS.escape(id) + '"]');
  if (button.dataset.hasActiveInvite === "true" && !window.confirm("새 링크를 발급하면 기존 링크는 즉시 사용할 수 없게 됩니다. 재발급할까요?")) return;
  button.disabled = true;
  button.textContent = "링크 발급 중";
  try {
    const response = await fetch(API_BASE + "/api/partner-registration-invites", {
      method: "POST",
      headers: adminHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ id: id }),
    });
    const result = await response.json().catch(function () { return {}; });
    if (!response.ok) throw new Error(result.error || "초대 링크를 발급하지 못했습니다.");
    resultBox.hidden = false;
    const deliveryCopy = result.emailSent
      ? "신청 이메일로 자동 발송했습니다."
      : result.emailStatus === "failed"
        ? "이메일 발송에 실패했습니다. 아래 링크를 직접 전달해 주세요."
        : "자동 메일이 아직 설정되지 않았습니다. 아래 링크를 직접 전달해 주세요.";
    resultBox.innerHTML = '<label>정식 등록 링크<input readonly value="' + escapeHtml(result.inviteUrl) + '" /></label><small>' +
      escapeHtml(formatDate(result.expiresAt, true)) + '까지 유효 · 1회 사용</small><small class="invite-delivery-copy">' +
      escapeHtml(deliveryCopy) + '</small>';
    resultBox.querySelector("input").addEventListener("click", function (event) { event.currentTarget.select(); });
    const copied = await copyInviteLink(result.inviteUrl);
    button.dataset.hasActiveInvite = "true";
    button.disabled = false;
    button.textContent = "새 링크 재발급";
    showToast(result.emailSent
      ? "정식 등록 링크를 이메일로 보내고 클립보드에도 복사했습니다."
      : copied ? "정식 등록 초대 링크를 복사했습니다." : "정식 등록 초대 링크를 발급했습니다.");
  } catch (error) {
    showToast(error.message, true);
    button.disabled = false;
    button.textContent = "정식 등록 초대 링크 발급";
  }
}

async function revokePartnerInvite(invitationId) {
  if (!window.confirm("이 초대 링크를 취소할까요? 취소하면 센터장은 즉시 링크를 사용할 수 없습니다.")) return;
  const button = document.querySelector('[data-revoke-partner-invite="' + CSS.escape(invitationId) + '"]');
  if (button) {
    button.disabled = true;
    button.textContent = "취소 중";
  }
  try {
    const response = await fetch(API_BASE + "/api/partner-registration-invites", {
      method: "DELETE",
      headers: adminHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ id: invitationId }),
    });
    const result = await response.json().catch(function () { return {}; });
    if (!response.ok) throw new Error(result.error || "초대 링크를 취소하지 못했습니다.");
    await loadStats(false);
    showToast("정식 등록 초대 링크를 취소했습니다.");
  } catch (error) {
    showToast(error.message, true);
    if (button) {
      button.disabled = false;
      button.textContent = "초대 취소";
    }
  }
}

function renderOverviewEvents() {
  const events = (dashboardData.recentEvents || []).slice(0, 5);
  document.querySelector("#overviewEvents").innerHTML = events.length ? events.map(function (event) {
    return '<article class="compact-event"><span>' + eventIcon(event.type) + "</span><div><strong>" +
      escapeHtml(eventLabel(event.type)) + "</strong><small>" +
      escapeHtml(centerNameFor(event.centerId)) + " · " + escapeHtml(sourceLabel(event.source)) +
      "</small></div><time>" + formatDate(event.createdAt) + "</time></article>";
  }).join("") : emptyState("아직 이용자 활동이 없습니다.", "활동이 발생하면 이곳에 표시됩니다.");
}

function renderApplications() {
  const applications = dashboardData.centerApplications || [];
  const filtered = applicationFilter === "all"
    ? applications
    : applications.filter(function (item) { return item.status === applicationFilter; });
  const container = document.querySelector("#centerApplications");
  if (!filtered.length) {
    container.innerHTML = emptyState(
      applicationFilter === "pending" ? "처리할 신청이 없습니다." : "등록 신청 내역이 없습니다.",
      applicationFilter === "pending" ? "새 신청이 접수되면 승인함에 표시됩니다." : "접수된 센터 신청이 아직 없습니다."
    );
    return;
  }
  container.innerHTML = filtered.map(function (item) {
    const centerImages = item.photoUrls && item.photoUrls.length ? item.photoUrls : [item.photoUrl].filter(Boolean);
    const mapUrl = item.naverMapUrl || "https://map.naver.com/p/search/" + encodeURIComponent(item.address || "");
    const media = centerImages.map(function (src, index) {
      return imageMarkup(src, item.centerName + " 사진 " + (index + 1), "센터 사진");
    }).join("") + imageMarkup(
      item.licenseImageUrl,
      item.centerName + " " + (item.qualificationLabel || "전문 자격") + " 인증",
      item.qualificationLabel || "전문 자격 인증"
    );
    const detailParts = [item.services, item.memo].filter(Boolean).map(function (value) {
      return "<p>" + escapeHtml(value) + "</p>";
    }).join("");
    const actions = item.status === "pending"
      ? '<div class="application-actions"><button class="approve-button" type="button" data-approve-id="' +
        escapeHtml(item.id) + '">승인하고 등록</button><button class="reject-button" type="button" data-reject-id="' +
        escapeHtml(item.id) + '">보완 요청·반려</button></div>'
      : '<div class="application-actions"><span class="status-badge ' + escapeHtml(item.status) + '">' +
        escapeHtml(statusLabel(item.status)) + "</span></div>";
    return '<article class="application-item"><div class="application-summary"><div class="application-title"><h3>' +
      escapeHtml(item.centerName) + '</h3><span class="status-badge ' + escapeHtml(item.status) + '">' +
      escapeHtml(statusLabel(item.status)) + "</span></div><p>" + escapeHtml(item.address) +
      ' · <a class="icon-label" href="' + escapeHtml(mapUrl) + '" target="_blank" rel="noreferrer">지도에서 확인 ' + uiIcon("external-link") + '</a></p>' +
      '<div class="application-meta"><span>신청자 ' + escapeHtml(item.ownerName) + "</span><span>" +
      escapeHtml(item.phone) + "</span><span>계정 이메일 " + escapeHtml(item.email || "미입력") +
      "</span><span>로그인 " + (item.ownerPasswordSet ? "설정 완료" : "관리자 발급 필요") +
      "</span><span>자격 " + escapeHtml(item.qualificationLabel || (item.therapistBackground ? "물리치료사 면허" : "체육학 학위")) +
      " · " + escapeHtml(item.licenseHolderName) + " · " + escapeHtml(item.licenseNumber) +
      "</span><span>접수 " + formatDate(item.createdAt, true) + "</span></div>" +
      (media ? '<div class="application-media">' + media + "</div>" : "") + detailParts +
      (item.status === "rejected" && item.rejectionReason ? "<p>반려 사유: " + escapeHtml(item.rejectionReason) + "</p>" : "") +
      "</div>" + actions + "</article>";
  }).join("");
}

function renderReviewModeration() {
  const reviews = dashboardData.reviews || [];
  const pending = reviews.filter(function (item) { return item.status === "pending"; });
  const visible = pending.length ? pending : reviews.slice(0, 20);
  const container = document.querySelector("#reviewModerationList");
  container.innerHTML = visible.length ? visible.map(function (item) {
    const actions = item.status === "pending"
      ? '<div class="moderation-actions"><button type="button" data-review-id="' + escapeHtml(item.id) +
        '" data-review-status="approved">공개 승인</button><button type="button" data-review-id="' +
        escapeHtml(item.id) + '" data-review-status="hidden">숨김</button><button type="button" data-review-id="' +
        escapeHtml(item.id) + '" data-review-status="rejected">반려</button></div>'
      : '<span class="status-badge ' + escapeHtml(item.status) + '">' + escapeHtml(statusLabel(item.status)) + "</span>";
    return '<article class="moderation-item"><div><header><h3>' + escapeHtml(item.nickname || "DAIL 이용자") +
      '</h3><span class="stars">' + "★".repeat(Number(item.rating) || 0) + '</span><small>' +
      escapeHtml(centerNameFor(item.centerId)) + " · " + formatDate(item.createdAt, true) +
      "</small></header><p>" + escapeHtml(item.content) + "</p></div>" + actions + "</article>";
  }).join("") : emptyState("심사할 후기가 없습니다.", "로그인 사용자가 후기를 작성하면 승인 대기로 표시됩니다.");
}

async function moderateReview(reviewId, status) {
  const response = await fetch(API_BASE + "/api/reviews?id=" + encodeURIComponent(reviewId), {
    method: "PATCH",
    headers: adminHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ status: status }),
  });
  const data = await response.json().catch(function () { return {}; });
  if (!response.ok) return showToast(data.error || "후기를 처리하지 못했습니다.", true);
  showToast(status === "approved" ? "후기를 공개 승인했습니다." : "후기 상태를 변경했습니다.");
  await loadStats();
}

function centerSearchText(center) {
  const account = center.ownerAccount || {};
  return [
    center.name, center.area, center.address, center.therapist, center.plan,
    (center.tags || []).join(" "), account.email,
  ].join(" ").toLowerCase();
}

function filteredCenters() {
  const query = document.querySelector("#centerSearch").value.trim().toLowerCase();
  const status = document.querySelector("#centerStatusFilter").value;
  const plan = document.querySelector("#centerPlanFilter").value;
  return (dashboardData.centers || []).filter(function (center) {
    return (!query || centerSearchText(center).includes(query)) &&
      (status === "all" || (center.status || "approved") === status) &&
      (plan === "all" || (center.plan || "free") === plan);
  });
}

function renderDirectory() {
  const centers = filteredCenters();
  document.querySelector("#centerResultCount").textContent = formatNumber(centers.length) + "개 센터";
  const container = document.querySelector("#centerDirectory");
  if (!centers.length) {
    container.innerHTML = emptyState("검색 결과가 없습니다.", "검색어나 필터 조건을 바꿔 보세요.");
    return;
  }
  const header = '<div class="directory-header"><span>센터</span><span>상태·플랜</span><span>이용 흐름</span><span>센터장 계정</span><span>최근 활동</span><span>관리</span></div>';
  const rows = centers.map(function (center) {
    const account = center.ownerAccount;
    const views = Number(center.views) || 0;
    const contacts = Number(center.contactClicks) || 0;
    const rate = views ? Math.round(contacts / views * 100) : 0;
    const initials = String(center.name || "DA").slice(0, 2);
    return '<article class="center-row"><div class="center-identity"><span class="center-avatar">' +
      escapeHtml(initials) + "</span><div><strong>" + escapeHtml(center.name) + "</strong><small>" +
      escapeHtml(center.area || "-") + " · " + escapeHtml((center.tags || []).slice(0, 3).join(", ") || "태그 미등록") +
      '</small></div></div><div class="center-status"><span class="status-badge ' +
      escapeHtml(center.status || "approved") + '">' + escapeHtml(statusLabel(center.status || "approved")) +
      '</span><span class="plan-badge ' + escapeHtml(center.plan || "free") + '">' +
      escapeHtml(center.plan || "free") + '</span></div><div class="center-performance"><strong>조회 ' +
      formatNumber(views) + " · 상담 " + formatNumber(contacts) + "</strong><small>상담 클릭률 <b>" + rate +
      "%</b></small></div><div class=\"center-account " + (account ? "" : "missing") + '"><strong>' +
      escapeHtml(account ? account.email : "계정 미등록") + "</strong><small>" +
      escapeHtml(account ? statusLabel(account.status) + " · 최근 로그인 " + formatDate(account.lastLoginAt) : "센터장 계정 발급 필요") +
      '</small></div><div class="center-recent"><strong>' + formatDate(center.lastEventAt) +
      "</strong><small>최근 이용자 활동</small></div><button class=\"manage-button\" type=\"button\" data-manage-center=\"" +
      escapeHtml(center.id) + '">상세 관리</button></article>';
  }).join("");
  container.innerHTML = header + rows;
}

function renderLogs() {
  const query = document.querySelector("#logSearch").value.trim().toLowerCase();
  const events = (dashboardData.recentEvents || []).filter(function (event) {
    const haystack = [event.type, event.centerId, centerNameFor(event.centerId), event.source].join(" ").toLowerCase();
    return !query || haystack.includes(query);
  });
  const eventPanel = document.querySelector("#eventLogPanel");
  eventPanel.innerHTML = events.length ? events.map(function (event) {
    return '<article class="log-item"><span>' + eventIcon(event.type) + "</span><div><strong>" +
      escapeHtml(eventLabel(event.type)) + "</strong><small>" + escapeHtml(centerNameFor(event.centerId)) +
      ' · ID ' + escapeHtml(event.centerId) + '</small></div><span class="source-badge">' +
      escapeHtml(sourceLabel(event.source)) + "</span><time>" + formatDate(event.createdAt, true) + "</time></article>";
  }).join("") : emptyState("조건에 맞는 활동이 없습니다.", "다른 검색어로 확인해 보세요.");

  const logs = (accessData.accessLogs || []).filter(function (log) {
    const haystack = [log.actorUserId, log.actorRole, log.source, log.method, log.path, log.ip, log.userAgent].join(" ").toLowerCase();
    return !query || haystack.includes(query);
  });
  document.querySelector("#accessLogs").innerHTML = logs.length ? logs.map(function (log) {
    const statusCode = Number(log.statusCode) || 0;
    return "<tr><td>" + formatDate(log.createdAt, true) + "</td><td><strong>" +
      escapeHtml(log.actorUserId || "-") + "</strong><br />" + escapeHtml(log.actorRole || "-") +
      '</td><td><span class="source-badge">' + escapeHtml(sourceLabel(log.source)) + "</span></td><td>" +
      escapeHtml(log.method) + " " + escapeHtml(log.path) + '</td><td><span class="http-status ' +
      (statusCode >= 400 ? "error" : "") + '">' + escapeHtml(statusCode || "-") +
      "</span></td><td>" + escapeHtml(log.ip || "-") + "<br />" + escapeHtml(shortUserAgent(log.userAgent)) + "</td></tr>";
  }).join("") : '<tr><td colspan="6">아직 접속 기록이 없거나 검색 결과가 없습니다.</td></tr>';

  const audits = (accessData.auditLogs || []).filter(function (log) {
    const haystack = [log.actorUserId, log.actorRole, log.action, log.targetType, log.targetId].join(" ").toLowerCase();
    return !query || haystack.includes(query);
  });
  document.querySelector("#auditLogs").innerHTML = audits.length ? audits.map(function (log) {
    return "<tr><td>" + formatDate(log.createdAt, true) + "</td><td><strong>" +
      escapeHtml(log.actorUserId || "-") + "</strong><br />" + escapeHtml(log.actorRole || "-") +
      "</td><td>" + escapeHtml(log.action) + "</td><td>" + escapeHtml(log.targetType) + " · " +
      escapeHtml(log.targetId || "-") + '</td><td><span class="http-status ' +
      (log.success ? "" : "error") + '">' + (log.success ? "성공" : "실패") + "</span></td></tr>";
  }).join("") : '<tr><td colspan="5">아직 관리자 작업 기록이 없거나 검색 결과가 없습니다.</td></tr>';

  const errors = (accessData.errorLogs || []).filter(function (log) {
    const haystack = [log.source, log.errorCode, log.path, log.message].join(" ").toLowerCase();
    return !query || haystack.includes(query);
  });
  document.querySelector("#errorLogs").innerHTML = errors.length ? errors.map(function (log) {
    return "<tr><td>" + formatDate(log.createdAt, true) + "</td><td>" + escapeHtml(log.source) +
      "</td><td><strong>" + escapeHtml(log.errorCode) + "</strong></td><td>" +
      escapeHtml(log.path || "-") + " · " + escapeHtml(log.statusCode || "-") + "</td><td>" +
      escapeHtml(log.message) + "</td></tr>";
  }).join("") : '<tr><td colspan="5">기록된 오류가 없거나 검색 결과가 없습니다.</td></tr>';
  updateLogTab();
}

function updateLogTab() {
  document.querySelector("#eventLogPanel").hidden = activeLogTab !== "events";
  document.querySelector("#accessLogPanel").hidden = activeLogTab !== "access";
  document.querySelector("#auditLogPanel").hidden = activeLogTab !== "audit";
  document.querySelector("#errorLogPanel").hidden = activeLogTab !== "errors";
  document.querySelectorAll("[data-log-tab]").forEach(function (button) {
    button.classList.toggle("active", button.dataset.logTab === activeLogTab);
  });
}

function renderOperations() {
  const badge = document.querySelector("#systemHealthBadge");
  if (!operationsData) {
    badge.textContent = "상태 확인 실패";
    badge.className = "health-badge critical";
    document.querySelector("#systemMetrics").innerHTML = emptyState("상태 정보를 불러오지 못했습니다.", "DB 연결과 서버 환경을 확인하세요.");
    document.querySelector("#alertList").innerHTML = "";
    return;
  }
  const status = operationsData.status || "warning";
  badge.textContent = status === "healthy" ? "정상" : status === "critical" ? "긴급 확인" : "확인 필요";
  badge.className = "health-badge " + status;
  const process = operationsData.process || {};
  const memory = process.memory || {};
  const database = operationsData.database || {};
  document.querySelector("#systemMetrics").innerHTML = [
    ["DB 응답", database.healthy ? formatNumber(database.responseMs) + "ms" : "연결 실패"],
    ["DB 사용량", formatNumber(database.sizeMb) + "MB"],
    ["DB 연결", formatNumber(database.activeConnections) + " / " + formatNumber(database.maxConnections)],
    ["메모리 RSS", formatNumber(memory.rssMb) + "MB"],
    ["프로세스 가동", formatNumber(Math.round((process.uptimeSeconds || 0) / 60)) + "분"],
  ].map(function (item) {
    return "<article><small>" + item[0] + "</small><strong>" + escapeHtml(item[1]) + "</strong></article>";
  }).join("");
  const alerts = operationsData.alerts || [];
  document.querySelector("#alertList").innerHTML = alerts.length ? alerts.map(function (item) {
    return '<article class="alert-item"><div><strong>' + escapeHtml(item.severity + " · " + item.alert_type) +
      "</strong><small>" + escapeHtml(item.message) + " · " + formatDate(item.created_at, true) +
      '</small></div><button type="button" data-alert-id="' + escapeHtml(item.id) +
      '" data-alert-status="' + (item.status === "open" ? "acknowledged" : "resolved") + '">' +
      (item.status === "open" ? "확인 처리" : "해결 처리") + "</button></article>";
  }).join("") : emptyState("열린 운영 경고가 없습니다.", "CPU·메모리·DB·오류 임계치를 계속 감시합니다.");
}

function renderPlatformRoles() {
  const roles = platformRolesData.roles || [];
  const container = document.querySelector("#platformRoleList");
  container.innerHTML = roles.length ? roles.map(function (item) {
    return '<article class="role-item"><div><strong>' + escapeHtml(item.email || item.user_id) +
      "</strong><small>MFA " + (item.mfa_required === false ? "선택" : "필수") + " · " +
      formatDate(item.created_at, true) + '</small></div><select data-role-id="' + escapeHtml(item.id) +
      '" data-role-field="role"><option value="admin">관리자</option><option value="support">고객지원</option>' +
      '<option value="analyst">분석가</option><option value="super_admin">최고 관리자</option></select>' +
      '<select data-role-id="' + escapeHtml(item.id) + '" data-role-field="status"><option value="active">활성</option>' +
      '<option value="suspended">일시 정지</option><option value="revoked">권한 회수</option></select></article>';
  }).join("") : emptyState("표시할 운영자 권한이 없습니다.", "Supabase Auth 관리자 계정을 초대하면 이곳에 표시됩니다.");
  roles.forEach(function (item) {
    const roleSelect = container.querySelector('[data-role-id="' + CSS.escape(item.id) + '"][data-role-field="role"]');
    const statusSelect = container.querySelector('[data-role-id="' + CSS.escape(item.id) + '"][data-role-field="status"]');
    if (roleSelect) roleSelect.value = item.role;
    if (statusSelect) statusSelect.value = item.status;
  });
}

async function approveApplication(applicationId) {
  const application = (dashboardData.centerApplications || []).find(function (item) {
    return item.id === applicationId;
  });
  const response = await fetch(API_BASE + "/api/approve-center?id=" + encodeURIComponent(applicationId), {
    method: "POST",
    headers: adminHeaders(),
  });
  const data = await response.json().catch(function () { return {}; });
  if (!response.ok) return showToast(data.error || "승인에 실패했습니다.", true);
  showToast(data.ownerAccountCreated || data.ownerMembershipCreated
    ? "센터 승인과 센터장 계정 활성화를 완료했습니다."
    : "센터를 승인하고 지도 등록을 완료했습니다.");
  await loadStats();
  if (
    data.centerId &&
    application &&
    !data.ownerAccountCreated &&
    !data.ownerMembershipCreated &&
    window.confirm("센터 승인이 완료되었습니다. 이어서 센터장 대시보드 계정을 발급할까요?")
  ) {
    await createOwnerAccount(data.centerId, application.centerName, application.email);
  }
}

async function rejectApplication(applicationId) {
  const reason = window.prompt("보완 요청 또는 반려 사유를 입력해 주세요.", "등록 정보 보완이 필요합니다.");
  if (reason === null) return;
  const response = await fetch(
    API_BASE + "/api/approve-center?action=reject&id=" + encodeURIComponent(applicationId),
    {
      method: "POST",
      headers: adminHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ reason: reason }),
    }
  );
  const data = await response.json().catch(function () { return {}; });
  if (!response.ok) return showToast(data.error || "반려에 실패했습니다.", true);
  showToast("신청을 반려 처리했습니다.");
  await loadStats();
}

function openCenterDialog(centerId) {
  const center = (dashboardData.centers || []).find(function (item) { return item.id === centerId; });
  if (!center) return;
  const account = center.ownerAccount;
  document.querySelector("#centerId").value = center.id;
  document.querySelector("#centerName").value = center.name || "";
  document.querySelector("#centerArea").value = center.area || "";
  document.querySelector("#centerAddress").value = center.address || "";
  document.querySelector("#centerLat").value = center.lat == null ? "" : center.lat;
  document.querySelector("#centerLng").value = center.lng == null ? "" : center.lng;
  document.querySelector("#centerStatus").value = center.status || "approved";
  document.querySelector("#centerPlan").value = center.plan || "free";
  document.querySelector("#centerLead").value = center.lead || "";
  document.querySelector("#centerTags").value = (center.tags || []).join(", ");
  document.querySelector("#centerTherapist").value = center.therapist || "";
  document.querySelector("#centerPrice").value = center.price || "";
  document.querySelector("#dialogCenterTitle").textContent = center.name;
  document.querySelector("#dialogCenterMeta").textContent =
    (center.area || "지역 미등록") + " · 조회 " + formatNumber(center.views) + " · 상담 " + formatNumber(center.contactClicks);
  document.querySelector("#dialogOwnerAccount").textContent = account ? account.email : "센터장 계정 미등록";
  document.querySelector("#dialogOwnerLogin").textContent = account
    ? statusLabel(account.status) + " · 최근 로그인 " + formatDate(account.lastLoginAt, true)
    : "센터장에게 전용 대시보드 계정을 발급할 수 있습니다.";
  document.querySelector("#dialogOwnerButton").dataset.centerId = center.id;
  document.querySelector("#dialogOwnerButton").dataset.centerName = center.name;
  document.querySelector("#deleteCenterButton").dataset.centerId = center.id;
  document.querySelector("#deleteCenterButton").dataset.centerName = center.name;
  const editable = ["super_admin", "admin"].includes(currentAdminRole);
  centerForm.querySelectorAll("input, textarea, select").forEach(function (element) {
    element.disabled = !editable;
  });
  centerForm.querySelector('button[type="submit"]').hidden = !editable;
  document.querySelector("#deleteCenterButton").hidden = !editable;
  document.querySelector("#dialogOwnerButton").hidden = !editable;
  if (typeof centerDialog.showModal === "function") centerDialog.showModal();
  else centerDialog.setAttribute("open", "");
}

async function updateCenter() {
  const centerId = document.querySelector("#centerId").value;
  const address = document.querySelector("#centerAddress").value.trim();
  const area = document.querySelector("#centerArea").value.trim();
  const latValue = document.querySelector("#centerLat").value.trim();
  const lngValue = document.querySelector("#centerLng").value.trim();
  const body = {
    name: document.querySelector("#centerName").value.trim(),
    area: area,
    address: address,
    lat: latValue ? Number(latValue) : null,
    lng: lngValue ? Number(lngValue) : null,
    status: document.querySelector("#centerStatus").value,
    plan: document.querySelector("#centerPlan").value,
    lead: document.querySelector("#centerLead").value.trim(),
    tags: document.querySelector("#centerTags").value.split(",").map(function (item) { return item.trim(); }).filter(Boolean),
    therapist: document.querySelector("#centerTherapist").value.trim(),
    price: document.querySelector("#centerPrice").value.trim(),
    naver_map_url: "https://map.naver.com/p/search/" + encodeURIComponent(address || area),
  };
  const response = await fetch(
    API_BASE + "/api/approve-center?action=update&id=" + encodeURIComponent(centerId),
    {
      method: "POST",
      headers: adminHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(body),
    }
  );
  const data = await response.json().catch(function () { return {}; });
  if (!response.ok) return showToast(data.error || "센터 정보를 저장하지 못했습니다.", true);
  centerDialog.close();
  showToast("센터 정보를 저장했습니다.");
  await loadStats();
}

async function deleteCenter(centerId, centerName) {
  if (!window.confirm("‘" + centerName + "’ 센터를 지도와 관리 목록에서 완전히 삭제할까요? 이 작업은 되돌릴 수 없습니다.")) return;
  const response = await fetch(
    API_BASE + "/api/approve-center?action=delete&id=" + encodeURIComponent(centerId),
    { method: "POST", headers: adminHeaders() }
  );
  const data = await response.json().catch(function () { return {}; });
  if (!response.ok) return showToast(data.error || "센터를 삭제하지 못했습니다.", true);
  centerDialog.close();
  showToast("센터를 삭제했습니다.");
  await loadStats();
}

async function createOwnerAccount(centerId, centerName, suggestedEmail) {
  const currentCenter = (dashboardData.centers || []).find(function (item) { return item.id === centerId; });
  const existingEmail = currentCenter && currentCenter.ownerAccount
    ? currentCenter.ownerAccount.email
    : (currentCenter && currentCenter.registrationEmail) || suggestedEmail || "";
  const email = window.prompt("‘" + centerName + "’ 센터장 로그인 이메일을 입력해 주세요.", existingEmail);
  if (!email) return;
  const password = window.prompt("임시 비밀번호를 입력해 주세요. 10자 이상이어야 합니다.");
  if (!password) return;
  const response = await fetch(API_BASE + "/api/owner-accounts", {
    method: "POST",
    headers: adminHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ centerId: centerId, email: email, password: password }),
  });
  const data = await response.json().catch(function () { return {}; });
  if (!response.ok) return showToast(data.error || "센터장 계정을 저장하지 못했습니다.", true);
  if (centerDialog.open) centerDialog.close();
  showToast("센터장 계정을 저장했습니다.");
  await loadStats();
  openCenterDialog(centerId);
}

async function updateAlert(id, status) {
  const response = await fetch(API_BASE + "/api/operations", {
    method: "PATCH",
    headers: adminHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ id: id, status: status }),
  });
  const data = await response.json().catch(function () { return {}; });
  if (!response.ok) return showToast(data.error || "경고 상태를 변경하지 못했습니다.", true);
  showToast(status === "resolved" ? "경고를 해결 처리했습니다." : "경고를 확인 처리했습니다.");
  await loadStats();
}

async function savePlatformRole(payload) {
  const method = payload.id ? "PATCH" : "POST";
  const response = await fetch(API_BASE + "/api/platform-users", {
    method: method,
    headers: adminHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(function () { return {}; });
  if (!response.ok) return showToast(data.error || "운영자 권한을 저장하지 못했습니다.", true);
  showToast(data.invitationSent ? "운영자 초대 메일과 MFA 권한을 설정했습니다." : "운영자 권한을 저장했습니다.");
  await loadStats();
}

loginForm.addEventListener("submit", function (event) {
  event.preventDefault();
  login();
});

mfaForm.addEventListener("submit", async function (event) {
  event.preventDefault();
  const button = mfaForm.querySelector('button[type="submit"]');
  const message = document.querySelector("#mfaMessage");
  button.disabled = true;
  message.textContent = "";
  try {
    await mfaRequest("verify", {
      factorId: pendingMfaFactorId,
      challengeId: pendingMfaChallengeId,
      code: document.querySelector("#mfaCode").value,
    });
    pendingMfaAccessToken = "";
    loginPassword.value = "";
    document.querySelector("#mfaCode").value = "";
    mfaPanel.hidden = true;
    loginForm.hidden = false;
    history.replaceState(null, "", "/admin/");
    window.location.hash = "";
    await loadStats();
  } catch (error) {
    message.textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

adminInviteForm.addEventListener("submit", async function (event) {
  event.preventDefault();
  const button = adminInviteForm.querySelector('button[type="submit"]');
  const message = document.querySelector("#adminInviteMessage");
  button.disabled = true;
  message.textContent = "";
  pendingMfaAccessToken = adminInviteAccessToken;
  try {
    await mfaRequest("set_password", {
      password: document.querySelector("#adminInvitePassword").value,
    });
    adminInvitePanel.hidden = true;
    await beginMfa({ accessToken: adminInviteAccessToken, factors: {} });
  } catch (error) {
    message.textContent = error.message;
    adminInvitePanel.hidden = false;
  } finally {
    button.disabled = false;
  }
});

togglePassword.addEventListener("click", function () {
  const show = loginPassword.type === "password";
  loginPassword.type = show ? "text" : "password";
  togglePassword.textContent = show ? "숨기기" : "보기";
  togglePassword.setAttribute("aria-label", show ? "비밀번호 숨기기" : "비밀번호 표시");
});

refreshButton.addEventListener("click", function () { loadStats(true); });

logoutButton.addEventListener("click", async function () {
  await fetch(API_BASE + "/api/logout", { method: "POST", headers: adminHeaders() }).catch(function () {});
  sessionToken = "";
  pendingMfaAccessToken = "";
  mfaPanel.hidden = true;
  loginForm.hidden = false;
  showLogin();
});

document.querySelector("#applicationFilters").addEventListener("click", function (event) {
  const button = event.target.closest("[data-application-filter]");
  if (!button) return;
  applicationFilter = button.dataset.applicationFilter;
  document.querySelectorAll("[data-application-filter]").forEach(function (item) {
    item.classList.toggle("active", item === button);
  });
  renderApplications();
});

document.querySelector("#partnerApplicationFilters").addEventListener("click", function (event) {
  const button = event.target.closest("[data-partner-filter]");
  if (!button) return;
  partnerApplicationFilter = button.dataset.partnerFilter;
  document.querySelectorAll("[data-partner-filter]").forEach(function (item) {
    item.classList.toggle("active", item === button);
  });
  renderPartnerApplications();
});

document.querySelector("#partnerApplicationSearch").addEventListener("input", renderPartnerApplications);

document.querySelector("#partnerApplications").addEventListener("click", function (event) {
  const saveButton = event.target.closest("[data-save-partner]");
  const inviteButton = event.target.closest("[data-create-partner-invite]");
  const revokeInviteButton = event.target.closest("[data-revoke-partner-invite]");
  if (saveButton) updatePartnerApplication(saveButton.dataset.savePartner);
  if (inviteButton) createPartnerInvite(inviteButton.dataset.createPartnerInvite);
  if (revokeInviteButton) revokePartnerInvite(revokeInviteButton.dataset.revokePartnerInvite);
});

document.querySelector("#centerApplications").addEventListener("click", function (event) {
  const approve = event.target.closest("[data-approve-id]");
  const reject = event.target.closest("[data-reject-id]");
  if (approve) approveApplication(approve.dataset.approveId);
  if (reject) rejectApplication(reject.dataset.rejectId);
});

document.querySelector("#reviewModerationList").addEventListener("click", function (event) {
  const button = event.target.closest("[data-review-id]");
  if (button) moderateReview(button.dataset.reviewId, button.dataset.reviewStatus);
});

["centerSearch", "centerStatusFilter", "centerPlanFilter"].forEach(function (id) {
  const element = document.querySelector("#" + id);
  element.addEventListener(id === "centerSearch" ? "input" : "change", renderDirectory);
});

document.querySelector("#centerDirectory").addEventListener("click", function (event) {
  const button = event.target.closest("[data-manage-center]");
  if (button) openCenterDialog(button.dataset.manageCenter);
});

document.querySelector("#logTabs").addEventListener("click", function (event) {
  const button = event.target.closest("[data-log-tab]");
  if (!button) return;
  activeLogTab = button.dataset.logTab;
  updateLogTab();
});

document.querySelector("#logSearch").addEventListener("input", renderLogs);

document.querySelector("#alertList").addEventListener("click", function (event) {
  const button = event.target.closest("[data-alert-id]");
  if (button) updateAlert(button.dataset.alertId, button.dataset.alertStatus);
});

document.querySelector("#platformRoleForm").addEventListener("submit", function (event) {
  event.preventDefault();
  savePlatformRole({
    email: document.querySelector("#platformRoleEmail").value.trim(),
    role: document.querySelector("#platformRoleValue").value,
    mfaRequired: true,
  });
});

document.querySelector("#platformRoleList").addEventListener("change", function (event) {
  const select = event.target.closest("[data-role-id]");
  if (!select) return;
  const id = select.dataset.roleId;
  const role = document.querySelector('[data-role-id="' + CSS.escape(id) + '"][data-role-field="role"]').value;
  const status = document.querySelector('[data-role-id="' + CSS.escape(id) + '"][data-role-field="status"]').value;
  savePlatformRole({ id: id, role: role, status: status, mfaRequired: true });
});

centerForm.addEventListener("submit", function (event) {
  event.preventDefault();
  updateCenter();
});

document.querySelector("#closeCenterDialog").addEventListener("click", function () { centerDialog.close(); });
document.querySelector("#cancelCenterButton").addEventListener("click", function () { centerDialog.close(); });
document.querySelector("#dialogOwnerButton").addEventListener("click", function (event) {
  createOwnerAccount(event.currentTarget.dataset.centerId, event.currentTarget.dataset.centerName);
});
document.querySelector("#deleteCenterButton").addEventListener("click", function (event) {
  deleteCenter(event.currentTarget.dataset.centerId, event.currentTarget.dataset.centerName);
});

centerDialog.addEventListener("click", function (event) {
  if (event.target === centerDialog) centerDialog.close();
});

document.querySelectorAll(".section-nav a").forEach(function (link) {
  link.addEventListener("click", function () {
    document.querySelectorAll(".section-nav a").forEach(function (item) {
      item.classList.toggle("active", item === link);
    });
  });
});

if (adminInviteAccessToken && adminInviteType === "invite") {
  loginForm.hidden = true;
  adminInvitePanel.hidden = false;
  mfaPanel.hidden = true;
} else {
  loadStats();
}
