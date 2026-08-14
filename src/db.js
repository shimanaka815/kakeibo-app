import Dexie from 'dexie';

export const db = new Dexie('kakeiboDB');

db.version(1).stores({
  accounts: '++id, name, type, order',
  categories: '++id, name, type, order',
  transactions: '++id, date, type, categoryId, accountId',
  budgets: '++id, &categoryId',
  recurring: '++id, name, active',
});

export async function ensureDefaults() {
  const accCount = await db.accounts.count();
  if (accCount === 0) {
    await db.accounts.bulkAdd([
      { name: '現金', type: 'cash', initialBalance: 0, order: 0 },
      { name: '銀行口座', type: 'bank', initialBalance: 0, order: 1 },
      { name: 'クレジットカード', type: 'card', initialBalance: 0, order: 2 },
    ]);
  }

  const catCount = await db.categories.count();
  if (catCount === 0) {
    const expense = [
      '食費', '日用品', '交通費', '娯楽・趣味', '衣服・美容',
      '医療', '住居費', '水道光熱費', '通信費', '教育', '交際費', 'その他',
    ];
    const income = ['給与', 'ボーナス', '副業', 'その他収入'];
    await db.categories.bulkAdd([
      ...expense.map((name, i) => ({ name, type: 'expense', order: i })),
      ...income.map((name, i) => ({ name, type: 'income', order: i })),
    ]);
  }
}

export async function computeAccountBalance(account) {
  const txs = await db.transactions.where('accountId').equals(account.id).toArray();
  const delta = txs.reduce((sum, t) => sum + (t.type === 'income' ? t.amount : -t.amount), 0);
  return (account.initialBalance || 0) + delta;
}
