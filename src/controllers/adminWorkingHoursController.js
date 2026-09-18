const adminWorkingHoursService = require('../services/adminWorkingHoursService');
const { updateWorkingHoursSchema } = require('../utils/validators');

/**
 * GET /api/admin/working-hours
 */
function listWorkingHours(req, res, next) {
  try {
    res.json(adminWorkingHoursService.listWorkingHours());
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/admin/working-hours/:dayOfWeek
 * dayOfWeek: 0..6 (0 = воскресенье)
 */
function updateWorkingHours(req, res, next) {
  try {
    const dayOfWeek = Number(req.params.dayOfWeek);
    if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
      const err = new Error('day_of_week must be an integer 0..6');
      err.status = 400;
      return next(err);
    }

    const parsed = updateWorkingHoursSchema.safeParse(req.body);
    if (!parsed.success) {
      const err = new Error('Validation failed');
      err.status = 400;
      err.details = parsed.error.flatten();
      return next(err);
    }

    const updated = adminWorkingHoursService.updateWorkingHours(
      dayOfWeek,
      parsed.data
    );
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listWorkingHours,
  updateWorkingHours,
};