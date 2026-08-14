import { db } from '../db.js';
import { yen } from '../format.js';
import { applyDueRecurring } from '../recurringEngine.js';

export async function renderRecurring(container) {
  const [items, categories, accounts] = await Promise.all([
    db.recurring.toArray(),
    db.categories.toArray(),
    db.accounts.orderBy('order').toArray(),
  ]);
  const catMap = Object.fromEntries(categories.map((c) => [c.id, c]));
  let currentType = 'expense';

  container.innerHTML = `
    <section class="page-header"><h2>固定費・サブスク</h2></section>
    <section class="recurring-list">
      ${
        items.length === 0
          ? '<p class="empty">まだ登録されていません</p>'
          : items
              .map(
                (item) => `
        <div class="recurring-item">
          <div>
            <strong>${item.name}</strong>
            <div class="muted">${catMap[item.categoryId]?.name ?? '未分類'} ・ 毎月${item.dayOfMonth}日 ・ ${item.type === 'expense' ? '-' : '+'}${yen(item.amount)}</div>
          </div>
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
    <section class="page-header"><h2>新規登録</h2></section>
    <form id="recurring-form" class="tx-form">
      <div class="type-toggle">
        <button type="button" class="type-btn active" data-type="expense">支出</button>
        <button type="button" class="type-btn" data-type="income">収入</button>
      </div>
      <label>名称<input type="text" name="name" required placeholder="例：Netflix" /></label>
      <label>金額<input type="number" name="amount" min="1" step="1" required /></label>
      <label>カテゴリ
        <select name="categoryId" id="rec-category-select">
          ${categories.filter((c) => c.type === 'expense').map((c) => `<option value="${c.id}">${c.name}</option>`).join('')}
        </select>
      </label>
      <label>口座
        <select name="accountId">${accounts.map((a) => `<option value="${a.id}">${a.name}</option>`).join('')}</select>
      </label>
      <label>毎月の登録日<input type="number" name="dayOfMonth" min="1" max="28" value="1" required /></label>
      <div class="form-actions"><button type="submit" class="primary-btn">登録</button></div>
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

  container.querySelector('#recurring-form').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const categoryId = Number(fd.get('categoryId'));
    const accountId = Number(fd.get('accountId'));
    if (!categoryId || !accountId) {
      alert('カテゴリと口座を選択してください');
      return;
    }
    await db.recurring.add({
      name: fd.get('name').trim(),
      amount: Number(fd.get('amount')),
      type: currentType,
      categoryId,
      accountId,
      dayOfMonth: Number(fd.get('dayOfMonth')),
      active: 1,
    });
    await applyDueRecurring();
    renderRecurring(container);
  };
}
