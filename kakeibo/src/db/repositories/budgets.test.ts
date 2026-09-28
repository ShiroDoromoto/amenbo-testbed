import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { deleteDB } from 'idb';
import { openKakeiboDB, type KakeiboDBConnection } from '../index.ts';
import { deleteBudget, getBudget, listBudgets, setBudget } from './budgets.ts';

const testDbName = 'kakeibo-budgets-test';

let db: KakeiboDBConnection;

beforeEach(async () => {
  db = await openKakeiboDB(testDbName);
  await db.clear('categories');
  await db.put('categories', {
    id: 'food',
    name: '食費',
    type: 'expense',
    color: '#ff0000',
    order: 0,
  });
  await db.put('categories', {
    id: 'rent',
    name: '住居',
    type: 'expense',
    color: '#00ff00',
    order: 1,
  });
  await db.put('categories', {
    id: 'salary',
    name: '給与',
    type: 'income',
    color: '#0000ff',
    order: 0,
  });
});

afterEach(async () => {
  db.close();
  await deleteDB(testDbName);
});

describe('setBudget', () => {
  it('stores a budget under a new id', async () => {
    const budget = await setBudget(db, { categoryId: 'food', month: '2026-09', amount: 30000 });
    expect(budget.id).not.toBe('');
    expect(budget).toEqual({ categoryId: 'food', month: '2026-09', amount: 30000, id: budget.id });
    expect(await db.get('budgets', budget.id)).toEqual(budget);
  });

  it('replaces the amount of the same category and month, keeping the id', async () => {
    const first = await setBudget(db, { categoryId: 'food', month: '2026-09', amount: 30000 });
    const second = await setBudget(db, { categoryId: 'food', month: '2026-09', amount: 25000 });
    expect(second).toEqual({ ...first, amount: 25000 });
    expect(await db.count('budgets')).toBe(1);
    expect(await db.get('budgets', first.id)).toEqual(second);
  });

  it('keeps separate budgets for other categories and months', async () => {
    await setBudget(db, { categoryId: 'food', month: '2026-09', amount: 30000 });
    await setBudget(db, { categoryId: 'food', month: '2026-10', amount: 32000 });
    await setBudget(db, { categoryId: 'rent', month: '2026-09', amount: 80000 });
    expect(await db.count('budgets')).toBe(3);
  });

  it('accepts a budget of 0 yen', async () => {
    const budget = await setBudget(db, { categoryId: 'food', month: '2026-09', amount: 0 });
    expect(await db.get('budgets', budget.id)).toEqual(budget);
  });

  it.each(['2026-13', '2026-9', '2026-09-01', ''])('throws on the month %s', async (month) => {
    await expect(setBudget(db, { categoryId: 'food', month, amount: 1000 })).rejects.toThrow(
      'Invalid budget month',
    );
    expect(await db.count('budgets')).toBe(0);
  });

  it.each([-1, 1.5, Number.NaN])('throws on the amount %s', async (amount) => {
    await expect(setBudget(db, { categoryId: 'food', month: '2026-09', amount })).rejects.toThrow(
      'Invalid budget amount',
    );
    expect(await db.count('budgets')).toBe(0);
  });

  it('throws when the category does not exist', async () => {
    await expect(
      setBudget(db, { categoryId: 'missing', month: '2026-09', amount: 1000 }),
    ).rejects.toThrow('Expense category not found: missing');
    expect(await db.count('budgets')).toBe(0);
  });

  it('throws when the category is for income', async () => {
    await expect(
      setBudget(db, { categoryId: 'salary', month: '2026-09', amount: 1000 }),
    ).rejects.toThrow('Expense category not found: salary');
    expect(await db.count('budgets')).toBe(0);
  });
});

describe('the budgets store', () => {
  it('refuses a second budget for the same category and month', async () => {
    await db.add('budgets', { id: 'a', categoryId: 'food', month: '2026-09', amount: 1000 });
    await expect(
      db.add('budgets', { id: 'b', categoryId: 'food', month: '2026-09', amount: 2000 }),
    ).rejects.toThrow();
  });
});

describe('getBudget', () => {
  it('returns the budget of the category and month', async () => {
    const budget = await setBudget(db, { categoryId: 'food', month: '2026-09', amount: 30000 });
    await setBudget(db, { categoryId: 'food', month: '2026-10', amount: 32000 });
    expect(await getBudget(db, 'food', '2026-09')).toEqual(budget);
  });

  it('returns undefined when there is no budget', async () => {
    await setBudget(db, { categoryId: 'food', month: '2026-09', amount: 30000 });
    expect(await getBudget(db, 'rent', '2026-09')).toBeUndefined();
    expect(await getBudget(db, 'food', '2026-08')).toBeUndefined();
  });
});

describe('listBudgets', () => {
  it('returns only the budgets of the month', async () => {
    const food = await setBudget(db, { categoryId: 'food', month: '2026-09', amount: 30000 });
    const rent = await setBudget(db, { categoryId: 'rent', month: '2026-09', amount: 80000 });
    await setBudget(db, { categoryId: 'food', month: '2026-10', amount: 32000 });
    const budgets = await listBudgets(db, '2026-09');
    expect(budgets).toHaveLength(2);
    expect(budgets).toEqual(expect.arrayContaining([food, rent]));
  });

  it('returns an empty list when the month has no budget', async () => {
    expect(await listBudgets(db, '2026-09')).toEqual([]);
  });
});

describe('deleteBudget', () => {
  it('deletes the budget', async () => {
    const budget = await setBudget(db, { categoryId: 'food', month: '2026-09', amount: 30000 });
    await deleteBudget(db, budget.id);
    expect(await getBudget(db, 'food', '2026-09')).toBeUndefined();
  });

  it('does nothing when the budget does not exist', async () => {
    await expect(deleteBudget(db, 'missing')).resolves.toBeUndefined();
  });
});
