require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');

const publicRoutes = require('./routes/public');
const adminRoutes = require('./routes/admin');
const telegramRoutes = require('./routes/telegram');
const telegramService = require('./services/telegramService');

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', ts: new Date().toISOString() });
});

// Админка (статика)
app.use(
  '/admin',
  express.static(path.join(__dirname, '..', 'public', 'admin'), { index: 'index.html' })
);

// Страница самоотмены клиентом
app.use(
  '/booking',
  express.static(path.join(__dirname, '..', 'public', 'booking'), { index: 'index.html' })
);

// Клиентская SPA
app.use(express.static(path.join(__dirname, '..', 'public')));

// Telegram webhook
app.use('/api/telegram', telegramRoutes);

// API
app.use('/api', publicRoutes);
app.use('/api/admin', adminRoutes);

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message, err.details || '');
  const status = err.status || 500;
  const body = { error: err.message || 'Internal Server Error' };
  if (err.details) body.details = err.details;
  res.status(status).json(body);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`   Админка:  http://localhost:${PORT}/admin/`);
  console.log(`   Отмена:   http://localhost:${PORT}/booking/?id=..&token=..`);

  const webhookUrl = process.env.TELEGRAM_WEBHOOK_URL;
  if (telegramService.isEnabled() && webhookUrl) {
    const result = await telegramService.setWebhook(
      webhookUrl,
      process.env.TELEGRAM_WEBHOOK_SECRET
    );
    if (result && result.ok) {
      console.log(`✅ Telegram webhook: ${webhookUrl}`);
    } else {
      console.error('❌ Не удалось установить Telegram webhook:', result);
    }
  } else if (telegramService.isEnabled()) {
    console.log('ℹ️  Telegram: webhook не настроен (нет TELEGRAM_WEBHOOK_URL).');
  }
});