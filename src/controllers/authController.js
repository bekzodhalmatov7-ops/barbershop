const authService = require('../services/authService');

/**
 * POST /api/admin/login
 */
function login(req, res, next) {
  try {
    const { login, password } = req.body || {};
    const result = authService.login(login, password);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/admin/me
 * Проверка активной сессии (защищён requireAdmin).
 */
function me(req, res) {
  res.json({ admin: { id: req.admin.sub, login: req.admin.login } });
}

module.exports = {
  login,
  me,
};