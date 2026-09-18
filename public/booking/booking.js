/* Страница самоотмены клиентом. Читает id/token из URL, работает с /api/bookings/:id */

const API = '/api';

const params = new URLSearchParams(window.location.search);
const bookingId = params.get('id');
const token = params.get('token');

const els = {
  loading: document.getElementById('loading-screen'),
  error: document.getElementById('error-screen'),
  errorText: document.getElementById('error-text'),
  screen: document.getElementById('booking-screen'),
  info: document.getElementById('booking-info'),
  cancelBlock: document.getElementById('cancel-block'),
  cancelledBlock: document.getElementById('cancelled-block'),
  cancelBtn: document.getElementById('cancel-btn'),
};

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function formatDateRu(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const months = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
  const days = ['воскресенье','понедельник','вторник','среда','четверг','пятница','суббота'];
  return `${d} ${months[m - 1]} ${y}, ${days[date.getDay()]}`;
}

function show(section) {
  els.loading.classList.add('hidden');
  els.error.classList.add('hidden');
  els.screen.classList.add('hidden');
  section.classList.remove('hidden');
}

function showError(msg) {
  els.errorText.textContent = msg;
  show(els.error);
}

async function apiFetch(path, options = {}) {
  const res = await fetch(API + path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  let body = null;
  try { body = await res.json(); } catch {}
  if (!res.ok) {
    const err = new Error((body && body.error) || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return body;
}

function renderBooking(b) {
  const rows = [
    ['Услуга', b.service_name || '—'],
    ['Дата', formatDateRu(b.date)],
    ['Время', `${b.start_time} — ${b.end_time}`],
    ['Мастер', b.master_name || '—'],
    ['Имя', b.client_name],
  ];
  els.info.innerHTML = rows
    .map(([k, v]) =>
      `<div class="row"><span class="label">${escapeHtml(k)}</span>` +
      `<span>${escapeHtml(v)}</span></div>`)
    .join('');

  if (b.status === 'cancelled') {
    els.cancelBlock.classList.add('hidden');
    els.cancelledBlock.classList.remove('hidden');
  } else {
    els.cancelBlock.classList.remove('hidden');
    els.cancelledBlock.classList.add('hidden');
  }
}

async function loadBooking() {
  if (!bookingId || !token) {
    showError('В ссылке отсутствует id или token. Проверьте адрес.');
    return;
  }
  try {
    const booking = await apiFetch(
      `/bookings/${encodeURIComponent(bookingId)}?token=${encodeURIComponent(token)}`
    );
    renderBooking(booking);
    show(els.screen);
  } catch (e) {
    if (e.status === 404) showError('Запись не найдена. Возможно, ссылка устарела.');
    else if (e.status === 403) showError('Неверный токен доступа. Проверьте ссылку.');
    else showError(e.message || 'Не удалось загрузить запись.');
  }
}

els.cancelBtn.addEventListener('click', async () => {
  if (!confirm('Точно отменить запись? Это действие нельзя отменить.')) return;
  els.cancelBtn.disabled = true;
  els.cancelBtn.textContent = 'Отмена…';
  try {
    const updated = await apiFetch(
      `/bookings/${encodeURIComponent(bookingId)}?token=${encodeURIComponent(token)}`,
      { method: 'DELETE' }
    );
    renderBooking(updated);
  } catch (e) {
    if (e.status === 409) {
      renderBooking({ status: 'cancelled', date: '', start_time: '', end_time: '', client_name: '', service_name: '' });
      alert('Запись уже была отменена.');
    } else {
      alert(e.message || 'Не удалось отменить запись.');
    }
  } finally {
    els.cancelBtn.disabled = false;
    els.cancelBtn.textContent = 'Отменить запись';
  }
});

loadBooking();