/* =========================================================
   Барбершоп — клиентская SPA
   ========================================================= */

const API = '/api';

const state = {
  step: 1,
  services: [],
  service: null,
  date: null,
  slots: [],
  startTime: null,
  booking: null,

  portfolio: [],
  portfolioTag: null,
  portfolioSelected: null,
  portfolioLoadToken: 0,
};

const els = {
  steps: document.querySelectorAll('.step'),
  screens: {
    1: document.getElementById('screen-1'),
    2: document.getElementById('screen-2'),
    3: document.getElementById('screen-3'),
    4: document.getElementById('screen-4'),
  },
  servicesList: document.getElementById('services-list'),
  selectedServiceInfo: document.getElementById('selected-service-info'),
  dateInput: document.getElementById('date-input'),
  slotsList: document.getElementById('slots-list'),
  selectedBookingInfo: document.getElementById('selected-booking-info'),
  form: document.getElementById('booking-form'),
  formError: document.getElementById('form-error'),
  submitBtn: document.getElementById('submit-btn'),
  confirmationInfo: document.getElementById('confirmation-info'),
  telegramSubscribe: document.getElementById('telegram-subscribe'),
  telegramSubscribeLink: document.getElementById('telegram-subscribe-link'),
  cancelLinkBlock: document.getElementById('cancel-link-block'),
  cancelLinkInput: document.getElementById('cancel-link-input'),
  copyCancelLink: document.getElementById('copy-cancel-link'),

  portfolioGrid: document.getElementById('portfolio-grid'),
  portfolioTags: document.getElementById('portfolio-tags'),
  portfolioModal: document.getElementById('portfolio-modal'),
  portfolioModalClose: document.getElementById('portfolio-modal-close'),
  portfolioModalCancel: document.getElementById('portfolio-modal-cancel'),
  portfolioModalBook: document.getElementById('portfolio-modal-book'),
  portfolioModalImg: document.getElementById('portfolio-modal-img'),
  portfolioModalTitle: document.getElementById('portfolio-modal-title'),
  portfolioModalTags: document.getElementById('portfolio-modal-tags'),
  portfolioModalDesc: document.getElementById('portfolio-modal-desc'),
  portfolioModalPrice: document.getElementById('portfolio-modal-price'),
};

function pad(n) { return String(n).padStart(2, '0'); }

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatDateRu(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const months = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
  const days = ['воскресенье','понедельник','вторник','среда','четверг','пятница','суббота'];
  return `${d} ${months[m - 1]} ${y}, ${days[date.getDay()]}`;
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
    err.details = body && body.details;
    throw err;
  }
  return body;
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function goto(step) {
  state.step = step;
  for (let i = 1; i <= 4; i++) {
    els.screens[i].classList.toggle('hidden', i !== step);
  }
  els.steps.forEach((el) => {
    const s = Number(el.dataset.step);
    el.classList.toggle('active', s === step);
    el.classList.toggle('done', s < step);
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* =========================================================
   Услуги
   ========================================================= */

async function loadServices() {
  try {
    state.services = await apiFetch('/services');
    renderServices();
  } catch (e) {
    els.servicesList.innerHTML =
      `<p class="form-error">Не удалось загрузить услуги: ${escapeHtml(e.message)}</p>`;
  }
}

function renderServices() {
  if (!state.services.length) {
    els.servicesList.innerHTML = '<p class="muted">Пока нет доступных услуг.</p>';
    return;
  }
  els.servicesList.innerHTML = state.services.map((s) => `
    <div class="service-card" data-id="${escapeHtml(s.id)}">
      <div>
        <div class="name">${escapeHtml(s.name)}</div>
        <div class="meta">${s.duration_minutes} мин</div>
      </div>
      <div class="price">${s.price} ₽</div>
    </div>
  `).join('');

  els.servicesList.querySelectorAll('.service-card').forEach((card) => {
    card.addEventListener('click', () => {
      const id = card.dataset.id;
      state.service = state.services.find((s) => String(s.id) === String(id));
      onServiceSelected();
    });
  });
}

function onServiceSelected() {
  state.date = null;
  state.slots = [];
  state.startTime = null;

  els.selectedServiceInfo.innerHTML =
    `Услуга: <strong>${escapeHtml(state.service.name)}</strong> — ` +
    `${state.service.duration_minutes} мин, ${state.service.price} ₽`;

  const minDate = todayISO();
  els.dateInput.min = minDate;
  els.dateInput.value = minDate;
  state.date = minDate;

  els.slotsList.innerHTML = '<p class="muted">Загрузка слотов…</p>';

  goto(2);
  loadSlots();
}

async function loadSlots() {
  if (!state.date || !state.service) return;
  els.slotsList.innerHTML = '<p class="muted">Загрузка слотов…</p>';
  try {
    const params = new URLSearchParams({
      service_id: state.service.id,
      date: state.date,
    });
    const data = await apiFetch(`/slots?${params.toString()}`);
    state.slots = data.slots || [];
    renderSlots();
  } catch (e) {
    els.slotsList.innerHTML =
      `<p class="form-error">Не удалось загрузить слоты: ${escapeHtml(e.message)}</p>`;
  }
}

function renderSlots() {
  if (!state.slots.length) {
    els.slotsList.innerHTML = '<p class="muted">На эту дату нет свободного времени.</p>';
    return;
  }
  els.slotsList.innerHTML = state.slots.map((t) =>
    `<button type="button" class="slot" data-time="${escapeHtml(t)}">${escapeHtml(t)}</button>`
  ).join('');

  els.slotsList.querySelectorAll('.slot').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.startTime = btn.dataset.time;
      els.slotsList.querySelectorAll('.slot').forEach((b) =>
        b.classList.toggle('selected', b === btn));
      onSlotSelected();
    });
  });
}

