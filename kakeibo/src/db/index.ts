import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Account } from '../domain/account.ts';
import type { Category } from '../domain/category.ts';
import type { Transaction } from '../domain/transaction.ts';

export const dbName = 'kakeibo';

/** ストアや索引を変えたら上げ、`upgrade` に移行を足す。 */
export const dbVersion = 1;

export interface KakeiboDB extends DBSchema {
  transactions: {
    key: string;
    value: Transaction;
    indexes: {
      'by-date': string;
      'by-category': string;
      'by-account': string;
    };
  };
  categories: {
    key: string;
    value: Category;
  };
  accounts: {
    key: string;
    value: Account;
  };
}

export type KakeiboDBConnection = IDBPDatabase<KakeiboDB>;

export function openKakeiboDB(name: string = dbName): Promise<KakeiboDBConnection> {
  return openDB<KakeiboDB>(name, dbVersion, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        const transactions = db.createObjectStore('transactions', { keyPath: 'id' });
        transactions.createIndex('by-date', 'date');
        transactions.createIndex('by-category', 'categoryId');
        transactions.createIndex('by-account', 'accountId');
        db.createObjectStore('categories', { keyPath: 'id' });
        db.createObjectStore('accounts', { keyPath: 'id' });
      }
    },
  });
}
