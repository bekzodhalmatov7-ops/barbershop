/* =========================================================
   Админка барбершопа (vanilla JS).
   - JWT хранится в localStorage.
   - При 401 — принудительный logout.
   - Вкладки: Записи, Услуги, Мастера, Рабочие часы, Портфолио.
   ========================================================= */

const API = '/api/admin';
const TOKEN_KEY = 'barbershop_admin_token';
const LOGIN_KEY = 'barbershop_admin_login';

const el = (id) => document.getElementById(id);
const els = {
  loginScreen: el('login-screen'),
  loginForm: el('login-form'),
  loginBtn: el('login-btn'),
  loginError: el('login-error'),
  app: el('app'),
  tabs: el('tabs'),
  adminLoginLabel: el('admin-login-label'),
  logoutBtn: el('logout-btn'),

  panels: {
    bookings: el('panel-bookings'),
    services: el('panel-services'),
    masters: el('panel-masters'),
    hours: el('panel-hours'),
    portfolio: el('panel-portfolio'),
  },

  bookingsBody: el('bookings-body'),
  filterDate: el('filter-date'),
  filterStatus: el('filter-status'),
  filterPhone: el('filter-phone'),
  filterApply: el('filter-apply'),
  filterReset: el('filter-reset'),
  newBookingBtn: el('new-booking-btn'),

  servicesBody: el('services-body'),
  newServiceBtn: el('new-service-btn'),

  mastersBody: el('masters-body'),
  newMasterBtn: el('new-master-btn'),

  hoursList: el('hours-list'),

  portfolioBody: el('portfolio-body'),
  newPortfolioBtn: el('new-portfolio-btn'),

  modalBackdrop: el('modal-backdrop'),
  modalTitle: el('modal-title'),
  modalBody: el('modal-body'),
  modalFoot: el('modal-foot'),
  modalClose: el('modal-close'),
  toast: el('toast'),
};

const state = {
  token: localStorage.getItem(TOKEN_KEY),
  login: localStorage.getItem(LOGIN_KEY),
  activeTab: 'bookings',
  services: [],
  masters: [],
};

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function showToast(msg, kind = '') {
  els.toast.textContent = msg;
  els.toast.className = `toast ${kind}`;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => els.toast.classList.add('hidden'), 3000);
}

async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (state.token) headers.Authorization = `Bearer ${state.token}`;

  const res = await fetch(API + path, { ...options, headers });

  if (res.status === 401) {
    handleLogout();
    throw new Error('Сессия истекла, войдите снова');
  }

  let body = null;
  try { body = await res.json(); } catch { /* ignore */ }

  if (!res.ok) {
    const err = new Error((body && body.error) || `HTTP ${res.status}`);
    err.status = res.status;
    err.details = body && body.details;
    throw err;
  }
  return body;
}

function openModal(title, bodyHtml, footButtons) {
  els.modalTitle.textContent = title;
  els.modalBody.innerHTML = bodyHtml;
  els.modalFoot.innerHTML = '';
  footButtons.forEach((b) => {
    const btn = document.createElement('button');
    btn.className = `btn ${b.className || 'btn-secondary'}`;
    btn.textContent = b.text;
    btn.addEventListener('click', () => b.onClick(btn));
    els.modalFoot.appendChild(btn);
  });
  els.modalBackdrop.classList.remove('hidden');
}

function closeModal() {
  els.modalBackdrop.classList.add('hidden');
  els.modalBody.innerHTML = '';
  els.modalFoot.innerHTML = '';
}

els.modalClose.addEventListener('click', closeModal);
els.modalBackdrop.addEventListener('click', (e) => {
  if (e.target === els.modalBackdrop) closeModal();
});

// ---------- Аутентификация ----------

function showLogin() {
  els.loginScreen.classList.remove('hidden');
  els.app.classList.add('hidden');
}

function showApp() {
  els.loginScreen.classList.add('hidden');
  els.app.classList.remove('hidden');
  els.adminLoginLabel.textContent = state.login || '';
  switchTab(state.activeTab);
}

function handleLogout() {
  state.token = null;
  state.login = null;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(LOGIN_KEY);
  showLogin();
}

