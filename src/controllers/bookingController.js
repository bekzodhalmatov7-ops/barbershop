const bookingService = require('../services/bookingService');
const { createBookingSchema } = require('../utils/validators');

/**
 * POST /api/bookings
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

    const result = bookingService.createBooking(parsed.data);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createBooking,
};