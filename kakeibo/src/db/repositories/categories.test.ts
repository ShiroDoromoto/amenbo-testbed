import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { deleteDB } from 'idb';
import { openKakeiboDB, type KakeiboDBConnection } from '../index.ts';
import {
  addCategory,
  deleteCategory,
  deleteCategoryAndReassign,
  getCategory,
  listCategories,
  updateCategory,
  type NewCategory,
} from './categories.ts';
import { addTransaction, countTransactionsByCategory } from './transactions.ts';
import { addRecurringTransaction } from './recurring.ts';

const testDbName = 'kakeibo-categories-test';

function newCategory(overrides: Partial<NewCategory> = {}): NewCategory {
  return { name: '食費', type: 'expense', color: '#ff0000', order: 0, ...overrides };
}

let db: KakeiboDBConnection;

beforeEach(async () => {
  db = await openKakeiboDB(testDbName);
  // 既定のカテゴリを消し、空の状態から始める。
  await db.clear('categories');
});

afterEach(async () => {
  db.close();
  await deleteDB(testDbName);
});

describe('addCategory', () => {
  it('stores the category under a new id', async () => {
    const added = await addCategory(db, newCategory({ name: '交通費' }));
    expect(added.id).not.toBe('');
    expect(await db.get('categories', added.id)).toEqual(added);
    expect(added).toEqual({ ...newCategory({ name: '交通費' }), id: added.id });
  });

  it('gives each category its own id', async () => {
    const first = await addCategory(db, newCategory());
    const second = await addCategory(db, newCategory());
    expect(first.id).not.toBe(second.id);
    expect(await db.count('categories')).toBe(2);
  });
});

describe('updateCategory', () => {
  it('replaces the stored category', async () => {
    const added = await addCategory(db, newCategory());
    const changed = { ...added, name: '外食', color: '#00ff00', order: 5 };
    await updateCategory(db, changed);
    expect(await db.get('categories', added.id)).toEqual(changed);
  });

  it('throws when the category does not exist', async () => {
    await expect(updateCategory(db, { ...newCategory(), id: 'missing' })).rejects.toThrow(
      'Category not found: missing',
    );
    expect(await db.count('categories')).toBe(0);
  });
});

describe('deleteCategory', () => {
  it('removes the category', async () => {
    const kept = await addCategory(db, newCategory());
    const removed = await addCategory(db, newCategory());
    await deleteCategory(db, removed.id);
    expect(await db.getAllKeys('categories')).toEqual([kept.id]);
  });

  it('does nothing when the category does not exist', async () => {
    await addCategory(db, newCategory());
    await deleteCategory(db, 'missing');
    expect(await db.count('categories')).toBe(1);
  });
});

