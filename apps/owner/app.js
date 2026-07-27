const loginPanel = document.querySelector("#loginPanel");
const invitePanel = document.querySelector("#invitePanel");
const dashboard = document.querySelector("#dashboard");
const loginForm = document.querySelector("#loginForm");
const centerForm = document.querySelector("#centerForm");
const logoutButton = document.querySelector("#logoutButton");
const ownerQuery = new URLSearchParams(window.location.search);
const ownerLoginEmail = document.querySelector("#email");
const invitationToken = String(ownerQuery.get("invite") || "");
const hashValues = new URLSearchParams(window.location.hash.replace(/^#/, ""));
const invitationAccessToken = String(hashValues.get("access_token") || "");
const ownerEmailHint = String(ownerQuery.get("email") || "").trim().toLowerCase();
const tagInput = document.querySelector("#tagInput");
const tagField = centerForm.elements.tags;
const tagChips = document.querySelector("#tagChips");
const tagEditor = document.querySelector("#tagEditor");
const AUTH_STORAGE_KEY = "dail_auth_session";
const AUTH_RETURN_KEY = "dail_auth_return_to";

let currentEmail = "";
let currentCenterId = "";
let currentRole = "";
let hasUnsavedChanges = false;
let latestInvitationLinks = {};
let publicConfig = { auth: { supabaseUrl: "", supabaseAnonKey: "", providers: {} } };

const ownerOnboardingMessage = invitationToken
  ? "초대받은 DAIL 계정으로 로그인하면 센터 구성원 합류가 완료됩니다."
  : ownerQuery.get("from") === "register"
    ? "센터가 승인되면 등록 신청에 사용한 같은 DAIL 계정으로 로그인해 주세요."
    : "";

if (/^\S+@\S+\.\S+$/.test(ownerEmailHint)) ownerLoginEmail.value = ownerEmailHint;

const escapeHtml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");
const uiIcon = (name, className = "") =>
  `<svg class="ui-icon ${className}" aria-hidden="true"><use href="/assets/ui-icons.svg#${name}"></use></svg>`;
const ratingIcons = (rating) =>
  Array.from({ length: 5 }, (_, index) => uiIcon("star", index < Number(rating || 0) ? "is-filled" : "")).join("");
const formatDate = (value, withTime = true) => value
  ? new Intl.DateTimeFormat("ko-KR", withTime
    ? { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }
    : { year: "numeric", month: "short", day: "numeric" }).format(new Date(value))
  : "-";
const roleLabel = (role) => ({
  owner: "소유자",
  manager: "매니저",
  staff: "직원",
  viewer: "조회 전용",
})[role] || role || "-";
const statusLabel = (status) => ({
  active: "활성",
  suspended: "일시 정지",
  revoked: "권한 회수",
  invited: "초대 중",
})[status] || status || "-";

function tagValues() {
  return tagField.value.split(",").map((tag) => tag.trim()).filter(Boolean);
}

function renderTags() {
  const tags = tagValues();
  tagChips.innerHTML = tags.map((tag, index) =>
    `<button class="tag-chip" type="button" data-tag-index="${index}" aria-label="${escapeHtml(tag)} 태그 삭제"><span>${escapeHtml(tag)}</span><i aria-hidden="true">${uiIcon("x")}</i></button>`
  ).join("");
  document.querySelector("#tagCount").textContent = tags.length;
  tagEditor.classList.toggle("limit", tags.length >= 12);
  tagInput.placeholder = tags.length >= 12 ? "최대 12개까지 입력할 수 있어요" : "태그 입력 후 스페이스 또는 쉼표";
  tagInput.disabled = tags.length >= 12 || currentRole === "viewer";
}

function addTag(raw) {
  const tag = String(raw || "").trim().replace(/^,+|,+$/g, "");
  if (!tag || currentRole === "viewer") return false;
  const tags = tagValues();
  if (tags.length >= 12 || tags.some((item) => item.toLowerCase() === tag.toLowerCase())) return false;
  tags.push(tag.slice(0, 30));
  tagField.value = tags.join(", ");
  tagInput.value = "";
  renderTags();
  updatePreview();
  setDirtyState(true);
  return true;
}

function removeTag(index) {
  if (currentRole === "viewer") return;
  const tags = tagValues();
  tags.splice(index, 1);
  tagField.value = tags.join(", ");
  renderTags();
  updatePreview();
  setDirtyState(true);
  tagInput.focus();
}

function showLogin(message = ownerOnboardingMessage) {
  invitePanel.hidden = true;
  loginPanel.hidden = false;
  dashboard.hidden = true;
  logoutButton.hidden = true;
  const loginMessage = document.querySelector("#loginMessage");
  loginMessage.textContent = message;
  loginMessage.classList.toggle("onboarding", Boolean(message));
}

function showInvitationActivation() {
  loginPanel.hidden = true;
  dashboard.hidden = true;
  logoutButton.hidden = true;
  invitePanel.hidden = false;
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

async function establishSocialOwnerSession() {
  const session = await activeAuthSession();
  if (!session?.access_token) return { ok: false, message: "" };
  const response = await fetch("/api/owner-login", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + session.access_token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ invitationToken }),
  });
  const data = await response.json().catch(() => ({}));
  return {
    ok: response.ok,
    message: data.error || "",
  };
}

