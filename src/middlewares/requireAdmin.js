const authService = require('../services/authService');

/**
 * Проверяет заголовок Authorization: Bearer <JWT>.
 * Кладёт payload в req.admin.
 */
function requireAdmin(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) {
      const err = new Error('Authorization header missing or malformed');
      err.status = 401;
      throw err;
    }
    req.admin = authService.verifyToken(token);
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { requireAdmin };