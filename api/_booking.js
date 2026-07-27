const DAY_KEYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

const DAY_LABELS = {
  monday: "월",
  tuesday: "화",
  wednesday: "수",
  thursday: "목",
  friday: "금",
  saturday: "토",
  sunday: "일",
};

const DEFAULT_SCHEDULE = {
  monday: { closed: false, open: "09:00", close: "21:00" },
  tuesday: { closed: false, open: "09:00", close: "21:00" },
  wednesday: { closed: false, open: "09:00", close: "21:00" },
  thursday: { closed: false, open: "09:00", close: "21:00" },
  friday: { closed: false, open: "09:00", close: "21:00" },
  saturday: { closed: false, open: "10:00", close: "17:00" },
  sunday: { closed: true, open: "10:00", close: "17:00" },
};

function validTime(value) {
  return /^(?:[01]\d|2[0-3]):(?:00|30)$/.test(String(value || ""));
}

function minutesFromTime(value) {
  const [hour, minute] = String(value || "").split(":").map(Number);
  return hour * 60 + minute;
}

function timeFromMinutes(value) {
  const hour = Math.floor(value / 60);
  const minute = value % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function normalizeSchedule(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const schedule = {};
  for (const key of Object.keys(DEFAULT_SCHEDULE)) {
    const fallback = DEFAULT_SCHEDULE[key];
    const item = source[key] && typeof source[key] === "object" ? source[key] : {};
    const open = validTime(item.open) ? item.open : fallback.open;
    const close = validTime(item.close) ? item.close : fallback.close;
    schedule[key] = {
      closed: Boolean(item.closed) || minutesFromTime(close) <= minutesFromTime(open),
      open,
      close,
    };
  }
  return schedule;
}

function scheduleSummary(value) {
  const schedule = normalizeSchedule(value);
  const weekdayValues = ["monday", "tuesday", "wednesday", "thursday", "friday"]
    .map((key) => schedule[key]);
  const sameWeekday = weekdayValues.every((item) =>
    item.closed === weekdayValues[0].closed &&
    item.open === weekdayValues[0].open &&
    item.close === weekdayValues[0].close
  );
  const parts = [];
  if (sameWeekday) {
    const item = weekdayValues[0];
    parts.push(item.closed ? "평일 휴무" : `평일 ${item.open}–${item.close}`);
  } else {
    for (const key of ["monday", "tuesday", "wednesday", "thursday", "friday"]) {
      const item = schedule[key];
      parts.push(`${DAY_LABELS[key]} ${item.closed ? "휴무" : `${item.open}–${item.close}`}`);
    }
  }
  for (const key of ["saturday", "sunday"]) {
    const item = schedule[key];
    parts.push(`${DAY_LABELS[key]} ${item.closed ? "휴무" : `${item.open}–${item.close}`}`);
  }
  return parts.join(" · ");
}

function dateKeyInKorea(value = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function dayKeyForDate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ""))) return "";
  const marker = new Date(`${date}T12:00:00+09:00`);
  if (Number.isNaN(marker.getTime())) return "";
  return DAY_KEYS[marker.getUTCDay()];
}

function slotsForDate(scheduleValue, date, slotMinutes = 60) {
  const dayKey = dayKeyForDate(date);
  const schedule = normalizeSchedule(scheduleValue);
  const item = schedule[dayKey];
  const duration = [30, 60, 90, 120].includes(Number(slotMinutes)) ? Number(slotMinutes) : 60;
  if (!item || item.closed) return [];
  const start = minutesFromTime(item.open);
  const close = minutesFromTime(item.close);
  const slots = [];
  for (let cursor = start; cursor + duration <= close; cursor += duration) {
    const time = timeFromMinutes(cursor);
    const startAt = new Date(`${date}T${time}:00+09:00`);
    slots.push({
      time,
      startAt: startAt.toISOString(),
      endAt: new Date(startAt.getTime() + duration * 60 * 1000).toISOString(),
    });
  }
  return slots;
}

function validBookingDate(date, { maxDays = 60, now = new Date() } = {}) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ""))) return false;
  const start = new Date(`${dateKeyInKorea(now)}T00:00:00+09:00`);
  const requested = new Date(`${date}T00:00:00+09:00`);
  const difference = requested.getTime() - start.getTime();
  return difference >= 0 && difference <= maxDays * 24 * 60 * 60 * 1000;
}

module.exports = {
  DAY_LABELS,
  DEFAULT_SCHEDULE,
  dateKeyInKorea,
  dayKeyForDate,
  normalizeSchedule,
  scheduleSummary,
  slotsForDate,
  validBookingDate,
};
