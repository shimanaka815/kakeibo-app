import { db } from './db.js';
import { currentMonth, shiftMonth, todayStr } from './format.js';

function daysInMonth(ym) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

export async function applyDueRecurring() {
  const items = await db.recurring.where('active').equals(1).toArray();
  const nowMonth = currentMonth();
  const today = todayStr();

  for (const item of items) {
    let cursor = item.lastAppliedMonth ? shiftMonth(item.lastAppliedMonth, 1) : nowMonth;

    while (cursor <= nowMonth) {
      const day = Math.min(item.dayOfMonth, daysInMonth(cursor));
      const scheduledDate = `${cursor}-${String(day).padStart(2, '0')}`;

      // Don't record this month's occurrence until its scheduled day actually arrives.
      if (cursor === nowMonth && scheduledDate > today) break;

      await db.transactions.add({
        type: item.type,
        amount: item.amount,
        date: scheduledDate,
        categoryId: item.categoryId,
        accountId: item.accountId,
        memo: item.name,
        createdAt: Date.now(),
        recurringId: item.id,
      });
      await db.recurring.update(item.id, { lastAppliedMonth: cursor });
      cursor = shiftMonth(cursor, 1);
    }
  }
}
