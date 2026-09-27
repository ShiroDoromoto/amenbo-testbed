import type { Transaction } from '../../domain/transaction.ts';
import type { Yen } from '../../lib/money.ts';

/**
 * 金額が `min` 以上 `max` 以下の取引だけを、渡された順のまま返す。両端を含む。
 * `null` の端は絞り込まない。振替も金額で比べる。
 */
export function filterTransactionsByAmount(
  transactions: readonly Transaction[],
  min: Yen | null,
  max: Yen | null,
): readonly Transaction[] {
  if (min === null && max === null) return transactions;
  return transactions.filter(
    ({ amount }) => (min === null || amount >= min) && (max === null || amount <= max),
  );
}
