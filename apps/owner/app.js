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
let currentPhotoItems = [];
let currentBookings = [];
let currentOverviewData = null;
let bookingFilter = "upcoming";
let bookingWeekStart = "";
let bookingDateSelection = "";
let bookingCalendarMonth = "";
let selectedBookingId = "";
let currentClients = [];
let clientFilter = "active";
let selectedClientId = "";
let clientsLoadedCenterId = "";
let clientListSequence = 0;
let clientDetailSequence = 0;
let clientMutationSequence = 0;
let clientDetailTab = "profile";
let assessmentCache = new Map();
let assessmentListSequence = 0;
let assessmentMutationSequence = 0;
let selectedAssessmentId = "";
let workspaceAssessmentClientId = "";
let assessmentDraftScores = { painVas: null, dailyFunction: null, movementConfidence: null, balanceConfidence: null };
let activeDashboardView = "overview";
let ownerMenuAutoCloseTimer = 0;
let currentSchedule = {};
let currentSlotMinutes = 60;
let publicConfig = { auth: { supabaseUrl: "", supabaseAnonKey: "", providers: {} } };

const DASHBOARD_VIEWS = new Set(["overview", "bookings", "clients", "assessments", "profile", "activity", "members"]);
const DASHBOARD_HASH_ALIASES = {
  overview: "overview",
  bookings: "bookings",
  bookingsSection: "bookings",
  clients: "clients",
  clientsSection: "clients",
  assessments: "assessments",
  assessmentsSection: "assessments",
  profile: "profile",
  activity: "activity",
  activitySection: "activity",
  reviewsSection: "activity",
  members: "members",
  membersSection: "members",
};

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
const BOOKING_STATUS_LABELS = {
  pending: "확인 대기",
  confirmed: "예약 확정",
  completed: "이용 완료",
  cancelled: "예약 취소",
  no_show: "노쇼",
};
const ASSESSMENT_SCORE_FIELDS = [
  { key: "painVas", label: "통증 정도 (VAS)", low: "통증 없음", high: "매우 심함", direction: "lower" },
  { key: "dailyFunction", label: "일상 기능", low: "매우 어려움", high: "충분히 가능", direction: "higher" },
  { key: "movementConfidence", label: "움직임 자신감", low: "자신 없음", high: "매우 자신 있음", direction: "higher" },
  { key: "balanceConfidence", label: "균형 자신감", low: "매우 불안함", high: "매우 안정적", direction: "higher" },
];

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

