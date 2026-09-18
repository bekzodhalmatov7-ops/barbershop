const adminMasterWorkingHoursService = require('../services/adminMasterWorkingHoursService');
const { updateMasterWorkingHoursSchema } = require('../utils/validators');

function parseMasterId(req) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    const err = new Error('Invalid master id');
    err.status = 400;
    throw err;
  }
  return id;
}

/**
 * GET /api/admin/masters/:id/working-hours
 */
function list(req, res, next) {
  try {
    const masterId = parseMasterId(req);
    res.json(adminMasterWorkingHoursService.listMasterWorkingHours(masterId));
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/admin/masters/:id/working-hours/:dayOfWeek
 */
function update(req, res, next) {
  try {
    const masterId = parseMasterId(req);
    const dayOfWeek = Number(req.params.dayOfWeek);
    if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
      const err = new Error('day_of_week must be an integer 0..6');
      err.status = 400;
      throw err;
    }

    const parsed = updateMasterWorkingHoursSchema.safeParse(req.body);
    if (!parsed.success) {
      const err = new Error('Validation failed');
      err.status = 400;
      err.details = parsed.error.flatten();
      return next(err);
    }

    const updated = adminMasterWorkingHoursService.updateMasterWorkingHours(
      masterId,
      dayOfWeek,
      parsed.data
    );
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/admin/masters/:id/working-hours/:dayOfWeek
 * Сброс override → использование глобального расписания.
 */
function reset(req, res, next) {
  try {
    const masterId = parseMasterId(req);
    const dayOfWeek = Number(req.params.dayOfWeek);
    if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
      const err = new Error('day_of_week must be an integer 0..6');
      err.status = 400;
      throw err;
    }
    const result = adminMasterWorkingHoursService.resetMasterWorkingHours(
      masterId,
      dayOfWeek
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  list,
  update,
  reset,
};