async function initializeOwnerAuth() {
  try {
    const response = await fetch("/api/config");
    publicConfig = await response.json();
  } catch {
    publicConfig = { auth: { supabaseUrl: "", supabaseAnonKey: "", providers: {} } };
  }
  const providers = publicConfig.auth?.providers || {};
  document.querySelectorAll("[data-owner-auth-provider]").forEach((button) => {
    const ready = Boolean(providers[button.dataset.ownerAuthProvider]);
    button.dataset.ready = String(ready);
    button.disabled = !ready;
    button.title = ready ? "" : "로그인 설정을 준비하고 있습니다.";
  });
  if (invitationToken && invitationAccessToken) showInvitationActivation();
  else loadDashboard();
}

function formValues() {
  const data = new FormData(centerForm);
  const values = Object.fromEntries(data.entries());
  values.categories = data.getAll("categories");
  return values;
}

function updatePreview() {
  const values = formValues();
  document.querySelector("#previewName").textContent = values.name || "센터명";
  document.querySelector("#previewArea").textContent = values.area || "지역";
  document.querySelector("#previewLead").textContent = values.lead || "센터 소개를 입력하면 이곳에 표시됩니다.";
  document.querySelector("#previewTherapist").textContent = values.therapist || "-";
  document.querySelector("#previewHours").textContent = values.opening_hours || "-";
  document.querySelector("#previewPrice").textContent = values.price || "-";
  const items = [
    ...values.categories,
    ...values.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
  ].slice(0, 6);
  document.querySelector("#previewTags").innerHTML = items.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("");
  document.querySelector('[data-count="lead"]').textContent = values.lead.length;
}

function syncCategories(center) {
  const selected = new Set(center.categories || []);
  centerForm.querySelectorAll('[name="categories"]').forEach((input) => {
    input.checked = selected.has(input.value);
  });
}

function profileStatus(center) {
  const items = [
    { label: "센터 기본 정보", done: Boolean(center.name && center.area && center.address) },
    { label: "연락처와 운영시간", done: Boolean(center.phone && center.openingHours) },
    { label: "소개와 전문 분야", done: Boolean(center.lead && (center.tags || []).length >= 2) },
    { label: "가격 안내", done: Boolean(center.price) },
  ];
  const score = Math.round(items.filter((item) => item.done).length / items.length * 100);
  document.querySelector("#completionValue").textContent = `${score}%`;
  document.querySelector("#completionBar").style.width = `${score}%`;
  document.querySelector("#checklist").innerHTML = items.map((item) =>
    `<div class="${item.done ? "done" : ""}"><i>${item.done ? uiIcon("check") : ""}</i><span>${item.label}</span></div>`
  ).join("");
}

function setFormAccess(role) {
  const readOnly = role === "viewer";
  centerForm.querySelectorAll("input, textarea, button").forEach((element) => {
    if (element.type === "hidden") return;
    element.disabled = readOnly;
  });
  centerForm.querySelectorAll('[name="categories"]').forEach((element) => {
    element.disabled = readOnly;
  });
  if (readOnly) {
    document.querySelector("#changeStatus").textContent = "조회 전용 권한입니다";
  }
}

function renderCenterSwitcher(centers) {
  const wrap = document.querySelector("#centerSwitcherWrap");
  const select = document.querySelector("#centerSwitcher");
  select.innerHTML = centers.map((center) =>
    `<option value="${escapeHtml(center.id)}">${escapeHtml(center.name)} · ${escapeHtml(roleLabel(center.role))}</option>`
  ).join("");
  select.value = currentCenterId;
  wrap.hidden = centers.length < 2;
}

