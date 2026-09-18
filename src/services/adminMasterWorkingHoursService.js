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

function ensureMasterExists(masterId) {
  const m = db.prepare('SELECT id FROM masters WHERE id = ?').get(masterId);
  if (!m) {
    const err = new Error('Master not found');
    err.status = 404;
    throw err;
  }
}

/**
 * Возвращает все 7 дней недели для мастера с флагом has_override.
 * Если override нет — показываем глобальное значение (source='global').
 */
function listMasterWorkingHours(masterId) {
  ensureMasterExists(masterId);

  const globalRows = db
    .prepare(
      `SELECT day_of_week, open_time, close_time, is_day_off FROM working_hours`
    )
    .all();
  const globalMap = new Map(globalRows.map((r) => [r.day_of_week, r]));

  const masterRows = db
    .prepare(
      `SELECT day_of_week, open_time, close_time, is_day_off
       FROM master_working_hours WHERE master_id = ?`
    )
    .all(masterId);
  const masterMap = new Map(masterRows.map((r) => [r.day_of_week, r]));

  const result = [];
  for (let d = 0; d <= 6; d++) {
    const over = masterMap.get(d);
    const glob = globalMap.get(d);
    const r = over || glob;

    result.push({
      day_of_week: d,
      day_name: DAY_NAMES_RU[d],
      open_time: r ? r.open_time : null,
      close_time: r ? r.close_time : null,
      is_day_off: r ? !!r.is_day_off : true,
      source: over ? 'master' : 'global',
      has_override: !!over,
    });
  }
  return result;
}

/**
 * Upsert override для одного дня недели.
 *
 * @param {number} masterId
 * @param {number} dayOfWeek 0..6
 * @param {{ is_day_off: boolean, open_time?: string, close_time?: string }} patch
 * @throws 404 если мастер не найден, 400 если day_of_week вне 0..6
 */
function updateMasterWorkingHours(masterId, dayOfWeek, patch) {
  ensureMasterExists(masterId);

  if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
    const err = new Error('day_of_week must be an integer 0..6');
    err.status = 400;
    throw err;
  }

  // Для выходного разрешаем не присылать время — сохраняем существующее
  // или берём глобальное, чтобы не было NULL в NOT NULL колонках.
  const existing = db
    .prepare(
      `SELECT open_time, close_time FROM master_working_hours
       WHERE master_id = ? AND day_of_week = ?`
    )
    .get(masterId, dayOfWeek);

  const globalRow = db
    .prepare(`SELECT open_time, close_time FROM working_hours WHERE day_of_week = ?`)
    .get(dayOfWeek);

  const isDayOff = patch.is_day_off;
  let openTime;
  let closeTime;

  if (isDayOff) {
    openTime =
      patch.open_time ??
      existing?.open_time ??
      globalRow?.open_time ??
      '10:00';
    closeTime =
      patch.close_time ??
      existing?.close_time ??
      globalRow?.close_time ??
      '20:00';
  } else {
    openTime = patch.open_time;
    closeTime = patch.close_time;
  }

  db.prepare(
    `INSERT INTO master_working_hours
       (master_id, day_of_week, open_time, close_time, is_day_off)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(master_id, day_of_week) DO UPDATE SET
       open_time  = excluded.open_time,
       close_time = excluded.close_time,
       is_day_off = excluded.is_day_off`
  ).run(masterId, dayOfWeek, openTime, closeTime, isDayOff ? 1 : 0);

  return {
    master_id: String(masterId),
    day_of_week: dayOfWeek,
    day_name: DAY_NAMES_RU[dayOfWeek],
    open_time: openTime,
    close_time: closeTime,
    is_day_off: isDayOff,
    source: 'master',
    has_override: true,
  };
}

/**
 * Удаляет override для одного дня — мастер возвращается к глобальному расписанию.
 */
function resetMasterWorkingHours(masterId, dayOfWeek) {
  ensureMasterExists(masterId);

  if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
    const err = new Error('day_of_week must be an integer 0..6');
    err.status = 400;
    throw err;
  }

  const result = db
    .prepare(
      `DELETE FROM master_working_hours WHERE master_id = ? AND day_of_week = ?`
    )
    .run(masterId, dayOfWeek);

  return { deleted: result.changes > 0 };
}

module.exports = {
  listMasterWorkingHours,
  updateMasterWorkingHours,
  resetMasterWorkingHours,
  DAY_NAMES_RU,
};