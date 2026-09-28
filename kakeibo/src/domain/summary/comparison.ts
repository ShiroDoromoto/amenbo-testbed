import { addMonths, startOfMonth, type DateString } from '../../lib/date.ts';
import { sumYen, type Yen } from '../../lib/money.ts';
import type { Transaction } from '../transaction.ts';
import { calculateMonthlySummary, type MonthlySummary } from './monthly.ts';

/** 比べる元の月から、ある値がどれだけ変わったか。 */
export interface Change {
  /** 今月の値から、比べる元の値を引いた差。 */
  difference: Yen;
  /**
   * 差を、比べる元の値の大きさ（絶対値）で割った割合。`0.1` なら 10% 増えた。
   * 比べる元が 0 のときは割合を出せないので `null` にする。
   */
  rate: number | null;
}

/** 収入・支出・差額それぞれの変化。 */
export interface SummaryChange {
  income: Change;
  expense: Change;
  balance: Change;
}

/** 今月の収支と、前月・前年同月からの変化。 */
export interface MonthlyComparison {
  current: MonthlySummary;
  /** 前月比。 */
  previousMonth: SummaryChange;
  /** 前年同月比。 */
  previousYear: SummaryChange;
}

/** `base` から `current` への変化を出す。 */
export function calculateChange(current: Yen, base: Yen): Change {
  const difference = sumYen([current, -base]);
  return { difference, rate: base === 0 ? null : difference / Math.abs(base) };
}

function changeOf(current: MonthlySummary, base: MonthlySummary): SummaryChange {
  return {
    income: calculateChange(current.income, base.income),
    expense: calculateChange(current.expense, base.expense),
    balance: calculateChange(current.balance, base.balance),
  };
}

/**
 * `month` を含む月の収支を、前月と前年同月の収支と比べる。`month` はその月のどの日付でもよい。
 *
 * 月ごとの数え方は `calculateMonthlySummary` と同じで、振替は数えない。
 * `month` が `YYYY-MM-DD` でないときや、金額が整数でないとき、合計が扱える範囲を超えたときは例外を投げる。
 */
export function calculateMonthlyComparison(
  transactions: readonly Transaction[],
  month: DateString,
): MonthlyComparison {
  const first = startOfMonth(month);
  const current = calculateMonthlySummary(transactions, first);
  const previousMonth = calculateMonthlySummary(transactions, addMonths(first, -1));
  const previousYear = calculateMonthlySummary(transactions, addMonths(first, -12));
  return {
    current,
    previousMonth: changeOf(current, previousMonth),
    previousYear: changeOf(current, previousYear),
  };
}
