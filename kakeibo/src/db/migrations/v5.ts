import type { KakeiboDB } from '../index.ts';
import type { Migration } from './run.ts';

/** 口座に締め日と引き落とし日を足す。既存の口座は、どちらも決めていない（`null`）ことにする。 */
export const v5: Migration<KakeiboDB> = {
  version: 5,
  async migrate(_db, tx) {
    const store = tx.objectStore('accounts');
    for (const account of await store.getAll()) {
      await store.put({
        ...account,
        closingDay: account.closingDay ?? null,
        paymentDay: account.paymentDay ?? null,
      });
    }
  },
};
