import { db } from '../db.js';

function categoryRow(c) {
  return `
    <li data-id="${c.id}">
      <input type="text" class="category-name-input" value="${c.name}" />
      <button type="button" class="icon-btn delete-category">🗑</button>
    </li>
  `;
}

function bindRowEvents(li) {
  const input = li.querySelector('.category-name-input');
  input.onchange = async () => {
    await db.categories.update(Number(li.dataset.id), { name: input.value.trim() });
  };
  li.querySelector('.delete-category').onclick = async () => {
    if (confirm('このカテゴリを削除しますか？過去の記録は「未分類」として表示されます')) {
      await db.categories.delete(Number(li.dataset.id));
      li.remove();
    }
  };
}

function bindCategoryEvents(container) {
  container.querySelectorAll('.category-edit-list li').forEach((li) => bindRowEvents(li));

  container.querySelectorAll('.add-category-form').forEach((form) => {
    form.onsubmit = async (e) => {
      e.preventDefault();
      const type = form.dataset.type;
      const input = form.querySelector('input[name="name"]');
      const name = input.value.trim();
      if (!name) return;
      const siblings = await db.categories.where('type').equals(type).toArray();
      const maxOrder = siblings.reduce((m, c) => Math.max(m, c.order ?? 0), -1);
      const id = await db.categories.add({ name, type, order: maxOrder + 1 });
      const ul = form.previousElementSibling;
      ul.insertAdjacentHTML('beforeend', categoryRow({ id, name }));
      bindRowEvents(ul.lastElementChild);
      input.value = '';
    };
  });
}

async function exportData() {
  const [accounts, categories, transactions, budgets, recurring] = await Promise.all([
    db.accounts.toArray(),
    db.categories.toArray(),
    db.transactions.toArray(),
    db.budgets.toArray(),
    db.recurring.toArray(),
  ]);
  const payload = { version: 1, exportedAt: new Date().toISOString(), accounts, categories, transactions, budgets, recurring };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `kakeibo-backup-${stamp}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

async function importData(file) {
  const text = await file.text();
  const data = JSON.parse(text);
  await db.transaction('rw', db.accounts, db.categories, db.transactions, db.budgets, db.recurring, async () => {
    await Promise.all([db.accounts.clear(), db.categories.clear(), db.transactions.clear(), db.budgets.clear(), db.recurring.clear()]);
    if (data.accounts) await db.accounts.bulkAdd(data.accounts);
    if (data.categories) await db.categories.bulkAdd(data.categories);
    if (data.transactions) await db.transactions.bulkAdd(data.transactions);
    if (data.budgets) await db.budgets.bulkAdd(data.budgets);
    if (data.recurring) await db.recurring.bulkAdd(data.recurring);
  });
}

export async function renderSettings(container) {
  const categories = await db.categories.orderBy('order').toArray();
  const expenseCats = categories.filter((c) => c.type === 'expense');
  const incomeCats = categories.filter((c) => c.type === 'income');

  container.innerHTML = `
    <section class="page-header"><h2>口座管理</h2></section>
    <section class="settings-link">
      <a href="#/accounts" class="ghost-btn">口座の追加・編集はこちら ›</a>
    </section>
    <section class="page-header"><h2>カテゴリ管理</h2></section>
    <section class="category-group">
      <h3>支出</h3>
      <ul class="category-edit-list" data-type="expense">
        ${expenseCats.map((c) => categoryRow(c)).join('')}
      </ul>
      <form class="add-category-form" data-type="expense">
        <input type="text" name="name" placeholder="新しいカテゴリ名" required />
        <button type="submit">追加</button>
      </form>
    </section>
    <section class="category-group">
      <h3>収入</h3>
      <ul class="category-edit-list" data-type="income">
        ${incomeCats.map((c) => categoryRow(c)).join('')}
      </ul>
      <form class="add-category-form" data-type="income">
        <input type="text" name="name" placeholder="新しいカテゴリ名" required />
        <button type="submit">追加</button>
      </form>
    </section>
    <section class="page-header"><h2>データのバックアップ</h2></section>
    <section class="backup-actions">
      <button type="button" id="export-btn" class="primary-btn">JSONでエクスポート</button>
      <label class="ghost-btn file-label">
        インポート
        <input type="file" id="import-input" accept="application/json" hidden />
      </label>
      <p class="muted small">機種変更などの際は、エクスポートしたファイルを新しい端末でインポートしてください。</p>
    </section>
  `;

  bindCategoryEvents(container);

  container.querySelector('#export-btn').onclick = exportData;
  container.querySelector('#import-input').onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!confirm('現在のデータをすべて置き換えます。よろしいですか？')) {
      e.target.value = '';
      return;
    }
    await importData(file);
    renderSettings(container);
  };
}
