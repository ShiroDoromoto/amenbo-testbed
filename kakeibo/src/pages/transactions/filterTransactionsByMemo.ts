import type { Transaction } from '../../domain/transaction.ts';

/**
 * メモに `keyword` を含む取引だけを、渡された順のまま返す。
 * 前後の空白は無視し、英字の大文字と小文字は区別しない。キーワードが空なら、すべて返す。
 */
export function filterTransactionsByMemo(
  transactions: readonly Transaction[],
  keyword: string,
): readonly Transaction[] {
  const needle = keyword.trim().toLowerCase();
  if (needle === '') return transactions;
  return transactions.filter((transaction) => transaction.memo.toLowerCase().includes(needle));
}
