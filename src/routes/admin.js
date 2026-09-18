const express = require('express');
const rateLimit = require('express-rate-limit');
const authController = require('../controllers/authController');
const adminBookingController = require('../controllers/adminBookingController');
const adminServiceController = require('../controllers/adminServiceController');
const adminMasterController = require('../controllers/adminMasterController');
const adminWorkingHoursController = require('../controllers/adminWorkingHoursController');
const adminMasterWorkingHoursController = require('../controllers/adminMasterWorkingHoursController');
const adminTelegramController = require('../controllers/adminTelegramController');
const adminPortfolioController = require('../controllers/adminPortfolioController');
const { requireAdmin } = require('../middlewares/requireAdmin');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts, please try again later' },
});

router.post('/login', loginLimiter, authController.login);
router.get('/me', requireAdmin, authController.me);

router.get('/bookings', requireAdmin, adminBookingController.listBookings);
router.post('/bookings', requireAdmin, adminBookingController.createBooking);
router.patch('/bookings/:id', requireAdmin, adminBookingController.patchBooking);

router.get('/services', requireAdmin, adminServiceController.listServices);
router.post('/services', requireAdmin, adminServiceController.createService);
router.put('/services/:id', requireAdmin, adminServiceController.updateService);
router.delete('/services/:id', requireAdmin, adminServiceController.deleteService);

router.get('/masters', requireAdmin, adminMasterController.listMasters);
router.post('/masters', requireAdmin, adminMasterController.createMaster);
router.put('/masters/:id', requireAdmin, adminMasterController.updateMaster);
router.delete('/masters/:id', requireAdmin, adminMasterController.deleteMaster);

router.get('/masters/:id/working-hours', requireAdmin, adminMasterWorkingHoursController.list);
router.put('/masters/:id/working-hours/:dayOfWeek', requireAdmin, adminMasterWorkingHoursController.update);
router.delete('/masters/:id/working-hours/:dayOfWeek', requireAdmin, adminMasterWorkingHoursController.reset);

router.get('/working-hours', requireAdmin, adminWorkingHoursController.listWorkingHours);
router.put('/working-hours/:dayOfWeek', requireAdmin, adminWorkingHoursController.updateWorkingHours);

// Портфолио
router.get('/portfolio', requireAdmin, adminPortfolioController.listAll);
router.post('/portfolio', requireAdmin, adminPortfolioController.create);
router.put('/portfolio/:id', requireAdmin, adminPortfolioController.update);
router.delete('/portfolio/:id', requireAdmin, adminPortfolioController.remove);

router.post('/telegram/test', requireAdmin, adminTelegramController.sendTest);

module.exports = router;