const { sendToAdmins, sendToClient } = require('./telegramService');

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function buildBookingLines(b) {
  const lines = [];
  lines.push(`👤 ${escapeHtml(b.client_name)}`);
  lines.push(`📞 ${escapeHtml(b.client_phone)}`);
  if (b.service_name) {
    const price = b.service_price != null ? ` · ${b.service_price} ₽` : '';
    lines.push(`💼 ${escapeHtml(b.service_name)}${price}`);
  }
  if (b.master_name) lines.push(`✂️ ${escapeHtml(b.master_name)}`);
  lines.push(`📅 ${escapeHtml(b.date)} в ${escapeHtml(b.start_time)}–${escapeHtml(b.end_time)}`);
  if (b.comment) lines.push(`💬 ${escapeHtml(b.comment)}`);
  return lines;
}

function adminKeyboard() {
  const base = (process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '');
  if (!base) return undefined;
  return { inline_keyboard: [[{ text: '📋 Открыть в админке', url: `${base}/admin/` }]] };
}

function clientKeyboard(booking) {
  if (booking.status !== 'confirmed') return undefined;
  const rows = [[{
    text: '❌ Отменить запись',
    callback_data: `cancel_client:${booking.id}`,
  }]];

  // Дублирующая web-ссылка на всякий случай
  if (booking.cancel_url) {
    rows.push([{ text: '🌐 Открыть страницу записи', url: booking.cancel_url }]);
  }

  return { inline_keyboard: rows };
}

async function notifyNewBooking(b) {
  const text = [
    `<b>🆕 Новая запись #${escapeHtml(b.id)}</b>`,
    ...buildBookingLines(b),
  ].join('\n');
  return sendToAdmins(text, { reply_markup: adminKeyboard() });
}

async function notifyBookingCancelled(b) {
  const text = [
    `<b>❌ Отменена запись #${escapeHtml(b.id)}</b>`,
    ...buildBookingLines(b),
  ].join('\n');
  return sendToAdmins(text, { reply_markup: adminKeyboard() });
}

async function notifyBookingRescheduled(b, prev) {
  const text = [
    `<b>🔁 Перенос записи #${escapeHtml(b.id)}</b>`,
    `👤 ${escapeHtml(b.client_name)}`,
    `📞 ${escapeHtml(b.client_phone)}`,
    b.service_name ? `💼 ${escapeHtml(b.service_name)}` : null,
    b.master_name ? `✂️ ${escapeHtml(b.master_name)}` : null,
    `Было:  📅 ${escapeHtml(prev.date)} в ${escapeHtml(prev.start_time)}`,
    `Стало: 📅 ${escapeHtml(b.date)} в ${escapeHtml(b.start_time)}–${escapeHtml(b.end_time)}`,
  ]
    .filter(Boolean)
    .join('\n');
  return sendToAdmins(text, { reply_markup: adminKeyboard() });
}

async function notifyClientWelcome(b) {
  if (!b.client_telegram_chat_id) return { skipped: true };
  const text = [
    `<b>✅ Вы подписаны на уведомления</b>`,
    ``,
    `Ваша запись #${escapeHtml(b.id)}:`,
    ...buildBookingLines(b),
    ``,
    `Мы пришлём сюда сообщение, если что-то изменится.`,
  ].join('\n');
  return sendToClient(b.client_telegram_chat_id, text, {
    reply_markup: clientKeyboard(b),
  });
}

async function notifyClientCancelled(b) {
  if (!b.client_telegram_chat_id) return { skipped: true };
  const text = [
    `<b>❌ Запись #${escapeHtml(b.id)} отменена</b>`,
    ...buildBookingLines(b),
  ].join('\n');
  return sendToClient(b.client_telegram_chat_id, text);
}

async function notifyClientRescheduled(b, prev) {
  if (!b.client_telegram_chat_id) return { skipped: true };
  const text = [
    `<b>🔁 Ваша запись #${escapeHtml(b.id)} перенесена</b>`,
    b.service_name ? `💼 ${escapeHtml(b.service_name)}` : null,
    b.master_name ? `✂️ ${escapeHtml(b.master_name)}` : null,
    `Было:  📅 ${escapeHtml(prev.date)} в ${escapeHtml(prev.start_time)}`,
    `Стало: 📅 ${escapeHtml(b.date)} в ${escapeHtml(b.start_time)}–${escapeHtml(b.end_time)}`,
  ]
    .filter(Boolean)
    .join('\n');
  return sendToClient(b.client_telegram_chat_id, text, {
    reply_markup: clientKeyboard(b),
  });
}

module.exports = {
  notifyNewBooking,
  notifyBookingCancelled,
  notifyBookingRescheduled,
  notifyClientWelcome,
  notifyClientCancelled,
  notifyClientRescheduled,
};