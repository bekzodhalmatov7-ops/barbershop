const crypto = require('crypto');

const TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const ADMIN_CHAT_IDS = (process.env.TELEGRAM_ADMIN_CHAT_IDS || '')
  .split(',').map((s) => s.trim()).filter(Boolean);

const ENABLED = process.env.TELEGRAM_ENABLED !== 'false' && TOKEN.length > 0;
const ADMIN_NOTIFY = ENABLED && ADMIN_CHAT_IDS.length > 0;
const CLIENT_NOTIFY = ENABLED && process.env.TELEGRAM_CLIENT_NOTIFICATIONS !== 'false';

const RATE_LIMIT_PER_MIN = Math.max(1, Number(process.env.TELEGRAM_RATE_LIMIT_PER_MIN || 20));
const DEDUP_WINDOW_MS = Math.max(0, Number(process.env.TELEGRAM_DEDUP_WINDOW_SECONDS || 30)) * 1000;

const rateBuckets = new Map();
const dedupCache = new Map();

function prune() {
  const now = Date.now();
  const cutoffRate = now - 60_000;
  for (const [k, arr] of rateBuckets) {
    const fresh = arr.filter((t) => t > cutoffRate);
    if (fresh.length) rateBuckets.set(k, fresh); else rateBuckets.delete(k);
  }
  const cutoffDedup = now - DEDUP_WINDOW_MS;
  for (const [k, ts] of dedupCache) if (ts < cutoffDedup) dedupCache.delete(k);
}
setInterval(prune, 60_000).unref();

async function callApi(method, payload) {
  if (!TOKEN) return { ok: false, error: 'TELEGRAM_BOT_TOKEN is not configured' };
  try {
    const res = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => null);
    if (!body) return { ok: false, error: `HTTP ${res.status}` };
    return body;
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

async function sendToChat(chatId, text, options = {}) {
  if (!ENABLED || !chatId) return { skipped: true, reason: 'disabled_or_no_chat' };

  const key = String(chatId);
  const now = Date.now();

  const cutoffRate = now - 60_000;
  const bucket = (rateBuckets.get(key) || []).filter((t) => t > cutoffRate);
  if (bucket.length >= RATE_LIMIT_PER_MIN) {
    console.warn(`[Telegram] rate limit hit for chat ${chatId}`);
    return { skipped: true, reason: 'rate_limit' };
  }

  const markup = options.reply_markup ? JSON.stringify(options.reply_markup) : '';
  const hash = crypto
    .createHash('sha1')
    .update(`${chatId}\u0000${text}\u0000${markup}`)
    .digest('hex');

  const last = dedupCache.get(hash);
  if (last && DEDUP_WINDOW_MS > 0 && now - last < DEDUP_WINDOW_MS) {
    return { skipped: true, reason: 'duplicate' };
  }

  bucket.push(now);
  rateBuckets.set(key, bucket);
  dedupCache.set(hash, now);

  const result = await callApi('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    ...options,
  });

  if (!result.ok) {
    console.error(`[Telegram] send to ${chatId} failed:`, result.description || result.error);
    return { ok: false, error: result.description || result.error, chat_id: chatId };
  }
  return { ok: true, chat_id: chatId, message_id: result.result.message_id };
}

async function editMessageText(chatId, messageId, text, options = {}) {
  if (!ENABLED) return { skipped: true };
  const result = await callApi('editMessageText', {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    ...options,
  });
  if (!result.ok) {
    const desc = result.description || result.error;
    if (desc && desc.includes('message is not modified')) return { ok: true, noop: true };
    console.error('[Telegram] editMessageText failed:', desc);
    return { ok: false, error: desc };
  }
  return { ok: true };
}

async function editMessageReplyMarkup(chatId, messageId, replyMarkup) {
  if (!ENABLED) return { skipped: true };
  return callApi('editMessageReplyMarkup', {
    chat_id: chatId,
    message_id: messageId,
    reply_markup: replyMarkup || { inline_keyboard: [] },
  });
}

async function sendToAdmins(text, options = {}) {
  if (!ADMIN_NOTIFY) return { skipped: true, reason: 'no_admins' };
  const results = [];
  for (const chatId of ADMIN_CHAT_IDS) results.push(await sendToChat(chatId, text, options));
  return { results };
}

async function sendToClient(chatId, text, options = {}) {
  if (!CLIENT_NOTIFY || !chatId) return { skipped: true, reason: 'no_client' };
  return sendToChat(chatId, text, options);
}

async function answerCallbackQuery(callbackQueryId, text) {
  return callApi('answerCallbackQuery', {
    callback_query_id: callbackQueryId,
    text: text || '',
    show_alert: false,
  });
}

async function setWebhook(url, secret) {
  return callApi('setWebhook', {
    url,
    secret_token: secret || undefined,
    allowed_updates: ['message', 'callback_query'],
    drop_pending_updates: false,
  });
}

async function deleteWebhook() {
  return callApi('deleteWebhook', { drop_pending_updates: false });
}

function isEnabled() { return ENABLED; }

function getStats() {
  return {
    enabled: ENABLED,
    adminsCount: ADMIN_CHAT_IDS.length,
    clientNotify: CLIENT_NOTIFY,
    rateLimitPerMin: RATE_LIMIT_PER_MIN,
    dedupWindowMs: DEDUP_WINDOW_MS,
    rateBuckets: rateBuckets.size,
    dedupEntries: dedupCache.size,
  };
}

module.exports = {
  sendToChat,
  editMessageText,
  editMessageReplyMarkup,
  sendToAdmins,
  sendToClient,
  answerCallbackQuery,
  setWebhook,
  deleteWebhook,
  isEnabled,
  getStats,
};