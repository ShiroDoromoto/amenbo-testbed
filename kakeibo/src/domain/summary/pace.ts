import { endOfMonth, startOfMonth, type DateString } from '../../lib/date.ts';
import { isYen, sumYen, type Yen } from '../../lib/money.ts';
import type { Transaction } from '../transaction.ts';

/** 月初から今日までの支出のペースと、そのペースで月末まで使ったときの見込み。 */
export interface ExpensePace {
  /** 月初から今日までの支出の合計。 */
  spent: Yen;
  /** 月初から今日までの日数。今日を含む。 */
  elapsedDays: number;
  /** その月の日数。 */
  daysInMonth: number;
  /** 1日あたりの平均支出。`spent` を `elapsedDays` で割り、円に丸める。 */
  dailyAverage: Yen;
  /** 月末までの支出見込み。`spent` を `elapsedDays` で割り、`daysInMonth` を掛けて円に丸める。 */
  projected: Yen;
}

/**
 * `today` を含む月の、月初から `today` までの支出から、1日あたりの平均と月末までの支出見込みを出す。
 *
 * 数えるのは、`date` がその月の 1 日から `today` までの支出。振替と収入は数えない。
 * `today` より後の日付の支出は、まだ使っていないものとして数えない。
 * `today` が `YYYY-MM-DD` でないときや、金額が整数でないとき、合計が扱える範囲を超えたときは例外を投げる。
 */
export function calculateExpensePace(
  transactions: readonly Transaction[],
  today: DateString,
): ExpensePace {
  const from = startOfMonth(today);
  const elapsedDays = Number(today.slice(8, 10));
  const daysInMonth = Number(endOfMonth(today).slice(8, 10));
  const expenses: Yen[] = [];

  for (const transaction of transactions) {
    if (transaction.type !== 'expense') continue;
    if (transaction.date < from || transaction.date > today) continue;
    expenses.push(transaction.amount);
  }

  const spent = sumYen(expenses);
  const dailyAverage = Math.round(spent / elapsedDays);
  const projected = Math.round((spent / elapsedDays) * daysInMonth);
  if (!isYen(projected)) throw new RangeError(`見込みが扱える範囲を超えました: ${projected}`);
  return { spent, elapsedDays, daysInMonth, dailyAverage, projected };
}
