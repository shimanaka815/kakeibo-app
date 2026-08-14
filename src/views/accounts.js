import { db, computeAccountBalance } from '../db.js';
import { yen } from '../format.js';

function typeLabel(type) {
  return { cash: '現金', bank: '銀行', card: 'クレジットカード', other: 'その他' }[type] || type;
}

export async function renderAccounts(container) {
  const accounts = await db.accounts.orderBy('order').toArray();
  const withBalance = await Promise.all(accounts.map(async (a) => ({ ...a, balance: await computeAccountBalance(a) })));

  container.innerHTML = `
    <section class="page-header"><h2>口座管理</h2></section>
    <section class="account-list">
      ${withBalance
        .map(
          (a) => `
        <div class="account-item">
          <div>
            <strong>${a.name}</strong>
            <div class="muted">${typeLabel(a.type)}</div>
          </div>
          <div class="account-balance">${yen(a.balance)}</div>
          <button type="button" class="icon-btn delete-account" data-id="${a.id}">🗑</button>
        </div>
      `
        )
        .join('')}
    </section>
    <section class="page-header"><h2>口座を追加</h2></section>
    <form id="account-form" class="tx-form">
      <label>口座名<input type="text" name="name" required placeholder="例：〇〇銀行" /></label>
      <label>種別
        <select name="type">
          <option value="cash">現金</option>
          <option value="bank">銀行</option>
          <option value="card">クレジットカード</option>
          <option value="other">その他</option>
        </select>
      </label>
      <label>初期残高<input type="number" name="initialBalance" value="0" step="1" /></label>
      <div class="form-actions"><button type="submit" class="primary-btn">追加</button></div>
    </form>
  `;

  container.querySelectorAll('.delete-account').forEach((btn) => {
    btn.onclick = async () => {
      if (confirm('この口座を削除しますか？関連する記録は残ります')) {
        await db.accounts.delete(Number(btn.dataset.id));
        renderAccounts(container);
      }
    };
  });

  container.querySelector('#account-form').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const maxOrder = accounts.reduce((m, a) => Math.max(m, a.order ?? 0), -1);
    await db.accounts.add({
      name: fd.get('name').trim(),
      type: fd.get('type'),
      initialBalance: Number(fd.get('initialBalance')) || 0,
      order: maxOrder + 1,
    });
    renderAccounts(container);
  };
}
