import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { deleteDB, openDB, type IDBPDatabase } from 'idb';
import { applyMigrations, latestVersion, type Migration } from './run.ts';

const testDbName = 'kakeibo-migrations-test';

interface Item {
  id: string;
  name: string;
  label?: string;
}

/** 1: items を作る。2: 既存のデータに label を足す。3: label に索引を張る。 */
function sampleMigrations(applied: number[]): Migration[] {
  return [
    {
      version: 1,
      migrate(db) {
        applied.push(1);
        db.createObjectStore('items', { keyPath: 'id' });
      },
    },
    {
      version: 2,
      async migrate(_db, tx) {
        applied.push(2);
        const store = tx.objectStore('items');
        for (const item of (await store.getAll()) as Item[]) {
          await store.put({ ...item, label: item.name.toUpperCase() });
        }
      },
    },
    {
      version: 3,
      migrate(_db, tx) {
        applied.push(3);
        tx.objectStore('items').createIndex('by-label', 'label');
      },
    },
  ];
}

function open(migrations: readonly Migration[], version = latestVersion(migrations)) {
  return openDB(testDbName, version, {
    upgrade(db, oldVersion, newVersion, tx) {
      void applyMigrations(migrations, db, tx, oldVersion, newVersion ?? oldVersion);
    },
  });
}

let db: IDBPDatabase | undefined;

afterEach(async () => {
  db?.close();
  db = undefined;
  await deleteDB(testDbName);
  vi.restoreAllMocks();
});

describe('latestVersion', () => {
  it('returns the version of the last migration', () => {
    expect(latestVersion(sampleMigrations([]))).toBe(3);
  });

  it('rejects versions that skip or go out of order', () => {
    const [m1, m2, m3] = sampleMigrations([]);
    expect(() => latestVersion([m1!, m3!])).toThrow('expected 2');
    expect(() => latestVersion([m2!, m1!])).toThrow('expected 1');
  });

  it('rejects an empty list', () => {
    expect(() => latestVersion([])).toThrow();
  });
});

describe('applyMigrations', () => {
  it('applies every migration in order to a new database', async () => {
    const applied: number[] = [];
    db = await open(sampleMigrations(applied));
    expect(applied).toEqual([1, 2, 3]);
    expect(db.version).toBe(3);
  });

  it('applies only the migrations newer than the stored version, keeping data', async () => {
    db = await open(sampleMigrations([]), 1);
    await db.put('items', { id: 'a', name: 'rice' });
    db.close();

    const applied: number[] = [];
    db = await open(sampleMigrations(applied));
    expect(applied).toEqual([2, 3]);
    expect(await db.getAllFromIndex('items', 'by-label', 'RICE')).toEqual([
      { id: 'a', name: 'rice', label: 'RICE' },
    ]);
  });

  it('applies nothing when the database is already up to date', async () => {
    db = await open(sampleMigrations([]));
    db.close();

    const applied: number[] = [];
    db = await open(sampleMigrations(applied));
    expect(applied).toEqual([]);
  });

  it('leaves the database at its old version when a migration fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    db = await open(sampleMigrations([]), 1);
    await db.put('items', { id: 'a', name: 'rice' });
    db.close();
    db = undefined;

    const failing: Migration[] = [
      ...sampleMigrations([]).slice(0, 2),
      {
        version: 3,
        migrate() {
          throw new Error('boom');
        },
      },
    ];
    await expect(open(failing)).rejects.toThrow();

    db = await openDB(testDbName);
    expect(db.version).toBe(1);
    expect(await db.get('items', 'a')).toEqual({ id: 'a', name: 'rice' });
  });
});
