const API_BASE = window.location.protocol === "file:" ? "http://localhost:8090" : window.location.origin;
const loginPanel = document.querySelector("#loginPanel");
const dashboard = document.querySelector("#dashboard");
const loginForm = document.querySelector("#loginForm");
const loginPassword = document.querySelector("#loginPassword");
const loginMessage = document.querySelector("#loginMessage");
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
let applicationFilter = "pending";
let activeLogTab = "events";
let toastTimer = 0;

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
  if (type === "contact") return "↗";
  if (type === "favorite") return "♡";
  if (type === "review") return "★";
  return "◎";
}

function sourceLabel(source) {
  const labels = {
    web: "웹",
    app: "앱",
    admin: "최고 관리자",
    owner: "센터 관리자",
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
  return '<div class="empty-state"><span>✓</span><strong>' + escapeHtml(title) + "</strong><p>" + escapeHtml(copy) + "</p></div>";
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
  loginPanel.hidden = false;
  dashboard.hidden = true;
  logoutButton.hidden = true;
}

function showDashboard() {
  loginPanel.hidden = true;
  dashboard.hidden = false;
  logoutButton.hidden = false;
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
      body: JSON.stringify({ password: loginPassword.value }),
    });
    const data = await response.json().catch(function () { return {}; });
    if (!response.ok) {
      loginMessage.textContent = data.error || "로그인에 실패했습니다.";
      return;
    }
    sessionToken = data.token || "";
    loginPassword.value = "";
    await loadStats();
  } catch {
    loginMessage.textContent = "서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.";
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
  document.querySelector("#totalViews").textContent = formatNumber(views);
  document.querySelector("#totalContacts").textContent = formatNumber(contacts);
  document.querySelector("#contactRate").textContent = rate + "%";
  document.querySelector("#navPendingCount").textContent = formatNumber(totals.pendingCenters);
  document.querySelector("#centerHealthCopy").textContent = incomplete
    ? "프로필 보완 필요 " + incomplete + "곳"
    : "모든 센터 프로필 기본 정보 완료";
  document.querySelector("#lastRefreshedAt").textContent = formatDate(new Date());
  document.querySelector("#totalAccessLogsLabel").textContent =
    "접속 기록 " + formatNumber(accessData.totals && accessData.totals.accessLogs) + "건";

  renderActionChecklist(totals.pendingCenters || 0, incomplete, missingAccounts);
  renderOverviewEvents();
  renderApplications();
  renderDirectory();
  renderLogs();
}

function renderActionChecklist(pending, incomplete, missingAccounts) {
  const items = [
    {
      href: "#applicationsSection",
      icon: "!",
      warning: pending > 0,
      title: "승인 대기 신청",
      copy: pending ? "신청 자료를 검토하고 승인 또는 반려하세요." : "새로 처리할 신청이 없습니다.",
      value: formatNumber(pending) + "건",
    },
    {
      href: "#centersSection",
      icon: "◫",
      warning: incomplete > 0,
      title: "프로필 정보 보완",
      copy: "주소·소개·태그·운영자·가격 기본 항목 기준",
      value: formatNumber(incomplete) + "곳",
    },
    {
      href: "#centersSection",
      icon: "⌾",
      warning: missingAccounts > 0,
      title: "센터장 계정 미등록",
      copy: "센터가 직접 정보를 관리할 수 있도록 계정을 발급하세요.",
      value: formatNumber(missingAccounts) + "곳",
    },
  ];
  document.querySelector("#actionChecklist").innerHTML = items.map(function (item) {
    return '<a class="action-item ' + (item.warning ? "warning" : "") + '" href="' + item.href + '">' +
      "<span>" + item.icon + "</span><div><strong>" + item.title + "</strong><small>" + item.copy +
      "</small></div><b>" + item.value + "</b></a>";
  }).join("");
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
    }).join("") + imageMarkup(item.licenseImageUrl, item.centerName + " 면허 인증", "면허 인증");
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
      ' · <a href="' + escapeHtml(mapUrl) + '" target="_blank" rel="noreferrer">지도에서 확인 ↗</a></p>' +
      '<div class="application-meta"><span>신청자 ' + escapeHtml(item.ownerName) + "</span><span>" +
      escapeHtml(item.phone) + "</span><span>면허 " + escapeHtml(item.licenseHolderName) + " · " +
      escapeHtml(item.licenseNumber) + "</span><span>접수 " + formatDate(item.createdAt, true) + "</span></div>" +
      (media ? '<div class="application-media">' + media + "</div>" : "") + detailParts +
      (item.status === "rejected" && item.rejectionReason ? "<p>반려 사유: " + escapeHtml(item.rejectionReason) + "</p>" : "") +
      "</div>" + actions + "</article>";
  }).join("");
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
  updateLogTab();
}

function updateLogTab() {
  document.querySelector("#eventLogPanel").hidden = activeLogTab !== "events";
  document.querySelector("#accessLogPanel").hidden = activeLogTab !== "access";
  document.querySelectorAll("[data-log-tab]").forEach(function (button) {
    button.classList.toggle("active", button.dataset.logTab === activeLogTab);
  });
}

async function approveApplication(applicationId) {
  const response = await fetch(API_BASE + "/api/approve-center?id=" + encodeURIComponent(applicationId), {
    method: "POST",
    headers: adminHeaders(),
  });
  const data = await response.json().catch(function () { return {}; });
  if (!response.ok) return showToast(data.error || "승인에 실패했습니다.", true);
  showToast("센터를 승인하고 지도 등록을 완료했습니다.");
  await loadStats();
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

async function createOwnerAccount(centerId, centerName) {
  const currentCenter = (dashboardData.centers || []).find(function (item) { return item.id === centerId; });
  const existingEmail = currentCenter && currentCenter.ownerAccount ? currentCenter.ownerAccount.email : "";
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
  centerDialog.close();
  showToast("센터장 계정을 저장했습니다.");
  await loadStats();
  openCenterDialog(centerId);
}

loginForm.addEventListener("submit", function (event) {
  event.preventDefault();
  login();
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

document.querySelector("#centerApplications").addEventListener("click", function (event) {
  const approve = event.target.closest("[data-approve-id]");
  const reject = event.target.closest("[data-reject-id]");
  if (approve) approveApplication(approve.dataset.approveId);
  if (reject) rejectApplication(reject.dataset.rejectId);
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

loadStats();
