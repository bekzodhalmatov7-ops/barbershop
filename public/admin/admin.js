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

/**
 * Модалка расписания мастера. Показывает 7 дней, позволяет
 * сохранять override отдельно по каждому дню и сбрасывать к глобальному.
 */
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
        // Перезагрузим модалку, чтобы обновить бейджи
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