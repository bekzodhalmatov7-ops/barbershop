const bcrypt = require('bcrypt');
const db = require('../db');

/**
 * Создаёт дефолтного админа, если таблица admins пуста.
 * Логин/пароль берутся из ENV (если заданы) или значения по умолчанию.
 *
 * ⚠️ Смените пароль в production!
 */
function seedDefaultAdmin() {
  const count = db.prepare('SELECT COUNT(*) AS c FROM admins').get().c;
  if (count > 0) return;

  const login = process.env.ADMIN_LOGIN || 'admin';
  const password = process.env.ADMIN_PASSWORD || 'admin123';

  const hash = bcrypt.hashSync(password, 10);
  db.prepare('INSERT INTO admins (login, password_hash) VALUES (?, ?)').run(login, hash);

  console.log(`👤 Создан дефолтный админ: login="${login}" (пароль из ENV или "admin123")`);
}

module.exports = { seedDefaultAdmin };