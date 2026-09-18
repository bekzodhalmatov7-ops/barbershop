const bookingService = require('../services/bookingService');
const {
  notifyBookingCancelled,
  notifyClientCancelled,
} = require('../services/notificationService');

const TOKEN_RE = /^[a-f0-9]{32}$/;

function parseIdAndToken(req) {
  const id = Number(req.params.id);
  const token = typeof req.query.token === 'string' ? req.query.token : '';
  if (!Number.isInteger(id) || id <= 0) {
    const err = new Error('Invalid booking id'); err.status = 400; throw err;
  }
  if (!token || !TOKEN_RE.test(token)) {
    const err = new Error('Invalid or missing token'); err.status = 403; throw err;
  }
  return { id, token };
}

/**
 * GET /api/bookings/:id?token=...
 * Публичная проекция брони (без телефона и chat_id) для страницы самоотмены.
 */
function getBooking(req, res, next) {
  try {
    const { id, token } = parseIdAndToken(req);
    const booking = bookingService.getBookingByToken(id, token);
    if (!booking) {
      const err = new Error('Booking not found');
      err.status = 404;
      throw err;
    }
    res.json(booking);
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/bookings/:id?token=...
 * Отмена брони клиентом.
 */
function cancelBooking(req, res, next) {
  try {
    const { id, token } = parseIdAndToken(req);
    const { booking, previousStatus } = bookingService.cancelBookingByToken(id, token);

    res.json(bookingService.toPublicBooking(booking));

    // Уведомления — fire-and-forget
    if (booking && previousStatus === 'confirmed') {
      notifyBookingCancelled(booking).catch((e) =>
        console.error('[notify] admin cancel (self) failed:', e.message)
      );
      notifyClientCancelled(booking).catch((e) =>
        console.error('[notify] client cancel (self) failed:', e.message)
      );
    }
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getBooking,
  cancelBooking,
};