els.loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  els.loginError.classList.add('hidden');
  els.loginBtn.disabled = true;
  els.loginBtn.textContent = 'Вход…';

  const fd = new FormData(els.loginForm);
  try {
    const data = await api('/login', {
      method: 'POST',
      body: JSON.stringify({
        login: fd.get('login')?.trim(),
        password: fd.get('password'),
      }),
    });
    state.token = data.token;
    state.login = data.admin.login;
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(LOGIN_KEY, data.admin.login);
    els.loginForm.reset();
    showApp();
  } catch (err) {
    els.loginError.textContent = err.message || 'Ошибка входа';
    els.loginError.classList.remove('hidden');
  } finally {
    els.loginBtn.disabled = false;
    els.loginBtn.textContent = 'Войти';
  }
});

els.logoutBtn.addEventListener('click', handleLogout);

// ---------- Табы ----------

els.tabs.addEventListener('click', (e) => {
  const btn = e.target.closest('.tab');
  if (!btn) return;
  switchTab(btn.dataset.tab);
});

function switchTab(tab) {
  state.activeTab = tab;
  els.tabs.querySelectorAll('.tab').forEach((b) =>
    b.classList.toggle('active', b.dataset.tab === tab));

  Object.entries(els.panels).forEach(([key, panel]) =>
    panel.classList.toggle('hidden', key !== tab));

  if (tab === 'bookings') loadBookings();
  if (tab === 'services') loadServices();
  if (tab === 'masters') loadMasters();
  if (tab === 'hours') loadHours();
  if (tab === 'portfolio') loadPortfolioAdmin();
}

// ============ ЗАПИСИ ============

async function loadBookings() {
  els.bookingsBody.innerHTML = '<tr><td colspan="8" class="muted">Загрузка…</td></tr>';
  const params = new URLSearchParams();
  if (els.filterDate.value) params.set('date', els.filterDate.value);
  if (els.filterStatus.value) params.set('status', els.filterStatus.value);
  if (els.filterPhone.value.trim()) params.set('phone', els.filterPhone.value.trim());
  const qs = params.toString();

  try {
    const bookings = await api(`/bookings${qs ? '?' + qs : ''}`);
    renderBookings(bookings);
  } catch (err) {
    els.bookingsBody.innerHTML =
      `<tr><td colspan="8" class="form-error">${escapeHtml(err.message)}</td></tr>`;
  }
}

function renderBookings(bookings) {
  if (!bookings.length) {
    els.bookingsBody.innerHTML = '<tr><td colspan="8" class="muted">Записей не найдено.</td></tr>';
    return;
  }

  const statusLabel = (s) =>
    s === 'pending' ? '⏳ Ожидает'
      : s === 'confirmed' ? 'Подтверждена'
      : 'Отменена';

  els.bookingsBody.innerHTML = bookings.map((b) => `
    <tr>
      <td>${escapeHtml(b.date)}</td>
      <td>${escapeHtml(b.start_time)}–${escapeHtml(b.end_time)}</td>
      <td>${escapeHtml(b.client_name)}</td>
      <td>${escapeHtml(b.client_phone)}</td>
      <td>${escapeHtml(b.service_name || '—')}</td>
      <td>${escapeHtml(b.master_name || '—')}</td>
      <td><span class="status status-${b.status}">${statusLabel(b.status)}</span></td>
      <td>
        <div class="actions-cell">
          ${b.status === 'pending' ? `
            <button class="btn btn-primary btn-sm" data-action="confirm" data-id="${b.id}">Подтвердить</button>
            <button class="btn btn-danger btn-sm" data-action="cancel" data-id="${b.id}">Отклонить</button>
          ` : `
            <button class="btn btn-secondary btn-sm" data-action="reschedule" data-id="${b.id}">Перенести</button>
            ${b.status === 'confirmed'
              ? `<button class="btn btn-danger btn-sm" data-action="cancel" data-id="${b.id}">Отменить</button>`
              : `<button class="btn btn-secondary btn-sm" data-action="confirm" data-id="${b.id}">Восстановить</button>`}
          `}
        </div>
      </td>
    </tr>
  `).join('');

  els.bookingsBody.querySelectorAll('button[data-action]').forEach((btn) => {
    btn.addEventListener('click', () => onBookingAction(btn.dataset.action, btn.dataset.id));
  });
}

