const adminBookingService = require('../services/adminBookingService');
const {
  createBookingSchema,
  listBookingsQuerySchema,
  patchBookingSchema,
} = require('../utils/validators');

/**
 * GET /api/admin/bookings?date=&status=&phone=
 */
function listBookings(req, res, next) {
  try {
    const parsed = listBookingsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      const err = new Error('Validation failed');
      err.status = 400;
      err.details = parsed.error.flatten();
      return next(err);
    }
    const result = adminBookingService.listBookings(parsed.data);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/admin/bookings
 * Создание записи вручную (например, по звонку).
 */
function createBooking(req, res, next) {
  try {
    const parsed = createBookingSchema.safeParse(req.body);
    if (!parsed.success) {
      const err = new Error('Validation failed');
      err.status = 400;
      err.details = parsed.error.flatten();
      return next(err);
    }
    const result = adminBookingService.createBookingManually(parsed.data);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/admin/bookings/:id
 */
function patchBooking(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      const err = new Error('Invalid booking id');
      err.status = 400;
      return next(err);
    }

    const parsed = patchBookingSchema.safeParse(req.body);
    if (!parsed.success) {
      const err = new Error('Validation failed');
      err.status = 400;
      err.details = parsed.error.flatten();
      return next(err);
    }

    const updated = adminBookingService.patchBooking(id, parsed.data);
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listBookings,
  createBooking,
  patchBooking,
};