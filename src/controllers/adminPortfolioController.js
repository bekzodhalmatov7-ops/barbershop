const portfolioService = require('../services/portfolioService');
const adminPortfolioService = require('../services/adminPortfolioService');
const { createPortfolioSchema, updatePortfolioSchema } = require('../utils/validators');

function listAll(req, res, next) {
  try {
    res.json(portfolioService.listAllPortfolio());
  } catch (err) {
    next(err);
  }
}

function create(req, res, next) {
  try {
    const parsed = createPortfolioSchema.safeParse(req.body);
    if (!parsed.success) {
      const err = new Error('Validation failed');
      err.status = 400;
      err.details = parsed.error.flatten();
      return next(err);
    }
    res.status(201).json(adminPortfolioService.createPortfolio(parsed.data));
  } catch (err) {
    next(err);
  }
}

function update(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      const err = new Error('Invalid id'); err.status = 400; return next(err);
    }
    const parsed = updatePortfolioSchema.safeParse(req.body);
    if (!parsed.success) {
      const err = new Error('Validation failed');
      err.status = 400;
      err.details = parsed.error.flatten();
      return next(err);
    }
    res.json(adminPortfolioService.updatePortfolio(id, parsed.data));
  } catch (err) {
    next(err);
  }
}

function remove(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      const err = new Error('Invalid id'); err.status = 400; return next(err);
    }
    res.json(adminPortfolioService.softDeletePortfolio(id));
  } catch (err) {
    next(err);
  }
}

module.exports = { listAll, create, update, remove };