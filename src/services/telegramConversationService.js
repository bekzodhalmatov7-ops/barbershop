/**
 * Состояния диалога клиента с ботом.
 * Хранится в памяти процесса. TTL — 30 минут, автоочистка каждые 5 минут.
 */

const TTL_MS = 30 * 60 * 1000;
const states = new Map(); // String(chatId) -> { step, data, ts }

function setState(chatId, step, data = {}) {
  states.set(String(chatId), { step, data: { ...data }, ts: Date.now() });
}

function getState(chatId) {
  const s = states.get(String(chatId));
  if (!s) return null;
  if (Date.now() - s.ts > TTL_MS) {
    states.delete(String(chatId));
    return null;
  }
  return s;
}

function updateData(chatId, patch) {
  const s = states.get(String(chatId));
  if (!s) return null;
  s.data = { ...s.data, ...patch };
  s.ts = Date.now();
  return s;
}

function clearState(chatId) {
  states.delete(String(chatId));
}

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of states) {
    if (now - v.ts > TTL_MS) states.delete(k);
  }
}, 5 * 60 * 1000).unref();

module.exports = { setState, getState, updateData, clearState };