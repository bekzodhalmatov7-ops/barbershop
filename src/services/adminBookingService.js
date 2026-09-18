const db = require('../db');
const { toMinutes, toHHMM, overlaps, parseDate, getDayOfWeek } = require('../utils/time');
const { getWorkingHours } = require('./workingHoursService');
const bookingService = require('./bookingService');
const {
  notifyBookingCancelled,
  notifyBookingRescheduled,
  notifyClientCancelled,
  notifyClientRescheduled,
} = require('./notificationService');

function listBookings({ date, status, phone } = {}) {
  const where = [];
  const params = [];

  if (date) { where.push('b.booking_date = ?'); params.push(date); }
  if (status) { where.push('b.status = ?'); params.push(status); }
  if (phone) { where.push('b.client_phone LIKE ?'); params.push(`%${phone}%`); }

  const sql = `
    SELECT
      b.id, b.service_id, b.master_id,
      b.client_name, b.client_phone, b.client_email,
      b.booking_date, b.start_time, b.end_time,
      b.status, b.comment, b.created_at,
      s.name AS service_name, s.price AS service_price,
      m.name AS master_name
    FROM bookings b
    LEFT JOIN services s ON s.id = b.service_id
    LEFT JOIN masters  m ON m.id = b.master_id
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY b.booking_date DESC, b.start_time DESC
  `;

  const rows = db.prepare(sql).all(...params);
  return rows.map((r) => ({
    id: String(r.id),
    service_id: String(r.service_id),
    service_name: r.service_name,
    service_price: r.service_price != null ? Number(r.service_price) : null,
    master_id: r.master_id != null ? String(r.master_id) : null,
    master_name: r.master_name,
    client_name: r.client_name,
    client_phone: r.client_phone,
    client_email: r.client_email,
    date: r.booking_date,
    start_time: r.start_time,
    end_time: r.end_time,
    status: r.status,
    comment: r.comment,
    created_at: r.created_at,
  }));
}

function getBookingById(id) {
  return (
    db
      .prepare(
        `SELECT id, service_id, master_id, booking_date, start_time, end_time, status
         FROM bookings WHERE id = ?`
      )
      .get(id) || null
  );
}

function patchBooking(id, patch) {
  const before = getBookingById(id);

  const tx = db.transaction(() => {
    const current = getBookingById(id);
    if (!current) {
      const err = new Error('Booking not found');
      err.status = 404;
      throw err;
    }

    const nextStatus = patch.status ?? current.status;
    const nextDate = patch.date ?? current.booking_date;
    const nextStart = patch.start_time ?? current.start_time;
    const nextMaster = patch.master_id !== undefined ? patch.master_id : current.master_id;

    const service = db
      .prepare('SELECT id, duration_minutes FROM services WHERE id = ?')
      .get(current.service_id);
    if (!service) {
      const err = new Error('Service for this booking not found');
      err.status = 500;
      throw err;
    }

    if (nextStatus === 'confirmed') {
      const reqDay = parseDate(nextDate);
      const t = new Date();
      const todayMidnight = new Date(t.getFullYear(), t.getMonth(), t.getDate());
      if (reqDay < todayMidnight) {
        const err = new Error('Date is in the past');
        err.status = 400;
        throw err;
      }

      // Учёт override-расписания мастера
      const wh = getWorkingHours(getDayOfWeek(nextDate), nextMaster);
      if (wh.is_day_off) {
        const err = new Error('Selected day is a day off');
        err.status = 400;
        throw err;
      }

      const openMin = toMinutes(wh.open_time);
      const closeMin = toMinutes(wh.close_time);
      const startMin = toMinutes(nextStart);
      const endMin = startMin + service.duration_minutes;

      if (startMin < openMin || endMin > closeMin) {
        const err = new Error('Selected time is outside working hours');
        err.status = 400;
        throw err;
      }

      const params = [nextDate, id];
      let sql = `SELECT id, start_time, end_time FROM bookings
                 WHERE booking_date = ? AND status = 'confirmed' AND id != ?`;
      if (nextMaster != null) {
        sql += ` AND master_id = ?`;
        params.push(nextMaster);
      }
      const others = db.prepare(sql).all(...params);
      const clash = others.some((b) =>
        overlaps(startMin, endMin, toMinutes(b.start_time), toMinutes(b.end_time))
      );
      if (clash) {
        const err = new Error('Selected slot is not available');
        err.status = 409;
        throw err;
      }
    }

    const newEnd = toHHMM(toMinutes(nextStart) + service.duration_minutes);

    db.prepare(
      `UPDATE bookings
       SET status = ?, booking_date = ?, start_time = ?, end_time = ?,
           master_id = ?, comment = COALESCE(?, comment)
       WHERE id = ?`
    ).run(
      nextStatus,
      nextDate,
      nextStart,
      newEnd,
      nextMaster,
      patch.comment !== undefined ? patch.comment : null,
      id
    );

    return getBookingById(id);
  });

  const updated = tx.immediate();

  if (before) {
    const becameCancelled = before.status === 'confirmed' && updated.status === 'cancelled';
    const becameConfirmed = before.status === 'cancelled' && updated.status === 'confirmed';
    const dateChanged = before.booking_date !== updated.booking_date;
    const timeChanged = before.start_time !== updated.start_time;

    const full = bookingService.getBookingWithNames(id);

    if (full && becameCancelled) {
      notifyBookingCancelled(full).catch((e) =>
        console.error('[notify] admin cancel failed:', e.message)
      );
      notifyClientCancelled(full).catch((e) =>
        console.error('[notify] client cancel failed:', e.message)
      );
    } else if (full && (dateChanged || timeChanged) && updated.status === 'confirmed') {
      notifyBookingRescheduled(full, {
        date: before.booking_date,
        start_time: before.start_time,
      }).catch((e) => console.error('[notify] admin reschedule failed:', e.message));

      notifyClientRescheduled(full, {
        date: before.booking_date,
        start_time: before.start_time,
      }).catch((e) => console.error('[notify] client reschedule failed:', e.message));
    } else if (full && becameConfirmed) {
      notifyClientRescheduled(full, {
        date: before.booking_date,
        start_time: before.start_time,
      }).catch(() => {});
    }
  }

  return {
    id: String(updated.id),
    status: updated.status,
    date: updated.booking_date,
    start_time: updated.start_time,
    end_time: updated.end_time,
  };
}

function createBookingManually(payload) {
  return bookingService.createBooking(payload, { source: 'admin' });
}

module.exports = {
  listBookings,
  patchBooking,
  createBookingManually,
};