async function onBookingAction(action, id) {
  if (action === 'cancel' || action === 'confirm') {
    const status = action === 'cancel' ? 'cancelled' : 'confirmed';
    try {
      await api(`/bookings/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      showToast(status === 'cancelled' ? 'Запись отменена' : 'Запись подтверждена', 'success');
      loadBookings();
    } catch (err) {
      showToast(err.message, 'error');
    }
    return;
  }

  if (action === 'reschedule') {
    openRescheduleModal(id);
  }
}

async function openRescheduleModal(id) {
  let booking = null;
  try {
    const all = await api('/bookings');
    booking = all.find((b) => String(b.id) === String(id));
  } catch (err) {
    showToast(err.message, 'error');
    return;
  }
  if (!booking) {
    showToast('Запись не найдена', 'error');
    return;
  }

  openModal(
    `Перенести запись #${id}`,
    `
      <div class="muted" style="margin-bottom:12px">
        ${escapeHtml(booking.client_name)} · ${escapeHtml(booking.service_name || '')}
      </div>
      <label class="field">
        <span>Дата</span>
        <input type="date" id="m-date" value="${escapeHtml(booking.date)}" />
      </label>
      <label class="field">
        <span>Время</span>
        <input type="time" id="m-time" value="${escapeHtml(booking.start_time)}" step="900" />
      </label>
      <div class="muted">Или выберите слот:</div>
      <div id="m-slots" class="slots" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(70px,1fr));gap:6px;margin-top:8px"></div>
    `,
    [
      { text: 'Отмена', className: 'btn-secondary', onClick: closeModal },
      {
        text: 'Сохранить',
        className: 'btn-primary',
        onClick: async () => {
          const date = el('m-date').value;
          const time = el('m-time').value;
          if (!date || !time) {
            showToast('Укажите дату и время', 'error');
            return;
          }
          try {
            await api(`/bookings/${id}`, {
              method: 'PATCH',
              body: JSON.stringify({ date, start_time: time }),
            });
            closeModal();
            showToast('Запись перенесена', 'success');
            loadBookings();
          } catch (err) {
            showToast(err.message, 'error');
          }
        },
      },
    ]
  );

  const slotsBox = el('m-slots');
  const reloadSlots = async () => {
    const date = el('m-date').value;
    if (!date) { slotsBox.innerHTML = ''; return; }
    slotsBox.innerHTML = '<span class="muted">Загрузка…</span>';
    try {
      const params = new URLSearchParams({
        service_id: booking.service_id,
        date,
      });
      if (booking.master_id) params.set('master_id', booking.master_id);
      const res = await fetch(`/api/slots?${params.toString()}`);
      const data = await res.json();
      if (!data.slots || !data.slots.length) {
        slotsBox.innerHTML = '<span class="muted">Нет слотов</span>';
        return;
      }
      slotsBox.innerHTML = data.slots.map((t) =>
        `<button type="button" class="btn btn-secondary btn-sm" data-slot="${escapeHtml(t)}">${escapeHtml(t)}</button>`
      ).join('');
      slotsBox.querySelectorAll('button[data-slot]').forEach((b) => {
        b.addEventListener('click', () => {
          el('m-time').value = b.dataset.slot;
        });
      });
    } catch {
      slotsBox.innerHTML = '<span class="muted">Ошибка загрузки</span>';
    }
  };
  el('m-date').addEventListener('change', reloadSlots);
  reloadSlots();
}

els.filterApply.addEventListener('click', loadBookings);
els.filterReset.addEventListener('click', () => {
  els.filterDate.value = '';
  els.filterStatus.value = '';
  els.filterPhone.value = '';
  loadBookings();
});

els.newBookingBtn.addEventListener('click', async () => {
  await ensureServicesAndMasters();
  openNewBookingModal();
});

async function ensureServicesAndMasters() {
  if (!state.services.length) {
    try { state.services = await api('/services'); } catch { state.services = []; }
  }
  if (!state.masters.length) {
    try { state.masters = await api('/masters'); } catch { state.masters = []; }
  }
}

function openNewBookingModal() {
  const serviceOptions = state.services
    .filter((s) => s.is_active)
    .map((s) => `<option value="${s.id}">${escapeHtml(s.name)} (${s.duration_minutes} мин)</option>`)
    .join('');
  const masterOptions =
    '<option value="">— без мастера —</option>' +
    state.masters
      .filter((m) => m.is_active)
      .map((m) => `<option value="${m.id}">${escapeHtml(m.name)}</option>`)
      .join('');

  openModal(
    'Новая запись',
    `
      <label class="field"><span>Услуга *</span>
        <select id="n-service">${serviceOptions}</select></label>
      <label class="field"><span>Мастер</span>
        <select id="n-master">${masterOptions}</select></label>
      <label class="field"><span>Дата *</span>
        <input type="date" id="n-date" /></label>
      <label class="field"><span>Время *</span>
        <input type="time" id="n-time" step="900" /></label>
      <label class="field"><span>Имя клиента *</span>
        <input type="text" id="n-name" maxlength="100" /></label>
      <label class="field"><span>Телефон *</span>
        <input type="tel" id="n-phone" maxlength="20" placeholder="+998 90 123 45 67" /></label>
      <label class="field"><span>Email</span>
        <input type="email" id="n-email" maxlength="100" /></label>
      <label class="field"><span>Комментарий</span>
        <textarea id="n-comment" rows="2" maxlength="1000"></textarea></label>
    `,
    [
      { text: 'Отмена', className: 'btn-secondary', onClick: closeModal },
      {
        text: 'Создать',
        className: 'btn-primary',
        onClick: async (btn) => {
          btn.disabled = true;
          try {
            const payload = {
              service_id: el('n-service').value,
              master_id: el('n-master').value || null,
              date: el('n-date').value,
              start_time: el('n-time').value,
              client_name: el('n-name').value.trim(),
              client_phone: el('n-phone').value.trim(),
              client_email: el('n-email').value.trim() || '',
              comment: el('n-comment').value.trim() || '',
            };
            await api('/bookings', { method: 'POST', body: JSON.stringify(payload) });
            closeModal();
            showToast('Запись создана', 'success');
            loadBookings();
          } catch (err) {
            showToast(err.message, 'error');
          } finally {
            btn.disabled = false;
          }
        },
      },
    ]
  );
}

// ============ УСЛУГИ ============

async function loadServices() {
  els.servicesBody.innerHTML = '<tr><td colspan="6" class="muted">Загрузка…</td></tr>';
  try {
    const services = await api('/services');
    state.services = services;
    renderServices(services);
  } catch (err) {
    els.servicesBody.innerHTML =
      `<tr><td colspan="6" class="form-error">${escapeHtml(err.message)}</td></tr>`;
  }
}

function renderServices(services) {
  if (!services.length) {
    els.servicesBody.innerHTML = '<tr><td colspan="6" class="muted">Нет услуг.</td></tr>';
    return;
  }
  els.servicesBody.innerHTML = services.map((s) => `
    <tr>
      <td>${escapeHtml(s.id)}</td>
      <td>${escapeHtml(s.name)}</td>
      <td>${s.duration_minutes} мин</td>
      <td>${s.price}</td>
      <td>${s.is_active ? '✅' : '—'}</td>
      <td>
        <div class="actions-cell">
          <button class="btn btn-secondary btn-sm" data-action="edit" data-id="${s.id}">Изменить</button>
          <button class="btn btn-danger btn-sm" data-action="delete" data-id="${s.id}">Удалить</button>
        </div>
      </td>
    </tr>
  `).join('');

  els.servicesBody.querySelectorAll('button[data-action]').forEach((btn) => {
    btn.addEventListener('click', () => onServiceAction(btn.dataset.action, btn.dataset.id, services));
  });
}

function onServiceAction(action, id, services) {
  const svc = services.find((s) => String(s.id) === String(id));
  if (!svc) return;

  if (action === 'edit') openServiceModal(svc);
  if (action === 'delete') {
    openModal(
      'Удалить услугу?',
      `<p>Услуга <strong>${escapeHtml(svc.name)}</strong> будет деактивирована (мягкое удаление). Существующие записи сохранятся.</p>`,
      [
        { text: 'Отмена', className: 'btn-secondary', onClick: closeModal },
        {
          text: 'Удалить',
          className: 'btn-danger',
          onClick: async (btn) => {
            btn.disabled = true;
            try {
              await api(`/services/${id}`, { method: 'DELETE' });
              closeModal();
              showToast('Услуга деактивирована', 'success');
              loadServices();
            } catch (err) {
              showToast(err.message, 'error');
            } finally {
              btn.disabled = false;
            }
          },
        },
      ]
    );
  }
}

function openServiceModal(svc = null) {
  const isNew = !svc;
  openModal(
    isNew ? 'Новая услуга' : `Изменить услугу #${svc.id}`,
    `
      <label class="field"><span>Название *</span>
        <input type="text" id="s-name" maxlength="100" value="${escapeHtml(svc?.name || '')}" /></label>
      <label class="field"><span>Длительность (мин) *</span>
        <input type="number" id="s-duration" min="1" max="1440" value="${svc?.duration_minutes ?? 30}" /></label>
      <label class="field"><span>Цена *</span>
        <input type="number" id="s-price" min="0" step="0.01" value="${svc?.price ?? 0}" /></label>
      <label class="field">
        <input type="checkbox" id="s-active" ${(!svc || svc.is_active) ? 'checked' : ''} />
        <span style="display:inline">Активна</span>
      </label>
    `,
    [
      { text: 'Отмена', className: 'btn-secondary', onClick: closeModal },
      {
        text: isNew ? 'Создать' : 'Сохранить',
        className: 'btn-primary',
        onClick: async (btn) => {
          btn.disabled = true;
          try {
            const payload = {
              name: el('s-name').value.trim(),
              duration_minutes: Number(el('s-duration').value),
              price: Number(el('s-price').value),
              is_active: el('s-active').checked,
            };
            if (isNew) {
              await api('/services', { method: 'POST', body: JSON.stringify(payload) });
            } else {
              await api(`/services/${svc.id}`, { method: 'PUT', body: JSON.stringify(payload) });
            }
            closeModal();
            showToast(isNew ? 'Услуга создана' : 'Услуга обновлена', 'success');
            loadServices();
          } catch (err) {
            showToast(err.message, 'error');
          } finally {
            btn.disabled = false;
          }
        },
      },
    ]
  );
}

els.newServiceBtn.addEventListener('click', () => openServiceModal(null));

// ============ МАСТЕРА ============

async function loadMasters() {
  els.mastersBody.innerHTML = '<tr><td colspan="4" class="muted">Загрузка…</td></tr>';
  try {
    const masters = await api('/masters');
    state.masters = masters;
    renderMasters(masters);
  } catch (err) {
    els.mastersBody.innerHTML =
      `<tr><td colspan="4" class="form-error">${escapeHtml(err.message)}</td></tr>`;
  }
}

function renderMasters(masters) {
  if (!masters.length) {
    els.mastersBody.innerHTML = '<tr><td colspan="4" class="muted">Нет мастеров.</td></tr>';
    return;
  }
  els.mastersBody.innerHTML = masters.map((m) => `
    <tr>
      <td>${escapeHtml(m.id)}</td>
      <td>${escapeHtml(m.name)}</td>
      <td>${m.is_active ? '✅' : '—'}</td>
      <td>
        <div class="actions-cell">
          <button class="btn btn-secondary btn-sm" data-action="schedule" data-id="${m.id}">Расписание</button>
          <button class="btn btn-secondary btn-sm" data-action="edit" data-id="${m.id}">Изменить</button>
          <button class="btn btn-danger btn-sm" data-action="delete" data-id="${m.id}">Удалить</button>
        </div>
      </td>
    </tr>
  `).join('');

  els.mastersBody.querySelectorAll('button[data-action]').forEach((btn) => {
    btn.addEventListener('click', () => onMasterAction(btn.dataset.action, btn.dataset.id, masters));
  });
}

function onMasterAction(action, id, masters) {
  const m = masters.find((x) => String(x.id) === String(id));
  if (!m) return;

  if (action === 'edit') openMasterModal(m);
  if (action === 'schedule') openMasterScheduleModal(m);
  if (action === 'delete') {
    openModal(
      'Удалить мастера?',
      `<p>Мастер <strong>${escapeHtml(m.name)}</strong> будет деактивирован (мягкое удаление).</p>`,
      [
        { text: 'Отмена', className: 'btn-secondary', onClick: closeModal },
        {
          text: 'Удалить',
          className: 'btn-danger',
          onClick: async (btn) => {
            btn.disabled = true;
            try {
              await api(`/masters/${id}`, { method: 'DELETE' });
              closeModal();
              showToast('Мастер деактивирован', 'success');
              loadMasters();
            } catch (err) {
              showToast(err.message, 'error');
            } finally {
              btn.disabled = false;
            }
          },
        },
      ]
    );
  }
}

async function openMasterScheduleModal(master) {
  openModal(
    `Расписание — ${master.name}`,
    '<p class="muted">Загрузка…</p>',
    [{ text: 'Закрыть', className: 'btn-secondary', onClick: closeModal }]
  );

  let days;
  try {
    days = await api(`/masters/${master.id}/working-hours`);
  } catch (err) {
    els.modalBody.innerHTML = `<p class="form-error">${escapeHtml(err.message)}</p>`;
    return;
  }

  renderMasterSchedule(master, days);
}

function renderMasterSchedule(master, days) {
  const rowsHtml = days.map((h) => `
    <div class="hours-row" data-day="${h.day_of_week}">
      <div class="day-name">
        ${escapeHtml(h.day_name)}
        ${h.has_override
          ? '<span class="badge-override">override</span>'
          : '<span class="badge-global">глобальное</span>'}
      </div>
      <input type="time" class="h-open" value="${escapeHtml(h.open_time || '')}" step="900" />
      <input type="time" class="h-close" value="${escapeHtml(h.close_time || '')}" step="900" />
      <label class="dayoff-label">
        <input type="checkbox" class="h-dayoff" ${h.is_day_off ? 'checked' : ''} />
        выходной
      </label>
      <div class="hours-actions">
        <button class="btn btn-primary btn-sm h-save">Сохранить</button>
        <button class="btn btn-secondary btn-sm h-reset" ${h.has_override ? '' : 'disabled'}>Сбросить</button>
      </div>
    </div>
  `).join('');

  els.modalBody.innerHTML = `<div class="hours-list hours-list-modal">${rowsHtml}</div>`;

  els.modalBody.querySelectorAll('.hours-row').forEach((row) => {
    const day = Number(row.dataset.day);
    const openInp = row.querySelector('.h-open');
    const closeInp = row.querySelector('.h-close');
    const dayoffInp = row.querySelector('.h-dayoff');
    const saveBtn = row.querySelector('.h-save');
    const resetBtn = row.querySelector('.h-reset');

    const syncDisabled = () => {
      openInp.disabled = dayoffInp.checked;
      closeInp.disabled = dayoffInp.checked;
    };
    syncDisabled();
    dayoffInp.addEventListener('change', syncDisabled);

    saveBtn.addEventListener('click', async () => {
      const isDayOff = dayoffInp.checked;
      const payload = { is_day_off: isDayOff };
      if (!isDayOff) {
        if (!openInp.value || !closeInp.value) {
          showToast('Укажите время открытия и закрытия', 'error');
          return;
        }
        if (openInp.value >= closeInp.value) {
          showToast('Время закрытия должно быть больше открытия', 'error');
          return;
        }
        payload.open_time = openInp.value;
        payload.close_time = closeInp.value;
      }
      saveBtn.disabled = true;
      try {
        await api(`/masters/${master.id}/working-hours/${day}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        showToast('Расписание сохранено', 'success');
        const fresh = await api(`/masters/${master.id}/working-hours`);
        renderMasterSchedule(master, fresh);
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        saveBtn.disabled = false;
      }
    });

    resetBtn.addEventListener('click', async () => {
      if (!confirm('Сбросить расписание этого дня к глобальному?')) return;
      resetBtn.disabled = true;
      try {
        await api(`/masters/${master.id}/working-hours/${day}`, { method: 'DELETE' });
        showToast('Сброшено к глобальному', 'success');
        const fresh = await api(`/masters/${master.id}/working-hours`);
        renderMasterSchedule(master, fresh);
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        resetBtn.disabled = false;
      }
    });
  });
}

function openMasterModal(master = null) {
  const isNew = !master;
  openModal(
    isNew ? 'Новый мастер' : `Изменить мастера #${master.id}`,
    `
      <label class="field"><span>Имя *</span>
        <input type="text" id="m-name" maxlength="100" value="${escapeHtml(master?.name || '')}" /></label>
      <label class="field">
        <input type="checkbox" id="m-active" ${(!master || master.is_active) ? 'checked' : ''} />
        <span style="display:inline">Активен</span>
      </label>
    `,
    [
      { text: 'Отмена', className: 'btn-secondary', onClick: closeModal },
      {
        text: isNew ? 'Создать' : 'Сохранить',
        className: 'btn-primary',
        onClick: async (btn) => {
          btn.disabled = true;
          try {
            const payload = {
              name: el('m-name').value.trim(),
              is_active: el('m-active').checked,
            };
            if (isNew) {
              await api('/masters', { method: 'POST', body: JSON.stringify(payload) });
            } else {
              await api(`/masters/${master.id}`, { method: 'PUT', body: JSON.stringify(payload) });
            }
            closeModal();
            showToast(isNew ? 'Мастер создан' : 'Мастер обновлён', 'success');
            loadMasters();
          } catch (err) {
            showToast(err.message, 'error');
          } finally {
            btn.disabled = false;
          }
        },
      },
    ]
  );
}

els.newMasterBtn.addEventListener('click', () => openMasterModal(null));

// ============ РАБОЧИЕ ЧАСЫ ============

async function loadHours() {
  els.hoursList.innerHTML = '<p class="muted">Загрузка…</p>';
  try {
    const hours = await api('/working-hours');
    renderHours(hours);
  } catch (err) {
    els.hoursList.innerHTML = `<p class="form-error">${escapeHtml(err.message)}</p>`;
  }
}

function renderHours(hours) {
  els.hoursList.innerHTML = hours.map((h) => `
    <div class="hours-row" data-day="${h.day_of_week}">
      <div class="day-name">${escapeHtml(h.day_name)}</div>
      <input type="time" class="h-open" value="${escapeHtml(h.open_time || '')}" step="900" />
      <input type="time" class="h-close" value="${escapeHtml(h.close_time || '')}" step="900" />
      <label class="dayoff-label">
        <input type="checkbox" class="h-dayoff" ${h.is_day_off ? 'checked' : ''} />
        выходной
      </label>
      <button class="btn btn-primary btn-sm h-save">Сохранить</button>
    </div>
  `).join('');

  els.hoursList.querySelectorAll('.hours-row').forEach((row) => {
    const day = Number(row.dataset.day);
    const openInp = row.querySelector('.h-open');
    const closeInp = row.querySelector('.h-close');
    const dayoffInp = row.querySelector('.h-dayoff');
    const saveBtn = row.querySelector('.h-save');

    dayoffInp.addEventListener('change', () => {
      openInp.disabled = dayoffInp.checked;
      closeInp.disabled = dayoffInp.checked;
    });
    openInp.disabled = dayoffInp.checked;
    closeInp.disabled = dayoffInp.checked;

    saveBtn.addEventListener('click', async () => {
      const isDayOff = dayoffInp.checked;
      const payload = { is_day_off: isDayOff };
      if (!isDayOff) {
        if (!openInp.value || !closeInp.value) {
          showToast('Укажите время открытия и закрытия', 'error');
          return;
        }
        if (openInp.value >= closeInp.value) {
          showToast('Время закрытия должно быть больше открытия', 'error');
          return;
        }
        payload.open_time = openInp.value;
        payload.close_time = closeInp.value;
      }
      saveBtn.disabled = true;
      try {
        await api(`/working-hours/${day}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        showToast('Сохранено', 'success');
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        saveBtn.disabled = false;
      }
    });
  });
}

// ============ ПОРТФОЛИО ============

async function loadPortfolioAdmin() {
  els.portfolioBody.innerHTML = '<tr><td colspan="7" class="muted">Загрузка…</td></tr>';
  try {
    const items = await api('/portfolio');
    renderPortfolioAdmin(items);
  } catch (err) {
    els.portfolioBody.innerHTML =
      `<tr><td colspan="7" class="form-error">${escapeHtml(err.message)}</td></tr>`;
  }
}

function renderPortfolioAdmin(items) {
  if (!items.length) {
    els.portfolioBody.innerHTML = '<tr><td colspan="7" class="muted">Нет работ.</td></tr>';
    return;
  }
  els.portfolioBody.innerHTML = items.map((p) => `
    <tr>
      <td>
        <img src="${escapeHtml(p.image_url_thumb || p.image_url)}" alt="" class="thumb" />
      </td>
      <td>${escapeHtml(p.title)}</td>
      <td>${(p.tags || []).map((t) => `<span class="mini-tag">${escapeHtml(t)}</span>`).join(' ')}</td>
      <td>${p.price_hint != null ? p.price_hint : '—'}</td>
      <td>${p.sort_order}</td>
      <td>${p.is_active ? '✅' : '—'}</td>
      <td>
        <div class="actions-cell">
          <button class="btn btn-secondary btn-sm" data-action="edit" data-id="${p.id}">Изменить</button>
          <button class="btn btn-danger btn-sm" data-action="delete" data-id="${p.id}">Удалить</button>
        </div>
      </td>
    </tr>
  `).join('');

  els.portfolioBody.querySelectorAll('button[data-action]').forEach((btn) => {
    btn.addEventListener('click', () => onPortfolioAction(btn.dataset.action, btn.dataset.id, items));
  });
}

function onPortfolioAction(action, id, items) {
  const item = items.find((p) => String(p.id) === String(id));
  if (!item) return;

  if (action === 'edit') openPortfolioModalAdmin(item);
  if (action === 'delete') {
    openModal(
      'Удалить работу?',
      `<p>Работа <strong>${escapeHtml(item.title)}</strong> будет деактивирована.</p>`,
      [
        { text: 'Отмена', className: 'btn-secondary', onClick: closeModal },
        {
          text: 'Удалить',
          className: 'btn-danger',
          onClick: async (btn) => {
            btn.disabled = true;
            try {
              await api(`/portfolio/${id}`, { method: 'DELETE' });
              closeModal();
              showToast('Работа деактивирована', 'success');
              loadPortfolioAdmin();
            } catch (err) {
              showToast(err.message, 'error');
            } finally {
              btn.disabled = false;
            }
          },
        },
      ]
    );
  }
}

function openPortfolioModalAdmin(item = null) {
  const isNew = !item;
  openModal(
    isNew ? 'Новая работа' : `Изменить работу #${item.id}`,
    `
      <label class="field"><span>Название *</span>
        <input type="text" id="pf-title" maxlength="120" value="${escapeHtml(item?.title || '')}" /></label>
      <label class="field"><span>URL изображения *</span>
        <input type="url" id="pf-image" maxlength="500" placeholder="https://images.unsplash.com/..." value="${escapeHtml(item?.image_url || '')}" /></label>
      <label class="field"><span>Описание</span>
        <textarea id="pf-desc" rows="3" maxlength="2000">${escapeHtml(item?.description || '')}</textarea></label>
      <label class="field"><span>Теги (через запятую)</span>
        <input type="text" id="pf-tags" placeholder="фейд,классика,короткие" value="${escapeHtml((item?.tags || []).join(','))}" /></label>
      <label class="field"><span>Цена от (₽)</span>
        <input type="number" id="pf-price" min="0" step="1" value="${item?.price_hint ?? ''}" /></label>
      <label class="field"><span>Порядок сортировки</span>
        <input type="number" id="pf-sort" value="${item?.sort_order ?? 0}" /></label>
      <label class="field">
        <input type="checkbox" id="pf-active" ${(!item || item.is_active) ? 'checked' : ''} />
        <span style="display:inline">Активна</span>
      </label>
    `,
    [
      { text: 'Отмена', className: 'btn-secondary', onClick: closeModal },
      {
        text: isNew ? 'Создать' : 'Сохранить',
        className: 'btn-primary',
        onClick: async (btn) => {
          btn.disabled = true;
          try {
            const payload = {
              title: el('pf-title').value.trim(),
              image_url: el('pf-image').value.trim(),
              description: el('pf-desc').value.trim(),
              tags: el('pf-tags').value.trim(),
              price_hint: el('pf-price').value === '' ? null : Number(el('pf-price').value),
              sort_order: Number(el('pf-sort').value) || 0,
              is_active: el('pf-active').checked,
            };
            if (isNew) {
              await api('/portfolio', { method: 'POST', body: JSON.stringify(payload) });
            } else {
              await api(`/portfolio/${item.id}`, { method: 'PUT', body: JSON.stringify(payload) });
            }
            closeModal();
            showToast(isNew ? 'Работа создана' : 'Работа обновлена', 'success');
            loadPortfolioAdmin();
          } catch (err) {
            showToast(err.message, 'error');
          } finally {
            btn.disabled = false;
          }
        },
      },
    ]
  );
}

els.newPortfolioBtn.addEventListener('click', () => openPortfolioModalAdmin(null));

// ============ TELEGRAM TEST ============

const telegramTestBtn = el('telegram-test-btn');
if (telegramTestBtn) {
  telegramTestBtn.addEventListener('click', async () => {
    telegramTestBtn.disabled = true;
    try {
      await api('/telegram/test', { method: 'POST' });
      showToast('Тестовое сообщение отправлено', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      telegramTestBtn.disabled = false;
    }
  });
}

// ============ Инициализация ============

(function init() {
  if (state.token && state.login) {
    showApp();
  } else {
    showLogin();
  }
})();