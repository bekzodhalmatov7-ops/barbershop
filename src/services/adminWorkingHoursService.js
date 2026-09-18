const db = require('../db');

const DAY_NAMES_RU = [
  'Воскресенье',
  'Понедельник',
  'Вторник',
  'Среда',
  'Четверг',
  'Пятница',
  'Суббота',
];

/**
 * Список всех 7 дней недели (0..6) с рабочими часами.
 * Если записи в БД нет — возвращаем выходной по умолчанию.
 */
function listWorkingHours() {
  const rows = db
    .prepare(
      `SELECT day_of_week, open_time, close_time, is_day_off
       FROM working_hours
       ORDER BY day_of_week ASC`
    )
    .all();

  const byDay = new Map(rows.map((r) => [r.day_of_week, r]));

  const result = [];
  for (let d = 0; d <= 6; d++) {
    const r = byDay.get(d);
    result.push({
      day_of_week: d,
      day_name: DAY_NAMES_RU[d],
      open_time: r ? r.open_time : null,
      close_time: r ? r.close_time : null,
      is_day_off: r ? !!r.is_day_off : true,
    });
  }
  return result;
}

/**
 * Обновить один день недели (upsert).
 *
 * @param {number} dayOfWeek 0..6
 * @param {Object} patch { is_day_off, open_time?, close_time? }
 * @throws 400 если dayOfWeek вне 0..6
 */
function updateWorkingHours(dayOfWeek, patch) {
  if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
    const err = new Error('day_of_week must be an integer 0..6');
    err.status = 400;
    throw err;
  }

  // Для выходного: сохраняем существующие значения времени (если были),
  // либо ставим дефолтные 10:00/20:00, чтобы поле не было NULL в БД.
  const existing = db
    .prepare(
      `SELECT open_time, close_time, is_day_off
       FROM working_hours WHERE day_of_week = ?`
    )
    .get(dayOfWeek);

  const isDayOff = patch.is_day_off;
  let openTime;
  let closeTime;

  if (isDayOff) {
    openTime = patch.open_time ?? existing?.open_time ?? '10:00';
    closeTime = patch.close_time ?? existing?.close_time ?? '20:00';
  } else {
    openTime = patch.open_time;
    closeTime = patch.close_time;
  }

  db.prepare(
    `INSERT INTO working_hours (day_of_week, open_time, close_time, is_day_off)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(day_of_week) DO UPDATE SET
       open_time  = excluded.open_time,
       close_time = excluded.close_time,
       is_day_off = excluded.is_day_off`
  ).run(dayOfWeek, openTime, closeTime, isDayOff ? 1 : 0);

  return {
    day_of_week: dayOfWeek,
    day_name: DAY_NAMES_RU[dayOfWeek],
    open_time: openTime,
    close_time: closeTime,
    is_day_off: isDayOff,
  };
}

module.exports = {
  listWorkingHours,
  updateWorkingHours,
  DAY_NAMES_RU,
};