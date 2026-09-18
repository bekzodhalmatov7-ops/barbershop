const db = require('../db');

/**
 * Оптимизирует URL изображения под нужный размер.
 * Для Unsplash подставляет маленький размер + сжатие,
 * для остальных URL — возвращает как есть.
 */
function optimizeImageUrl(url, size) {
  if (!url || typeof url !== 'string') return url;
  try {
    const u = new URL(url);
    if (u.hostname === 'images.unsplash.com') {
      u.searchParams.set('w', String(size));
      u.searchParams.set('q', size <= 400 ? '65' : '85');
      u.searchParams.set('auto', 'format');
      u.searchParams.set('fit', 'crop');
      return u.toString();
    }
    return url;
  } catch {
    return url;
  }
}

function rowToItem(r) {
  return {
    id: String(r.id),
    title: r.title,
    description: r.description,

    // Оригинальная ссылка — как задана в админке
    image_url: r.image_url,

    // Готовые размеры
    image_url_thumb: optimizeImageUrl(r.image_url, 400),
    image_url_full: optimizeImageUrl(r.image_url, 1200),

    service_id: r.service_id != null ? String(r.service_id) : null,
    service_name: r.service_name || null,
    service_duration: r.service_duration || null,
    tags: r.tags ? r.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
    price_hint: r.price_hint != null ? Number(r.price_hint) : null,
    sort_order: r.sort_order,
    is_active: !!r.is_active,
    created_at: r.created_at,
  };
}

function getPublicPortfolio({ tag } = {}) {
  const params = [];
  let sql = `
    SELECT p.*, s.name AS service_name, s.duration_minutes AS service_duration
    FROM portfolio p
    LEFT JOIN services s ON s.id = p.service_id
    WHERE p.is_active = 1
  `;
  if (tag) {
    sql += ` AND (',' || p.tags || ',') LIKE ?`;
    params.push(`%,${tag},%`);
  }
  sql += ` ORDER BY p.sort_order ASC, p.id ASC`;

  return db.prepare(sql).all(...params).map(rowToItem);
}

function listAllPortfolio() {
  const rows = db
    .prepare(
      `SELECT p.*, s.name AS service_name, s.duration_minutes AS service_duration
       FROM portfolio p
       LEFT JOIN services s ON s.id = p.service_id
       ORDER BY p.sort_order ASC, p.id ASC`
    )
    .all();
  return rows.map(rowToItem);
}

function getById(id) {
  const r = db
    .prepare(
      `SELECT p.*, s.name AS service_name, s.duration_minutes AS service_duration
       FROM portfolio p
       LEFT JOIN services s ON s.id = p.service_id
       WHERE p.id = ?`
    )
    .get(id);
  return r ? rowToItem(r) : null;
}

function getAllTags() {
  const rows = db
    .prepare(`SELECT tags FROM portfolio WHERE is_active = 1 AND tags IS NOT NULL`)
    .all();
  const set = new Set();
  rows.forEach((r) => {
    r.tags.split(',').map((t) => t.trim()).filter(Boolean).forEach((t) => set.add(t));
  });
  return Array.from(set).sort();
}

module.exports = {
  getPublicPortfolio,
  listAllPortfolio,
  getById,
  getAllTags,
  optimizeImageUrl,
  rowToItem,
};