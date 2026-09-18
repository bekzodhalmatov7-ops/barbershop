const db = require('../db');

/**
 * Список всех услуг (включая неактивные) для админки.
 */
function listAllServices() {
  const rows = db
    .prepare(
      `SELECT id, name, duration_minutes, price, is_active, created_at
       FROM services
       ORDER BY id ASC`
    )
    .all();

  return rows.map((r) => ({
    id: String(r.id),
    name: r.name,
    duration_minutes: r.duration_minutes,
    price: Number(r.price),
    is_active: !!r.is_active,
    created_at: r.created_at,
  }));
}

/**
 * Получить услугу по id.
 */
function getServiceById(id) {
  const r = db
    .prepare(
      `SELECT id, name, duration_minutes, price, is_active, created_at
       FROM services WHERE id = ?`
    )
    .get(id);
  if (!r) return null;
  return {
    id: String(r.id),
    name: r.name,
    duration_minutes: r.duration_minutes,
    price: Number(r.price),
    is_active: !!r.is_active,
    created_at: r.created_at,
  };
}

/**
 * Создать услугу.
 */
function createService({ name, duration_minutes, price, is_active }) {
  const result = db
    .prepare(
      `INSERT INTO services (name, duration_minutes, price, is_active)
       VALUES (?, ?, ?, ?)`
    )
    .run(name, duration_minutes, price, is_active ? 1 : 0);

  return getServiceById(result.lastInsertRowid);
}

/**
 * Обновить услугу. Возвращает обновлённую сущность.
 * @throws 404 если не найдена
 */
function updateService(id, patch) {
  const current = db.prepare('SELECT id FROM services WHERE id = ?').get(id);
  if (!current) {
    const err = new Error('Service not found');
    err.status = 404;
    throw err;
  }

  const fields = [];
  const params = [];

  if (patch.name !== undefined) {
    fields.push('name = ?');
    params.push(patch.name);
  }
  if (patch.duration_minutes !== undefined) {
    fields.push('duration_minutes = ?');
    params.push(patch.duration_minutes);
  }
  if (patch.price !== undefined) {
    fields.push('price = ?');
    params.push(patch.price);
  }
  if (patch.is_active !== undefined) {
    fields.push('is_active = ?');
    params.push(patch.is_active ? 1 : 0);
  }

  if (fields.length === 0) {
    // не должно произойти — схема требует хотя бы одно поле
    return getServiceById(id);
  }

  params.push(id);
  db.prepare(`UPDATE services SET ${fields.join(', ')} WHERE id = ?`).run(...params);

  return getServiceById(id);
}

/**
 * Мягкое удаление услуги: is_active = false.
 * Существующие брони остаются валидными, услуга пропадает из публичного списка.
 * @throws 404 если не найдена
 */
function softDeleteService(id) {
  const current = db.prepare('SELECT id FROM services WHERE id = ?').get(id);
  if (!current) {
    const err = new Error('Service not found');
    err.status = 404;
    throw err;
  }
  db.prepare('UPDATE services SET is_active = 0 WHERE id = ?').run(id);
  return getServiceById(id);
}

module.exports = {
  listAllServices,
  getServiceById,
  createService,
  updateService,
  softDeleteService,
};