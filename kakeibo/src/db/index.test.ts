import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { deleteDB } from 'idb';
import { dbVersion, openKakeiboDB, type KakeiboDBConnection } from './index.ts';
import type { Transaction } from '../domain/transaction.ts';

const testDbName = 'kakeibo-test';

function transaction(overrides: Partial<Transaction>): Transaction {
  return {
    id: 't',
    date: '2026-01-01',
    amount: 1000,
    type: 'expense',
    categoryId: 'c',
    accountId: 'a',
    memo: '',
    ...overrides,
  };
}

let db: KakeiboDBConnection | undefined;

afterEach(async () => {
  db?.close();
  db = undefined;
  await deleteDB(testDbName);
});

describe('openKakeiboDB', () => {
  it('creates the stores', async () => {
    db = await openKakeiboDB(testDbName);
    expect(db.version).toBe(dbVersion);
    expect([...db.objectStoreNames].sort()).toEqual(['accounts', 'categories', 'transactions']);
  });

  it('keys records by id', async () => {
    db = await openKakeiboDB(testDbName);
    await db.put('accounts', { id: 'a', name: '財布', type: 'cash', initialBalance: 0 });
    expect(await db.get('accounts', 'a')).toEqual({
      id: 'a',
      name: '財布',
      type: 'cash',
      initialBalance: 0,
    });
  });

  it('looks up transactions by date, category and account', async () => {
    db = await openKakeiboDB(testDbName);
    await db.put('transactions', transaction({ id: '1', date: '2026-01-05', categoryId: 'food' }));
    await db.put('transactions', transaction({ id: '2', date: '2026-02-01', accountId: 'bank' }));
    await db.put('transactions', transaction({ id: '3', date: '2026-01-20', categoryId: 'food' }));

    const january = await db.getAllFromIndex(
      'transactions',
      'by-date',
      IDBKeyRange.bound('2026-01-01', '2026-01-31'),
    );
    expect(january.map((t) => t.id)).toEqual(['1', '3']);
    expect(
      (await db.getAllFromIndex('transactions', 'by-category', 'food')).map((t) => t.id),
    ).toEqual(['1', '3']);
    expect(
      (await db.getAllFromIndex('transactions', 'by-account', 'bank')).map((t) => t.id),
    ).toEqual(['2']);
  });

  it('keeps data when reopened', async () => {
    db = await openKakeiboDB(testDbName);
    await db.put('categories', { id: 'c', name: '食費', type: 'expense', color: '#ff0000', order: 0 });
    db.close();

    db = await openKakeiboDB(testDbName);
    expect(await db.count('categories')).toBe(1);
  });
});