function onSlotSelected() {
  els.selectedBookingInfo.innerHTML =
    `<strong>${escapeHtml(state.service.name)}</strong> · ` +
    `${escapeHtml(formatDateRu(state.date))} · ` +
    `<strong>${escapeHtml(state.startTime)}</strong>`;

  els.formError.classList.add('hidden');
  els.formError.textContent = '';

  goto(3);
}

/* =========================================================
   Форма записи
   ========================================================= */

async function submitBooking(event) {
  event.preventDefault();

  els.formError.classList.add('hidden');
  els.formError.textContent = '';
  els.submitBtn.disabled = true;
  els.submitBtn.textContent = 'Отправка…';

  const fd = new FormData(els.form);
  const payload = {
    service_id: state.service.id,
    date: state.date,
    start_time: state.startTime,
    client_name: fd.get('client_name')?.trim() || '',
    client_phone: fd.get('client_phone')?.trim() || '',
    client_email: fd.get('client_email')?.trim() || '',
    comment: fd.get('comment')?.trim() || '',
  };

  try {
    const booking = await apiFetch('/bookings', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    state.booking = booking;
    showConfirmation();
    goto(4);
  } catch (e) {
    let msg = e.message || 'Не удалось создать запись.';
    if (e.status === 409) msg = 'Этот слот уже заняли. Пожалуйста, выберите другое время.';
    else if (e.status === 429) msg = 'Слишком много попыток. Подождите минуту и попробуйте снова.';
    else if (e.status === 400 && e.details) {
      const details = e.details.fieldErrors || {};
      const list = Object.entries(details)
        .map(([field, errors]) => `${field}: ${errors.join(', ')}`).join('; ');
      if (list) msg = `Проверьте данные — ${list}`;
    }
    els.formError.textContent = msg;
    els.formError.classList.remove('hidden');
  } finally {
    els.submitBtn.disabled = false;
    els.submitBtn.textContent = 'Записаться';
  }
}

function showConfirmation() {
  const b = state.booking;
  const rows = [
    ['Услуга', state.service.name],
    ['Дата', formatDateRu(b.date)],
    ['Время', `${b.start_time} — ${b.end_time}`],
    ['Имя', els.form.client_name.value.trim()],
    ['Телефон', els.form.client_phone.value.trim()],
  ];
  els.confirmationInfo.innerHTML = rows
    .map(([k, v]) =>
      `<div class="row"><span class="label">${escapeHtml(k)}</span>` +
      `<span>${escapeHtml(v)}</span></div>`)
    .join('');

  if (b.telegram_url) {
    els.telegramSubscribeLink.href = b.telegram_url;
    els.telegramSubscribe.classList.remove('hidden');
  } else {
    els.telegramSubscribe.classList.add('hidden');
  }

  if (b.cancel_url) {
    els.cancelLinkInput.value = b.cancel_url;
    els.cancelLinkBlock.classList.remove('hidden');
  } else {
    els.cancelLinkBlock.classList.add('hidden');
  }
}

/* =========================================================
   Портфолио — оптимизированная версия с ленивой загрузкой
   ========================================================= */

function renderPortfolioSkeletons(count = 8) {
  if (!els.portfolioGrid) return;
  const items = Array.from({ length: count }, () => `
    <div class="portfolio-card skeleton-card">
      <div class="portfolio-card-image">
        <div class="skeleton-image"></div>
      </div>
      <div class="portfolio-card-body">
        <div class="skeleton-line skeleton-line-title"></div>
        <div class="skeleton-line skeleton-line-price"></div>
      </div>
    </div>
  `).join('');
  els.portfolioGrid.innerHTML = items;
}

async function loadPortfolio() {
  if (!els.portfolioGrid) return;

  // Показываем скелетоны сразу
  renderPortfolioSkeletons(8);

  const token = ++state.portfolioLoadToken;

  try {
    const qs = state.portfolioTag ? `?tag=${encodeURIComponent(state.portfolioTag)}` : '';
    const data = await apiFetch(`/portfolio${qs}`);

    // Устаревший запрос — игнорируем
    if (token !== state.portfolioLoadToken) return;

    state.portfolio = data;
    renderPortfolio();

    if (!state.portfolioTag) {
      loadPortfolioTags();
    }
  } catch (e) {
    if (token !== state.portfolioLoadToken) return;
    els.portfolioGrid.innerHTML =
      `<p class="form-error">Не удалось загрузить работы: ${escapeHtml(e.message)}</p>`;
  }
}

async function loadPortfolioTags() {
  if (!els.portfolioTags) return;
  try {
    const tags = await apiFetch('/portfolio/tags');
    if (!tags.length) { els.portfolioTags.innerHTML = ''; return; }
    els.portfolioTags.innerHTML = `
      <button class="tag ${!state.portfolioTag ? 'active' : ''}" data-tag="">Все</button>
      ${tags.map((t) => `
        <button class="tag ${state.portfolioTag === t ? 'active' : ''}" data-tag="${escapeHtml(t)}">${escapeHtml(t)}</button>
      `).join('')}
    `;
    els.portfolioTags.querySelectorAll('.tag').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.portfolioTag = btn.dataset.tag || null;
        els.portfolioTags.querySelectorAll('.tag').forEach((b) =>
          b.classList.toggle('active', b === btn));
        loadPortfolio();
      });
    });
  } catch { /* ignore */ }
}

