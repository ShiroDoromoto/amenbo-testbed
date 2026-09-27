import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Account } from '../domain/account.ts';
import type { Category } from '../domain/category.ts';
import type { Transaction } from '../domain/transaction.ts';
import { applyMigrations, latestVersion, migrations } from './migrations/index.ts';

export const dbName = 'kakeibo';

/** スキーマのバージョン。`migrations/` の最後の移行のバージョンで、移行を足すと上がる。 */
export const dbVersion = latestVersion(migrations);

export interface KakeiboDB extends DBSchema {
  transactions: {
    key: string;
    value: Transaction;
    indexes: {
      'by-date': string;
      'by-category': string;
      'by-account': string;
      'by-to-account': string;
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
    upgrade(db, oldVersion, newVersion, tx) {
      void applyMigrations(migrations, db, tx, oldVersion, newVersion ?? oldVersion);
    },
  });
}
