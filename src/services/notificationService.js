const {
  sendToAdmins,
  sendToClient,
  sendToAdminGroup,
  getAdminGroupId,
} = require('./telegramService');

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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
  if (booking.cancel_url) {
    rows.push([{ text: '🌐 Открыть страницу записи', url: booking.cancel_url }]);
  }
  return { inline_keyboard: rows };
}

function groupConfirmKeyboard(bookingId) {
  return {
    inline_keyboard: [[
      { text: '✅ Подтвердить', callback_data: `admin_confirm:${bookingId}` },
      { text: '❌ Отклонить', callback_data: `admin_reject:${bookingId}` },
    ]],
  };
}

// ── Admins ──────────────────────────────────────────────

async function notifyNewBooking(b) {
  const groupId = getAdminGroupId();
  const isPending = b.status === 'pending';

  const text = [
    isPending
      ? `<b>🆕 Новая заявка #${escapeHtml(b.id)}</b>`
      : `<b>🆕 Новая запись #${escapeHtml(b.id)}</b>`,
    ...buildBookingLines(b),
    ...(isPending ? ['', '⏳ Ожидает подтверждения.'] : []),
  ].join('\n');

  if (groupId && isPending) {
    const res = await sendToAdminGroup(text, {
      reply_markup: groupConfirmKeyboard(b.id),
    });
    if (res && res.ok && res.message_id) {
      try {
        require('../db')
          .prepare(`UPDATE bookings SET tg_group_message_id = ? WHERE id = ?`)
          .run(res.message_id, b.id);
      } catch (e) {
        console.error('[notify] save group message_id failed:', e.message);
      }
    }
    return res;
  }

  return sendToAdmins(text, { reply_markup: adminKeyboard() });
}

async function notifyBookingCancelled(b) {
  const text = [
    `<b>❌ Отменена запись #${escapeHtml(b.id)}</b>`,
    ...buildBookingLines(b),
  ].join('\n');
  const groupId = getAdminGroupId();
  if (groupId) return sendToAdminGroup(text);
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
  const groupId = getAdminGroupId();
  if (groupId) return sendToAdminGroup(text);
  return sendToAdmins(text, { reply_markup: adminKeyboard() });
}

// ── Client ──────────────────────────────────────────────

async function notifyClientWelcome(b) {
  if (!b.client_telegram_chat_id) return { skipped: true };
  const statusLine =
    b.status === 'pending'
      ? '⏳ Ваша заявка отправлена на подтверждение администратору. Мы сообщим, как только её рассмотрят.'
      : '✅ Ваша запись подтверждена.';

  const text = [
    `<b>Ваша заявка #${escapeHtml(b.id)}</b>`,
    ...buildBookingLines(b),
    '',
    statusLine,
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

async function notifyClientConfirmed(b) {
  if (!b.client_telegram_chat_id) return { skipped: true };
  const text = [
    `<b>✅ Запись #${escapeHtml(b.id)} подтверждена</b>`,
    ...buildBookingLines(b),
    '',
    'Ждём вас!',
  ].join('\n');
  return sendToClient(b.client_telegram_chat_id, text, {
    reply_markup: clientKeyboard(b),
  });
}

async function notifyClientRejected(b) {
  if (!b.client_telegram_chat_id) return { skipped: true };
  const text = [
    `<b>❌ Заявка #${escapeHtml(b.id)} отклонена</b>`,
    ...buildBookingLines(b),
    '',
    'К сожалению, это время недоступно. Попробуйте выбрать другое: /book',
  ].join('\n');
  return sendToClient(b.client_telegram_chat_id, text);
}

module.exports = {
  notifyNewBooking,
  notifyBookingCancelled,
  notifyBookingRescheduled,
  notifyClientWelcome,
  notifyClientCancelled,
  notifyClientRescheduled,
  notifyClientConfirmed,
  notifyClientRejected,
  buildBookingLines,
  groupConfirmKeyboard,
};