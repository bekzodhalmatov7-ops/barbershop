/**
 * Генерация и проверка токенов для связки брони с Telegram-чатом клиента.
 * Токен — 32-символьная hex-строка, хранится в bookings.client_link_token.
 */

const crypto = require('crypto');
const db = require('../db');

function generateToken() {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Возвращает существующий токен брони или создаёт новый.
 */
function ensureToken(bookingId) {
  const row = db
    .prepare('SELECT id, client_link_token FROM bookings WHERE id = ?')
    .get(bookingId);
  if (!row) return null;
  if (row.client_link_token) return row.client_link_token;

  const token = generateToken();
  db.prepare('UPDATE bookings SET client_link_token = ? WHERE id = ?').run(token, bookingId);
  return token;
}

/**
 * Находит бронь по токену вместе с именами услуги/мастера.
 */
function findByToken(token) {
  if (!token) return null;
  return (
    db
      .prepare(
        `SELECT
           b.id, b.client_name, b.client_phone, b.status,
           b.booking_date AS date, b.start_time, b.end_time, b.comment,
           b.service_id, b.master_id, b.client_telegram_chat_id,
           s.name AS service_name, s.price AS service_price,
           m.name AS master_name
         FROM bookings b
         LEFT JOIN services s ON s.id = b.service_id
         LEFT JOIN masters  m ON m.id = b.master_id
         WHERE b.client_link_token = ?`
      )
      .get(token) || null
  );
}

/**
 * Привязывает chat_id клиента к брони.
 */
function bindChat(bookingId, chatId) {
  db.prepare('UPDATE bookings SET client_telegram_chat_id = ? WHERE id = ?').run(
    String(chatId),
    bookingId
  );
}

module.exports = {
  generateToken,
  ensureToken,
  findByToken,
  bindChat,
};