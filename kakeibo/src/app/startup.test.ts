import 'fake-indexeddb/auto';
import { afterEach, expect, test } from 'vitest';
import { deleteDB } from 'idb';
import { openKakeiboDB } from '../db/index.ts';
import { addRecurringTransaction } from '../db/repositories/recurring.ts';
import { runStartupTasks } from './startup.ts';

const testDbName = 'kakeibo-startup-test';

afterEach(async () => {
  await deleteDB(testDbName);
});

test('creates the transactions the recurring transactions owe up to today', async () => {
  const db = await openKakeiboDB(testDbName);
  await addRecurringTransaction(db, {
    dayOfMonth: 25,
    amount: 80000,
    type: 'expense',
    categoryId: 'rent',
    accountId: 'bank',
    memo: '',
  });
  db.close();

  const created = await runStartupTasks(testDbName, new Date(2025, 2, 26));
  expect(created.map((t) => t.date)).toEqual(['2025-03-25']);

  const reopened = await openKakeiboDB(testDbName);
  expect(await reopened.count('transactions')).toBe(1);
  reopened.close();
});
