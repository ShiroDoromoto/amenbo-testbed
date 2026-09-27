import type { Transaction } from '../../domain/transaction.ts';

/** 一覧の並び順。 */
export const transactionSortOrders = [
  'date-desc',
  'date-asc',
  'amount-desc',
  'amount-asc',
] as const;

export type TransactionSortOrder = (typeof transactionSortOrders)[number];

export function isTransactionSortOrder(value: unknown): value is TransactionSortOrder {
  return transactionSortOrders.includes(value as TransactionSortOrder);
}

const byDate = (a: Transaction, b: Transaction) => a.date.localeCompare(b.date);

const compare: Record<TransactionSortOrder, (a: Transaction, b: Transaction) => number> = {
  'date-desc': (a, b) => byDate(b, a),
  'date-asc': byDate,
  // 金額が同じなら、日付の新しい順にする。
  'amount-desc': (a, b) => b.amount - a.amount || byDate(b, a),
  'amount-asc': (a, b) => a.amount - b.amount || byDate(b, a),
};

/**
 * 取引を `order` の順に並べた新しい配列を返す。
 * 金額は符号を付けない額で比べ、振替も収入・支出と同じように並べる。
 * 日付も金額も同じ取引は、渡された順のまま保つ。
 */
export function sortTransactions(
  transactions: readonly Transaction[],
  order: TransactionSortOrder,
): Transaction[] {
  return [...transactions].sort(compare[order]);
}
