/**
 * Диалоговый бот записи.
 * Команды: /start, /book, /my, /cancel, /help
 * Колбэки: b_svc:<id>, b_date:<iso>, b_time:<hh:mm>, b_new, b_cancel_flow, b_back_dates
 */

const db = require('../db');
const {
  sendToChat,
  answerCallbackQuery,
  editMessageText,
} = require('../services/telegramService');
const conversation = require('../services/telegramConversationService');
const slotService = require('../services/slotService');
const bookingService = require('../services/bookingService');
const { getWorkingHours } = require('../services/workingHoursService');

const STEP = {
  AWAIT_NAME: 'await_name',
  AWAIT_PHONE: 'await_phone',
};

const DAYS_SHORT = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

function pad(n) { return String(n).padStart(2, '0'); }

function formatDateShort(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return `${DAYS_SHORT[dt.getDay()]}, ${d} ${MONTHS_SHORT[m - 1]}`;
}

function formatDateRu(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const months = ['января','февраля','марта','апреля','мая','июня',
                  'июля','августа','сентября','октября','ноября','декабря'];
  return `${d} ${months[m - 1]} ${y} (${DAYS_SHORT[dt.getDay()]})`;
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function getActiveServices() {
  return db
    .prepare(`SELECT id, name, duration_minutes, price FROM services
              WHERE is_active = 1 ORDER BY id ASC`)
    .all();
}

function getUpcomingWorkingDates(limit = 7) {
  const out = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 0; i < 60 && out.length < limit; i++) {
    const cur = new Date(today);
    cur.setDate(cur.getDate() + i);
    const dow = cur.getDay();
    const wh = getWorkingHours(dow);
    if (!wh.is_day_off) {
      out.push(`${cur.getFullYear()}-${pad(cur.getMonth() + 1)}-${pad(cur.getDate())}`);
    }
  }
  return out;
}

function normalizePhone(raw) {
  if (!raw) return '';
  const s = String(raw).trim();
  if (s.startsWith('+')) return s;
  return `+${s}`;
}

function isPhoneLike(text) {
  const digits = String(text).replace(/\D/g, '');
  return digits.length >= 9 && digits.length <= 15;
}

function servicesKeyboard(services) {
  return {
    inline_keyboard: services.map((s) => [{
      text: `${s.name} — ${Number(s.price)}₽ (${s.duration_minutes} мин)`,
      callback_data: `b_svc:${s.id}`,
    }]),
  };
}

function datesKeyboard(dates) {
  const rows = [];
  for (let i = 0; i < dates.length; i += 2) {
    const row = [{
      text: formatDateShort(dates[i]),
      callback_data: `b_date:${dates[i]}`,
    }];
    if (dates[i + 1]) {
      row.push({
        text: formatDateShort(dates[i + 1]),
        callback_data: `b_date:${dates[i + 1]}`,
      });
    }
    rows.push(row);
  }
  rows.push([{ text: '← Отмена', callback_data: 'b_cancel_flow' }]);
  return { inline_keyboard: rows };
}

function timesKeyboard(slots) {
  const rows = [];
  for (let i = 0; i < slots.length; i += 3) {
    rows.push(slots.slice(i, i + 3).map((t) => ({
      text: t,
      callback_data: `b_time:${t}`,
    })));
  }
  rows.push([{ text: '← Назад к датам', callback_data: 'b_back_dates' }]);
  rows.push([{ text: 'Отмена', callback_data: 'b_cancel_flow' }]);
  return { inline_keyboard: rows };
}

function contactKeyboard() {
  return {
    keyboard: [[{ text: '📱 Поделиться контактом', request_contact: true }]],
    resize_keyboard: true,
    one_time_keyboard: true,
  };
}

function removeKeyboard() {
  return { remove_keyboard: true };
}

function menuKeyboard() {
  return {
    inline_keyboard: [[
      { text: '🆕 Записаться', callback_data: 'b_new' },
      { text: '📋 Мои записи', callback_data: 'b_my' },
    ]],
  };
}

