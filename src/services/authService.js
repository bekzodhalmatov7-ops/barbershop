const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../db');

/**
 * Проверяет логин/пароль, возвращает JWT или бросает 401.
 */
function login(login, password) {
  if (typeof login !== 'string' || typeof password !== 'string' || !login || !password) {
    const err = new Error('login and password are required');
    err.status = 400;
    throw err;
  }

  const admin = db
    .prepare('SELECT id, login, password_hash FROM admins WHERE login = ?')
    .get(login);

  if (!admin) {
    const err = new Error('Invalid credentials');
    err.status = 401;
    throw err;
  }

  const ok = bcrypt.compareSync(password, admin.password_hash);
  if (!ok) {
    const err = new Error('Invalid credentials');
    err.status = 401;
    throw err;
  }

  const payload = { sub: admin.id, login: admin.login, role: 'admin' };
  const token = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  });

  return {
    token,
    admin: { id: admin.id, login: admin.login },
  };
}

/**
 * Верифицирует JWT, возвращает payload или бросает 401.
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (e) {
    const err = new Error('Invalid or expired token');
    err.status = 401;
    throw err;
  }
}

module.exports = {
  login,
  verifyToken,
};