function formatPhone(value) {
  const digits = String(value || "").replace(/\D/g, "").slice(0, 11);
  if (!digits) return "";
  if (digits.startsWith("02")) {
    if (digits.length <= 2) return digits;
    if (digits.length <= 5) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
    if (digits.length <= 9) return `${digits.slice(0, 2)}-${digits.slice(2, 5)}-${digits.slice(5)}`;
    return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  if (digits.length <= 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

function canManageClientRecords() {
  return ["owner", "manager"].includes(currentRole);
}

function preferredScrollBehavior() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
}

function dashboardViewFromHash() {
  const raw = window.location.hash.replace(/^#/, "");
  return DASHBOARD_HASH_ALIASES[raw] || "overview";
}

function updateDashboardViewUrl(view, replace = false) {
  const url = `${window.location.pathname}${window.location.search}#${view}`;
  history[replace ? "replaceState" : "pushState"](null, "", url);
}

function activateDashboardView(view, { updateUrl = true, replaceUrl = false, scroll = true } = {}) {
  const requestedView = DASHBOARD_VIEWS.has(view) ? view : "overview";
  const nextView = ["clients", "assessments"].includes(requestedView) && currentRole && !canManageClientRecords()
    ? "overview"
    : requestedView;
  const viewChanged = nextView !== activeDashboardView;
  activeDashboardView = nextView;
  document.querySelectorAll("[data-dashboard-panel]").forEach((panel) => {
    panel.hidden = panel.dataset.dashboardPanel !== nextView;
  });
  document.querySelectorAll("[data-dashboard-view]").forEach((link) => {
    const active = link.dataset.dashboardView === nextView;
    link.classList.toggle("active", active);
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  document.querySelector("#dashboardMobileMenu").value = nextView;
  if (updateUrl && (viewChanged || replaceUrl)) updateDashboardViewUrl(nextView, replaceUrl);
  if (["clients", "assessments"].includes(nextView) && currentCenterId) {
    if (clientsLoadedCenterId !== currentCenterId) loadClients().catch(() => {});
    else if (nextView === "assessments") renderAssessmentWorkspace();
  }
  if (viewChanged) setOwnerMenuCollapsed(nextView === "bookings");
  if (scroll && !dashboard.hidden) {
    const top = Math.max(0, dashboard.getBoundingClientRect().top + window.scrollY - 14);
    window.scrollTo({ top, behavior: "auto" });
  }
  return true;
}

function setOwnerMenuCollapsed(collapsed) {
  const shell = document.querySelector(".dashboard-shell");
  const toggle = document.querySelector("#ownerMenuToggle");
  const reveal = document.querySelector("#ownerMenuReveal");
  shell.classList.toggle("menu-collapsed", collapsed);
  toggle.setAttribute("aria-expanded", String(!collapsed));
  reveal.setAttribute("aria-hidden", String(!collapsed));
  reveal.tabIndex = collapsed ? 0 : -1;
}

function clearOwnerMenuAutoClose() {
  window.clearTimeout(ownerMenuAutoCloseTimer);
  ownerMenuAutoCloseTimer = 0;
}

function scheduleOwnerMenuAutoClose(delay = 320) {
  clearOwnerMenuAutoClose();
  if (activeDashboardView !== "bookings") return;
  ownerMenuAutoCloseTimer = window.setTimeout(() => setOwnerMenuCollapsed(true), delay);
}

function timeOptions(selected) {
  const options = [];
  for (let minutes = 0; minutes < 24 * 60; minutes += 30) {
    const value = `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
    options.push(`<option value="${value}" ${value === selected ? "selected" : ""}>${value}</option>`);
  }
  return options.join("");
}

function normalizeSchedule(value) {
  const source = value && typeof value === "object" ? value : {};
  return Object.fromEntries(DAY_ROWS.map(([key]) => {
    const fallback = DEFAULT_SCHEDULE[key];
    const item = source[key] && typeof source[key] === "object" ? source[key] : {};
    return [key, {
      closed: Boolean(item.closed),
      open: /^\d{2}:(?:00|30)$/.test(item.open) ? item.open : fallback.open,
      close: /^\d{2}:(?:00|30)$/.test(item.close) ? item.close : fallback.close,
    }];
  }));
}

function scheduleSummary(scheduleValue = currentSchedule) {
  const schedule = normalizeSchedule(scheduleValue);
  const weekday = ["monday", "tuesday", "wednesday", "thursday", "friday"].map((key) => schedule[key]);
  const sameWeekday = weekday.every((item) =>
    item.closed === weekday[0].closed && item.open === weekday[0].open && item.close === weekday[0].close
  );
  const parts = [];
  if (sameWeekday) {
    parts.push(weekday[0].closed ? "평일 휴무" : `평일 ${weekday[0].open}–${weekday[0].close}`);
  } else {
    DAY_ROWS.slice(0, 5).forEach(([key, label]) => {
      const item = schedule[key];
      parts.push(`${label.slice(0, 1)} ${item.closed ? "휴무" : `${item.open}–${item.close}`}`);
    });
  }
  DAY_ROWS.slice(5).forEach(([key, label]) => {
    const item = schedule[key];
    parts.push(`${label.slice(0, 1)} ${item.closed ? "휴무" : `${item.open}–${item.close}`}`);
  });
  return parts.join(" · ");
}

function scheduleSlotsForDate(date) {
  const marker = new Date(`${date}T12:00:00+09:00`);
  const dayKey = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][marker.getUTCDay()];
  const item = currentSchedule[dayKey];
  if (!item || item.closed) return [];
  const toMinutes = (value) => {
    const [hour, minute] = value.split(":").map(Number);
    return hour * 60 + minute;
  };
  const values = [];
  for (let cursor = toMinutes(item.open); cursor + currentSlotMinutes <= toMinutes(item.close); cursor += currentSlotMinutes) {
    values.push(`${String(Math.floor(cursor / 60)).padStart(2, "0")}:${String(cursor % 60).padStart(2, "0")}`);
  }
  return values;
}

function bookingDateTime(startAt) {
  const value = new Date(startAt);
  const dateParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const dateMap = Object.fromEntries(dateParts.map((part) => [part.type, part.value]));
  return {
    date: `${dateMap.year}-${dateMap.month}-${dateMap.day}`,
    time: new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Seoul",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(value),
  };
}

function addCalendarDays(date, days) {
  const marker = new Date(`${date}T12:00:00+09:00`);
  return bookingDateTime(new Date(marker.getTime() + days * 86400000)).date;
}

function startOfBookingWeek(date) {
  const marker = new Date(`${date}T12:00:00+09:00`);
  const day = marker.getUTCDay();
  return addCalendarDays(date, -(day === 0 ? 6 : day - 1));
}

function currentBookingDate() {
  return bookingDateTime(new Date()).date;
}

function overviewDateText(date = currentBookingDate()) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(new Date(`${date}T12:00:00+09:00`));
}

function setOverviewComparison(selector, current, previous) {
  const element = document.querySelector(selector);
  const difference = Number(current || 0) - Number(previous || 0);
  element.dataset.trend = difference > 0 ? "up" : difference < 0 ? "down" : "flat";
  if (!difference) {
    element.textContent = "이전 30일과 같음";
    return;
  }
  if (!Number(previous || 0)) {
    element.textContent = `이전 30일보다 ${Math.abs(difference).toLocaleString()}회 ${difference > 0 ? "많음" : "적음"}`;
    return;
  }
  const percentage = Math.round(Math.abs(difference) / Number(previous) * 100);
  element.textContent = `이전 30일보다 ${percentage}% ${difference > 0 ? "증가" : "감소"}`;
}

function setOverviewComparisonBars(name, current, previous) {
  const chart = document.querySelector(`[data-comparison-bars="${name}"]`);
  if (!chart) return;
  const currentValue = Math.max(0, Number(current || 0));
  const previousValue = Math.max(0, Number(previous || 0));
  const maximum = Math.max(currentValue, previousValue, 1);
  const width = (value) => value ? Math.max(8, Math.round(value / maximum * 100)) : 0;
  chart.style.setProperty("--previous-width", `${width(previousValue)}%`);
  chart.style.setProperty("--current-width", `${width(currentValue)}%`);
}

function renderOverview() {
  const data = currentOverviewData;
  if (!data) return;
  const today = currentBookingDate();
  const weekStart = startOfBookingWeek(today);
  const weekEnd = addCalendarDays(weekStart, 6);
  const now = Date.now();
  const isActiveBooking = (booking) => !["cancelled", "no_show"].includes(booking.status);
  const todayBookings = currentBookings
    .filter((booking) => isActiveBooking(booking) && bookingDateTime(booking.start_at).date === today)
    .sort((left, right) => new Date(left.start_at) - new Date(right.start_at));
  const pendingBookings = currentBookings.filter((booking) =>
    booking.status === "pending" && new Date(booking.start_at).getTime() >= now
  );
  const weekBookings = currentBookings.filter((booking) => {
    const date = bookingDateTime(booking.start_at).date;
    return isActiveBooking(booking) && date >= weekStart && date <= weekEnd;
  });
  const upcomingBookings = currentBookings
    .filter((booking) => ["pending", "confirmed"].includes(booking.status) && new Date(booking.start_at).getTime() >= now)
    .sort((left, right) => new Date(left.start_at) - new Date(right.start_at));
  const confirmedToday = todayBookings.filter((booking) => booking.status === "confirmed").length;
  const completedThisWeek = weekBookings.filter((booking) => booking.status === "completed").length;
  const nextBooking = upcomingBookings[0];

  document.querySelector("#overviewDateLabel").textContent = `${overviewDateText(today)} · 예약과 확인할 일을 최신 상태로 보여드립니다.`;
  document.querySelector("#overviewTodayBookings").textContent = `${todayBookings.length.toLocaleString()}건`;
  document.querySelector("#overviewTodayBookingsMeta").textContent = todayBookings.length
    ? `확정 ${confirmedToday}건 · 완료 ${todayBookings.filter((booking) => booking.status === "completed").length}건`
    : "오늘 예정된 예약이 없습니다";
  document.querySelector("#overviewPendingBookings").textContent = `${pendingBookings.length.toLocaleString()}건`;
  document.querySelector("#overviewPendingBookingsMeta").textContent = pendingBookings.length
    ? "예약 확정 또는 변경이 필요합니다"
    : "지금 처리할 예약이 없습니다";
  document.querySelector("#overviewWeekBookings").textContent = `${weekBookings.length.toLocaleString()}건`;
  document.querySelector("#overviewWeekBookingsMeta").textContent = `완료 ${completedThisWeek}건 · 남은 일정 ${weekBookings.filter((booking) => ["pending", "confirmed"].includes(booking.status) && new Date(booking.start_at).getTime() >= now).length}건`;
  document.querySelector("#overviewUpcomingBookings").textContent = `${upcomingBookings.length.toLocaleString()}건`;
  document.querySelector("#overviewNextBookingMeta").textContent = nextBooking
    ? `다음 일정 · ${overviewDateText(bookingDateTime(nextBooking.start_at).date)} ${bookingDateTime(nextBooking.start_at).time}`
    : "예정된 다음 예약이 없습니다";

  document.querySelector("#overviewTodayAgenda").innerHTML = todayBookings.length
    ? todayBookings.slice(0, 5).map((booking) => `<button type="button" data-overview-booking="${escapeHtml(booking.id)}">
        <time>${escapeHtml(bookingDateTime(booking.start_at).time)}</time>
        <span><b>${escapeHtml(booking.customer_name)}</b><small>${escapeHtml(booking.pain_area || "이용 목적 미입력")}</small></span>
        <i class="status-${bookingCalendarStatusClass(booking.status)}">${escapeHtml(BOOKING_STATUS_LABELS[booking.status] || booking.status)}</i>
      </button>`).join("")
    : `<div class="overview-empty"><span>${uiIcon("calendar")}</span><div><b>오늘 예약이 없습니다</b><p>새 예약이 들어오면 시간 순서대로 이곳에 표시됩니다.</p></div></div>`;

  const profileChecks = [
    data.center.address,
    data.center.phone,
    data.center.openingHours,
    data.center.tags?.length,
    data.center.photoItems?.length,
    data.center.lead,
    data.center.price,
  ];
  const missingProfileCount = profileChecks.filter((value) => !value).length;
  const tasks = [
    {
      view: "bookings",
      tone: pendingBookings.length ? "attention" : "complete",
      label: pendingBookings.length ? "우선" : "완료",
      title: "예약 확인",
      detail: pendingBookings.length ? `확인 대기 예약 ${pendingBookings.length}건을 처리해 주세요.` : "확인 대기 중인 예약이 없습니다.",
    },
    {
      view: "profile",
      tone: missingProfileCount ? "attention" : "complete",
      label: missingProfileCount ? "확인" : "완료",
      title: "센터 정보",
      detail: missingProfileCount ? `공개 페이지의 필수 정보 ${missingProfileCount}개가 비어 있습니다.` : "이용자에게 필요한 기본 정보가 등록되어 있습니다.",
    },
    {
      view: "activity",
      tone: "neutral",
      label: "후기",
      title: "이용자 반응",
      detail: data.totals.reviews ? `승인된 후기 ${data.totals.reviews}건과 최근 활동을 확인하세요.` : "아직 승인된 후기가 없습니다.",
    },
  ];
  document.querySelector("#overviewTaskList").innerHTML = tasks.map((task) => `<button type="button" data-overview-jump="${task.view}">
    <i class="${task.tone}">${task.label}</i><span><b>${task.title}</b><small>${task.detail}</small></span>${uiIcon("arrow-right")}
  </button>`).join("");

  document.querySelector("#last30Views").textContent = `${Number(data.totals.last30Views || 0).toLocaleString()}회`;
  document.querySelector("#last30Contacts").textContent = `${Number(data.totals.last30Contacts || 0).toLocaleString()}회`;
  document.querySelector("#last30ContactRate").textContent = `${Number(data.totals.last30ContactRate || 0)}%`;
  setOverviewComparison("#viewsComparison", data.totals.last30Views, data.totals.previous30Views);
  setOverviewComparison("#contactsComparison", data.totals.last30Contacts, data.totals.previous30Contacts);
  setOverviewComparisonBars("views", data.totals.last30Views, data.totals.previous30Views);
  setOverviewComparisonBars("contacts", data.totals.last30Contacts, data.totals.previous30Contacts);
  document.querySelector("#reviews").textContent = `${Number(data.totals.reviews || 0).toLocaleString()}건`;
  document.querySelector("#rating").textContent = data.totals.ratingAverage ? `${data.totals.ratingAverage} / 5` : "-";
}

function bookingCalendarStatusClass(status) {
  if (["cancelled", "no_show"].includes(status)) return "cancelled";
  return ["pending", "confirmed", "completed"].includes(status) ? status : "pending";
}

function minutesFromClock(value) {
  const [hour, minute] = String(value || "00:00").split(":").map(Number);
  return hour * 60 + minute;
}

function bookingMonthStart(date) {
  const safeDate = /^\d{4}-\d{2}-\d{2}$/.test(String(date || "")) ? date : currentBookingDate();
  return `${safeDate.slice(0, 7)}-01`;
}

function shiftBookingMonth(date, amount) {
  const safeDate = bookingMonthStart(date);
  const year = Number(safeDate.slice(0, 4));
  const month = Number(safeDate.slice(5, 7)) - 1 + amount;
  const marker = new Date(Date.UTC(year, month, 1, 3));
  return `${marker.getUTCFullYear()}-${String(marker.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

function renderBookingDatePopover() {
  const popover = document.querySelector("#bookingDatePopover");
  if (popover.hidden) return;
  if (!bookingCalendarMonth) bookingCalendarMonth = bookingMonthStart(bookingDateSelection || currentBookingDate());
  const monthStart = bookingMonthStart(bookingCalendarMonth);
  const marker = new Date(`${monthStart}T12:00:00+09:00`);
  const mondayOffset = (marker.getUTCDay() + 6) % 7;
  const gridStart = addCalendarDays(monthStart, -mondayOffset);
  const currentDate = currentBookingDate();
  const selectedDate = bookingDateSelection || currentDate;
  const currentWeekStart = bookingWeekStart || startOfBookingWeek(selectedDate);
  const currentWeekEnd = addCalendarDays(currentWeekStart, 6);
  document.querySelector("#bookingMonthLabel").textContent = new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
  }).format(marker);
  document.querySelector("#bookingMonthGrid").innerHTML = Array.from({ length: 42 }, (_, index) => {
    const date = addCalendarDays(gridStart, index);
    const outside = date.slice(0, 7) !== monthStart.slice(0, 7);
    const selected = date === selectedDate;
    const inWeek = date >= currentWeekStart && date <= currentWeekEnd;
    return `<button type="button" role="gridcell" data-booking-date-choice="${date}" class="${outside ? "outside" : ""} ${selected ? "selected" : ""} ${date === currentDate ? "today" : ""} ${inWeek ? "in-week" : ""}" aria-selected="${selected}"><span>${Number(date.slice(-2))}</span></button>`;
  }).join("");
}

function setBookingDatePopover(open) {
  const popover = document.querySelector("#bookingDatePopover");
  const trigger = document.querySelector("#bookingDatePickerButton");
  popover.hidden = !open;
  trigger.setAttribute("aria-expanded", String(open));
  if (open) {
    bookingCalendarMonth = bookingMonthStart(bookingDateSelection || currentBookingDate());
    renderBookingDatePopover();
  }
}

function renderBookingCalendar() {
  if (!bookingWeekStart) bookingWeekStart = startOfBookingWeek(currentBookingDate());
  const dates = Array.from({ length: 7 }, (_, index) => addCalendarDays(bookingWeekStart, index));
  const lastDate = dates[6];
  const currentDate = currentBookingDate();
  const visible = filteredBookings().filter((booking) => {
    const date = bookingDateTime(booking.start_at).date;
    return date >= bookingWeekStart && date <= lastDate;
  });
  const operatingTimes = Object.values(currentSchedule || {}).flatMap((item) =>
    item && !item.closed ? [minutesFromClock(item.open), minutesFromClock(item.close)] : []
  );
  const bookingTimes = visible.flatMap((booking) => {
    const start = bookingDateTime(booking.start_at);
    const end = booking.end_at ? bookingDateTime(booking.end_at) : null;
    return [minutesFromClock(start.time), end ? minutesFromClock(end.time) : minutesFromClock(start.time) + currentSlotMinutes];
  });
  const allTimes = [...operatingTimes, ...bookingTimes];
  const firstHour = Math.max(6, Math.min(8, ...allTimes.map((minutes) => Math.floor(minutes / 60))));
  const lastHour = Math.min(24, Math.max(22, ...allTimes.map((minutes) => Math.ceil(minutes / 60))));
  const hourCount = Math.max(8, lastHour - firstHour);
  const trackMinutes = hourCount * 60;
  const dayNames = ["월", "화", "수", "목", "금", "토", "일"];
  const labelFormat = new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric" });
  document.querySelector("#bookingWeekLabel").textContent = `${labelFormat.format(new Date(`${bookingWeekStart}T12:00:00+09:00`))} – ${labelFormat.format(new Date(`${lastDate}T12:00:00+09:00`))}`;
  if (!bookingDateSelection) bookingDateSelection = currentDate >= bookingWeekStart && currentDate <= lastDate ? currentDate : bookingWeekStart;
  const timeLabels = Array.from({ length: hourCount + 1 }, (_, index) => {
    const edgeClass = index === 0 ? "is-first" : index === hourCount ? "is-last" : "";
    return `<span class="${edgeClass}" style="left:${index / hourCount * 100}%">${String(firstHour + index).padStart(2, "0")}:00</span>`;
  }).join("");
  const dayColumns = dates.map((date, dayIndex) => {
    const dayBookings = visible
      .filter((booking) => bookingDateTime(booking.start_at).date === date)
      .sort((left, right) => new Date(left.start_at) - new Date(right.start_at));
    const laneEnds = [];
    const blocks = dayBookings.map((booking) => {
      const start = bookingDateTime(booking.start_at);
      const startMinutes = minutesFromClock(start.time);
      const endMinutes = booking.end_at
        ? minutesFromClock(bookingDateTime(booking.end_at).time)
        : startMinutes + currentSlotMinutes;
      const clampedStart = Math.max(firstHour * 60, Math.min(lastHour * 60, startMinutes));
      const clampedEnd = Math.max(clampedStart + 15, Math.min(lastHour * 60, endMinutes));
      let lane = laneEnds.findIndex((laneEnd) => laneEnd <= clampedStart);
      if (lane < 0) lane = laneEnds.length;
      laneEnds[lane] = clampedEnd;
      const left = (clampedStart - firstHour * 60) / trackMinutes * 100;
      const width = Math.max(3.25, (clampedEnd - clampedStart) / trackMinutes * 100);
      const selected = booking.id === selectedBookingId;
      return `<button class="schedule-booking status-${bookingCalendarStatusClass(booking.status)} ${selected ? "selected" : ""}" type="button" data-calendar-booking="${escapeHtml(booking.id)}" style="left:${left}%;width:${width}%;top:${8 + lane * 36}px" aria-label="${escapeHtml(start.time)} ${escapeHtml(booking.customer_name)} ${escapeHtml(BOOKING_STATUS_LABELS[booking.status] || booking.status)}"><time>${escapeHtml(start.time)}</time><b>${escapeHtml(booking.customer_name)}</b><small>${escapeHtml(booking.pain_area || "예약")}</small></button>`;
    }).join("");
    const rowHeight = Math.max(58, laneEnds.length * 36 + 16);
    return `<div class="schedule-day-row ${date === currentDate ? "is-today" : ""}" data-calendar-date="${date}"><div class="schedule-day-label"><span>${dayNames[dayIndex]}</span><strong>${Number(date.slice(-2))}</strong><small>${date.slice(5, 7)}월</small></div><div class="schedule-day-track" style="--hour-count:${hourCount};height:${rowHeight}px">${blocks}</div></div>`;
  }).join("");
  document.querySelector("#bookingCalendar").innerHTML = `<div class="horizontal-schedule-scroll"><div class="horizontal-schedule-inner"><div class="schedule-time-header"><div class="schedule-date-head">날짜</div><div class="schedule-time-scale">${timeLabels}</div></div>${dayColumns}</div></div>${visible.length ? "" : '<div class="schedule-empty-note">이 주에 해당하는 예약이 없습니다.</div>'}`;
  renderBookingDatePopover();
}

function renderWeeklySchedule() {
  currentSchedule = normalizeSchedule(currentSchedule);
  document.querySelector("#weeklySchedule").innerHTML = DAY_ROWS.map(([key, label]) => {
    const item = currentSchedule[key];
    return `<div class="schedule-row ${item.closed ? "is-closed" : ""}" data-schedule-day="${key}">
      <strong>${label}</strong>
      <label class="day-toggle"><input type="checkbox" data-schedule-closed ${item.closed ? "" : "checked"} /><span>${item.closed ? "휴무" : "운영"}</span></label>
      <label><span>시작</span><select data-schedule-open ${item.closed ? "disabled" : ""}>${timeOptions(item.open)}</select></label>
      <i>–</i>
      <label><span>종료</span><select data-schedule-close ${item.closed ? "disabled" : ""}>${timeOptions(item.close)}</select></label>
    </div>`;
  }).join("");
  centerForm.elements.opening_schedule.value = JSON.stringify(currentSchedule);
  centerForm.elements.opening_hours.value = scheduleSummary(currentSchedule);
}

function renderCenterPhotos() {
  const list = document.querySelector("#centerPhotoList");
  list.innerHTML = currentPhotoItems.length
    ? currentPhotoItems.map((item, index) => `<figure class="center-photo-item">
        <img src="${escapeHtml(item.url)}" alt="센터 사진 ${index + 1}" />
        ${index === 0 ? "<figcaption>대표 사진</figcaption>" : ""}
        ${currentRole === "viewer" ? "" : `<button type="button" data-photo-delete="${escapeHtml(item.path)}">삭제</button>`}
      </figure>`).join("")
    : `<div class="photo-empty">${uiIcon("image")}<b>등록된 센터 사진이 없습니다</b><span>첫 번째 사진이 상세보기 대표 사진으로 노출됩니다.</span></div>`;
  const input = document.querySelector("#centerPhotoInput");
  input.disabled = currentRole === "viewer" || currentPhotoItems.length >= 5;
}

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
  currentEmail = "";
  currentCenterId = "";
  currentRole = "";
  clearOwnerSensitiveState();
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
  values.opening_schedule = normalizeSchedule(currentSchedule);
  values.booking_slot_minutes = Number(values.booking_slot_minutes || 60);
  values.booking_enabled = centerForm.elements.booking_enabled.checked;
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
  const cover = document.querySelector(".preview-cover");
  const photo = currentPhotoItems[0]?.url || "";
  cover.style.backgroundImage = photo ? `linear-gradient(rgba(15,28,46,.16),rgba(15,28,46,.32)),url("${photo.replaceAll('"', "%22")}")` : "";
  cover.classList.toggle("has-photo", Boolean(photo));
}

function syncCategories(center) {
  const selected = new Set(center.categories || []);
  centerForm.querySelectorAll('[name="categories"]').forEach((input) => {
    input.checked = selected.has(input.value);
  });
}

function setFormAccess(role) {
  const readOnly = role === "viewer";
  const canManageClients = canManageClientRecords();
  centerForm.querySelectorAll("input, textarea, select, button").forEach((element) => {
    if (element.type === "hidden") return;
    element.disabled = readOnly;
  });
  centerForm.querySelectorAll('[name="categories"]').forEach((element) => {
    element.disabled = readOnly;
  });
  if (readOnly) {
    document.querySelector("#changeStatus").textContent = "조회 전용 권한입니다";
  }
  document.querySelector("#newClientButton").hidden = !canManageClients;
  ["clients", "assessments"].forEach((view) => {
    const link = document.querySelector(`[data-dashboard-view="${view}"]`);
    const option = document.querySelector(`#dashboardMobileMenu option[value="${view}"]`);
    link.hidden = !canManageClients;
    option.hidden = !canManageClients;
    option.disabled = !canManageClients;
  });
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
  const centerChanged = Boolean(currentCenterId && currentCenterId !== data.center.id);
  if (centerChanged) {
    clearOwnerSensitiveState();
  }
  currentEmail = data.account?.email || currentEmail;
  currentCenterId = data.center.id;
  currentRole = data.account?.role || currentRole;
  currentOverviewData = { center: data.center, totals: data.totals };
  invitePanel.hidden = true;
  loginPanel.hidden = true;
  dashboard.hidden = false;
  logoutButton.hidden = false;
  document.querySelector("#centerHeading").textContent = `${data.center.name} 운영 현황`;
  document.querySelector("#updatedAt").textContent = `최근 수정 ${formatDate(data.center.updatedAt, false)}`;
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
    manager_career: data.center.managerCareer,
    price: data.center.price,
    booking_slot_minutes: String(data.center.bookingSlotMinutes || 60),
  };
  Object.entries(fields).forEach(([name, value]) => {
    centerForm.elements[name].value = value || "";
  });
  currentSchedule = normalizeSchedule(data.center.openingSchedule);
  currentSlotMinutes = Number(data.center.bookingSlotMinutes || 60);
  centerForm.elements.booking_enabled.checked = data.center.bookingEnabled !== false;
  currentPhotoItems = data.center.photoItems || (data.center.photoUrls || []).map((url) => ({ path: "", url }));
  renderWeeklySchedule();
  renderCenterPhotos();
  syncCategories(data.center);
  setFormAccess(currentRole);
  renderTags();
  updatePreview();
  renderCenterSwitcher(data.availableCenters || []);
  renderOverview();
  document.querySelector("#eventList").innerHTML = data.recentEvents.map((item) =>
    `<article><strong>${item.type === "view" ? "센터 상세 조회" : "상담 연결 클릭"}</strong><span>${escapeHtml(item.source)} · ${formatDate(item.createdAt)}</span></article>`
  ).join("") || '<p class="empty">아직 기록된 이용자 활동이 없습니다.</p>';
  document.querySelector("#reviewList").innerHTML = data.recentReviews.map((item) =>
    `<article><strong>${escapeHtml(item.nickname)}</strong><span class="stars">${ratingIcons(item.rating)}</span><p>${escapeHtml(item.content)}</p><span>${formatDate(item.createdAt)}</span></article>`
  ).join("") || '<p class="empty">아직 승인된 후기가 없습니다.</p>';
  setDirtyState(false);
  const requestedView = dashboardViewFromHash();
  const allowedView = ["clients", "assessments"].includes(requestedView) && !canManageClientRecords() ? "overview" : requestedView;
  activateDashboardView(allowedView, {
    updateUrl: allowedView !== requestedView,
    replaceUrl: true,
    scroll: false,
  });
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
  await Promise.all([loadMembers(), loadBookings()]);
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
  const requestedCenterId = currentCenterId;
  const response = await fetch(`/api/center-members?centerId=${encodeURIComponent(requestedCenterId)}`);
  const data = await response.json().catch(() => ({}));
  if (requestedCenterId !== currentCenterId) return;
  if (!response.ok) {
    document.querySelector("#memberList").innerHTML =
      `<p class="empty">${escapeHtml(data.error || "구성원 정보를 불러오지 못했습니다.")}</p>`;
    return;
  }
  renderMembers(data);
}

function filteredBookings() {
  const now = Date.now();
  if (bookingFilter === "upcoming") {
    return currentBookings.filter((booking) =>
      ["pending", "confirmed"].includes(booking.status) && new Date(booking.start_at).getTime() >= now
    );
  }
  if (bookingFilter === "completed") return currentBookings.filter((booking) => booking.status === "completed");
  if (bookingFilter === "cancelled") return currentBookings.filter((booking) => booking.status === "cancelled");
  return currentBookings;
}

function bookingTimeOptions(booking, date) {
  const current = bookingDateTime(booking.start_at);
  const values = scheduleSlotsForDate(date);
  if (date === current.date && !values.includes(current.time)) values.push(current.time);
  return values.sort().map((time) =>
    `<option value="${time}" ${time === current.time ? "selected" : ""}>${time}</option>`
  ).join("");
}

function renderOwnerBookings() {
  const upcomingCount = currentBookings.filter((booking) =>
    ["pending", "confirmed"].includes(booking.status) && new Date(booking.start_at).getTime() >= Date.now()
  ).length;
  document.querySelector("#bookingCount").textContent = `예정 예약 ${upcomingCount}건`;
  document.querySelectorAll("[data-booking-filter]").forEach((button) => {
    button.classList.toggle("active", button.dataset.bookingFilter === bookingFilter);
  });
  renderBookingCalendar();
  const filtered = filteredBookings();
  const selectedBooking = filtered.find((booking) => booking.id === selectedBookingId);
  const bookings = selectedBooking ? [selectedBooking] : filtered.slice(0, 3);
  const canManage = ["owner", "manager"].includes(currentRole);
  document.querySelector("#ownerBookingList").innerHTML = bookings.length
    ? bookings.map((booking) => {
        const current = bookingDateTime(booking.start_at);
        return `<article class="owner-booking-card" data-owner-booking="${escapeHtml(booking.id)}">
          <header><div><span class="booking-status status-${escapeHtml(booking.status)}">${escapeHtml(BOOKING_STATUS_LABELS[booking.status] || booking.status)}</span><strong>${escapeHtml(formatDate(booking.start_at))}</strong></div><small>접수 ${formatDate(booking.created_at)}</small></header>
          <div class="booking-customer">
            <div><span>예약자</span><strong>${escapeHtml(booking.customer_name)}</strong></div>
            <div><span>전화번호</span><a href="tel:${escapeHtml(String(booking.customer_phone).replace(/[^\d+]/g, ""))}">${escapeHtml(booking.customer_phone)}</a></div>
            <div class="wide"><span>불편 부위</span><strong>${escapeHtml(booking.pain_area)}</strong></div>
            ${booking.customer_note ? `<div class="wide"><span>전달 사항</span><p>${escapeHtml(booking.customer_note)}</p></div>` : ""}
          </div>
          ${canManage ? `<div class="booking-editor">
            <label>상태<select data-booking-status><option value="pending">확인 대기</option><option value="confirmed">예약 확정</option><option value="completed">이용 완료</option><option value="cancelled">예약 취소</option><option value="no_show">노쇼</option></select></label>
            <label>날짜<input type="date" data-booking-date value="${current.date}" /></label>
            <label>시간<select data-booking-time>${bookingTimeOptions(booking, current.date)}</select></label>
            <button type="button" data-booking-save>예약 수정 저장</button>
          </div>` : `<p class="booking-readonly">예약 변경은 소유자 또는 매니저 권한에서만 가능합니다.</p>`}
          <p class="booking-message" aria-live="polite"></p>
        </article>`;
      }).join("")
    : '<div class="booking-empty"><span>' + uiIcon("calendar") + '</span><strong>표시할 예약 상세가 없습니다</strong><p>캘린더에서 예약을 선택하거나 상태 조건을 바꿔보세요.</p></div>';
  bookings.forEach((booking) => {
    const card = document.querySelector(`[data-owner-booking="${CSS.escape(booking.id)}"]`);
    if (card?.querySelector("[data-booking-status]")) card.querySelector("[data-booking-status]").value = booking.status;
  });
}

async function loadBookings() {
  const requestedCenterId = currentCenterId;
  const response = await fetch(`/api/owner-bookings?centerId=${encodeURIComponent(requestedCenterId)}`);
  const data = await response.json().catch(() => ({}));
  if (requestedCenterId !== currentCenterId) return;
  if (!response.ok) {
    document.querySelector("#ownerBookingList").innerHTML =
      `<p class="empty">${escapeHtml(data.error || "예약 정보를 불러오지 못했습니다.")}</p>`;
    return;
  }
  currentBookings = data.bookings || [];
  renderOwnerBookings();
  renderOverview();
}

function clearClientState() {
  clientListSequence += 1;
  clientDetailSequence += 1;
  clientMutationSequence += 1;
  assessmentListSequence += 1;
  assessmentMutationSequence += 1;
  currentClients = [];
  clientFilter = "active";
  selectedClientId = "";
  clientsLoadedCenterId = "";
  clientDetailTab = "profile";
  assessmentCache = new Map();
  selectedAssessmentId = "";
  workspaceAssessmentClientId = "";
  assessmentDraftScores = emptyAssessmentScores();
  const form = document.querySelector("#clientForm");
  form.reset();
  form.querySelectorAll("input, textarea, button").forEach((element) => { element.disabled = false; });
  form.querySelector('button[type="submit"]').hidden = false;
  form.hidden = true;
  document.querySelector("#clientEmptyState").hidden = false;
  document.querySelector(".client-editor").classList.remove("is-open");
  const modal = document.querySelector("#clientModal");
  modal.hidden = true;
  modal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("client-modal-open");
  document.querySelector("#clientEditorEyebrow").textContent = "NEW CLIENT";
  document.querySelector("#clientEditorTitle").textContent = "새 고객 등록";
  document.querySelector("#clientFormMessage").textContent = "";
  document.querySelector("#archiveClientButton").hidden = true;
  document.querySelector("#clientConsentRow").hidden = false;
  document.querySelector("#clientDetailTabs").hidden = true;
  document.querySelector("#clientProfilePanel").hidden = false;
  document.querySelector("#clientAssessmentPanel").hidden = true;
  document.querySelector("#assessmentEditor").hidden = true;
  document.querySelector("#clientAssessmentHistory").innerHTML = '<p class="empty">평가 기록을 불러오는 중입니다.</p>';
  document.querySelector("#clientAssessmentCount").textContent = "0";
  document.querySelector("#clientSearch").value = "";
  renderClients();
}

function clearOwnerSensitiveState() {
  clearClientState();
  currentOverviewData = null;
  currentBookings = [];
  bookingFilter = "upcoming";
  bookingWeekStart = startOfBookingWeek(currentBookingDate());
  bookingDateSelection = currentBookingDate();
  bookingCalendarMonth = bookingMonthStart(bookingDateSelection);
  selectedBookingId = "";
  latestInvitationLinks = {};
  document.querySelector("#bookingCount").textContent = "예정 예약 0건";
  document.querySelector("#ownerBookingList").innerHTML = '<p class="empty">예약 정보를 불러오는 중입니다.</p>';
  document.querySelector("#memberInviteEmail").value = "";
  document.querySelector("#memberList").innerHTML = '<p class="empty">구성원 정보를 불러오는 중입니다.</p>';
  document.querySelector("#invitationList").innerHTML = '<p class="empty">초대 정보를 불러오는 중입니다.</p>';
}

function visibleClients() {
  const query = document.querySelector("#clientSearch").value.trim().toLowerCase();
  const queryDigits = query.replace(/\D/g, "");
  return currentClients.filter((client) => {
    if (clientFilter !== "all" && (client.status || "active") !== clientFilter) return false;
    if (!query) return true;
    const text = [client.full_name, client.phone]
      .map((value) => String(value || "").toLowerCase()).join(" ");
    const phoneDigits = String(client.phone || "").replace(/\D/g, "");
    return text.includes(query) || Boolean(queryDigits && phoneDigits.includes(queryDigits));
  });
}

function renderClients() {
  const activeCount = currentClients.filter((client) => (client.status || "active") === "active").length;
  document.querySelector("#clientCount").textContent = `활성 고객 ${activeCount}명`;
  document.querySelectorAll("[data-client-filter]").forEach((button) => {
    const active = button.dataset.clientFilter === clientFilter;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  const clients = visibleClients();
  document.querySelector("#clientList").innerHTML = clients.length
    ? clients.map((client) => `<button class="client-list-item ${client.id === selectedClientId ? "selected" : ""}" type="button" data-client-id="${escapeHtml(client.id)}" ${client.id === selectedClientId ? 'aria-current="true"' : ""}>
        <span class="client-avatar" aria-hidden="true">${escapeHtml(String(client.full_name || "?").trim().slice(0, 1) || "?")}</span>
        <span class="client-list-copy"><strong>${escapeHtml(client.full_name)}</strong><small>${escapeHtml(formatPhone(client.phone))}</small></span>
        <span class="client-list-meta"><i class="client-status status-${escapeHtml(client.status || "active")}">${(client.status || "active") === "archived" ? "보관됨" : "이용 중"}</i><small>${formatDate(client.updated_at || client.created_at, false)}</small></span>
      </button>`).join("")
    : `<div class="client-list-empty"><span>${uiIcon("search")}</span><strong>${currentClients.length ? "검색 결과가 없습니다" : "등록된 고객이 없습니다"}</strong><p>${currentClients.length ? "검색어나 상태 조건을 바꿔보세요." : "고객 등록을 눌러 한 명씩 명단을 만들어 보세요."}</p></div>`;
  renderAssessmentWorkspace();
}

function setClientFormOpen(open) {
  document.querySelector("#clientForm").hidden = !open;
  document.querySelector("#clientEmptyState").hidden = open;
  document.querySelector(".client-editor").classList.toggle("is-open", open);
  if (open) setClientModalOpen(true);
}

function setClientModalOpen(open) {
  const modal = document.querySelector("#clientModal");
  modal.hidden = !open;
  modal.setAttribute("aria-hidden", String(!open));
  document.body.classList.toggle("client-modal-open", open);
}

function revealClientEditor(focusTarget) {
  requestAnimationFrame(() => focusTarget?.focus({ preventScroll: true }));
}

function showClientDetailState(title, message, { retry = false } = {}) {
  const emptyState = document.querySelector("#clientEmptyState");
  const form = document.querySelector("#clientForm");
  form.reset();
  form.hidden = true;
  document.querySelector("#clientEditorTitle").textContent = "고객 정보";
  document.querySelector("#clientFormMessage").textContent = "";
  document.querySelector("#clientDetailTabs").hidden = true;
  emptyState.hidden = false;
  emptyState.querySelector("strong").textContent = title;
  emptyState.querySelector("p").textContent = message;
  document.querySelector("#clientDetailRetry").hidden = !retry;
  document.querySelector(".client-editor").classList.add("is-open");
  setClientModalOpen(true);
  revealClientEditor(emptyState);
}

function fillClientEditor(client = null) {
  const creating = !client;
  const canManage = canManageClientRecords();
  if (creating && !canManage) return;
  const form = document.querySelector("#clientForm");
  form.reset();
  form.elements.fullName.value = client?.full_name || "";
  form.elements.phone.value = formatPhone(client?.phone || "");
  form.elements.primaryConcern.value = client?.primary_concern || "";
  form.elements.goal.value = client?.goal || "";
  form.elements.notes.value = client?.notes || "";
  document.querySelector("#clientEditorEyebrow").textContent = creating ? "NEW CLIENT" : "CLIENT PROFILE";
  document.querySelector("#clientEditorTitle").textContent = creating ? "새 고객 등록" : client.full_name;
  document.querySelector("#clientDetailTabs").hidden = creating;
  document.querySelector("#clientConsentRow").hidden = !creating;
  form.elements.consentConfirmed.required = creating;
  const archiveButton = document.querySelector("#archiveClientButton");
  archiveButton.hidden = creating || !canManage;
  archiveButton.textContent = client?.status === "archived" ? "다시 이용 중으로" : "보관하기";
  archiveButton.classList.toggle("restore", client?.status === "archived");
  form.querySelectorAll("input, textarea, button").forEach((element) => {
    if (element.id === "closeClientEditor") return;
    element.disabled = !canManage;
  });
  form.querySelector('button[type="submit"]').hidden = !canManage;
  document.querySelector("#clientFormMessage").textContent = "";
  document.querySelector("#clientDetailRetry").hidden = true;
  setClientFormOpen(true);
  setClientDetailTab("profile", { load: false });
  renderClients();
  revealClientEditor(document.querySelector("#clientEditorTitle"));
}

async function openClientEditor(clientId = "", providedDetail = null) {
  const detailSequence = ++clientDetailSequence;
  if (!clientId) {
    selectedClientId = "";
    fillClientEditor();
    return;
  }
  const summary = currentClients.find((item) => item.id === clientId);
  if (!summary) return;
  selectedClientId = clientId;
  renderClients();
  if (providedDetail?.id === clientId) {
    fillClientEditor(providedDetail);
    return;
  }
  const requestedCenterId = currentCenterId;
  showClientDetailState("고객 정보를 불러오는 중입니다", "상세 정보는 고객을 선택할 때만 안전하게 불러옵니다.");
  let response;
  try {
    response = await fetch(`/api/center-clients?centerId=${encodeURIComponent(requestedCenterId)}&clientId=${encodeURIComponent(clientId)}`);
  } catch {
    if (detailSequence !== clientDetailSequence || requestedCenterId !== currentCenterId || selectedClientId !== clientId) return;
    showClientDetailState("서버에 연결하지 못했습니다", "네트워크 상태를 확인한 뒤 다시 시도해 주세요.", { retry: true });
    return;
  }
  const data = await response.json().catch(() => ({}));
  if (detailSequence !== clientDetailSequence || requestedCenterId !== currentCenterId || selectedClientId !== clientId) return;
  if (response.status === 401 || response.status === 403) {
    return showLogin(data.error || "고객 정보를 확인할 권한이 없거나 로그인 시간이 만료되었습니다.");
  }
  if (!response.ok || !data.client) {
    showClientDetailState("고객 정보를 불러오지 못했습니다", data.error || "잠시 후 다시 시도해 주세요.", { retry: true });
    return;
  }
  fillClientEditor(data.client);
}

function closeClientEditor() {
  clientDetailSequence += 1;
  const previousClientId = selectedClientId;
  selectedClientId = "";
  selectedAssessmentId = "";
  clientDetailTab = "profile";
  document.querySelector("#clientForm").reset();
  document.querySelector("#clientDetailRetry").hidden = true;
  document.querySelector("#clientEditorTitle").textContent = "새 고객 등록";
  document.querySelector("#assessmentEditor").hidden = true;
  setClientFormOpen(false);
  setClientModalOpen(false);
  renderClients();
  const returnTarget = previousClientId
    ? document.querySelector(`[data-client-id="${CSS.escape(previousClientId)}"]`)
    : document.querySelector("#newClientButton");
  requestAnimationFrame(() => returnTarget?.focus({ preventScroll: true }));
}

function clientRequestBody() {
  const form = document.querySelector("#clientForm");
  return {
    centerId: currentCenterId,
    fullName: form.elements.fullName.value.trim(),
    phone: formatPhone(form.elements.phone.value),
    primaryConcern: form.elements.primaryConcern.value.trim(),
    goal: form.elements.goal.value.trim(),
    notes: form.elements.notes.value.trim(),
    consentConfirmed: form.elements.consentConfirmed.checked,
  };
}

function mergeClientResponse(data) {
  if (Array.isArray(data.clients)) {
    currentClients = data.clients;
    return;
  }
  if (!data.client) return;
  const summary = {
    id: data.client.id,
    full_name: data.client.full_name,
    phone: data.client.phone,
    status: data.client.status,
    created_at: data.client.created_at,
    updated_at: data.client.updated_at,
    archived_at: data.client.archived_at,
  };
  const index = currentClients.findIndex((client) => client.id === data.client.id);
  if (index >= 0) currentClients.splice(index, 1, summary);
  else currentClients.unshift(summary);
}

async function loadClients(force = false) {
  if (!currentCenterId) return;
  if (!force && clientsLoadedCenterId === currentCenterId) {
    renderClients();
    return;
  }
  const listSequence = ++clientListSequence;
  const requestedCenterId = currentCenterId;
  const list = document.querySelector("#clientList");
  list.innerHTML = '<p class="empty">고객 명단을 불러오는 중입니다.</p>';
  let response;
  try {
    response = await fetch(`/api/center-clients?centerId=${encodeURIComponent(requestedCenterId)}`);
  } catch {
    if (listSequence !== clientListSequence || requestedCenterId !== currentCenterId) return;
    clientsLoadedCenterId = "";
    list.innerHTML = `<div class="client-list-empty error"><span>${uiIcon("circle-alert")}</span><strong>서버에 연결하지 못했습니다</strong><p>네트워크 상태를 확인한 뒤 다시 시도해 주세요.</p><button type="button" data-client-retry>다시 시도</button></div>`;
    return;
  }
  const data = await response.json().catch(() => ({}));
  if (listSequence !== clientListSequence || requestedCenterId !== currentCenterId) return;
  if (response.status === 401 || response.status === 403) {
    return showLogin(data.error || "고객 명단을 확인할 권한이 없거나 로그인 시간이 만료되었습니다.");
  }
  if (!response.ok) {
    clientsLoadedCenterId = "";
    list.innerHTML = `<div class="client-list-empty error"><span>${uiIcon("circle-alert")}</span><strong>고객 명단을 불러오지 못했습니다</strong><p>${escapeHtml(data.error || "잠시 후 다시 시도해 주세요.")}</p><button type="button" data-client-retry>다시 시도</button></div>`;
    return;
  }
  currentClients = data.clients || [];
  clientsLoadedCenterId = requestedCenterId;
  if (workspaceAssessmentClientId && !currentClients.some((client) => client.id === workspaceAssessmentClientId)) {
    workspaceAssessmentClientId = "";
  }
  if (selectedClientId && !currentClients.some((client) => client.id === selectedClientId)) closeClientEditor();
  else renderClients();
}

async function saveClient() {
  const form = document.querySelector("#clientForm");
  const button = form.querySelector('button[type="submit"]');
  const message = document.querySelector("#clientFormMessage");
  const requestedCenterId = currentCenterId;
  const requestedClientId = selectedClientId;
  const creating = !selectedClientId;
  const body = clientRequestBody();
  if (creating && !body.consentConfirmed) {
    message.textContent = "고객에게 개인정보 저장 목적을 안내하고 동의를 확인해 주세요.";
    return;
  }
  if (!body.fullName || !body.phone) {
    message.textContent = "이름과 전화번호를 입력해 주세요.";
    return;
  }
  if (!creating) {
    const client = currentClients.find((item) => item.id === selectedClientId);
    body.clientId = selectedClientId;
    body.status = client?.status || "active";
  }
  const mutationSequence = ++clientMutationSequence;
  button.disabled = true;
  message.textContent = "저장 중…";
  let response;
  try {
    response = await fetch("/api/center-clients", {
      method: creating ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    if (mutationSequence !== clientMutationSequence || requestedCenterId !== currentCenterId) return;
    button.disabled = false;
    message.textContent = "서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.";
    return;
  }
  const data = await response.json().catch(() => ({}));
  if (mutationSequence !== clientMutationSequence || requestedCenterId !== currentCenterId) return;
  button.disabled = false;
  if (response.status === 401 || response.status === 403) {
    return showLogin(data.error || "고객 정보를 관리할 권한이 없거나 로그인 시간이 만료되었습니다.");
  }
  if (!response.ok) {
    message.textContent = data.error || "고객 정보를 저장하지 못했습니다.";
    return;
  }
  mergeClientResponse(data);
  const shouldReopenSavedClient = creating || selectedClientId === requestedClientId;
  if (shouldReopenSavedClient) selectedClientId = data.client?.id || selectedClientId;
  clientsLoadedCenterId = currentCenterId;
  clientFilter = "active";
  renderClients();
  if (shouldReopenSavedClient) {
    openClientEditor(selectedClientId, data.client);
    document.querySelector("#clientFormMessage").textContent = creating ? "고객을 등록했습니다." : "고객 정보를 저장했습니다.";
  }
}

async function toggleClientArchive() {
  const client = currentClients.find((item) => item.id === selectedClientId);
  if (!client) return;
  const requestedCenterId = currentCenterId;
  const nextStatus = client.status === "archived" ? "active" : "archived";
  if (nextStatus === "archived" && !window.confirm("이 고객을 보관할까요? 보관된 고객은 명단에서 다시 확인할 수 있습니다.")) return;
  const mutationSequence = ++clientMutationSequence;
  const button = document.querySelector("#archiveClientButton");
  const message = document.querySelector("#clientFormMessage");
  button.disabled = true;
  message.textContent = nextStatus === "archived" ? "보관 중…" : "복원 중…";
  let response;
  try {
    response = await fetch("/api/center-clients", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ centerId: requestedCenterId, clientId: client.id, status: nextStatus }),
    });
  } catch {
    if (mutationSequence !== clientMutationSequence || requestedCenterId !== currentCenterId) return;
    button.disabled = false;
    message.textContent = "서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.";
    return;
  }
  const data = await response.json().catch(() => ({}));
  if (mutationSequence !== clientMutationSequence || requestedCenterId !== currentCenterId) return;
  button.disabled = false;
  if (response.status === 401 || response.status === 403) {
    return showLogin(data.error || "고객 정보를 관리할 권한이 없거나 로그인 시간이 만료되었습니다.");
  }
  if (!response.ok) {
    message.textContent = data.error || "고객 상태를 변경하지 못했습니다.";
    return;
  }
  mergeClientResponse(data);
  clientFilter = nextStatus === "archived" ? "archived" : "active";
  renderClients();
  if (selectedClientId === client.id) {
    openClientEditor(client.id, data.client);
    document.querySelector("#clientFormMessage").textContent = nextStatus === "archived" ? "고객을 보관했습니다." : "고객을 다시 이용 중으로 표시했습니다.";
  }
}

function emptyAssessmentScores() {
  return { painVas: null, dailyFunction: null, movementConfidence: null, balanceConfidence: null };
}

function assessmentVisitLabel(value) {
  return ({ initial: "첫 방문", follow_up: "재방문", discharge: "마지막 방문" })[value] || "방문 평가";
}

function assessmentScoreValue(value) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 && number <= 10 ? number : null;
}

function renderAssessmentScales() {
  document.querySelector("#assessmentScoreScales").innerHTML = ASSESSMENT_SCORE_FIELDS.map((field) => {
    const selected = assessmentScoreValue(assessmentDraftScores[field.key]);
    const options = Array.from({ length: 11 }, (_, value) =>
      `<button type="button" class="${selected === value ? "selected" : ""}" data-assessment-score-key="${field.key}" data-assessment-score-value="${value}" aria-pressed="${selected === value}">${value}</button>`
    ).join("");
    return `<div class="assessment-scale"><div class="assessment-scale-head"><div><strong>${escapeHtml(field.label)}</strong><small>${escapeHtml(field.low)} → ${escapeHtml(field.high)}</small></div><span>${selected === null ? "미기록" : `${selected}점`}</span></div><div class="assessment-scale-options" role="group" aria-label="${escapeHtml(field.label)} 점수">${options}</div><button class="assessment-score-clear" type="button" data-assessment-score-clear="${field.key}" ${selected === null ? "disabled" : ""}>기록 안 함</button></div>`;
  }).join("");
}

function renderAssessmentHistory(target, assessments, clientId) {
  if (!target) return;
  if (!assessments.length) {
    target.innerHTML = `<div class="assessment-empty"><span>${uiIcon("activity")}</span><strong>아직 평가 기록이 없습니다</strong><p>첫 평가를 저장하면 방문할 때마다 점수와 변화가 시간순으로 쌓입니다.</p></div>`;
    return;
  }
  target.innerHTML = assessments.map((assessment, index) => {
    const previous = assessments[index + 1];
    const scoreItems = ASSESSMENT_SCORE_FIELDS.map((field) => {
      const value = assessmentScoreValue(assessment.scores?.[field.key]);
      if (value === null) return "";
      const previousValue = assessmentScoreValue(previous?.scores?.[field.key]);
      const difference = previousValue === null ? "" : value === previousValue ? "변화 없음" : `${value > previousValue ? "+" : ""}${value - previousValue}`;
      return `<span><small>${escapeHtml(field.label.replace(" (VAS)", ""))}</small><b>${value}</b><i>${escapeHtml(difference)}</i></span>`;
    }).join("");
    return `<button type="button" class="assessment-record" data-assessment-open="${escapeHtml(assessment.id)}" data-assessment-client="${escapeHtml(clientId)}"><span class="assessment-record-date"><b>${escapeHtml(formatDate(`${assessment.assessed_on}T12:00:00+09:00`, false))}</b><i>${escapeHtml(assessmentVisitLabel(assessment.visit_kind))}</i></span><span class="assessment-record-scores">${scoreItems}</span><span class="assessment-record-note"><b>${escapeHtml(assessment.main_concern || "주요 변화 미입력")}</b><small>${escapeHtml(assessment.next_plan || assessment.notes || "기록을 눌러 상세 내용을 확인하세요.")}</small></span><svg class="ui-icon" aria-hidden="true"><use href="/assets/ui-icons.svg#arrow-right"></use></svg></button>`;
  }).join("");
}

function renderAssessmentWorkspace() {
  const select = document.querySelector("#assessmentClientSelect");
  if (!select) return;
  const clients = currentClients.filter((client) => (client.status || "active") === "active");
  select.innerHTML = '<option value="">이용자를 선택하세요</option>' + clients.map((client) =>
    `<option value="${escapeHtml(client.id)}">${escapeHtml(client.full_name)} · ${escapeHtml(formatPhone(client.phone))}</option>`
  ).join("");
  if (clients.some((client) => client.id === workspaceAssessmentClientId)) select.value = workspaceAssessmentClientId;
  else workspaceAssessmentClientId = "";
  const client = clients.find((item) => item.id === workspaceAssessmentClientId);
  document.querySelector("#startAssessmentButton").disabled = !client;
  const summary = document.querySelector("#assessmentWorkspaceSummary");
  const history = document.querySelector("#assessmentWorkspaceHistory");
  if (!client) {
    summary.innerHTML = `<div class="assessment-empty"><span>${uiIcon("user-cog")}</span><strong>${clients.length ? "이용자를 먼저 선택해 주세요" : "등록된 이용자가 없습니다"}</strong><p>${clients.length ? "평가 이력과 점수 변화를 이 화면에서 확인할 수 있습니다." : "고객 관리에서 이용자를 등록한 뒤 평가를 시작할 수 있습니다."}</p></div>`;
    history.innerHTML = "";
    return;
  }
  const assessments = assessmentCache.get(client.id);
  const latest = assessments?.[0];
  summary.innerHTML = `<div class="assessment-selected-client"><span class="client-avatar" aria-hidden="true">${escapeHtml(String(client.full_name || "?").slice(0, 1))}</span><div><strong>${escapeHtml(client.full_name)}</strong><small>${escapeHtml(formatPhone(client.phone))}</small></div><dl><div><dt>누적 평가</dt><dd>${assessments ? assessments.length : "-"}회</dd></div><div><dt>최근 평가</dt><dd>${latest ? escapeHtml(formatDate(`${latest.assessed_on}T12:00:00+09:00`, false)) : "-"}</dd></div></dl></div>`;
  if (assessments) renderAssessmentHistory(history, assessments, client.id);
  else history.innerHTML = '<p class="empty">평가 기록을 불러오는 중입니다.</p>';
}

function renderSelectedClientAssessments() {
  const assessments = selectedClientId ? (assessmentCache.get(selectedClientId) || []) : [];
  document.querySelector("#clientAssessmentCount").textContent = String(assessments.length);
  renderAssessmentHistory(document.querySelector("#clientAssessmentHistory"), assessments, selectedClientId);
  renderAssessmentWorkspace();
}

async function loadAssessments(clientId, { force = false } = {}) {
  if (!clientId || !currentCenterId) return [];
  if (!force && assessmentCache.has(clientId)) {
    renderSelectedClientAssessments();
    return assessmentCache.get(clientId);
  }
  const sequence = ++assessmentListSequence;
  const requestedCenterId = currentCenterId;
  if (selectedClientId === clientId) document.querySelector("#clientAssessmentHistory").innerHTML = '<p class="empty">평가 기록을 불러오는 중입니다.</p>';
  if (workspaceAssessmentClientId === clientId) document.querySelector("#assessmentWorkspaceHistory").innerHTML = '<p class="empty">평가 기록을 불러오는 중입니다.</p>';
  let response;
  try {
    response = await fetch(`/api/center-client-assessments?centerId=${encodeURIComponent(requestedCenterId)}&clientId=${encodeURIComponent(clientId)}`);
  } catch {
    if (sequence !== assessmentListSequence || requestedCenterId !== currentCenterId) return [];
    const message = '<div class="assessment-empty error"><span>' + uiIcon("circle-alert") + '</span><strong>평가 기록을 불러오지 못했습니다</strong><p>네트워크 상태를 확인한 뒤 다시 시도해 주세요.</p></div>';
    if (selectedClientId === clientId) document.querySelector("#clientAssessmentHistory").innerHTML = message;
    if (workspaceAssessmentClientId === clientId) document.querySelector("#assessmentWorkspaceHistory").innerHTML = message;
    return [];
  }
  const data = await response.json().catch(() => ({}));
  if (sequence !== assessmentListSequence || requestedCenterId !== currentCenterId) return [];
  if (response.status === 401 || response.status === 403) {
    showLogin(data.error || "평가 기록을 확인할 권한이 없거나 로그인 시간이 만료되었습니다.");
    return [];
  }
  if (!response.ok) {
    const message = `<div class="assessment-empty error"><span>${uiIcon("circle-alert")}</span><strong>평가 기록을 불러오지 못했습니다</strong><p>${escapeHtml(data.error || "잠시 후 다시 시도해 주세요.")}</p></div>`;
    if (selectedClientId === clientId) document.querySelector("#clientAssessmentHistory").innerHTML = message;
    if (workspaceAssessmentClientId === clientId) document.querySelector("#assessmentWorkspaceHistory").innerHTML = message;
    return [];
  }
  assessmentCache.set(clientId, data.assessments || []);
  renderSelectedClientAssessments();
  return assessmentCache.get(clientId);
}

async function setClientDetailTab(tab, { load = true } = {}) {
  const next = tab === "assessments" && selectedClientId ? "assessments" : "profile";
  clientDetailTab = next;
  document.querySelectorAll("[data-client-detail-tab]").forEach((button) => {
    const active = button.dataset.clientDetailTab === next;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });
  document.querySelector("#clientProfilePanel").hidden = next !== "profile";
  document.querySelector("#clientAssessmentPanel").hidden = next !== "assessments";
  if (next === "assessments") {
    document.querySelector("#assessmentEditor").hidden = true;
    if (load) await loadAssessments(selectedClientId);
  }
}

function openAssessmentEditor(assessment = null) {
  selectedAssessmentId = assessment?.id || "";
  const existing = selectedClientId ? (assessmentCache.get(selectedClientId) || []) : [];
  assessmentDraftScores = { ...emptyAssessmentScores(), ...(assessment?.scores || {}) };
  document.querySelector("#assessmentEditorTitle").textContent = assessment ? "방문 평가 수정" : "새 방문 평가";
  document.querySelector("#assessmentDate").value = assessment?.assessed_on || currentBookingDate();
  document.querySelector("#assessmentVisitKind").value = assessment?.visit_kind || (existing.length ? "follow_up" : "initial");
  document.querySelector("#assessmentMainConcern").value = assessment?.main_concern || "";
  document.querySelector("#assessmentNotes").value = assessment?.notes || "";
  document.querySelector("#assessmentNextPlan").value = assessment?.next_plan || "";
  document.querySelector("#assessmentConsent").checked = false;
  document.querySelector("#assessmentConsentRow").hidden = Boolean(assessment);
  document.querySelector("#assessmentFormMessage").textContent = "";
  renderAssessmentScales();
  const editor = document.querySelector("#assessmentEditor");
  editor.hidden = false;
  requestAnimationFrame(() => editor.scrollIntoView({ block: "start", behavior: preferredScrollBehavior() }));
}

async function saveAssessment() {
  if (!selectedClientId) return;
  const scores = Object.fromEntries(ASSESSMENT_SCORE_FIELDS.map((field) => [field.key, assessmentScoreValue(assessmentDraftScores[field.key])]));
  const message = document.querySelector("#assessmentFormMessage");
  if (Object.values(scores).every((value) => value === null)) {
    message.textContent = "평가 점수를 하나 이상 선택해 주세요.";
    return;
  }
  if (!selectedAssessmentId && !document.querySelector("#assessmentConsent").checked) {
    message.textContent = "이용자에게 저장 목적을 안내하고 민감정보 기록 동의를 확인해 주세요.";
    return;
  }
  const requestedCenterId = currentCenterId;
  const requestedClientId = selectedClientId;
  const requestedAssessmentId = selectedAssessmentId;
  const sequence = ++assessmentMutationSequence;
  const button = document.querySelector("#saveAssessmentButton");
  button.disabled = true;
  message.textContent = "평가 기록을 저장하는 중…";
  let response;
  try {
    response = await fetch("/api/center-client-assessments", {
      method: requestedAssessmentId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        centerId: requestedCenterId,
        clientId: requestedClientId,
        assessmentId: requestedAssessmentId || undefined,
        assessedOn: document.querySelector("#assessmentDate").value,
        visitKind: document.querySelector("#assessmentVisitKind").value,
        templateKey: "dail_visit_v1",
        scores,
        mainConcern: document.querySelector("#assessmentMainConcern").value.trim(),
        notes: document.querySelector("#assessmentNotes").value.trim(),
        nextPlan: document.querySelector("#assessmentNextPlan").value.trim(),
        consentConfirmed: document.querySelector("#assessmentConsent").checked,
      }),
    });
  } catch {
    if (sequence !== assessmentMutationSequence || requestedCenterId !== currentCenterId || requestedClientId !== selectedClientId) return;
    button.disabled = false;
    message.textContent = "서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.";
    return;
  }
  const data = await response.json().catch(() => ({}));
  if (sequence !== assessmentMutationSequence || requestedCenterId !== currentCenterId || requestedClientId !== selectedClientId) return;
  button.disabled = false;
  if (response.status === 401 || response.status === 403) return showLogin(data.error || "평가 기록을 저장할 권한이 없거나 로그인 시간이 만료되었습니다.");
  if (!response.ok || !data.assessment) {
    message.textContent = data.error || "평가 기록을 저장하지 못했습니다.";
    return;
  }
  const assessments = assessmentCache.get(requestedClientId) || [];
  const index = assessments.findIndex((item) => item.id === data.assessment.id);
  if (index >= 0) assessments.splice(index, 1, data.assessment);
  else assessments.push(data.assessment);
  assessments.sort((left, right) => `${right.assessed_on}${right.created_at}`.localeCompare(`${left.assessed_on}${left.created_at}`));
  assessmentCache.set(requestedClientId, assessments);
  selectedAssessmentId = data.assessment.id;
  renderSelectedClientAssessments();
  document.querySelector("#assessmentEditorTitle").textContent = "방문 평가 수정";
  document.querySelector("#assessmentConsentRow").hidden = true;
  message.textContent = requestedAssessmentId ? "평가 기록을 수정했습니다." : "새 방문 평가를 저장했습니다.";
}

async function openClientAssessment(clientId, { startNew = false, assessmentId = "" } = {}) {
  await openClientEditor(clientId);
  if (selectedClientId !== clientId || document.querySelector("#clientForm").hidden) return;
  await setClientDetailTab("assessments");
  if (assessmentId) {
    const assessment = (assessmentCache.get(clientId) || []).find((item) => item.id === assessmentId);
    if (assessment) openAssessmentEditor(assessment);
  } else if (startNew) openAssessmentEditor();
}

async function updateBooking(card) {
  const bookingId = card.dataset.ownerBooking;
  const date = card.querySelector("[data-booking-date]").value;
  const time = card.querySelector("[data-booking-time]").value;
  const message = card.querySelector(".booking-message");
  const button = card.querySelector("[data-booking-save]");
  if (!date || !time) {
    message.textContent = "변경할 날짜와 시간을 선택해 주세요.";
    return;
  }
  button.disabled = true;
  message.textContent = "저장 중…";
  const response = await fetch("/api/owner-bookings", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      centerId: currentCenterId,
      bookingId,
      status: card.querySelector("[data-booking-status]").value,
      startAt: new Date(`${date}T${time}:00+09:00`).toISOString(),
    }),
  });
  const data = await response.json().catch(() => ({}));
  button.disabled = false;
  if (!response.ok) {
    message.textContent = data.error || "예약을 수정하지 못했습니다.";
    return;
  }
  currentBookings = data.bookings || [];
  renderOwnerBookings();
}

