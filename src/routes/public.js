const express = require('express');
const serviceController = require('../controllers/serviceController');
const slotController = require('../controllers/slotController');
const bookingController = require('../controllers/bookingController');
const bookingAccessController = require('../controllers/bookingAccessController');
const masterController = require('../controllers/masterController');
const portfolioController = require('../controllers/portfolioController');
const { bookingLimiter } = require('../middlewares/rateLimit');

const router = express.Router();

router.get('/services', serviceController.listServices);
router.get('/masters', masterController.listMasters);
router.get('/slots', slotController.listSlots);
router.post('/bookings', bookingLimiter, bookingController.createBooking);

router.get('/bookings/:id', bookingAccessController.getBooking);
router.delete('/bookings/:id', bookingLimiter, bookingAccessController.cancelBooking);

// Портфолио
router.get('/portfolio', portfolioController.listPortfolio);
router.get('/portfolio/tags', portfolioController.listTags);

module.exports = router;