import type { KakeiboDB } from '../index.ts';
import type { Migration } from './run.ts';

/** 取引・カテゴリ・口座のストアと、取引を引く索引を作る。 */
export const v1: Migration<KakeiboDB> = {
  version: 1,
  migrate(db) {
    const transactions = db.createObjectStore('transactions', { keyPath: 'id' });
    transactions.createIndex('by-date', 'date');
    transactions.createIndex('by-category', 'categoryId');
    transactions.createIndex('by-account', 'accountId');
    db.createObjectStore('categories', { keyPath: 'id' });
    db.createObjectStore('accounts', { keyPath: 'id' });
  },
};
