const db = require('../db');

/**
 * Возвращает рабочие часы для дня недели (0..6, 0 = воскресенье).
 *
 * @param {number} dayOfWeek
 * @param {number|null} [masterId] — если задан, ищем override в master_working_hours.
 *                                  Fallback — глобальная таблица working_hours.
 * @returns {{ day_of_week: number, is_day_off: boolean, open_time: string|null,
 *             close_time: string|null, source: 'master'|'global'|'default' }}
 */
function getWorkingHours(dayOfWeek, masterId = null) {
  if (masterId != null) {
    const row = db
      .prepare(
        `SELECT open_time, close_time, is_day_off
         FROM master_working_hours
         WHERE master_id = ? AND day_of_week = ?`
      )
      .get(masterId, dayOfWeek);

    if (row) {
      return {
        day_of_week: dayOfWeek,
        is_day_off: !!row.is_day_off,
        open_time: row.open_time,
        close_time: row.close_time,
        source: 'master',
      };
    }
  }

  const row = db
    .prepare(
      `SELECT open_time, close_time, is_day_off
       FROM working_hours
       WHERE day_of_week = ?`
    )
    .get(dayOfWeek);

  if (!row) {
    return {
      day_of_week: dayOfWeek,
      is_day_off: true,
      open_time: null,
      close_time: null,
      source: 'default',
    };
  }

  return {
    day_of_week: dayOfWeek,
    is_day_off: !!row.is_day_off,
    open_time: row.open_time,
    close_time: row.close_time,
    source: 'global',
  };
}

module.exports = {
  getWorkingHours,
};