import { db } from '../db.js';
import { yen, currentMonth, formatMonthLabel } from '../format.js';

export async function renderBudget(container) {
  const month = currentMonth();
  const categories = await db.categories.where('type').equals('expense').sortBy('order');
  const budgets = await db.budgets.toArray();
  const budgetMap = Object.fromEntries(budgets.map((b) => [b.categoryId, b]));
  const monthTx = await db.transactions
    .where('date')
    .startsWith(month)
    .and((t) => t.type === 'expense')
    .toArray();
  const spentByCat = {};
  for (const t of monthTx) spentByCat[t.categoryId] = (spentByCat[t.categoryId] || 0) + t.amount;

  container.innerHTML = `
    <section class="page-header"><h2>${formatMonthLabel(month)}の予算</h2></section>
    <section class="budget-list">
      ${categories
        .map((c) => {
          const budget = budgetMap[c.id]?.monthlyAmount || 0;
          const spent = spentByCat[c.id] || 0;
          const pct = budget > 0 ? Math.min(100, Math.round((spent / budget) * 100)) : 0;
          const over = budget > 0 && spent > budget;
          return `
          <div class="budget-item">
            <div class="budget-row">
              <span class="budget-name">${c.name}</span>
              <input type="number" class="budget-input" data-cat="${c.id}" min="0" step="1" value="${budget || ''}" placeholder="未設定" />
            </div>
            ${
              budget > 0
                ? `
              <div class="progress-bar"><div class="progress-fill ${over ? 'over' : ''}" style="width:${pct}%"></div></div>
              <div class="budget-meta ${over ? 'over-text' : ''}">${yen(spent)} / ${yen(budget)}${over ? '（超過）' : ''}</div>
            `
                : `<div class="budget-meta muted">${yen(spent)} 使用（予算未設定）</div>`
            }
          </div>
        `;
        })
        .join('')}
    </section>
  `;

  container.querySelectorAll('.budget-input').forEach((input) => {
    input.onchange = async () => {
      const categoryId = Number(input.dataset.cat);
      const amount = Number(input.value) || 0;
      const existing = await db.budgets.where('categoryId').equals(categoryId).first();
      if (amount === 0 && existing) {
        await db.budgets.delete(existing.id);
      } else if (existing) {
        await db.budgets.update(existing.id, { monthlyAmount: amount });
      } else if (amount > 0) {
        await db.budgets.add({ categoryId, monthlyAmount: amount });
      }
      renderBudget(container);
    };
  });
}
