const {
  enforceRateLimit,
  recordAuditLog,
  recordErrorLog,
  sendJson,
  supabaseRequest,
} = require("./_shared");
const { requireAuthenticatedUser } = require("./_platform-auth");
const {
  dateKeyInKorea,
  normalizeSchedule,
  slotsForDate,
  validBookingDate,
} = require("./_booking");

function bodyValue(req) {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");
  return {};
}

function validIdempotencyKey(value) {
  return /^[0-9a-f-]{36}$/i.test(String(value || "").trim());
}

function phoneDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

async function centerRow(centerId) {
  const rows = await supabaseRequest("centers", {
    query: `?select=id,name,status,opening_schedule,booking_slot_minutes,booking_enabled&id=eq.${encodeURIComponent(centerId)}&status=eq.approved&limit=1`,
  });
  return rows[0] || null;
}

async function availability(req, res) {
  const centerId = String(req.query?.centerId || "");
  const date = String(req.query?.date || "");
  if (!centerId || !validBookingDate(date)) {
    return sendJson(res, 400, { error: "센터와 예약 날짜를 확인해 주세요." });
  }
  const center = await centerRow(centerId);
  if (!center) return sendJson(res, 404, { error: "센터를 찾을 수 없습니다." });
  const slotMinutes = Number(center.booking_slot_minutes || 60);
  const schedule = normalizeSchedule(center.opening_schedule);
  const generated = center.booking_enabled === false ? [] : slotsForDate(schedule, date, slotMinutes);
  const start = new Date(`${date}T00:00:00+09:00`).toISOString();
  const end = new Date(`${date}T23:59:59+09:00`).toISOString();
  const reserved = generated.length
    ? await supabaseRequest("bookings", {
        query: `?select=start_at&center_id=eq.${encodeURIComponent(centerId)}&status=in.(pending,confirmed)&start_at=gte.${encodeURIComponent(start)}&start_at=lte.${encodeURIComponent(end)}`,
      })
    : [];
  const reservedStarts = new Set(reserved.map((item) => new Date(item.start_at).toISOString()));
  const minimumStart = Date.now() + 30 * 60 * 1000;
  return sendJson(res, 200, {
    centerId,
    centerName: center.name,
    date,
    bookingEnabled: center.booking_enabled !== false,
    slotMinutes,
    slots: generated.map((slot) => {
      const pastCutoff = new Date(slot.startAt).getTime() < minimumStart;
      const reserved = reservedStarts.has(slot.startAt);
      return {
        ...slot,
        available: !pastCutoff && !reserved,
        unavailableReason: pastCutoff ? "closed" : reserved ? "booked" : null,
      };
    }),
  });
}

async function createBooking(req, res) {
  const auth = await requireAuthenticatedUser(req, res);
  if (!auth) return;
  if (!enforceRateLimit(req, res, {
    bucket: "booking-create",
    max: 10,
    windowMs: 60 * 60 * 1000,
    identity: auth.user.id,
  })) return;

  const idempotencyKey = String(req.headers["idempotency-key"] || "").trim();
  if (!validIdempotencyKey(idempotencyKey)) {
    return sendJson(res, 400, { error: "예약 중복 방지 키가 필요합니다. 다시 시도해 주세요." });
  }
  const body = bodyValue(req);
  const centerId = String(body.centerId || "");
  const customerName = String(body.customerName || "").trim().slice(0, 40);
  const customerPhone = String(body.customerPhone || "").trim().slice(0, 30);
  const painArea = String(body.painArea || "").trim().slice(0, 100);
  const customerNote = String(body.customerNote || "").trim().slice(0, 500);
  const requestedStart = new Date(String(body.startAt || ""));
  const digits = phoneDigits(customerPhone);
  if (
    !centerId ||
    customerName.length < 2 ||
    digits.length < 9 ||
    digits.length > 11 ||
    painArea.length < 2 ||
    Number.isNaN(requestedStart.getTime()) ||
    body.privacyConsent !== true
  ) {
    return sendJson(res, 400, { error: "이름, 전화번호, 불편 부위와 개인정보 동의를 확인해 주세요." });
  }
  if (requestedStart.getTime() < Date.now() + 30 * 60 * 1000) {
    return sendJson(res, 409, { error: "현재 시간보다 30분 이후의 예약 시간을 선택해 주세요." });
  }

  const [center, duplicated] = await Promise.all([
    centerRow(centerId),
    supabaseRequest("bookings", {
      query: `?select=id,status&idempotency_key=eq.${encodeURIComponent(idempotencyKey)}&limit=1`,
    }),
  ]);
  if (duplicated[0]) return sendJson(res, 200, { ok: true, duplicate: true, ...duplicated[0] });
  if (!center || center.booking_enabled === false) {
    return sendJson(res, 409, { error: "현재 온라인 예약을 받지 않는 센터입니다." });
  }

  const date = dateKeyInKorea(requestedStart);
  if (!validBookingDate(date)) return sendJson(res, 400, { error: "예약 가능한 날짜가 아닙니다." });
  const slots = slotsForDate(center.opening_schedule, date, center.booking_slot_minutes);
  const selected = slots.find((slot) => slot.startAt === requestedStart.toISOString());
  if (!selected) return sendJson(res, 409, { error: "센터 운영시간에 포함되지 않는 예약 시간입니다." });
  const existing = await supabaseRequest("bookings", {
    query: `?select=id&center_id=eq.${encodeURIComponent(centerId)}&start_at=eq.${encodeURIComponent(selected.startAt)}&status=in.(pending,confirmed)&limit=1`,
  });
  if (existing[0]) return sendJson(res, 409, { error: "방금 다른 예약이 접수된 시간입니다. 다른 시간을 선택해 주세요." });

  try {
    const rows = await supabaseRequest("bookings", {
      method: "POST",
      body: {
        center_id: centerId,
        user_id: auth.user.id,
        customer_name: customerName,
        customer_phone: customerPhone,
        pain_area: painArea,
        customer_note: customerNote || null,
        start_at: selected.startAt,
        end_at: selected.endAt,
        status: "pending",
        idempotency_key: idempotencyKey,
        privacy_consent_at: new Date().toISOString(),
      },
    });
    const booking = rows[0];
    await recordAuditLog(req, {
      actorUserId: auth.user.id,
      actorRole: "user",
      centerId,
      action: "booking.create",
      targetType: "booking",
      targetId: booking.id,
      metadata: { startAt: selected.startAt },
    });
    return sendJson(res, 201, {
      ok: true,
      id: booking.id,
      status: booking.status,
      startAt: booking.start_at,
      message: "예약 요청을 보냈습니다. 센터 확인 후 예약이 확정됩니다.",
    });
  } catch (error) {
    if (/duplicate|unique/i.test(String(error.message || ""))) {
      return sendJson(res, 409, { error: "방금 다른 예약이 접수된 시간입니다. 다른 시간을 선택해 주세요." });
    }
    throw error;
  }
}

module.exports = async function handler(req, res) {
  try {
    if (req.method === "GET") return availability(req, res);
    if (req.method === "POST") return createBooking(req, res);
    return sendJson(res, 405, { error: "Method not allowed" });
  } catch (error) {
    console.error("bookings api failed", error);
    await recordErrorLog(req, error, { errorCode: "bookings_api_failed", statusCode: 500 });
    return sendJson(res, 500, { error: "예약을 처리하지 못했습니다." });
  }
};
