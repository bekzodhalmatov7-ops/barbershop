const rateLimit = require('express-rate-limit');

/**
 * Лимит на POST /api/bookings — защита от спама.
 * 5 запросов в минуту с одного IP.
 */
const bookingLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many booking requests, please try again later' },
});

module.exports = {
  bookingLimiter,
};