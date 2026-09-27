import type { KakeiboDB } from '../index.ts';
import type { Migration } from './run.ts';

/** 振替先の口座で取引を引く索引を作る。振替元は `by-account` で引ける。 */
export const v3: Migration<KakeiboDB> = {
  version: 3,
  migrate(_db, tx) {
    tx.objectStore('transactions').createIndex('by-to-account', 'toAccountId');
  },
};
