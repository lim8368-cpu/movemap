const assert = require("node:assert/strict");
const {
  normalizeSchedule,
  scheduleSummary,
  slotsForDate,
  validBookingDate,
} = require("./_booking");

const schedule = normalizeSchedule({
  monday: { closed: false, open: "09:00", close: "12:00" },
  sunday: { closed: true, open: "09:00", close: "12:00" },
});

const mondaySlots = slotsForDate(schedule, "2026-07-27", 60);
assert.deepEqual(mondaySlots.map((slot) => slot.time), ["09:00", "10:00", "11:00"]);
assert.equal(slotsForDate(schedule, "2026-08-02", 60).length, 0);
assert.match(scheduleSummary(schedule), /월 09:00–12:00/);
assert.equal(validBookingDate("not-a-date"), false);

console.log("booking schedule tests passed");