function renderPortfolio() {
  if (!els.portfolioGrid) return;
  if (!state.portfolio.length) {
    els.portfolioGrid.innerHTML = '<p class="muted">Пока нет работ в этой категории.</p>';
    return;
  }

  els.portfolioGrid.innerHTML = state.portfolio.map((item, idx) => {
    const thumb = item.image_url_thumb || item.image_url;
    // Первые два грузим сразу, остальные лениво
    const eager = idx < 2;
    return `
      <div class="portfolio-card" data-id="${escapeHtml(item.id)}">
        <div class="portfolio-card-image">
          <div class="skeleton-image" aria-hidden="true"></div>
          <img
            src="${escapeHtml(thumb)}"
            alt="${escapeHtml(item.title)}"
            loading="${eager ? 'eager' : 'lazy'}"
            decoding="async"
            fetchpriority="${eager ? 'high' : 'low'}"
            class="portfolio-img"
          />
        </div>
        <div class="portfolio-card-body">
          <h4 class="portfolio-card-title">${escapeHtml(item.title)}</h4>
          ${item.price_hint != null ? `<span class="portfolio-card-price">от ${item.price_hint} ₽</span>` : ''}
          ${item.tags && item.tags.length ? `
            <div class="portfolio-card-tags">
              ${item.tags.slice(0, 3).map((t) => `<span class="mini-tag">${escapeHtml(t)}</span>`).join('')}
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');

  // Плавное появление картинок, когда они загрузились
  els.portfolioGrid.querySelectorAll('.portfolio-img').forEach((img) => {
    if (img.complete && img.naturalWidth > 0) {
      img.classList.add('loaded');
    } else {
      img.addEventListener('load', () => img.classList.add('loaded'), { once: true });
      img.addEventListener('error', () => {
        img.classList.add('loaded'); // скрываем скелетон в любом случае
        img.style.opacity = '0.3';
      }, { once: true });
    }
  });

  // Клик по карточке
  els.portfolioGrid.querySelectorAll('.portfolio-card').forEach((card) => {
    card.addEventListener('click', () => openPortfolioModal(card.dataset.id));
  });
}

function openPortfolioModal(id) {
  const item = state.portfolio.find((p) => String(p.id) === String(id));
  if (!item) return;
  state.portfolioSelected = item;

  // Используем большое изображение для модалки
  els.portfolioModalImg.src = item.image_url_full || item.image_url;
  els.portfolioModalImg.alt = item.title;
  els.portfolioModalTitle.textContent = item.title;
  els.portfolioModalDesc.textContent = item.description || '';

  els.portfolioModalTags.innerHTML = (item.tags || [])
    .map((t) => `<span class="mini-tag">${escapeHtml(t)}</span>`).join('');

  if (item.price_hint != null) {
    els.portfolioModalPrice.textContent = `Стоимость: от ${item.price_hint} ₽`;
    els.portfolioModalPrice.classList.remove('hidden');
  } else {
    els.portfolioModalPrice.classList.add('hidden');
  }

  els.portfolioModal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closePortfolioModal() {
  els.portfolioModal.classList.add('hidden');
  document.body.style.overflow = '';
  state.portfolioSelected = null;
}

function bookPortfolioItem() {
  const item = state.portfolioSelected;
  closePortfolioModal();

  if (item && item.service_id) {
    const svc = state.services.find((s) => String(s.id) === String(item.service_id));
    if (svc) {
      state.service = svc;
      document.getElementById('booking').scrollIntoView({ behavior: 'smooth' });
      setTimeout(() => onServiceSelected(), 400);
      return;
    }
  }
  document.getElementById('booking').scrollIntoView({ behavior: 'smooth' });
}

/* =========================================================
   Навигация
   ========================================================= */

function bindNavigation() {
  document.getElementById('back-to-1').addEventListener('click', () => goto(1));
  document.getElementById('back-to-2').addEventListener('click', () => goto(2));

  els.dateInput.addEventListener('change', () => {
    state.date = els.dateInput.value;
    state.startTime = null;
    loadSlots();
  });

  els.form.addEventListener('submit', submitBooking);

  els.copyCancelLink.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(els.cancelLinkInput.value);
      els.copyCancelLink.textContent = 'Скопировано ✓';
      setTimeout(() => { els.copyCancelLink.textContent = 'Копировать'; }, 2000);
    } catch {
      els.cancelLinkInput.select();
      document.execCommand('copy');
    }
  });

  document.getElementById('start-over').addEventListener('click', () => {
    state.service = null;
    state.date = null;
    state.slots = [];
    state.startTime = null;
    state.booking = null;
    els.form.reset();
    els.telegramSubscribe.classList.add('hidden');
    els.cancelLinkBlock.classList.add('hidden');
    goto(1);
  });

  // Портфолио — модалка
  if (els.portfolioModalClose) {
    els.portfolioModalClose.addEventListener('click', closePortfolioModal);
    els.portfolioModalCancel.addEventListener('click', closePortfolioModal);
    els.portfolioModalBook.addEventListener('click', bookPortfolioItem);
    els.portfolioModal.addEventListener('click', (e) => {
      if (e.target === els.portfolioModal) closePortfolioModal();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !els.portfolioModal.classList.contains('hidden')) {
        closePortfolioModal();
      }
    });
  }
}

/* =========================================================
   Старт
   ========================================================= */

(function init() {
  bindNavigation();
  goto(1);
  loadServices();
  loadPortfolio();
})();