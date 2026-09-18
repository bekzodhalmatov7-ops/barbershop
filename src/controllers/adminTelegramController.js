const telegramService = require('../services/telegramService');

/**
 * POST /api/admin/telegram/test
 * Отправляет тестовое сообщение во все настроенные чаты.
 */
async function sendTest(req, res, next) {
  try {
    if (!telegramService.isEnabled()) {
      const err = new Error(
        'Telegram не настроен: задайте TELEGRAM_BOT_TOKEN и TELEGRAM_ADMIN_CHAT_IDS в .env'
      );
      err.status = 400;
      throw err;
    }

    const result = await telegramService.sendMessage(
      '🔔 <b>Тест уведомлений</b>\nСообщение из админки барбершопа. Всё работает.'
    );
    res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
}

module.exports = { sendTest };