function fillDashboard(data) {
  currentEmail = data.account?.email || currentEmail;
  currentCenterId = data.center.id;
  currentRole = data.account?.role || currentRole;
  invitePanel.hidden = true;
  loginPanel.hidden = true;
  dashboard.hidden = false;
  logoutButton.hidden = false;
  document.querySelector("#centerHeading").textContent = `${data.center.name} 운영 현황`;
  document.querySelector("#updatedAt").textContent = `최근 수정 ${formatDate(data.center.updatedAt, false)}`;
  document.querySelector("#views").textContent = data.totals.views.toLocaleString();
  document.querySelector("#contacts").textContent = data.totals.contactClicks.toLocaleString();
  document.querySelector("#contactRate").textContent = `${data.totals.contactRate || 0}%`;
  document.querySelector("#last30Views").textContent = (data.totals.last30Views || 0).toLocaleString();
  document.querySelector("#last30Contacts").textContent = (data.totals.last30Contacts || 0).toLocaleString();
  document.querySelector("#reviews").textContent = data.totals.reviews.toLocaleString();
  document.querySelector("#rating").textContent = data.totals.ratingAverage ? `${data.totals.ratingAverage} / 5` : "-";
  const fields = {
    name: data.center.name,
    area: data.center.area,
    address: data.center.address,
    phone: data.center.phone,
    website: data.center.website,
    opening_hours: data.center.openingHours,
    lead: data.center.lead,
    tags: (data.center.tags || []).join(", "),
    therapist: data.center.therapist,
    price: data.center.price,
  };
  Object.entries(fields).forEach(([name, value]) => {
    centerForm.elements[name].value = value || "";
  });
  syncCategories(data.center);
  setFormAccess(currentRole);
  renderTags();
  profileStatus(data.center);
  updatePreview();
  renderCenterSwitcher(data.availableCenters || []);
  document.querySelector("#eventList").innerHTML = data.recentEvents.map((item) =>
    `<article><strong>${item.type === "view" ? "센터 상세 조회" : "상담 연결 클릭"}</strong><span>${escapeHtml(item.source)} · ${formatDate(item.createdAt)}</span></article>`
  ).join("") || '<p class="empty">아직 기록된 이용자 활동이 없습니다.</p>';
  document.querySelector("#reviewList").innerHTML = data.recentReviews.map((item) =>
    `<article><strong>${escapeHtml(item.nickname)}</strong><span class="stars">${ratingIcons(item.rating)}</span><p>${escapeHtml(item.content)}</p><span>${formatDate(item.createdAt)}</span></article>`
  ).join("") || '<p class="empty">아직 승인된 후기가 없습니다.</p>';
  setDirtyState(false);
}

async function loadDashboard(centerId = currentCenterId, allowSocialSession = true) {
  const query = centerId ? `?centerId=${encodeURIComponent(centerId)}` : "";
  const response = await fetch(`/api/owner-dashboard${query}`);
  if ((response.status === 401 || response.status === 403) && allowSocialSession) {
    const socialLogin = await establishSocialOwnerSession();
    if (socialLogin.ok) {
      if (ownerQuery.get("auth") === "success") history.replaceState(null, "", "/center-dashboard/");
      return loadDashboard(centerId, false);
    }
    return showLogin(socialLogin.message || ownerOnboardingMessage);
  }
  if (response.status === 401 || response.status === 403) return showLogin();
  const data = await response.json().catch(() => ({}));
  if (!response.ok) return showLogin(data.error || "센터 정보를 불러오지 못했습니다.");
  fillDashboard(data);
  await loadMembers();
}

function renderMembers(data) {
  currentRole = data.currentRole || currentRole;
  document.querySelector("#currentMemberRole").textContent = `내 역할 ${roleLabel(currentRole)}`;
  const canManage = ["owner", "manager"].includes(currentRole);
  document.querySelector("#memberInviteForm").hidden = !canManage;
  document.querySelector(".member-role-guide").hidden = !canManage;
  document.querySelector("#memberList").innerHTML = (data.memberships || []).map((member) => {
    const canChange = canManage && member.user_id !== data.currentUserId &&
      (currentRole === "owner" || member.role !== "owner");
    const roleControl = canChange
      ? `<select data-member-id="${escapeHtml(member.id)}" data-member-role><option value="manager">매니저</option><option value="staff">직원</option><option value="viewer">조회 전용</option>${currentRole === "owner" ? '<option value="owner">소유자</option>' : ""}</select>`
      : `<span>${escapeHtml(roleLabel(member.role))}</span>`;
    const revoke = canChange
      ? `<button class="danger" type="button" data-revoke-member="${escapeHtml(member.id)}">권한 회수</button>`
      : `<span>${escapeHtml(statusLabel(member.status))}</span>`;
    return `<article class="member-item"><div><strong>${escapeHtml(member.email)}</strong><small>${escapeHtml(statusLabel(member.status))} · 최근 활동 ${formatDate(member.last_active_at)}</small></div>${roleControl}${revoke}</article>`;
  }).join("") || '<p class="empty">등록된 구성원이 없습니다.</p>';
  (data.memberships || []).forEach((member) => {
    const select = document.querySelector(`[data-member-id="${CSS.escape(member.id)}"]`);
    if (select) select.value = member.role;
  });
  document.querySelector("#invitationList").innerHTML = (data.invitations || []).map((item) => {
    const inviteUrl = latestInvitationLinks[item.id];
    return `<article class="invitation-item"><strong>${escapeHtml(item.email)}</strong><small>${escapeHtml(roleLabel(item.role))} · ${formatDate(item.expires_at)} 만료</small>${inviteUrl ? `<button type="button" data-copy-invite="${escapeHtml(inviteUrl)}">초대 링크 복사</button>` : ""}</article>`;
  }).join("") || '<p class="empty">대기 중인 초대가 없습니다.</p>';
}

