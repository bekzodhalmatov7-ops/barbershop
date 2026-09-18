const serviceService = require('../services/serviceService');

/**
 * GET /api/services
 * Публичный список активных услуг.
 */
function listServices(req, res, next) {
  try {
    const services = serviceService.getActiveServices();
    res.json(services);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listServices,
};