async function uploadCenterPhotos(files) {
  if (hasUnsavedChanges) {
    window.alert("입력 중인 센터 정보를 먼저 저장한 뒤 사진을 추가해 주세요.");
    return;
  }
  const message = document.querySelector("#photoUploadMessage");
  const available = Math.max(0, 5 - currentPhotoItems.length);
  const selected = [...files].slice(0, available);
  if (!selected.length) return;
  message.textContent = `${selected.length}장 업로드 중…`;
  for (let index = 0; index < selected.length; index += 1) {
    const file = selected[index];
    const response = await fetch(`/api/owner-uploads?centerId=${encodeURIComponent(currentCenterId)}`, {
      method: "POST",
      headers: { "Content-Type": file.type },
      body: file,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      message.textContent = data.error || `${file.name} 업로드에 실패했습니다.`;
      return;
    }
    currentPhotoItems = data.photoItems || currentPhotoItems;
    renderCenterPhotos();
    updatePreview();
    message.textContent = `${index + 1}/${selected.length}장 업로드 완료`;
  }
  message.textContent = "센터 사진이 저장되었습니다.";
}

async function deleteCenterPhoto(path) {
  const message = document.querySelector("#photoUploadMessage");
  const response = await fetch(`/api/owner-uploads?centerId=${encodeURIComponent(currentCenterId)}&path=${encodeURIComponent(path)}`, {
    method: "DELETE",
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    message.textContent = data.error || "사진을 삭제하지 못했습니다.";
    return;
  }
  currentPhotoItems = data.photoItems || [];
  renderCenterPhotos();
  updatePreview();
  message.textContent = "센터 사진을 삭제했습니다.";
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

document.querySelector(".section-nav-links").addEventListener("click", (event) => {
  const link = event.target.closest("[data-dashboard-view]");
  if (!link) return;
  event.preventDefault();
  activateDashboardView(link.dataset.dashboardView);
  requestAnimationFrame(() => link.blur());
});

document.querySelector("#ownerMenuToggle").addEventListener("click", () => {
  clearOwnerMenuAutoClose();
  setOwnerMenuCollapsed(true);
});
document.querySelector("#ownerMenuReveal").addEventListener("click", () => {
  setOwnerMenuCollapsed(false);
  scheduleOwnerMenuAutoClose(2600);
});
document.querySelector(".section-nav").addEventListener("pointerenter", clearOwnerMenuAutoClose);
document.querySelector(".section-nav").addEventListener("pointerleave", () => scheduleOwnerMenuAutoClose());
document.addEventListener("pointerdown", (event) => {
  if (activeDashboardView !== "bookings") return;
  const shell = document.querySelector(".dashboard-shell");
  if (shell.classList.contains("menu-collapsed")) return;
  if (event.target.closest(".section-nav, #ownerMenuReveal")) return;
  setOwnerMenuCollapsed(true);
});

document.querySelector("#overview").addEventListener("click", (event) => {
  const bookingButton = event.target.closest("[data-overview-booking]");
  if (bookingButton) {
    const booking = currentBookings.find((item) => item.id === bookingButton.dataset.overviewBooking);
    if (!booking) return;
    selectedBookingId = booking.id;
    bookingFilter = "all";
    bookingDateSelection = bookingDateTime(booking.start_at).date;
    bookingWeekStart = startOfBookingWeek(bookingDateSelection);
    renderOwnerBookings();
    activateDashboardView("bookings");
    return;
  }
  const button = event.target.closest("[data-overview-jump]");
  if (!button) return;
  const view = button.dataset.overviewJump;
  activateDashboardView(view);
  if (view === "clients" && canManageClientRecords()) openClientEditor();
});

document.querySelector("#dashboardMobileMenu").addEventListener("change", (event) => {
  activateDashboardView(event.target.value);
});

window.addEventListener("popstate", () => {
  activateDashboardView(dashboardViewFromHash(), { updateUrl: false });
});

document.querySelectorAll("[data-client-filter]").forEach((button) => {
  button.addEventListener("click", () => {
    clientFilter = button.dataset.clientFilter;
    renderClients();
  });
});

document.querySelector("#clientSearch").addEventListener("input", renderClients);
document.querySelector("#newClientButton").addEventListener("click", () => openClientEditor());
document.querySelector("#closeClientEditor").addEventListener("click", closeClientEditor);
document.querySelector("[data-client-modal-close]").addEventListener("click", closeClientEditor);
document.querySelector("#clientDetailRetry").addEventListener("click", () => {
  if (selectedClientId) openClientEditor(selectedClientId);
});
document.querySelector("#clientList").addEventListener("click", async (event) => {
  const retry = event.target.closest("[data-client-retry]");
  if (retry) {
    await loadClients(true);
    return;
  }
  const item = event.target.closest("[data-client-id]");
  if (item) openClientEditor(item.dataset.clientId);
});
document.querySelector("#clientDetailTabs").addEventListener("click", (event) => {
  const button = event.target.closest("[data-client-detail-tab]");
  if (button) setClientDetailTab(button.dataset.clientDetailTab);
});
document.querySelector("#newAssessmentButton").addEventListener("click", () => openAssessmentEditor());
document.querySelector("#cancelAssessmentButton").addEventListener("click", () => {
  selectedAssessmentId = "";
  document.querySelector("#assessmentEditor").hidden = true;
  document.querySelector("#assessmentFormMessage").textContent = "";
});
document.querySelector("#assessmentScoreScales").addEventListener("click", (event) => {
  const score = event.target.closest("[data-assessment-score-key]");
  if (score) {
    assessmentDraftScores[score.dataset.assessmentScoreKey] = Number(score.dataset.assessmentScoreValue);
    renderAssessmentScales();
    return;
  }
  const clear = event.target.closest("[data-assessment-score-clear]");
  if (clear) {
    assessmentDraftScores[clear.dataset.assessmentScoreClear] = null;
    renderAssessmentScales();
  }
});
document.querySelector("#saveAssessmentButton").addEventListener("click", saveAssessment);
document.querySelector("#clientAssessmentHistory").addEventListener("click", (event) => {
  const record = event.target.closest("[data-assessment-open]");
  if (!record) return;
  const assessment = (assessmentCache.get(selectedClientId) || []).find((item) => item.id === record.dataset.assessmentOpen);
  if (assessment) openAssessmentEditor(assessment);
});
document.querySelector("#assessmentClientSelect").addEventListener("change", async (event) => {
  workspaceAssessmentClientId = event.target.value;
  renderAssessmentWorkspace();
  if (workspaceAssessmentClientId) await loadAssessments(workspaceAssessmentClientId);
});
document.querySelector("#startAssessmentButton").addEventListener("click", () => {
  if (workspaceAssessmentClientId) openClientAssessment(workspaceAssessmentClientId, { startNew: true });
});
document.querySelector("#assessmentWorkspaceHistory").addEventListener("click", (event) => {
  const record = event.target.closest("[data-assessment-open]");
  if (record) openClientAssessment(record.dataset.assessmentClient, { assessmentId: record.dataset.assessmentOpen });
});
document.querySelector('#clientForm [name="phone"]').addEventListener("input", (event) => {
  event.target.value = formatPhone(event.target.value);
});
document.querySelector("#clientForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (clientDetailTab === "assessments") return;
  await saveClient();
});
document.querySelector("#archiveClientButton").addEventListener("click", toggleClientArchive);

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

document.querySelector("#weeklySchedule").addEventListener("change", (event) => {
  const row = event.target.closest("[data-schedule-day]");
  if (!row || currentRole === "viewer") return;
  const day = row.dataset.scheduleDay;
  if (event.target.matches("[data-schedule-closed]")) {
    currentSchedule[day].closed = !event.target.checked;
  } else if (event.target.matches("[data-schedule-open]")) {
    currentSchedule[day].open = event.target.value;
  } else if (event.target.matches("[data-schedule-close]")) {
    currentSchedule[day].close = event.target.value;
  }
  renderWeeklySchedule();
  updatePreview();
  setDirtyState(true);
});

document.querySelectorAll("[data-schedule-copy]").forEach((button) => {
  button.addEventListener("click", () => {
    if (currentRole === "viewer") return;
    if (button.dataset.scheduleCopy === "weekdays") {
      ["tuesday", "wednesday", "thursday", "friday"].forEach((key) => {
        currentSchedule[key] = { ...currentSchedule.monday };
      });
    } else {
      currentSchedule.sunday = { ...currentSchedule.saturday };
    }
    renderWeeklySchedule();
    updatePreview();
    setDirtyState(true);
  });
});

centerForm.elements.booking_slot_minutes.addEventListener("change", (event) => {
  currentSlotMinutes = Number(event.target.value || 60);
});

document.querySelector("#centerPhotoInput").addEventListener("change", async (event) => {
  await uploadCenterPhotos(event.target.files || []);
  event.target.value = "";
});

document.querySelector("#centerPhotoList").addEventListener("click", async (event) => {
  const button = event.target.closest("[data-photo-delete]");
  if (!button || !window.confirm("이 센터 사진을 삭제할까요?")) return;
  button.disabled = true;
  await deleteCenterPhoto(button.dataset.photoDelete);
});

document.querySelectorAll("[data-booking-filter]").forEach((button) => {
  button.addEventListener("click", () => {
    bookingFilter = button.dataset.bookingFilter;
    selectedBookingId = "";
    renderOwnerBookings();
  });
});

document.querySelectorAll("[data-booking-week]").forEach((button) => {
  button.addEventListener("click", () => {
    const direction = button.dataset.bookingWeek;
    if (direction === "today") {
      bookingDateSelection = currentBookingDate();
      bookingWeekStart = startOfBookingWeek(bookingDateSelection);
    } else {
      bookingWeekStart = addCalendarDays(bookingWeekStart || startOfBookingWeek(currentBookingDate()), direction === "prev" ? -7 : 7);
      bookingDateSelection = bookingWeekStart;
    }
    selectedBookingId = "";
    renderOwnerBookings();
  });
});

document.querySelector("#bookingDatePickerButton").addEventListener("click", () => {
  setBookingDatePopover(document.querySelector("#bookingDatePopover").hidden);
});

document.querySelector("#bookingDatePopover").addEventListener("click", (event) => {
  const monthButton = event.target.closest("[data-booking-month]");
  if (monthButton) {
    bookingCalendarMonth = shiftBookingMonth(bookingCalendarMonth, monthButton.dataset.bookingMonth === "prev" ? -1 : 1);
    renderBookingDatePopover();
    return;
  }
  const dateButton = event.target.closest("[data-booking-date-choice]");
  if (!dateButton) return;
  bookingDateSelection = dateButton.dataset.bookingDateChoice;
  bookingWeekStart = startOfBookingWeek(bookingDateSelection);
  selectedBookingId = "";
  setBookingDatePopover(false);
  renderOwnerBookings();
});

document.addEventListener("click", (event) => {
  if (event.target.closest(".booking-date-control")) return;
  setBookingDatePopover(false);
});

document.querySelector("#bookingCalendar").addEventListener("click", (event) => {
  const block = event.target.closest("[data-calendar-booking]");
  if (!block) return;
  selectedBookingId = block.dataset.calendarBooking;
  renderOwnerBookings();
  requestAnimationFrame(() => {
    const card = document.querySelector(`[data-owner-booking="${CSS.escape(selectedBookingId)}"]`);
    card?.scrollIntoView({ block: "nearest", behavior: preferredScrollBehavior() });
    card?.setAttribute("tabindex", "-1");
    card?.focus({ preventScroll: true });
  });
});

document.querySelector("#ownerBookingList").addEventListener("change", (event) => {
  const dateInput = event.target.closest("[data-booking-date]");
  if (!dateInput) return;
  const card = dateInput.closest("[data-owner-booking]");
  const booking = currentBookings.find((item) => item.id === card.dataset.ownerBooking);
  card.querySelector("[data-booking-time]").innerHTML = bookingTimeOptions(booking, dateInput.value);
});

document.querySelector("#ownerBookingList").addEventListener("click", async (event) => {
  const button = event.target.closest("[data-booking-save]");
  if (!button) return;
  await updateBooking(button.closest("[data-owner-booking]"));
});

centerForm.addEventListener("input", (event) => {
  if (event.target === tagInput || event.target.id === "centerPhotoInput" || currentRole === "viewer") return;
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
  const nextCenterId = event.target.value;
  clearOwnerSensitiveState();
  currentCenterId = nextCenterId;
  await loadDashboard(nextCenterId);
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
  button.addEventListener("click", () => activateDashboardView("profile"))
);
logoutButton.addEventListener("click", async () => {
  currentCenterId = "";
  clearOwnerSensitiveState();
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
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (!document.querySelector("#clientModal").hidden) closeClientEditor();
  else if (!document.querySelector("#bookingDatePopover").hidden) {
    setBookingDatePopover(false);
    document.querySelector("#bookingDatePickerButton").focus();
  } else if (activeDashboardView === "bookings" && !document.querySelector(".dashboard-shell").classList.contains("menu-collapsed")) {
    setOwnerMenuCollapsed(true);
  }
});

initializeOwnerAuth();
