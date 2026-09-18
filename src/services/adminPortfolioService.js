const db = require('../db');
const portfolioService = require('./portfolioService');

function ensureServiceExists(serviceId) {
  if (serviceId == null) return;
  const row = db.prepare('SELECT id FROM services WHERE id = ?').get(serviceId);
  if (!row) {
    const err = new Error('Service not found');
    err.status = 404;
    throw err;
  }
}

function createPortfolio(payload) {
  ensureServiceExists(payload.service_id);
  const result = db
    .prepare(
      `INSERT INTO portfolio
         (title, description, image_url, service_id, tags, price_hint, sort_order, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      payload.title,
      payload.description,
      payload.image_url,
      payload.service_id,
      payload.tags,
      payload.price_hint,
      payload.sort_order ?? 0,
      payload.is_active ? 1 : 0
    );
  return portfolioService.getById(result.lastInsertRowid);
}

function updatePortfolio(id, patch) {
  const current = db.prepare('SELECT id FROM portfolio WHERE id = ?').get(id);
  if (!current) {
    const err = new Error('Portfolio item not found');
    err.status = 404;
    throw err;
  }
  if (patch.service_id !== undefined) {
    ensureServiceExists(patch.service_id);
  }

  const fields = [];
  const params = [];
  const map = {
    title: 'title',
    description: 'description',
    image_url: 'image_url',
    service_id: 'service_id',
    tags: 'tags',
    price_hint: 'price_hint',
    sort_order: 'sort_order',
  };

  Object.entries(map).forEach(([key, col]) => {
    if (patch[key] !== undefined) {
      fields.push(`${col} = ?`);
      params.push(patch[key]);
    }
  });
  if (patch.is_active !== undefined) {
    fields.push('is_active = ?');
    params.push(patch.is_active ? 1 : 0);
  }

  if (!fields.length) return portfolioService.getById(id);

  params.push(id);
  db.prepare(`UPDATE portfolio SET ${fields.join(', ')} WHERE id = ?`).run(...params);
  return portfolioService.getById(id);
}

/**
 * Мягкое удаление.
 */
function softDeletePortfolio(id) {
  const current = db.prepare('SELECT id FROM portfolio WHERE id = ?').get(id);
  if (!current) {
    const err = new Error('Portfolio item not found');
    err.status = 404;
    throw err;
  }
  db.prepare('UPDATE portfolio SET is_active = 0 WHERE id = ?').run(id);
  return portfolioService.getById(id);
}

module.exports = {
  createPortfolio,
  updatePortfolio,
  softDeletePortfolio,
};