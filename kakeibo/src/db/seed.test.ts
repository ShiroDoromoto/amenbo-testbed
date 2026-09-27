import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { deleteDB, openDB } from 'idb';
import { isCategoryColor } from '../domain/category.ts';
import { openKakeiboDB, type KakeiboDB, type KakeiboDBConnection } from './index.ts';
import { applyMigrations, migrations } from './migrations/index.ts';
import { defaultCategories } from './seed.ts';

const testDbName = 'kakeibo-seed-test';

let db: KakeiboDBConnection | undefined;

afterEach(async () => {
  db?.close();
  db = undefined;
  await deleteDB(testDbName);
});

/** v1 までの移行だけを当てて開く。既定のカテゴリが入る前の DB を作る。 */
function openAtV1() {
  return openDB<KakeiboDB>(testDbName, 1, {
    upgrade(database, oldVersion, newVersion, tx) {
      void applyMigrations(migrations, database, tx, oldVersion, newVersion ?? oldVersion);
    },
  });
}

describe('defaultCategories', () => {
  it('has valid colors and unique names within each type', () => {
    for (const category of defaultCategories) {
      expect(isCategoryColor(category.color)).toBe(true);
    }
    for (const type of ['income', 'expense'] as const) {
      const ofType = defaultCategories.filter((c) => c.type === type);
      expect(ofType.length).toBeGreaterThan(0);
      expect(new Set(ofType.map((c) => c.name)).size).toBe(ofType.length);
      expect(ofType.map((c) => c.order)).toEqual(ofType.map((_, i) => i));
    }
  });
});

describe('seeding on first launch', () => {
  it('stores the default categories when the database is created', async () => {
    db = await openKakeiboDB(testDbName);
    const stored = await db.getAll('categories');
    expect(stored).toEqual(
      expect.arrayContaining(defaultCategories.map((c) => ({ ...c, id: expect.any(String) }))),
    );
    expect(stored).toHaveLength(defaultCategories.length);
    expect(new Set(stored.map((c) => c.id)).size).toBe(stored.length);
  });

  it('does not seed again when reopened, even after every category is deleted', async () => {
    db = await openKakeiboDB(testDbName);
    await db.clear('categories');
    db.close();

    db = await openKakeiboDB(testDbName);
    expect(await db.count('categories')).toBe(0);
  });

  it('seeds a database from before seeding when it has no categories', async () => {
    const old = await openAtV1();
    old.close();

    db = await openKakeiboDB(testDbName);
    expect(await db.count('categories')).toBe(defaultCategories.length);
  });

  it('leaves existing categories alone', async () => {
    const old = await openAtV1();
    await old.put('categories', {
      id: 'mine',
      name: '自分のカテゴリ',
      type: 'expense',
      color: '#123456',
      order: 0,
    });
    old.close();

    db = await openKakeiboDB(testDbName);
    expect(await db.getAllKeys('categories')).toEqual(['mine']);
  });
});
