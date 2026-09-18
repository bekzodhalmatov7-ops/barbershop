const slotService = require('../services/slotService');

/**
 * GET /api/slots?service_id=1&date=2026-09-20&master_id=optional
 */
function listSlots(req, res, next) {
  try {
    const { service_id, date, master_id } = req.query;
    const result = slotService.getAvailableSlots({
      serviceId: service_id,
      date,
      masterId: master_id,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listSlots,
};