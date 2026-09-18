const portfolioService = require('../services/portfolioService');
const { listPortfolioQuerySchema } = require('../utils/validators');

/**
 * GET /api/portfolio?tag=
 */
function listPortfolio(req, res, next) {
  try {
    const parsed = listPortfolioQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      const err = new Error('Validation failed');
      err.status = 400;
      err.details = parsed.error.flatten();
      return next(err);
    }
    const items = portfolioService.getPublicPortfolio(parsed.data);
    res.json(items);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/portfolio/tags
 */
function listTags(req, res, next) {
  try {
    res.json(portfolioService.getAllTags());
  } catch (err) {
    next(err);
  }
}

module.exports = { listPortfolio, listTags };