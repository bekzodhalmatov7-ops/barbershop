const masterService = require('../services/masterService');

/**
 * GET /api/masters
 */
function listMasters(req, res, next) {
  try {
    res.json(masterService.getActiveMasters());
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listMasters,
};