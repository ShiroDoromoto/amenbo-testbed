import { addMonths, startOfMonth, type DateString } from '../../lib/date.ts';
import type { Transaction } from '../transaction.ts';
import { calculateMonthlySummary, type MonthlySummary } from './monthly.ts';

/** 推移に並べる月の数。 */
export const TREND_MONTHS = 12;

/** 推移の中の1か月分の収支。 */
export interface MonthlyTrendPoint extends MonthlySummary {
  /** その月の 1 日。 */
  month: DateString;
}

/**
 * `month` を含む月までの直近 12 か月について、月ごとの収入・支出・差額を計算する。`month` はその月のどの日付でもよい。
 *
 * 古い月から順に 12 件を返す。最後の 1 件が `month` を含む月になる。取引の無い月も、0 の収支で返す。
 * 月ごとの数え方は `calculateMonthlySummary` と同じで、振替は数えない。
 * `month` が `YYYY-MM-DD` でないときや、金額が整数でないとき、合計が扱える範囲を超えたときは例外を投げる。
 */
export function calculateMonthlyTrend(
  transactions: readonly Transaction[],
  month: DateString,
): MonthlyTrendPoint[] {
  const last = startOfMonth(month);
  return Array.from({ length: TREND_MONTHS }, (_, i) => {
    const current = addMonths(last, i - (TREND_MONTHS - 1));
    return { month: current, ...calculateMonthlySummary(transactions, current) };
  });
}
