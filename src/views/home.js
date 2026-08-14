import { db, computeAccountBalance } from '../db.js';
import { yen, currentMonth, formatMonthLabel, shiftMonth } from '../format.js';
import { navigate } from '../router.js';

export async function renderHome(container, params = {}) {
  const month = params.month || currentMonth();
  const [transactions, categories, accounts] = await Promise.all([
    db.transactions.where('date').startsWith(month).toArray(),
    db.categories.toArray(),
    db.accounts.orderBy('order').toArray(),
  ]);
  transactions.sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);

  const catMap = Object.fromEntries(categories.map((c) => [c.id, c]));
  const balances = await Promise.all(accounts.map(async (a) => ({ ...a, balance: await computeAccountBalance(a) })));

  const income = transactions.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = transactions.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

  const groups = {};
  for (const t of transactions) {
    (groups[t.date] ??= []).push(t);
  }

  container.innerHTML = `
    <section class="month-nav">
      <button class="icon-btn" data-nav="prev" aria-label="前の月">‹</button>
      <div class="month-label">${formatMonthLabel(month)}</div>
      <button class="icon-btn" data-nav="next" aria-label="次の月">›</button>
    </section>
    <section class="summary-cards">
      <div class="card income"><span>収入</span><strong>${yen(income)}</strong></div>
      <div class="card expense"><span>支出</span><strong>${yen(expense)}</strong></div>
      <div class="card balance"><span>収支</span><strong>${yen(income - expense)}</strong></div>
    </section>
    <section class="account-chips">
      ${balances.map((a) => `<div class="chip"><span>${a.name}</span><strong>${yen(a.balance)}</strong></div>`).join('')}
    </section>
    <section class="tx-list">
      ${
        Object.keys(groups).length === 0
          ? '<p class="empty">この月の記録はまだありません。右下の＋から追加しましょう。</p>'
          : Object.entries(groups)
              .map(
                ([date, items]) => `
        <div class="tx-date-group">
          <div class="tx-date">${date}</div>
          ${items
            .map(
              (t) => `
            <button type="button" class="tx-item" data-id="${t.id}">
              <span class="tx-cat">${catMap[t.categoryId]?.name ?? '未分類'}</span>
              <span class="tx-memo">${t.memo ?? ''}</span>
              <span class="tx-amount ${t.type}">${t.type === 'expense' ? '-' : '+'}${yen(t.amount)}</span>
            </button>
          `
            )
            .join('')}
        </div>
      `
              )
              .join('')
      }
    </section>
  `;

  container.querySelector('[data-nav="prev"]').onclick = () => renderHome(container, { month: shiftMonth(month, -1) });
  container.querySelector('[data-nav="next"]').onclick = () => renderHome(container, { month: shiftMonth(month, 1) });
  container.querySelectorAll('.tx-item').forEach((btn) => {
    btn.onclick = () => navigate(`#/add?id=${btn.dataset.id}`);
  });
}
