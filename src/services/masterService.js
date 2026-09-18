const db = require('../db');

/**
 * Список активных мастеров для клиента.
 */
function getActiveMasters() {
  const rows = db
    .prepare(`SELECT id, name FROM masters WHERE is_active = 1 ORDER BY id ASC`)
    .all();

  return rows.map((r) => ({
    id: String(r.id),
    name: r.name,
  }));
}

module.exports = {
  getActiveMasters,
};