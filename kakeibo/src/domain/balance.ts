import { addMonths, endOfMonth, startOfMonth, type DateString } from '../lib/date.ts';
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

/** 残高の推移に並べる月の数。 */
export const BALANCE_TREND_MONTHS = 12;

/** 残高の推移の中の1か月分。 */
export interface BalanceTrendPoint {
  /** その月の 1 日。 */
  month: DateString;
  /** その月の末日の時点での、すべての口座の残高の合計。 */
  balance: Yen;
}

/**
 * `month` を含む月までの直近 12 か月について、月末の時点での残高の合計を計算する。`month` はその月のどの日付でもよい。
 *
 * 古い月から順に 12 件を返す。最後の 1 件が `month` を含む月になる。
 * 各月の残高は、`date` がその月の末日までの取引を `calculateBalances` と同じ数え方で積み、すべての口座について足したもの。
 * `month` が `YYYY-MM-DD` でないときや、金額が整数でないとき、残高が扱える範囲を超えたときは例外を投げる。
 */
export function calculateBalanceTrend(
  accounts: readonly Account[],
  transactions: readonly Transaction[],
  month: DateString,
): BalanceTrendPoint[] {
  const last = startOfMonth(month);
  return Array.from({ length: BALANCE_TREND_MONTHS }, (_, i) => {
    const current = addMonths(last, i - (BALANCE_TREND_MONTHS - 1));
    const to = endOfMonth(current);
    const upToMonthEnd = transactions.filter((transaction) => transaction.date <= to);
    const balances = calculateBalances(accounts, upToMonthEnd);
    return { month: current, balance: sumYen(balances.values()) };
  });
}
