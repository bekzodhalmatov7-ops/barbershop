const adminMasterService = require('../services/adminMasterService');
const { createMasterSchema, updateMasterSchema } = require('../utils/validators');

/**
 * GET /api/admin/masters
 */
function listMasters(req, res, next) {
  try {
    res.json(adminMasterService.listAllMasters());
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/admin/masters
 */
function createMaster(req, res, next) {
  try {
    const parsed = createMasterSchema.safeParse(req.body);
    if (!parsed.success) {
      const err = new Error('Validation failed');
      err.status = 400;
      err.details = parsed.error.flatten();
      return next(err);
    }
    const created = adminMasterService.createMaster(parsed.data);
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/admin/masters/:id
 */
function updateMaster(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      const err = new Error('Invalid master id');
      err.status = 400;
      return next(err);
    }

    const parsed = updateMasterSchema.safeParse(req.body);
    if (!parsed.success) {
      const err = new Error('Validation failed');
      err.status = 400;
      err.details = parsed.error.flatten();
      return next(err);
    }

    const updated = adminMasterService.updateMaster(id, parsed.data);
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/admin/masters/:id
 * Мягкое удаление (is_active = false).
 */
function deleteMaster(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      const err = new Error('Invalid master id');
      err.status = 400;
      return next(err);
    }
    const updated = adminMasterService.softDeleteMaster(id);
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listMasters,
  createMaster,
  updateMaster,
  deleteMaster,
};