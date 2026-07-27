const {
  recordAuditLog,
  recordErrorLog,
  sendJson,
  supabaseRequest,
} = require("./_shared");
const { requireOwnerAccess } = require("./_platform-auth");
const { dateKeyInKorea, slotsForDate, validBookingDate } = require("./_booking");

const ALLOWED_STATUSES = new Set(["pending", "confirmed", "completed", "cancelled", "no_show"]);

async function bookingRows(centerId) {
  return supabaseRequest("bookings", {
    query: `?select=*&center_id=eq.${encodeURIComponent(centerId)}&order=start_at.asc&limit=300`,
  });
}

async function centerRow(centerId) {
  const rows = await supabaseRequest("centers", {
    query: `?select=id,opening_schedule,booking_slot_minutes&id=eq.${encodeURIComponent(centerId)}&limit=1`,
  });
  return rows[0] || null;
}

module.exports = async function handler(req, res) {
  try {
    const centerId = String(req.query?.centerId || req.body?.centerId || "");
    const access = await requireOwnerAccess(req, res, { centerId, action: "manage_bookings" });
    if (!access) return;
    if (req.method === "GET") {
      const rows = await bookingRows(access.centerId);
      return sendJson(res, 200, { bookings: rows });
    }
    if (req.method !== "PATCH") return sendJson(res, 405, { error: "Method not allowed" });

    const body = req.body || {};
    const bookingId = String(body.bookingId || "");
    const status = String(body.status || "");
    if (!bookingId || !ALLOWED_STATUSES.has(status)) {
      return sendJson(res, 400, { error: "예약과 처리 상태를 확인해 주세요." });
    }
    const existingRows = await supabaseRequest("bookings", {
      query: `?select=*&id=eq.${encodeURIComponent(bookingId)}&center_id=eq.${encodeURIComponent(access.centerId)}&limit=1`,
    });
    const existing = existingRows[0];
    if (!existing) return sendJson(res, 404, { error: "예약을 찾을 수 없습니다." });
    const patch = {
      status,
      updated_at: new Date().toISOString(),
      cancelled_at: status === "cancelled" ? new Date().toISOString() : null,
    };

    const requestedDate = body.startAt ? new Date(String(body.startAt)) : null;
    if (requestedDate && Number.isNaN(requestedDate.getTime())) {
      return sendJson(res, 400, { error: "변경할 예약 시간을 확인해 주세요." });
    }
    const requestedIso = requestedDate ? requestedDate.toISOString() : "";
    const existingIso = new Date(existing.start_at).toISOString();
    const activatesCancelledSlot =
      ["pending", "confirmed"].includes(status) &&
      !["pending", "confirmed"].includes(existing.status);
    if ((requestedIso && requestedIso !== existingIso) || activatesCancelledSlot) {
      const requestedStart = requestedDate || new Date(existing.start_at);
      const date = dateKeyInKorea(requestedStart);
      const center = await centerRow(access.centerId);
      if (
        Number.isNaN(requestedStart.getTime()) ||
        !center ||
        !validBookingDate(date, { maxDays: 180 })
      ) {
        return sendJson(res, 400, { error: "변경할 예약 날짜를 확인해 주세요." });
      }
      const slot = slotsForDate(center.opening_schedule, date, center.booking_slot_minutes)
        .find((item) => item.startAt === requestedStart.toISOString());
      if (!slot) return sendJson(res, 409, { error: "센터 운영시간에 포함된 시간만 선택할 수 있습니다." });
      const conflicts = await supabaseRequest("bookings", {
        query: `?select=id&center_id=eq.${encodeURIComponent(access.centerId)}&start_at=eq.${encodeURIComponent(slot.startAt)}&status=in.(pending,confirmed)&id=neq.${encodeURIComponent(bookingId)}&limit=1`,
      });
      if (conflicts[0]) return sendJson(res, 409, { error: "이미 다른 예약이 있는 시간입니다." });
      if (slot.startAt !== existingIso) {
        patch.start_at = slot.startAt;
        patch.end_at = slot.endAt;
      }
    }

    await supabaseRequest("bookings", {
      method: "PATCH",
      query: `?id=eq.${encodeURIComponent(bookingId)}&center_id=eq.${encodeURIComponent(access.centerId)}`,
      body: patch,
    });
    await recordAuditLog(req, {
      actorUserId: access.userId,
      actorRole: access.role,
      centerId: access.centerId,
      action: "booking.update",
      targetType: "booking",
      targetId: bookingId,
      metadata: { status, startAt: patch.start_at || existing.start_at },
    });
    return sendJson(res, 200, { ok: true, bookings: await bookingRows(access.centerId) });
  } catch (error) {
    console.error("owner bookings api failed", error);
    await recordErrorLog(req, error, { errorCode: "owner_bookings_api_failed", statusCode: 500 });
    return sendJson(res, 500, { error: "예약 정보를 처리하지 못했습니다." });
  }
};
