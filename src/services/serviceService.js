const db = require('../db');

/**
 * Возвращает список активных услуг.
 * Сортировка: по id (порядок добавления).
 */
function getActiveServices() {
  const rows = db
    .prepare(
      `SELECT id, name, duration_minutes, price
       FROM services
       WHERE is_active = 1
       ORDER BY id ASC`
    )
    .all();

  // Приводим к публичному виду (id строкой, price числом)
  return rows.map((r) => ({
    id: String(r.id),
    name: r.name,
    duration_minutes: r.duration_minutes,
    price: Number(r.price),
  }));
}

module.exports = {
  getActiveServices,
};