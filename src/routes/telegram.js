const express = require('express');
const telegramWebhookController = require('../controllers/telegramWebhookController');

const router = express.Router();

/**
 * POST /api/telegram/webhook
 * Принимает апдейты от Telegram.
 * Защита: опциональный secret_token в заголовке (см. TELEGRAM_WEBHOOK_SECRET).
 */
router.post('/webhook', (req, res) => {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (secret) {
    const got = req.headers['x-telegram-bot-api-secret-token'];
    if (got !== secret) {
      return res.status(401).json({ error: 'unauthorized' });
    }
  }

  // Отвечаем Telegram сразу, чтобы он не ретраил
  res.json({ ok: true });

  // Обрабатываем асинхронно
  Promise.resolve()
    .then(() => telegramWebhookController.handleUpdate(req.body))
    .catch((e) => console.error('[telegram webhook] error:', e.message));
});

module.exports = router;