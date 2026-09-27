import { isTransfer, type Transaction } from '../../domain/transaction.ts';

/** 口座 `accountId` が関わる取引だけを、渡された順のまま返す。振替は、振替元か振替先がその口座なら残す。 */
export function filterTransactionsByAccount(
  transactions: readonly Transaction[],
  accountId: string,
): Transaction[] {
  return transactions.filter(
    (transaction) =>
      transaction.accountId === accountId ||
      (isTransfer(transaction) && transaction.toAccountId === accountId),
  );
}