async function loadMembers() {
  const response = await fetch(`/api/center-members?centerId=${encodeURIComponent(currentCenterId)}`);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    document.querySelector("#memberList").innerHTML =
      `<p class="empty">${escapeHtml(data.error || "구성원 정보를 불러오지 못했습니다.")}</p>`;
    return;
  }
  renderMembers(data);
}

async function inviteMember(email, role) {
  const response = await fetch("/api/center-members", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ centerId: currentCenterId, email, role }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "구성원을 초대하지 못했습니다.");
  latestInvitationLinks[data.invitationId] = data.inviteUrl;
  document.querySelector("#memberInviteEmail").value = "";
  await loadMembers();
  window.alert(data.emailSent
    ? "초대 메일을 보냈습니다. 초대 링크도 대기 목록에서 복사할 수 있습니다."
    : "초대를 만들었습니다. 대기 목록의 링크를 복사해 전달해 주세요.");
}

async function updateMember(membershipId, payload) {
  const response = await fetch("/api/center-members", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ centerId: currentCenterId, membershipId, ...payload }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "구성원 권한을 변경하지 못했습니다.");
  await loadMembers();
}

function setDirtyState(dirty) {
  hasUnsavedChanges = dirty;
  const saveBox = centerForm.querySelector(".sticky-save");
  const button = centerForm.querySelector('[type="submit"]');
  const label = document.querySelector("#changeStatus");
  saveBox.classList.toggle("dirty", dirty);
  button.disabled = !dirty || currentRole === "viewer";
  label.textContent = currentRole === "viewer"
    ? "조회 전용 권한입니다"
    : dirty ? "저장하지 않은 변경사항이 있습니다" : "저장된 정보입니다";
}

document.querySelectorAll("[data-owner-auth-provider]").forEach((button) => {
  button.addEventListener("click", () => {
    if (button.dataset.ready !== "true") return;
    sessionStorage.setItem(AUTH_RETURN_KEY, "/center-dashboard/");
    location.href = `/api/auth/start?provider=${encodeURIComponent(button.dataset.ownerAuthProvider)}`;
  });
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = loginForm.querySelector('button[type="submit"]');
  button.disabled = true;
  button.textContent = "로그인 중…";
  const response = await fetch("/api/owner-login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: document.querySelector("#email").value,
      password: document.querySelector("#password").value,
      invitationToken,
    }),
  });
  const data = await response.json().catch(() => ({}));
  button.disabled = false;
  button.textContent = "기존 계정으로 들어가기";
  if (!response.ok) return showLogin(data.error || "로그인하지 못했습니다.");
  document.querySelector("#password").value = "";
  if (invitationToken) history.replaceState(null, "", "/center-dashboard/");
  await loadDashboard();
});

