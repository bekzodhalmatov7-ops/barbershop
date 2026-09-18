const db = require('../db');
const { toMinutes, toHHMM, overlaps, getDayOfWeek, nowMinutesIfToday, parseDate } = require('../utils/time');
const { getWorkingHours } = require('./workingHoursService');

const STEP_MINUTES = 15;

function getActiveService(serviceId) {
  const row = db
    .prepare(
      `SELECT id, duration_minutes, is_active
       FROM services
       WHERE id = ?`
    )
    .get(serviceId);

  if (!row || !row.is_active) return null;
  return row;
}

function getConfirmedBookings(dateStr, masterId) {
  const params = [dateStr];
  let sql = `SELECT start_time, end_time FROM bookings
             WHERE booking_date = ? AND status = 'confirmed'`;
  if (masterId != null && masterId !== '') {
    sql += ` AND master_id = ?`;
    params.push(masterId);
  }
  return db.prepare(sql).all(...params);
}

/**
 * Расчёт доступных слотов.
 * Учитывает override-расписание мастера, если masterId задан.
 */
function getAvailableSlots({ serviceId, date, masterId, now = new Date() }) {
  if (serviceId == null || serviceId === '') {
    const err = new Error('service_id is required');
    err.status = 400;
    throw err;
  }

  const service = getActiveService(serviceId);
  if (!service) {
    const err = new Error('Service not found or inactive');
    err.status = 404;
    throw err;
  }

  parseDate(date);

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const reqDay = parseDate(date);
  if (reqDay < today) {
    const err = new Error('Date is in the past');
    err.status = 400;
    throw err;
  }

  const dayOfWeek = getDayOfWeek(date);
  const masterIdNum =
    masterId != null && masterId !== '' ? Number(masterId) : null;

  const wh = getWorkingHours(dayOfWeek, masterIdNum);
  if (wh.is_day_off) {
    return { date, slots: [] };
  }

  const openMin = toMinutes(wh.open_time);
  const closeMin = toMinutes(wh.close_time);
  const duration = service.duration_minutes;

  const bookings = getConfirmedBookings(date, masterIdNum).map((b) => ({
    start: toMinutes(b.start_time),
    end: toMinutes(b.end_time),
  }));

  const nowMin = nowMinutesIfToday(date, now);

  const slots = [];
  for (let cur = openMin; cur + duration <= closeMin; cur += STEP_MINUTES) {
    const slotEnd = cur + duration;

    if (nowMin != null && cur <= nowMin) continue;

    const hasOverlap = bookings.some((b) => overlaps(cur, slotEnd, b.start, b.end));
    if (hasOverlap) continue;

    slots.push(toHHMM(cur));
  }

  return { date, slots };
}

module.exports = {
  getAvailableSlots,
  STEP_MINUTES,
};