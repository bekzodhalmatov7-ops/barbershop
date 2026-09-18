const db = require('../db');
const { toMinutes, toHHMM, overlaps, parseDate, getDayOfWeek, nowMinutesIfToday } = require('../utils/time');
const { getWorkingHours } = require('./workingHoursService');
const { notifyNewBooking } = require('./notificationService');
const telegramLinkService = require('./telegramLinkService');

function ensureActiveService(serviceId) {
  const row = db
    .prepare(`SELECT id, duration_minutes, is_active FROM services WHERE id = ?`)
    .get(serviceId);
  if (!row || !row.is_active) {
    const err = new Error('Service not found or inactive');
    err.status = 404;
    throw err;
  }
  return row;
}

function ensureActiveMaster(masterId) {
  if (masterId == null) return;
  const row = db
    .prepare(`SELECT id, is_active FROM masters WHERE id = ?`)
    .get(masterId);
  if (!row || !row.is_active) {
    const err = new Error('Master not found or inactive');
    err.status = 404;
    throw err;
  }
}

function getConfirmedBookings(dateStr, masterId) {
  const params = [dateStr];
  let sql = `SELECT id, start_time, end_time FROM bookings
             WHERE booking_date = ? AND status = 'confirmed'`;
  if (masterId != null) {
    sql += ` AND master_id = ?`;
    params.push(masterId);
  }
  return db.prepare(sql).all(...params);
}

function isSlotFree(dateStr, masterId, startMin, endMin) {
  const rows = getConfirmedBookings(dateStr, masterId);
  return !rows.some((b) =>
    overlaps(startMin, endMin, toMinutes(b.start_time), toMinutes(b.end_time))
  );
}

function getBookingWithNames(id) {
  return db
    .prepare(
      `SELECT
         b.id, b.client_name, b.client_phone, b.client_email,
         b.booking_date AS date, b.start_time, b.end_time,
         b.status, b.comment,
         b.client_telegram_chat_id, b.client_link_token,
         s.name AS service_name, s.price AS service_price,
         m.name AS master_name
       FROM bookings b
       LEFT JOIN services s ON s.id = b.service_id
       LEFT JOIN masters  m ON m.id = b.master_id
       WHERE b.id = ?`
    )
    .get(id);
}

function toPublicBooking(b) {
  if (!b) return null;
  return {
    id: String(b.id),
    status: b.status,
    date: b.date,
    start_time: b.start_time,
    end_time: b.end_time,
    service_name: b.service_name || null,
    service_price: b.service_price != null ? Number(b.service_price) : null,
    master_name: b.master_name || null,
    client_name: b.client_name,
    comment: b.comment || null,
  };
}

function buildCancelUrl(id, token) {
  const base = (process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '');
  if (!base || !token) return null;
  return `${base}/booking/?id=${id}&token=${token}`;
}

function createBooking(payload, opts = {}) {
  const now = opts.now || new Date();
  const source = opts.source || 'public';

  const {
    service_id,
    master_id = null,
    date,
    start_time,
    client_name,
    client_phone,
    client_email = null,
    comment = null,
  } = payload;

  const service = ensureActiveService(service_id);
  ensureActiveMaster(master_id);

  const reqDay = parseDate(date);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (reqDay < today) {
    const err = new Error('Date is in the past'); err.status = 400; throw err;
  }

  // Учёт override-расписания мастера
  const wh = getWorkingHours(getDayOfWeek(date), master_id);
  if (wh.is_day_off) {
    const err = new Error('Selected day is a day off'); err.status = 400; throw err;
  }

  const openMin = toMinutes(wh.open_time);
  const closeMin = toMinutes(wh.close_time);
  const startMin = toMinutes(start_time);
  const endMin = startMin + service.duration_minutes;

  if (startMin < openMin || endMin > closeMin) {
    const err = new Error('Selected time is outside working hours'); err.status = 400; throw err;
  }

  const nowMin = nowMinutesIfToday(date, now);
  if (nowMin != null && startMin <= nowMin) {
    const err = new Error('Selected time is in the past'); err.status = 400; throw err;
  }

  const insert = db.prepare(
    `INSERT INTO bookings
       (service_id, master_id, client_name, client_phone, client_email,
        booking_date, start_time, end_time, status, comment)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', ?)`
  );

  const tx = db.transaction(() => {
    if (!isSlotFree(date, master_id, startMin, endMin)) {
      const err = new Error('Selected slot is no longer available');
      err.status = 409;
      throw err;
    }
    const result = insert.run(
      service_id, master_id, client_name, client_phone, client_email,
      date, toHHMM(startMin), toHHMM(endMin), comment
    );
    return result.lastInsertRowid;
  });

  const id = tx.immediate();

  const token = telegramLinkService.ensureToken(id);
  const botUsername = process.env.TELEGRAM_BOT_USERNAME;
  const telegramUrl =
    botUsername && token ? `https://t.me/${botUsername}?start=${token}` : null;
  const cancelUrl = buildCancelUrl(id, token);

  if (source !== 'admin') {
    const full = getBookingWithNames(id);
    if (full) {
      notifyNewBooking(full).catch((e) =>
        console.error('[notify] new booking failed:', e.message)
      );
    }
  }

  return {
    id: String(id),
    status: 'confirmed',
    date,
    start_time: toHHMM(startMin),
    end_time: toHHMM(endMin),
    telegram_url: telegramUrl,
    cancel_url: cancelUrl,
  };
}

function getBookingByToken(id, token) {
  if (!id || !token) return null;
  const row = db
    .prepare(
      `SELECT
         b.id, b.status,
         b.booking_date AS date, b.start_time, b.end_time, b.comment,
         b.client_link_token, b.client_name,
         s.name AS service_name, s.price AS service_price,
         m.name AS master_name
       FROM bookings b
       LEFT JOIN services s ON s.id = b.service_id
       LEFT JOIN masters  m ON m.id = b.master_id
       WHERE b.id = ?`
    )
    .get(id);

  if (!row) return null;
  if (row.client_link_token !== token) return null;
  return toPublicBooking(row);
}

function cancelBookingByToken(id, token) {
  const tx = db.transaction(() => {
    const row = db
      .prepare(`SELECT id, status, client_link_token FROM bookings WHERE id = ?`)
      .get(id);

    if (!row) {
      const err = new Error('Booking not found'); err.status = 404; throw err;
    }
    if (row.client_link_token !== token) {
      const err = new Error('Invalid booking token'); err.status = 403; throw err;
    }
    if (row.status === 'cancelled') {
      const err = new Error('Booking is already cancelled'); err.status = 409; throw err;
    }

    db.prepare(`UPDATE bookings SET status = 'cancelled' WHERE id = ?`).run(id);
    return { previousStatus: row.status };
  });

  const { previousStatus } = tx.immediate();
  const full = getBookingWithNames(id);

  return { booking: full, previousStatus };
}

module.exports = {
  createBooking,
  getBookingWithNames,
  getBookingByToken,
  cancelBookingByToken,
  toPublicBooking,
  buildCancelUrl,
};