import type { KakeiboDBConnection } from '../index.ts';
import type { Transaction } from '../../domain/transaction.ts';

export type NewTransaction = Omit<Transaction, 'id'>;

/** 取引を追加し、id を振って返す。 */
export async function addTransaction(
  db: KakeiboDBConnection,
  input: NewTransaction,
): Promise<Transaction> {
  const transaction: Transaction = { ...input, id: crypto.randomUUID() };
  await db.add('transactions', transaction);
  return transaction;
}

/** 既存の取引を丸ごと置き換える。id の取引が無ければ投げる。 */
export async function updateTransaction(
  db: KakeiboDBConnection,
  transaction: Transaction,
): Promise<void> {
  const tx = db.transaction('transactions', 'readwrite');
  if ((await tx.store.getKey(transaction.id)) === undefined) {
    tx.abort();
    await tx.done.catch(() => {});
    throw new Error(`Transaction not found: ${transaction.id}`);
  }
  await tx.store.put(transaction);
  await tx.done;
}

/** 取引を消す。id の取引が無ければ何もしない。 */
export async function deleteTransaction(db: KakeiboDBConnection, id: string): Promise<void> {
  await db.delete('transactions', id);
}

/**
 * `from` から `to` までの取引を、両端を含めて日付の古い順に返す。
 * 日付は `YYYY-MM-DD` で渡す。同じ日付の中の順は決めない。
 */
export async function listTransactionsByDateRange(
  db: KakeiboDBConnection,
  from: string,
  to: string,
): Promise<Transaction[]> {
  if (from > to) return [];
  return db.getAllFromIndex('transactions', 'by-date', IDBKeyRange.bound(from, to));
}
