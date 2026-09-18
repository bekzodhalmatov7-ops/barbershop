const db = require('../db');
const { answerCallbackQuery, sendToChat } = require('../services/telegramService');
const telegramLinkService = require('../services/telegramLinkService');
const bookingService = require('../services/bookingService');
const bookingBot = require('./telegramBookingBotController');
const {
  notifyClientWelcome,
  notifyClientCancelled,
  notifyBookingCancelled,
} = require('../services/notificationService');

async function handleUpdate(update) {
  if (update && update.callback_query) {
    const data = update.callback_query.data || '';
    if (data.startsWith('cancel_client:')) {
      return handleCancelCallback(update.callback_query);
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

  db.prepare(`UPDATE bookings SET status='cancelled' WHERE id = ?`).run(bookingId);
  await answerCallbackQuery(cbId, 'Запись отменена');

  const fresh = bookingService.getBookingWithNames(bookingId);
  if (fresh) {
    notifyClientCancelled(fresh).catch((e) =>
      console.error('[notify] client cancel failed:', e.message));
    notifyBookingCancelled(fresh).catch((e) =>
      console.error('[notify] admin cancel failed:', e.message));
  }
}

module.exports = { handleUpdate };