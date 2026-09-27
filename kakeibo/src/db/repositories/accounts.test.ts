import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { deleteDB } from 'idb';
import { openKakeiboDB, type KakeiboDBConnection } from '../index.ts';
import {
  addAccount,
  deleteAccount,
  getAccount,
  listAccounts,
  updateAccount,
  type NewAccount,
} from './accounts.ts';

const testDbName = 'kakeibo-accounts-test';

function newAccount(overrides: Partial<NewAccount> = {}): NewAccount {
  return { name: '財布', type: 'cash', initialBalance: 0, ...overrides };
}

let db: KakeiboDBConnection;

beforeEach(async () => {
  db = await openKakeiboDB(testDbName);
});

afterEach(async () => {
  db.close();
  await deleteDB(testDbName);
});

describe('addAccount', () => {
  it('stores the account under a new id', async () => {
    const added = await addAccount(db, newAccount({ name: '普通預金', type: 'bank' }));
    expect(added.id).not.toBe('');
    expect(await db.get('accounts', added.id)).toEqual(added);
    expect(added).toEqual({ ...newAccount({ name: '普通預金', type: 'bank' }), id: added.id });
  });

  it('gives each account its own id', async () => {
    const first = await addAccount(db, newAccount());
    const second = await addAccount(db, newAccount());
    expect(first.id).not.toBe(second.id);
    expect(await db.count('accounts')).toBe(2);
  });

  it('keeps a negative initial balance', async () => {
    const added = await addAccount(db, newAccount({ type: 'card', initialBalance: -12000 }));
    expect((await db.get('accounts', added.id))?.initialBalance).toBe(-12000);
  });
});

describe('updateAccount', () => {
  it('replaces the stored account', async () => {
    const added = await addAccount(db, newAccount());
    const changed = { ...added, name: 'へそくり', initialBalance: 5000 };
    await updateAccount(db, changed);
    expect(await db.get('accounts', added.id)).toEqual(changed);
  });

  it('throws when the account does not exist', async () => {
    await expect(updateAccount(db, { ...newAccount(), id: 'missing' })).rejects.toThrow(
      'Account not found: missing',
    );
    expect(await db.count('accounts')).toBe(0);
  });
});

describe('deleteAccount', () => {
  it('removes the account', async () => {
    const kept = await addAccount(db, newAccount());
    const removed = await addAccount(db, newAccount());
    await deleteAccount(db, removed.id);
    expect(await db.getAllKeys('accounts')).toEqual([kept.id]);
  });

  it('does nothing when the account does not exist', async () => {
    await addAccount(db, newAccount());
    await deleteAccount(db, 'missing');
    expect(await db.count('accounts')).toBe(1);
  });
});

describe('getAccount', () => {
  it('returns the account with the id', async () => {
    const added = await addAccount(db, newAccount());
    expect(await getAccount(db, added.id)).toEqual(added);
  });

  it('returns undefined when the account does not exist', async () => {
    expect(await getAccount(db, 'missing')).toBeUndefined();
  });
});

describe('listAccounts', () => {
  it('returns all accounts sorted by name', async () => {
    await addAccount(db, newAccount({ name: 'さいふ' }));
    await addAccount(db, newAccount({ name: 'カード', type: 'card' }));
    await addAccount(db, newAccount({ name: 'ぎんこう', type: 'bank' }));

    const all = await listAccounts(db);
    expect(all.map((a) => a.name)).toEqual(['カード', 'ぎんこう', 'さいふ']);
  });

  it('returns nothing when there are no accounts', async () => {
    expect(await listAccounts(db)).toEqual([]);
  });
});
