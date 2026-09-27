import type { KakeiboDBConnection } from '../index.ts';
import type {
  IncomeExpenseTransaction,
  Transaction,
  TransferTransaction,
} from '../../domain/transaction.ts';

export type NewTransaction = Omit<IncomeExpenseTransaction, 'id'> | Omit<TransferTransaction, 'id'>;

/** 振替元と振替先が同じ口座の振替は、保存せずに投げる。 */
function assertSavable(transaction: NewTransaction): void {
  if (transaction.type === 'transfer' && transaction.accountId === transaction.toAccountId) {
    throw new Error(`Transfer to the same account: ${transaction.accountId}`);
  }
}

/** 取引を追加し、id を振って返す。 */
export async function addTransaction(
  db: KakeiboDBConnection,
  input: NewTransaction,
): Promise<Transaction> {
  assertSavable(input);
  const transaction: Transaction = { ...input, id: crypto.randomUUID() };
  await db.add('transactions', transaction);
  return transaction;
}

/** 消した取引を、同じ id のまま入れ直す。同じ id の取引が既にあれば投げる。 */
export async function restoreTransaction(
  db: KakeiboDBConnection,
  transaction: Transaction,
): Promise<void> {
  assertSavable(transaction);
  await db.add('transactions', transaction);
}

/** id の取引を返す。無ければ `undefined` を返す。 */
export async function getTransaction(
  db: KakeiboDBConnection,
  id: string,
): Promise<Transaction | undefined> {
  return db.get('transactions', id);
}

/** 既存の取引を丸ごと置き換える。収支と振替の間で区分を変えてもよい。id の取引が無ければ投げる。 */
export async function updateTransaction(
  db: KakeiboDBConnection,
  transaction: Transaction,
): Promise<void> {
  assertSavable(transaction);
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

/** すべての取引を返す。順は決めない。 */
export async function listTransactions(db: KakeiboDBConnection): Promise<Transaction[]> {
  return db.getAll('transactions');
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

/** `categoryId` のカテゴリを使っている取引の件数を返す。 */
export async function countTransactionsByCategory(
  db: KakeiboDBConnection,
  categoryId: string,
): Promise<number> {
  return db.countFromIndex('transactions', 'by-category', categoryId);
}
