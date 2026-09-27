import type { KakeiboDB } from '../index.ts';
import type { Migration } from './run.ts';

/** 定期取引のストアを作る。 */
export const v4: Migration<KakeiboDB> = {
  version: 4,
  migrate(db) {
    db.createObjectStore('recurringTransactions', { keyPath: 'id' });
  },
};