document.querySelector("#inviteActivationForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = event.currentTarget.querySelector("button");
  const message = document.querySelector("#inviteMessage");
  button.disabled = true;
  message.textContent = "";
  try {
    const response = await fetch("/api/center-invitations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${invitationAccessToken}`,
      },
      body: JSON.stringify({
        invitationToken,
        password: document.querySelector("#invitePassword").value,
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "초대를 완료하지 못했습니다.");
    history.replaceState(null, "", "/center-dashboard/");
    window.location.hash = "";
    await loadDashboard(data.centerId);
  } catch (error) {
    message.textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

centerForm.addEventListener("input", (event) => {
  if (event.target === tagInput || currentRole === "viewer") return;
  updatePreview();
  setDirtyState(true);
});

centerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  addTag(tagInput.value);
  const status = document.querySelector("#saveStatus");
  const button = centerForm.querySelector('[type="submit"]');
  status.textContent = "저장 중…";
  button.disabled = true;
  const body = formValues();
  body.centerId = currentCenterId;
  body.tags = body.tags.split(",").map((tag) => tag.trim()).filter(Boolean);
  const response = await fetch("/api/owner-dashboard", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  button.disabled = false;
  if (response.status === 401 || response.status === 403) {
    return showLogin("로그인 시간이 만료되었거나 권한이 회수되었습니다. 다시 로그인해 주세요.");
  }
  if (!response.ok) {
    status.textContent = data.error || "저장하지 못했습니다.";
    return;
  }
  fillDashboard({
    ...data,
    account: { email: currentEmail, role: currentRole },
  });
  setDirtyState(false);
  status.innerHTML = `${uiIcon("circle-check")} 저장되었습니다`;
  setTimeout(() => { status.textContent = ""; }, 2500);
});

document.querySelector("#centerSwitcher").addEventListener("change", async (event) => {
  if (hasUnsavedChanges && !window.confirm("저장하지 않은 변경사항을 버리고 다른 지점으로 이동할까요?")) {
    event.target.value = currentCenterId;
    return;
  }
  await loadDashboard(event.target.value);
});

document.querySelector("#memberInviteForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = event.currentTarget.querySelector("button");
  button.disabled = true;
  try {
    await inviteMember(
      document.querySelector("#memberInviteEmail").value.trim(),
      document.querySelector("#memberInviteRole").value
    );
  } catch (error) {
    window.alert(error.message);
  } finally {
    button.disabled = false;
  }
});

document.querySelector("#memberList").addEventListener("change", async (event) => {
  const select = event.target.closest("[data-member-role]");
  if (!select) return;
  try {
    await updateMember(select.dataset.memberId, { role: select.value, status: "active" });
  } catch (error) {
    window.alert(error.message);
    await loadMembers();
  }
});

document.querySelector("#memberList").addEventListener("click", async (event) => {
  const button = event.target.closest("[data-revoke-member]");
  if (!button || !window.confirm("이 구성원의 센터 접근 권한을 즉시 회수할까요?")) return;
  try {
    await updateMember(button.dataset.revokeMember, { action: "revoke" });
  } catch (error) {
    window.alert(error.message);
  }
});

document.querySelector("#invitationList").addEventListener("click", async (event) => {
  const button = event.target.closest("[data-copy-invite]");
  if (!button) return;
  try {
    await navigator.clipboard.writeText(button.dataset.copyInvite);
    button.textContent = "복사 완료";
  } catch {
    window.prompt("초대 링크를 복사해 주세요.", button.dataset.copyInvite);
  }
});

document.querySelectorAll("[data-jump-profile]").forEach((button) =>
  button.addEventListener("click", () => document.querySelector("#profile").scrollIntoView({ behavior: "smooth" }))
);
logoutButton.addEventListener("click", async () => {
  await fetch("/api/owner-logout", { method: "POST" });
  const session = storedAuthSession();
  const auth = publicConfig.auth || {};
  if (session?.access_token && auth.supabaseUrl && auth.supabaseAnonKey) {
    fetch(auth.supabaseUrl + "/auth/v1/logout", {
      method: "POST",
      headers: {
        "apikey": auth.supabaseAnonKey,
        "Authorization": "Bearer " + session.access_token,
      },
    }).catch(() => {});
  }
  localStorage.removeItem(AUTH_STORAGE_KEY);
  currentCenterId = "";
  showLogin("안전하게 로그아웃되었습니다.");
});
tagInput.addEventListener("keydown", (event) => {
  if (event.isComposing) return;
  if ([" ", ",", "Enter"].includes(event.key)) {
    event.preventDefault();
    addTag(tagInput.value);
  } else if (event.key === "Backspace" && !tagInput.value && tagValues().length) {
    removeTag(tagValues().length - 1);
  }
});
tagInput.addEventListener("blur", () => addTag(tagInput.value));
tagChips.addEventListener("click", (event) => {
  const button = event.target.closest("[data-tag-index]");
  if (button) removeTag(Number(button.dataset.tagIndex));
});
document.querySelector("#togglePassword").addEventListener("click", () => {
  const password = document.querySelector("#password");
  const show = password.type === "password";
  password.type = show ? "text" : "password";
  document.querySelector("#togglePassword").textContent = show ? "숨기기" : "보기";
});
window.addEventListener("beforeunload", (event) => {
  if (!hasUnsavedChanges) return;
  event.preventDefault();
  event.returnValue = "";
});

initializeOwnerAuth();
