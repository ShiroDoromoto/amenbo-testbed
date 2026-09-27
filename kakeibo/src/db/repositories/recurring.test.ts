import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { deleteDB } from 'idb';
import { openKakeiboDB, type KakeiboDBConnection } from '../index.ts';
import type {
  IncomeExpenseRecurringTransaction,
  TransferRecurringTransaction,
} from '../../domain/recurring.ts';
import {
  addRecurringTransaction,
  deleteRecurringTransaction,
  getRecurringTransaction,
  listRecurringTransactions,
  updateRecurringTransaction,
  type NewRecurringTransaction,
} from './recurring.ts';

const testDbName = 'kakeibo-recurring-test';

function newRecurring(
  overrides: Partial<Omit<IncomeExpenseRecurringTransaction, 'id'>> = {},
): NewRecurringTransaction {
  return {
    dayOfMonth: 27,
    amount: 80000,
    type: 'expense',
    categoryId: 'rent',
    accountId: 'bank',
    memo: '',
    ...overrides,
  };
}

function newTransfer(
  overrides: Partial<Omit<TransferRecurringTransaction, 'id'>> = {},
): Omit<TransferRecurringTransaction, 'id'> {
  return {
    dayOfMonth: 25,
    amount: 30000,
    type: 'transfer',
    accountId: 'bank',
    toAccountId: 'savings',
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

describe('addRecurringTransaction', () => {
  it('stores the recurring transaction under a new id', async () => {
    const added = await addRecurringTransaction(db, newRecurring({ memo: '家賃' }));
    expect(added.id).not.toBe('');
    expect(added).toEqual({ ...newRecurring({ memo: '家賃' }), id: added.id });
    expect(await db.get('recurringTransactions', added.id)).toEqual(added);
  });

  it('gives each recurring transaction its own id', async () => {
    const first = await addRecurringTransaction(db, newRecurring());
    const second = await addRecurringTransaction(db, newRecurring());
    expect(first.id).not.toBe(second.id);
    expect(await db.count('recurringTransactions')).toBe(2);
  });

  it('stores a transfer with the accounts it moves money between', async () => {
    const added = await addRecurringTransaction(db, newTransfer({ memo: '積立' }));
    expect(await db.get('recurringTransactions', added.id)).toEqual({
      ...newTransfer({ memo: '積立' }),
      id: added.id,
    });
  });

  it.each([0, 32, 1.5])('rejects day %s of the month', async (dayOfMonth) => {
    await expect(addRecurringTransaction(db, newRecurring({ dayOfMonth }))).rejects.toThrow(
      `Invalid day of month: ${dayOfMonth}`,
    );
    expect(await db.count('recurringTransactions')).toBe(0);
  });

  it('rejects a transfer to the same account', async () => {
    await expect(
      addRecurringTransaction(db, newTransfer({ accountId: 'bank', toAccountId: 'bank' })),
    ).rejects.toThrow('Transfer to the same account: bank');
    expect(await db.count('recurringTransactions')).toBe(0);
  });
});

describe('getRecurringTransaction', () => {
  it('returns the recurring transaction with the id', async () => {
    await addRecurringTransaction(db, newRecurring());
    const added = await addRecurringTransaction(db, newRecurring({ memo: '探す' }));
    expect(await getRecurringTransaction(db, added.id)).toEqual(added);
  });

  it('returns undefined when the recurring transaction does not exist', async () => {
    expect(await getRecurringTransaction(db, 'missing')).toBeUndefined();
  });
});

describe('updateRecurringTransaction', () => {
  it('replaces the stored recurring transaction', async () => {
    const added = await addRecurringTransaction(db, newRecurring());
    const changed = { ...added, dayOfMonth: 31, amount: 85000 };
    await updateRecurringTransaction(db, changed);
    expect(await db.get('recurringTransactions', added.id)).toEqual(changed);
  });

  it('turns an expense into a transfer', async () => {
    const added = await addRecurringTransaction(db, newRecurring());
    const changed = { ...newTransfer(), id: added.id };
    await updateRecurringTransaction(db, changed);
    expect(await db.get('recurringTransactions', added.id)).toEqual(changed);
  });

  it('rejects an invalid day of the month', async () => {
    const added = await addRecurringTransaction(db, newRecurring());
    await expect(updateRecurringTransaction(db, { ...added, dayOfMonth: 0 })).rejects.toThrow(
      'Invalid day of month: 0',
    );
    expect(await db.get('recurringTransactions', added.id)).toEqual(added);
  });

  it('rejects a transfer to the same account', async () => {
    const added = await addRecurringTransaction(db, newTransfer());
    await expect(
      updateRecurringTransaction(db, {
        ...added,
        type: 'transfer',
        accountId: 'a',
        toAccountId: 'a',
      }),
    ).rejects.toThrow('Transfer to the same account: a');
    expect(await db.get('recurringTransactions', added.id)).toEqual(added);
  });

  it('throws when the recurring transaction does not exist', async () => {
    await expect(
      updateRecurringTransaction(db, { ...newRecurring(), id: 'missing' }),
    ).rejects.toThrow('Recurring transaction not found: missing');
    expect(await db.count('recurringTransactions')).toBe(0);
  });
});

describe('deleteRecurringTransaction', () => {
  it('removes the recurring transaction', async () => {
    const kept = await addRecurringTransaction(db, newRecurring());
    const removed = await addRecurringTransaction(db, newRecurring());
    await deleteRecurringTransaction(db, removed.id);
    expect(await db.getAllKeys('recurringTransactions')).toEqual([kept.id]);
  });

  it('does nothing when the recurring transaction does not exist', async () => {
    await addRecurringTransaction(db, newRecurring());
    await deleteRecurringTransaction(db, 'missing');
    expect(await db.count('recurringTransactions')).toBe(1);
  });
});

describe('listRecurringTransactions', () => {
  it('returns recurring transactions by day of the month, earliest first', async () => {
    for (const dayOfMonth of [27, 1, 31, 10]) {
      await addRecurringTransaction(db, newRecurring({ dayOfMonth }));
    }
    const list = await listRecurringTransactions(db);
    expect(list.map((r) => r.dayOfMonth)).toEqual([1, 10, 27, 31]);
  });

  it('returns nothing when there are none', async () => {
    expect(await listRecurringTransactions(db)).toEqual([]);
  });
});
