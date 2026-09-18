const db = require('../db');

/**
 * Список всех мастеров (включая неактивных) для админки.
 */
function listAllMasters() {
  const rows = db
    .prepare(`SELECT id, name, is_active FROM masters ORDER BY id ASC`)
    .all();

  return rows.map((r) => ({
    id: String(r.id),
    name: r.name,
    is_active: !!r.is_active,
  }));
}

/**
 * Получить мастера по id.
 */
function getMasterById(id) {
  const r = db
    .prepare(`SELECT id, name, is_active FROM masters WHERE id = ?`)
    .get(id);
  if (!r) return null;
  return {
    id: String(r.id),
    name: r.name,
    is_active: !!r.is_active,
  };
}

/**
 * Создать мастера.
 */
function createMaster({ name, is_active }) {
  const result = db
    .prepare(`INSERT INTO masters (name, is_active) VALUES (?, ?)`)
    .run(name, is_active ? 1 : 0);
  return getMasterById(result.lastInsertRowid);
}

/**
 * Обновить мастера. Возвращает обновлённую сущность.
 * @throws 404 если не найден
 */
function updateMaster(id, patch) {
  const current = db.prepare('SELECT id FROM masters WHERE id = ?').get(id);
  if (!current) {
    const err = new Error('Master not found');
    err.status = 404;
    throw err;
  }

  const fields = [];
  const params = [];

  if (patch.name !== undefined) {
    fields.push('name = ?');
    params.push(patch.name);
  }
  if (patch.is_active !== undefined) {
    fields.push('is_active = ?');
    params.push(patch.is_active ? 1 : 0);
  }

  if (fields.length === 0) {
    return getMasterById(id);
  }

  params.push(id);
  db.prepare(`UPDATE masters SET ${fields.join(', ')} WHERE id = ?`).run(...params);
  return getMasterById(id);
}

/**
 * Мягкое удаление мастера: is_active = false.
 * Существующие брони остаются валидными.
 * @throws 404 если не найден
 */
function softDeleteMaster(id) {
  const current = db.prepare('SELECT id FROM masters WHERE id = ?').get(id);
  if (!current) {
    const err = new Error('Master not found');
    err.status = 404;
    throw err;
  }
  db.prepare('UPDATE masters SET is_active = 0 WHERE id = ?').run(id);
  return getMasterById(id);
}

module.exports = {
  listAllMasters,
  getMasterById,
  createMaster,
  updateMaster,
  softDeleteMaster,
};