describe('deleteCategoryAndReassign', () => {
  const expense = (categoryId: string) =>
    ({
      date: '2026-01-01',
      amount: 1000,
      type: 'expense',
      categoryId,
      accountId: 'a',
      memo: '',
    }) as const;

  it('moves the transactions to the other category and removes the category', async () => {
    const from = await addCategory(db, newCategory({ name: '外食' }));
    const to = await addCategory(db, newCategory({ name: '食費' }));
    const other = await addCategory(db, newCategory({ name: '交通費' }));
    const moved1 = await addTransaction(db, expense(from.id));
    const moved2 = await addTransaction(db, expense(from.id));
    const untouched = await addTransaction(db, expense(other.id));
    const transfer = await addTransaction(db, {
      date: '2026-01-01',
      amount: 500,
      type: 'transfer',
      accountId: 'a',
      toAccountId: 'b',
      memo: '',
    });

    await deleteCategoryAndReassign(db, from.id, to.id);

    expect(await getCategory(db, from.id)).toBeUndefined();
    expect(await db.get('transactions', moved1.id)).toEqual({ ...moved1, categoryId: to.id });
    expect(await db.get('transactions', moved2.id)).toEqual({ ...moved2, categoryId: to.id });
    expect(await db.get('transactions', untouched.id)).toEqual(untouched);
    expect(await db.get('transactions', transfer.id)).toEqual(transfer);
    expect(await countTransactionsByCategory(db, from.id)).toBe(0);
    expect(await countTransactionsByCategory(db, to.id)).toBe(2);
  });

  it('moves the recurring transactions to the other category', async () => {
    const from = await addCategory(db, newCategory({ name: '外食' }));
    const to = await addCategory(db, newCategory({ name: '食費' }));
    const moved = await addRecurringTransaction(db, { ...expense(from.id), dayOfMonth: 1 });
    const untouched = await addRecurringTransaction(db, { ...expense(to.id), dayOfMonth: 2 });

    await deleteCategoryAndReassign(db, from.id, to.id);

    expect(await db.get('recurringTransactions', moved.id)).toEqual({
      ...moved,
      categoryId: to.id,
    });
    expect(await db.get('recurringTransactions', untouched.id)).toEqual(untouched);
  });

  it('removes an unused category', async () => {
    const from = await addCategory(db, newCategory());
    const to = await addCategory(db, newCategory());
    await deleteCategoryAndReassign(db, from.id, to.id);
    expect(await db.getAllKeys('categories')).toEqual([to.id]);
  });

  it('throws and changes nothing when the target category does not exist', async () => {
    const from = await addCategory(db, newCategory());
    const used = await addTransaction(db, expense(from.id));
    await expect(deleteCategoryAndReassign(db, from.id, 'missing')).rejects.toThrow(
      'Category not found: missing',
    );
    expect(await getCategory(db, from.id)).toEqual(from);
    expect(await db.get('transactions', used.id)).toEqual(used);
  });

  it('throws when the deleted category does not exist', async () => {
    const to = await addCategory(db, newCategory());
    await expect(deleteCategoryAndReassign(db, 'missing', to.id)).rejects.toThrow(
      'Category not found: missing',
    );
    expect(await db.count('categories')).toBe(1);
  });

  it('throws when reassigning to the deleted category itself', async () => {
    const from = await addCategory(db, newCategory());
    await expect(deleteCategoryAndReassign(db, from.id, from.id)).rejects.toThrow(
      `Cannot reassign to the deleted category: ${from.id}`,
    );
    expect(await getCategory(db, from.id)).toEqual(from);
  });

  it('throws and changes nothing when the categories differ in type', async () => {
    const from = await addCategory(db, newCategory({ type: 'expense' }));
    const to = await addCategory(db, newCategory({ type: 'income' }));
    const used = await addTransaction(db, expense(from.id));
    await expect(deleteCategoryAndReassign(db, from.id, to.id)).rejects.toThrow(
      'Category type mismatch: expense to income',
    );
    expect(await getCategory(db, from.id)).toEqual(from);
    expect(await db.get('transactions', used.id)).toEqual(used);
  });
});

describe('getCategory', () => {
  it('returns the category with the id', async () => {
    const added = await addCategory(db, newCategory());
    expect(await getCategory(db, added.id)).toEqual(added);
  });

  it('returns undefined when the category does not exist', async () => {
    expect(await getCategory(db, 'missing')).toBeUndefined();
  });
});

describe('listCategories', () => {
  it('returns all categories sorted by order, then by name', async () => {
    await addCategory(db, newCategory({ name: '日用品', order: 1 }));
    await addCategory(db, newCategory({ name: '給与', type: 'income', order: 0 }));
    await addCategory(db, newCategory({ name: '交通費', order: 1 }));
    await addCategory(db, newCategory({ name: '食費', order: 2 }));

    const all = await listCategories(db);
    expect(all.map((c) => c.name)).toEqual(['給与', '交通費', '日用品', '食費']);
  });

  it('returns only the categories of the given type', async () => {
    await addCategory(db, newCategory({ name: '食費', type: 'expense', order: 1 }));
    await addCategory(db, newCategory({ name: '給与', type: 'income', order: 1 }));
    await addCategory(db, newCategory({ name: '賞与', type: 'income', order: 0 }));

    const income = await listCategories(db, 'income');
    expect(income.map((c) => c.name)).toEqual(['賞与', '給与']);
    const expense = await listCategories(db, 'expense');
    expect(expense.map((c) => c.name)).toEqual(['食費']);
  });

  it('returns nothing when there are no categories', async () => {
    expect(await listCategories(db)).toEqual([]);
  });
});
