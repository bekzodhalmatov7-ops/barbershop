const db = require('../db');
const {
  answerCallbackQuery,
  sendToChat,
  editMessageReplyMarkup,
  editMessageText,
  isGroupAdmin,
  getAdminGroupId,
} = require('../services/telegramService');
const telegramLinkService = require('../services/telegramLinkService');
const bookingService = require('../services/bookingService');
const bookingBot = require('./telegramBookingBotController');
const {
  notifyClientWelcome,
  notifyClientCancelled,
  notifyBookingCancelled,
  notifyClientConfirmed,
  notifyClientRejected,
} = require('../services/notificationService');

async function handleUpdate(update) {
  if (update && update.callback_query) {
    const data = update.callback_query.data || '';
    if (data.startsWith('cancel_client:')) {
      return handleCancelCallback(update.callback_query);
    }
    if (data.startsWith('admin_confirm:') || data.startsWith('admin_reject:')) {
      return handleAdminDecision(update.callback_query);
    }
    return bookingBot.handleCallback(update.callback_query);
  }

  if (update && update.message) {
    const text = update.message.text || '';
    if (text.startsWith('/start')) {
      const parts = text.split(/\s+/);
      if (parts[1]) return handleStartWithToken(update.message, parts[1]);
    }
    return bookingBot.handleMessage(update.message);
  }
}

async function handleStartWithToken(message, token) {
  const chatId = message.chat && message.chat.id;
  if (!chatId) return;

  const booking = telegramLinkService.findByToken(token);
  if (!booking) {
    return sendToChat(
      chatId,
      '⚠️ Ссылка не найдена или устарела. Оформите новую запись через /book.'
    );
  }

  telegramLinkService.bindChat(booking.id, chatId);
  const fresh = telegramLinkService.findByToken(token);

  await notifyClientWelcome(fresh);
  await sendToChat(
    chatId,
    'Хотите записаться ещё раз? /book — новая запись, /my — ваши текущие записи.'
  );
}

async function handleCancelCallback(query) {
  const chatId = query.from && query.from.id;
  const data = query.data || '';
  const cbId = query.id;
  const bookingId = data.slice('cancel_client:'.length);

  const row = db
    .prepare(`SELECT id, status, client_telegram_chat_id FROM bookings WHERE id = ?`)
    .get(bookingId);

  if (!row) return answerCallbackQuery(cbId, 'Запись не найдена');
  if (String(row.client_telegram_chat_id) !== String(chatId)) {
    return answerCallbackQuery(cbId, 'Нет доступа к этой записи');
  }
  if (row.status === 'cancelled') {
    return answerCallbackQuery(cbId, 'Запись уже отменена');
  }

  db.prepare(`UPDATE bookings SET status = 'cancelled' WHERE id = ?`).run(bookingId);
  await answerCallbackQuery(cbId, 'Запись отменена');

  const fresh = bookingService.getBookingWithNames(bookingId);
  if (fresh) {
    notifyClientCancelled(fresh).catch((e) =>
      console.error('[notify] client cancel failed:', e.message));
    notifyBookingCancelled(fresh).catch((e) =>
      console.error('[notify] admin cancel failed:', e.message));
  }
}

/**
 * Обработка нажатий «✅ Подтвердить» / «❌ Отклонить» в группе.
 */
async function handleAdminDecision(query) {
  const cbId = query.id;
  const data = query.data || '';
  const chatId = query.message && query.message.chat && query.message.chat.id;
  const messageId = query.message && query.message.message_id;
  const originalText = query.message && query.message.text;
  const fromUser = query.from || {};

  const groupId = getAdminGroupId();
  if (!groupId) {
    return answerCallbackQuery(cbId, 'Группа для подтверждений не настроена');
  }
  if (String(chatId) !== String(groupId)) {
    return answerCallbackQuery(cbId, 'Нет доступа');
  }

  const isAdmin = await isGroupAdmin(fromUser.id);
  if (!isAdmin) {
    return answerCallbackQuery(cbId, 'Только администраторы могут подтверждать');
  }

  const [action, idStr] = data.split(':');
  const bookingId = Number(idStr);
  if (!Number.isInteger(bookingId) || bookingId <= 0) {
    return answerCallbackQuery(cbId, 'Некорректная заявка');
  }

  const booking = db
    .prepare(`SELECT id, status FROM bookings WHERE id = ?`)
    .get(bookingId);
  if (!booking) return answerCallbackQuery(cbId, 'Заявка не найдена');
  if (booking.status !== 'pending') {
    return answerCallbackQuery(
      cbId,
      booking.status === 'confirmed' ? 'Уже подтверждено' : 'Уже отменено'
    );
  }

  const newStatus = action === 'admin_confirm' ? 'confirmed' : 'cancelled';
  db.prepare(`UPDATE bookings SET status = ? WHERE id = ?`).run(newStatus, bookingId);

  await answerCallbackQuery(
    cbId,
    newStatus === 'confirmed' ? '✅ Подтверждено' : '❌ Отклонено'
  );

  const fromName = fromUser.username
    ? `@${fromUser.username}`
    : (fromUser.first_name || 'админ');

  if (messageId && originalText) {
    const suffix = newStatus === 'confirmed'
      ? `\n\n✅ Подтверждено: ${fromName}`
      : `\n\n❌ Отклонено: ${fromName}`;
    await editMessageText(chatId, messageId, originalText + suffix, {
      reply_markup: { inline_keyboard: [] },
    });
  } else if (messageId) {
    await editMessageReplyMarkup(chatId, messageId, { inline_keyboard: [] });
  }

  const full = bookingService.getBookingWithNames(bookingId);
  if (full) {
    if (newStatus === 'confirmed') {
      notifyClientConfirmed(full).catch((e) =>
        console.error('[notify] client confirmed failed:', e.message));
    } else {
      notifyClientRejected(full).catch((e) =>
        console.error('[notify] client rejected failed:', e.message));
    }
  }
}

module.exports = { handleUpdate };