/**
 * Утилиты для работы со временем (минуты от полуночи <-> "HH:MM").
 */

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * "HH:MM" -> минуты от полуночи.
 * @throws если формат неверный
 */
function toMinutes(hhmm) {
  if (typeof hhmm !== 'string' || !TIME_RE.test(hhmm)) {
    const err = new Error(`Invalid time format: ${hhmm} (expected HH:MM)`);
    err.status = 400;
    throw err;
  }
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Минуты от полуночи -> "HH:MM".
 */
function toHHMM(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Проверка пересечения двух интервалов [aStart, aEnd) и [bStart, bEnd).
 */
function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Парсит дату "YYYY-MM-DD" в локальный Date (полночь).
 * @throws если формат неверный
 */
function parseDate(dateStr) {
  if (typeof dateStr !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const err = new Error(`Invalid date format: ${dateStr} (expected YYYY-MM-DD)`);
    err.status = 400;
    throw err;
  }
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  if (
    dt.getFullYear() !== y ||
    dt.getMonth() !== m - 1 ||
    dt.getDate() !== d
  ) {
    const err = new Error(`Invalid calendar date: ${dateStr}`);
    err.status = 400;
    throw err;
  }
  return dt;
}

/**
 * День недели (0 = воскресенье) для строки "YYYY-MM-DD".
 */
function getDayOfWeek(dateStr) {
  return parseDate(dateStr).getDay();
}

/**
 * Возвращает "минуты от полуночи" текущего момента, если переданная дата — сегодня,
 * иначе null (значит ограничение по времени не применяется).
 */
function nowMinutesIfToday(dateStr, now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const todayStr = `${y}-${m}-${d}`;
  if (todayStr !== dateStr) return null;
  return now.getHours() * 60 + now.getMinutes();
}

module.exports = {
  toMinutes,
  toHHMM,
  overlaps,
  parseDate,
  getDayOfWeek,
  nowMinutesIfToday,
};