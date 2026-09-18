const adminServiceService = require('../services/adminServiceService');
const { createServiceSchema, updateServiceSchema } = require('../utils/validators');

/**
 * GET /api/admin/services
 */
function listServices(req, res, next) {
  try {
    res.json(adminServiceService.listAllServices());
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/admin/services
 */
function createService(req, res, next) {
  try {
    const parsed = createServiceSchema.safeParse(req.body);
    if (!parsed.success) {
      const err = new Error('Validation failed');
      err.status = 400;
      err.details = parsed.error.flatten();
      return next(err);
    }
    const created = adminServiceService.createService(parsed.data);
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/admin/services/:id
 */
function updateService(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      const err = new Error('Invalid service id');
      err.status = 400;
      return next(err);
    }

    const parsed = updateServiceSchema.safeParse(req.body);
    if (!parsed.success) {
      const err = new Error('Validation failed');
      err.status = 400;
      err.details = parsed.error.flatten();
      return next(err);
    }

    const updated = adminServiceService.updateService(id, parsed.data);
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/admin/services/:id
 * Мягкое удаление (is_active = false).
 */
function deleteService(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      const err = new Error('Invalid service id');
      err.status = 400;
      return next(err);
    }
    const updated = adminServiceService.softDeleteService(id);
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listServices,
  createService,
  updateService,
  deleteService,
};