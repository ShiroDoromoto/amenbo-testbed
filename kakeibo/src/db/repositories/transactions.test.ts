import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { deleteDB } from 'idb';
import { openKakeiboDB, type KakeiboDBConnection } from '../index.ts';
import {
  addTransaction,
  deleteTransaction,
  listTransactionsByDateRange,
  updateTransaction,
  type NewTransaction,
} from './transactions.ts';

const testDbName = 'kakeibo-transactions-test';

function newTransaction(overrides: Partial<NewTransaction> = {}): NewTransaction {
  return {
    date: '2026-01-01',
    amount: 1000,
    type: 'expense',
    categoryId: 'c',
    accountId: 'a',
    memo: '',
    ...overrides,
  };
}

let db: KakeiboDBConnection;

beforeEach(async () => {
  db = await openKakeiboDB(testDbName);
});

afterEach(async () => {
  db.close();
  await deleteDB(testDbName);
});

describe('addTransaction', () => {
  it('stores the transaction under a new id', async () => {
    const added = await addTransaction(db, newTransaction({ memo: 'ランチ' }));
    expect(added.id).not.toBe('');
    expect(await db.get('transactions', added.id)).toEqual(added);
    expect(added).toEqual({ ...newTransaction({ memo: 'ランチ' }), id: added.id });
  });

  it('gives each transaction its own id', async () => {
    const first = await addTransaction(db, newTransaction());
    const second = await addTransaction(db, newTransaction());
    expect(first.id).not.toBe(second.id);
    expect(await db.count('transactions')).toBe(2);
  });
});

describe('updateTransaction', () => {
  it('replaces the stored transaction', async () => {
    const added = await addTransaction(db, newTransaction());
    const changed = { ...added, amount: 2500, memo: '修正' };
    await updateTransaction(db, changed);
    expect(await db.get('transactions', added.id)).toEqual(changed);
  });

  it('throws when the transaction does not exist', async () => {
    await expect(updateTransaction(db, { ...newTransaction(), id: 'missing' })).rejects.toThrow(
      'Transaction not found: missing',
    );
    expect(await db.count('transactions')).toBe(0);
  });
});

describe('deleteTransaction', () => {
  it('removes the transaction', async () => {
    const kept = await addTransaction(db, newTransaction());
    const removed = await addTransaction(db, newTransaction());
    await deleteTransaction(db, removed.id);
    expect(await db.getAllKeys('transactions')).toEqual([kept.id]);
  });

  it('does nothing when the transaction does not exist', async () => {
    await addTransaction(db, newTransaction());
    await deleteTransaction(db, 'missing');
    expect(await db.count('transactions')).toBe(1);
  });
});

describe('listTransactionsByDateRange', () => {
  it('returns transactions within the range, both ends included, oldest first', async () => {
    const dates = ['2026-02-01', '2026-01-31', '2025-12-31', '2026-01-01', '2026-01-15'];
    for (const date of dates) await addTransaction(db, newTransaction({ date }));

    const january = await listTransactionsByDateRange(db, '2026-01-01', '2026-01-31');
    expect(january.map((t) => t.date)).toEqual(['2026-01-01', '2026-01-15', '2026-01-31']);
  });

  it('returns a single day when from equals to', async () => {
    await addTransaction(db, newTransaction({ date: '2026-03-03' }));
    await addTransaction(db, newTransaction({ date: '2026-03-04' }));
    const day = await listTransactionsByDateRange(db, '2026-03-03', '2026-03-03');
    expect(day.map((t) => t.date)).toEqual(['2026-03-03']);
  });

  it('returns nothing when from is after to', async () => {
    await addTransaction(db, newTransaction({ date: '2026-01-15' }));
    expect(await listTransactionsByDateRange(db, '2026-01-31', '2026-01-01')).toEqual([]);
  });
});
