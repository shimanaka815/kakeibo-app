import { db } from '../db.js';
import { yen } from '../format.js';
import { applyDueRecurring } from '../recurringEngine.js';

export async function renderRecurring(container, params = {}) {
  const editingId = params.edit ? Number(params.edit) : null;
  const [items, categories, accounts] = await Promise.all([
    db.recurring.toArray(),
    db.categories.toArray(),
    db.accounts.orderBy('order').toArray(),
  ]);
  const catMap = Object.fromEntries(categories.map((c) => [c.id, c]));
  const editing = editingId ? items.find((i) => i.id === editingId) : null;
  let currentType = editing?.type || 'expense';

  container.innerHTML = `
    <section class="page-header"><h2>固定費・サブスク</h2></section>
    <section class="recurring-list">
      ${
        items.length === 0
          ? '<p class="empty">まだ登録されていません</p>'
          : items
              .map(
                (item) => `
        <div class="recurring-item ${item.id === editingId ? 'editing' : ''}">
          <button type="button" class="recurring-info edit-recurring" data-id="${item.id}">
            <strong>${item.name}</strong>
            <div class="muted">${catMap[item.categoryId]?.name ?? '未分類'} ・ 毎月${item.dayOfMonth}日 ・ ${item.type === 'expense' ? '-' : '+'}${yen(item.amount)}</div>
          </button>
          <div class="recurring-actions">
            <label class="switch">
              <input type="checkbox" data-id="${item.id}" class="toggle-active" ${item.active ? 'checked' : ''} />
              <span></span>
            </label>
            <button type="button" class="icon-btn delete-recurring" data-id="${item.id}">🗑</button>
          </div>
        </div>
      `
              )
              .join('')
      }
    </section>
    <section class="page-header"><h2>${editing ? `「${editing.name}」を編集` : '新規登録'}</h2></section>
    <form id="recurring-form" class="tx-form">
      <div class="type-toggle">
        <button type="button" class="type-btn ${currentType === 'expense' ? 'active' : ''}" data-type="expense">支出</button>
        <button type="button" class="type-btn ${currentType === 'income' ? 'active' : ''}" data-type="income">収入</button>
      </div>
      <label>名称<input type="text" name="name" required placeholder="例：Netflix" value="${editing?.name ?? ''}" /></label>
      <label>金額<input type="number" name="amount" min="1" step="1" required value="${editing?.amount ?? ''}" /></label>
      <label>カテゴリ
        <select name="categoryId" id="rec-category-select">
          ${categories
            .filter((c) => c.type === currentType)
            .map((c) => `<option value="${c.id}" ${editing?.categoryId === c.id ? 'selected' : ''}>${c.name}</option>`)
            .join('')}
        </select>
      </label>
      <label>口座
        <select name="accountId">${accounts.map((a) => `<option value="${a.id}" ${editing?.accountId === a.id ? 'selected' : ''}>${a.name}</option>`).join('')}</select>
      </label>
      <label>毎月の登録日<input type="number" name="dayOfMonth" min="1" max="28" value="${editing?.dayOfMonth ?? 1}" required /></label>
      <div class="form-actions">
        <button type="submit" class="primary-btn">${editing ? '更新' : '登録'}</button>
        ${editing ? '<button type="button" id="cancel-edit-btn" class="ghost-btn">キャンセル</button>' : ''}
      </div>
    </form>
  `;

  container.querySelectorAll('.type-btn').forEach((btn) => {
    btn.onclick = () => {
      currentType = btn.dataset.type;
      container.querySelectorAll('.type-btn').forEach((b) => b.classList.toggle('active', b === btn));
      const sel = container.querySelector('#rec-category-select');
      sel.innerHTML = categories.filter((c) => c.type === currentType).map((c) => `<option value="${c.id}">${c.name}</option>`).join('');
    };
  });

  container.querySelectorAll('.toggle-active').forEach((cb) => {
    cb.onchange = async () => {
      await db.recurring.update(Number(cb.dataset.id), { active: cb.checked ? 1 : 0 });
    };
  });

  container.querySelectorAll('.delete-recurring').forEach((btn) => {
    btn.onclick = async () => {
      if (confirm('この固定費を削除しますか？（過去の記録は残ります）')) {
        await db.recurring.delete(Number(btn.dataset.id));
        renderRecurring(container);
      }
    };
  });

  container.querySelectorAll('.edit-recurring').forEach((btn) => {
    btn.onclick = () => renderRecurring(container, { edit: btn.dataset.id });
  });

  const cancelBtn = container.querySelector('#cancel-edit-btn');
  if (cancelBtn) {
    cancelBtn.onclick = () => renderRecurring(container);
  }

  container.querySelector('#recurring-form').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const categoryId = Number(fd.get('categoryId'));
    const accountId = Number(fd.get('accountId'));
    if (!categoryId || !accountId) {
      alert('カテゴリと口座を選択してください');
      return;
    }
    const data = {
      name: fd.get('name').trim(),
      amount: Number(fd.get('amount')),
      type: currentType,
      categoryId,
      accountId,
      dayOfMonth: Number(fd.get('dayOfMonth')),
    };
    if (editing) {
      await db.recurring.update(editing.id, data);
    } else {
      await db.recurring.add({ ...data, active: 1 });
      await applyDueRecurring();
    }
    renderRecurring(container);
  };
}
