import { Chart } from 'chart.js/auto';
import { db } from '../db.js';
import { yen, currentMonth, formatMonthLabel, shiftMonth } from '../format.js';

let pieChart, barChart;

const palette = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#6366f1', '#a855f7', '#ec4899', '#78716c', '#84cc16', '#06b6d4'];
function colorForCategory(id) {
  return palette[id % palette.length];
}

export async function renderStats(container, params = {}) {
  const month = params.month || currentMonth();
  const categories = await db.categories.toArray();
  const catMap = Object.fromEntries(categories.map((c) => [c.id, c]));
  const monthTx = await db.transactions.where('date').startsWith(month).toArray();

  const expenseByCat = {};
  for (const t of monthTx) {
    if (t.type !== 'expense') continue;
    expenseByCat[t.categoryId] = (expenseByCat[t.categoryId] || 0) + t.amount;
  }
  const catEntries = Object.entries(expenseByCat).sort((a, b) => b[1] - a[1]);
  const totalExpense = catEntries.reduce((s, [, v]) => s + v, 0);

  const months = [];
  for (let i = 5; i >= 0; i--) months.push(shiftMonth(month, -i));
  const allTx = await db.transactions.toArray();
  const trend = months.map((m) => {
    const items = allTx.filter((t) => t.date.startsWith(m));
    return {
      month: m,
      income: items.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0),
      expense: items.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
    };
  });

  container.innerHTML = `
    <section class="month-nav">
      <button class="icon-btn" data-nav="prev" aria-label="前の月">‹</button>
      <div class="month-label">${formatMonthLabel(month)}</div>
      <button class="icon-btn" data-nav="next" aria-label="次の月">›</button>
    </section>
    <section class="chart-card">
      <h2>カテゴリ別支出</h2>
      ${totalExpense === 0 ? '<p class="empty">この月の支出はまだありません</p>' : '<canvas id="pie-chart" height="220"></canvas>'}
      <ul class="cat-breakdown">
        ${catEntries
          .map(
            ([cid, amt]) => `
          <li>
            <span class="dot" style="background:${colorForCategory(Number(cid))}"></span>
            <span class="name">${catMap[cid]?.name ?? '未分類'}</span>
            <span class="amt">${yen(amt)}</span>
            <span class="pct">${Math.round((amt / totalExpense) * 100)}%</span>
          </li>
        `
          )
          .join('')}
      </ul>
    </section>
    <section class="chart-card">
      <h2>月別推移（直近6か月）</h2>
      <canvas id="bar-chart" height="220"></canvas>
    </section>
  `;

  container.querySelector('[data-nav="prev"]').onclick = () => renderStats(container, { month: shiftMonth(month, -1) });
  container.querySelector('[data-nav="next"]').onclick = () => renderStats(container, { month: shiftMonth(month, 1) });

  if (pieChart) {
    pieChart.destroy();
    pieChart = null;
  }
  if (barChart) {
    barChart.destroy();
    barChart = null;
  }

  if (totalExpense > 0) {
    const ctx = container.querySelector('#pie-chart');
    pieChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: catEntries.map(([cid]) => catMap[cid]?.name ?? '未分類'),
        datasets: [{ data: catEntries.map(([, v]) => v), backgroundColor: catEntries.map(([cid]) => colorForCategory(Number(cid))) }],
      },
      options: { plugins: { legend: { display: false } } },
    });
  }

  const barCtx = container.querySelector('#bar-chart');
  barChart = new Chart(barCtx, {
    type: 'bar',
    data: {
      labels: trend.map((t) => `${Number(t.month.slice(5))}月`),
      datasets: [
        { label: '収入', data: trend.map((t) => t.income), backgroundColor: '#22c55e' },
        { label: '支出', data: trend.map((t) => t.expense), backgroundColor: '#ef4444' },
      ],
    },
    options: { responsive: true, scales: { y: { beginAtZero: true } } },
  });
}
