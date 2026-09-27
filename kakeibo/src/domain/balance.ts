import { sumYen, type Yen } from '../lib/money.ts';
import type { Account } from './account.ts';
import type { Transaction } from './transaction.ts';

/**
 * 口座ごとの残高を計算する。キーは口座の `id`。
 *
 * 残高は、初期残高に収入を足し、支出を引いたもの。振替は、振替元から引いて振替先に足す。
 * `accounts` に無い口座を指す取引は、その口座の分だけ数えない。
 * 金額が整数でないときや、残高が扱える範囲を超えたときは例外を投げる。
 */
export function calculateBalances(
  accounts: readonly Account[],
  transactions: readonly Transaction[],
): Map<string, Yen> {
  const movements = new Map<string, Yen[]>(
    accounts.map((account) => [account.id, [account.initialBalance]]),
  );
  const record = (accountId: string, amount: Yen) => {
    movements.get(accountId)?.push(amount);
  };

  for (const transaction of transactions) {
    switch (transaction.type) {
      case 'income':
        record(transaction.accountId, transaction.amount);
        break;
      case 'expense':
        record(transaction.accountId, -transaction.amount);
        break;
      case 'transfer':
        record(transaction.accountId, -transaction.amount);
        record(transaction.toAccountId, transaction.amount);
        break;
    }
  }

  return new Map([...movements].map(([accountId, amounts]) => [accountId, sumYen(amounts)]));
}