async function handleStart(chatId) {
  conversation.clearState(chatId);
  await sendToChat(
    chatId,
    [
      '<b>✂️ Барбершоп — онлайн-запись</b>',
      '',
      'Здесь можно записаться на стрижку за 30 секунд.',
      '',
      'Команды:',
      '/book — новая запись',
      '/my — мои записи',
      '/help — справка',
    ].join('\n'),
    { reply_markup: menuKeyboard() }
  );
}

async function showHelp(chatId) {
  await sendToChat(
    chatId,
    [
      '<b>Справка</b>',
      '',
      '/book — начать запись',
      '/my — посмотреть мои записи',
      '/cancel — отменить текущий диалог',
      '',
      'В любой момент можно нажать «Отмена» под сообщением.',
    ].join('\n'),
    { reply_markup: menuKeyboard() }
  );
}

async function startBooking(chatId) {
  conversation.setState(chatId, null, {});
  const services = getActiveServices();
  if (!services.length) {
    return sendToChat(chatId, '😔 К сожалению, сейчас нет доступных услуг.');
  }
  await sendToChat(chatId, '<b>Шаг 1/4.</b> Выберите услугу:', {
    reply_markup: servicesKeyboard(services),
  });
}

async function handleCancel(chatId) {
  const st = conversation.getState(chatId);
  if (st) {
    conversation.clearState(chatId);
    return sendToChat(chatId, 'Диалог отменён. /book — начать заново.', {
      reply_markup: menuKeyboard(),
    });
  }
  await sendToChat(chatId, 'У вас нет активного диалога. Используйте /my для списка записей.');
}

async function cancelFlow(chatId, msgId) {
  conversation.clearState(chatId);
  if (msgId) {
    await editMessageText(chatId, msgId, '❌ Запись отменена. /book — начать заново.');
  } else {
    await sendToChat(chatId, '❌ Запись отменена.', { reply_markup: menuKeyboard() });
  }
}

async function onService(chatId, msgId, serviceId) {
  const svc = db
    .prepare(`SELECT id, name, duration_minutes, price FROM services
              WHERE id = ? AND is_active = 1`)
    .get(Number(serviceId));
  if (!svc) return answerCallbackQuery('__', 'Услуга недоступна');

  conversation.updateData(chatId, {
    service_id: svc.id,
    service_name: svc.name,
    service_price: Number(svc.price),
  });

  const dates = getUpcomingWorkingDates(7);
  if (!dates.length) {
    return editMessageText(chatId, msgId, '😔 Нет свободных дат в ближайшее время.');
  }

  await editMessageText(
    chatId,
    msgId,
    [
      `✅ Услуга: <b>${escapeHtml(svc.name)}</b> · ${Number(svc.price)}₽ · ${svc.duration_minutes} мин`,
      '',
      '<b>Шаг 2/4.</b> Выберите дату:',
    ].join('\n'),
    { reply_markup: datesKeyboard(dates) }
  );
}

async function onDate(chatId, msgId, iso) {
  const st = conversation.getState(chatId);
  if (!st || !st.data.service_id) {
    return editMessageText(chatId, msgId, 'Сессия устарела. /book — начать заново.');
  }

  conversation.updateData(chatId, { date: iso });

  let result;
  try {
    result = slotService.getAvailableSlots({
      serviceId: st.data.service_id,
      date: iso,
      masterId: null,
    });
  } catch (e) {
    return editMessageText(chatId, msgId, `⚠️ ${escapeHtml(e.message)}`);
  }

  if (!result.slots.length) {
    return editMessageText(
      chatId,
      msgId,
      `На <b>${escapeHtml(formatDateRu(iso))}</b> свободных слотов нет.\n\nВыберите другую дату:`,
      { reply_markup: datesKeyboard(getUpcomingWorkingDates(7)) }
    );
  }

  await editMessageText(
    chatId,
    msgId,
    [
      `✅ Услуга: <b>${escapeHtml(st.data.service_name)}</b>`,
      `✅ Дата: <b>${escapeHtml(formatDateRu(iso))}</b>`,
      '',
      '<b>Шаг 3/4.</b> Выберите время:',
    ].join('\n'),
    { reply_markup: timesKeyboard(result.slots) }
  );
}

