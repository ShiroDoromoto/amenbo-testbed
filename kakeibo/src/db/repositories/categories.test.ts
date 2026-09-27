import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { deleteDB } from 'idb';
import { openKakeiboDB, type KakeiboDBConnection } from '../index.ts';
import {
  addCategory,
  deleteCategory,
  getCategory,
  listCategories,
  updateCategory,
  type NewCategory,
} from './categories.ts';

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
