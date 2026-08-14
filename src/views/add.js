import { db } from '../db.js';
import { todayStr } from '../format.js';
import { navigate } from '../router.js';

export async function renderAdd(container, params = {}) {
  const id = params.id ? Number(params.id) : null;
  const existing = id ? await db.transactions.get(id) : null;
  let currentType = existing?.type || params.type || 'expense';

  const [categories, accounts] = await Promise.all([
    db.categories.where('type').equals(currentType).sortBy('order'),
    db.accounts.orderBy('order').toArray(),
  ]);

  container.innerHTML = `
    <form id="tx-form" class="tx-form">
      <div class="type-toggle">
        <button type="button" class="type-btn ${currentType === 'expense' ? 'active' : ''}" data-type="expense">支出</button>
        <button type="button" class="type-btn ${currentType === 'income' ? 'active' : ''}" data-type="income">収入</button>
      </div>
      <label>金額
        <input type="number" name="amount" inputmode="numeric" min="1" step="1" required value="${existing?.amount ?? ''}" placeholder="0" />
      </label>
      <label>日付
        <input type="date" name="date" required value="${existing?.date ?? todayStr()}" />
      </label>
      <label>カテゴリ
        <select name="categoryId" id="category-select">
          ${categories.map((c) => `<option value="${c.id}" ${existing?.categoryId === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
        </select>
      </label>
      <label>口座
        <select name="accountId">
          ${accounts.map((a) => `<option value="${a.id}" ${existing?.accountId === a.id ? 'selected' : ''}>${a.name}</option>`).join('')}
        </select>
      </label>
      <label>メモ
        <input type="text" name="memo" value="${existing?.memo ?? ''}" placeholder="任意" />
      </label>
      <div class="form-actions">
        <button type="submit" class="primary-btn">保存</button>
        ${existing ? '<button type="button" id="delete-btn" class="danger-btn">削除</button>' : ''}
        <button type="button" id="cancel-btn" class="ghost-btn">キャンセル</button>
      </div>
    </form>
  `;

  container.querySelectorAll('.type-btn').forEach((btn) => {
    btn.onclick = async () => {
      currentType = btn.dataset.type;
      container.querySelectorAll('.type-btn').forEach((b) => b.classList.toggle('active', b === btn));
      const cats = await db.categories.where('type').equals(currentType).sortBy('order');
      const sel = container.querySelector('#category-select');
      sel.innerHTML = cats.map((c) => `<option value="${c.id}">${c.name}</option>`).join('');
    };
  });

  container.querySelector('#cancel-btn').onclick = () => history.back();

  if (existing) {
    container.querySelector('#delete-btn').onclick = async () => {
      if (confirm('この記録を削除しますか？')) {
        await db.transactions.delete(id);
        navigate('#/home');
      }
    };
  }

  container.querySelector('#tx-form').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = {
      type: currentType,
      amount: Number(fd.get('amount')),
      date: fd.get('date'),
      categoryId: Number(fd.get('categoryId')),
      accountId: Number(fd.get('accountId')),
      memo: fd.get('memo')?.trim() || '',
    };
    if (!data.amount || data.amount <= 0) {
      alert('金額を入力してください');
      return;
    }
    if (!data.categoryId || !data.accountId) {
      alert('カテゴリと口座を選択してください');
      return;
    }
    if (id) {
      await db.transactions.update(id, data);
    } else {
      await db.transactions.add({ ...data, createdAt: Date.now() });
    }
    navigate('#/home');
  };
}