async function onBackToDates(chatId, msgId) {
  const st = conversation.getState(chatId);
  if (!st || !st.data.service_id) {
    return editMessageText(chatId, msgId, 'Сессия устарела. /book — начать заново.');
  }
  conversation.updateData(chatId, { date: null, start_time: null });
  await editMessageText(
    chatId,
    msgId,
    [
      `✅ Услуга: <b>${escapeHtml(st.data.service_name)}</b>`,
      '',
      '<b>Шаг 2/4.</b> Выберите дату:',
    ].join('\n'),
    { reply_markup: datesKeyboard(getUpcomingWorkingDates(7)) }
  );
}

async function onTime(chatId, msgId, time) {
  const st = conversation.getState(chatId);
  if (!st || !st.data.service_id || !st.data.date) {
    return editMessageText(chatId, msgId, 'Сессия устарела. /book — начать заново.');
  }

  conversation.updateData(chatId, { start_time: time });
  conversation.setState(chatId, STEP.AWAIT_NAME, conversation.getState(chatId).data);

  await editMessageText(
    chatId,
    msgId,
    [
      `✅ Услуга: <b>${escapeHtml(st.data.service_name)}</b>`,
      `✅ Дата: <b>${escapeHtml(formatDateRu(st.data.date))}</b>`,
      `✅ Время: <b>${escapeHtml(time)}</b>`,
      '',
      '<b>Шаг 4/4.</b> Напишите ваше имя:',
    ].join('\n')
  );
}

async function handleName(chatId, text) {
  const name = text.trim().slice(0, 100);
  if (name.length < 2) {
    return sendToChat(chatId, 'Имя слишком короткое. Напишите, пожалуйста, ещё раз:');
  }

  const st = conversation.getState(chatId);
  const data = { ...(st?.data || {}), client_name: name };
  conversation.setState(chatId, STEP.AWAIT_PHONE, data);

  await sendToChat(
    chatId,
    [
      `Приятно познакомиться, <b>${escapeHtml(name)}</b>!`,
      '',
      'Нажмите кнопку ниже, чтобы поделиться телефоном, или напишите номер вручную:',
    ].join('\n'),
    { reply_markup: contactKeyboard() }
  );
}

async function handleContact(chatId, contact) {
  const st = conversation.getState(chatId);
  if (!st || st.step !== STEP.AWAIT_PHONE) {
    return sendToChat(chatId, 'Клавиатура скрыта.', { reply_markup: removeKeyboard() });
  }
  const phone = normalizePhone(contact.phone_number);
  await finalizeBooking(chatId, phone);
}

async function handlePhone(chatId, text) {
  const st = conversation.getState(chatId);
  if (!st || st.step !== STEP.AWAIT_PHONE) {
    return sendToChat(chatId, 'Используйте /book для новой записи.');
  }
  const phone = normalizePhone(text.trim());
  if (!isPhoneLike(phone)) {
    return sendToChat(chatId, 'Похоже, это не телефон. Напишите номер или нажмите «Поделиться контактом».');
  }
  await finalizeBooking(chatId, phone);
}

async function finalizeBooking(chatId, phone) {
  const st = conversation.getState(chatId);
  if (!st) return sendToChat(chatId, 'Сессия устарела. /book — начать заново.');

  const { service_id, date, start_time, client_name } = st.data;

  try {
    const result = bookingService.createBooking(
      {
        service_id,
        master_id: null,
        date,
        start_time,
        client_name,
        client_phone: phone,
      },
      { source: 'telegram' }
    );

    try {
      const linkToken = require('../services/telegramLinkService').ensureToken(result.id);
      if (linkToken) {
        require('../services/telegramLinkService').bindChat(result.id, chatId);
      }
    } catch (e) {
      console.error('[bot] bindChat failed:', e.message);
    }

    conversation.clearState(chatId);

    await sendToChat(
      chatId,
      [
        '<b>✅ Готово! Вы записаны.</b>',
        '',
        `📅 ${escapeHtml(formatDateRu(result.date))}`,
        `🕐 ${escapeHtml(result.start_time)}–${escapeHtml(result.end_time)}`,
        `💼 ${escapeHtml(st.data.service_name)}`,
        `👤 ${escapeHtml(client_name)}`,
        `📞 ${escapeHtml(phone)}`,
        '',
        'Мы пришлём сюда напоминание. Если планы изменятся — отмените запись в /my.',
      ].join('\n'),
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '❌ Отменить запись', callback_data: `cancel_client:${result.id}` }],
            [{ text: '📋 Мои записи', callback_data: 'b_my' }],
          ],
        },
      }
    );

    await sendToChat(chatId, 'Меню снизу убрано.', { reply_markup: removeKeyboard() });
  } catch (e) {
    const msg =
      e.status === 409
        ? 'Этот слот уже заняли. Начните заново: /book'
        : e.status === 400
          ? `Не получилось: ${e.message}. Начните заново: /book`
          : `Ошибка: ${e.message}`;
    await sendToChat(chatId, msg, { reply_markup: removeKeyboard() });
    conversation.clearState(chatId);
  }
}

async function showMyBookings(chatId) {
  const rows = db
    .prepare(
      `SELECT b.id, b.booking_date AS date, b.start_time, b.end_time, b.status,
              s.name AS service_name
       FROM bookings b
       LEFT JOIN services s ON s.id = b.service_id
       WHERE b.client_telegram_chat_id = ? AND b.status = 'confirmed'
       ORDER BY b.booking_date ASC, b.start_time ASC
       LIMIT 10`
    )
    .all(String(chatId));

  if (!rows.length) {
    return sendToChat(chatId, 'У вас нет активных записей.', {
      reply_markup: menuKeyboard(),
    });
  }

  const lines = rows.map(
    (r, i) =>
      `${i + 1}. <b>${escapeHtml(formatDateRu(r.date))}</b> в ${escapeHtml(r.start_time)}\n   ${escapeHtml(r.service_name || '—')}`
  );

  const inline = rows.map((r) => [
    { text: `❌ Отменить: ${r.date} ${r.start_time}`, callback_data: `cancel_client:${r.id}` },
  ]);

  await sendToChat(
    chatId,
    ['<b>📋 Ваши записи:</b>', '', ...lines].join('\n'),
    { reply_markup: { inline_keyboard: inline } }
  );
}

async function handleMessage(msg) {
  const chatId = msg.chat?.id;
  if (!chatId) return;

  if (msg.contact) return handleContact(chatId, msg.contact);

  const text = (msg.text || '').trim();
  if (!text) return;

  if (text.startsWith('/')) {
    const cmd = text.split(/\s+/)[0].split('@')[0];
    switch (cmd) {
      case '/start': return handleStart(chatId);
      case '/book': return startBooking(chatId);
      case '/my': return showMyBookings(chatId);
      case '/cancel': return handleCancel(chatId);
      case '/help': return showHelp(chatId);
      default: return sendToChat(chatId, 'Неизвестная команда. /help');
    }
  }

  const st = conversation.getState(chatId);
  if (st?.step === STEP.AWAIT_NAME) return handleName(chatId, text);
  if (st?.step === STEP.AWAIT_PHONE) return handlePhone(chatId, text);

  return sendToChat(
    chatId,
    'Выберите /book для новой записи или /my для списка ваших записей.',
    { reply_markup: menuKeyboard() }
  );
}

async function handleCallback(q) {
  const chatId = q.from?.id;
  const msgId = q.message?.message_id;
  const data = q.data || '';
  if (!chatId) return;

  await answerCallbackQuery(q.id);

  if (data === 'b_new') return startBooking(chatId);
  if (data === 'b_my') return showMyBookings(chatId);
  if (data === 'b_cancel_flow') return cancelFlow(chatId, msgId);
  if (data === 'b_back_dates') return onBackToDates(chatId, msgId);
  if (data.startsWith('b_svc:')) return onService(chatId, msgId, data.slice(6));
  if (data.startsWith('b_date:')) return onDate(chatId, msgId, data.slice(7));
  if (data.startsWith('b_time:')) return onTime(chatId, msgId, data.slice(7));

  return sendToChat(chatId, 'Неизвестное действие.');
}

module.exports = { handleMessage, handleCallback };