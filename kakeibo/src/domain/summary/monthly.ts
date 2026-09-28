import { endOfMonth, startOfMonth, type DateString } from '../../lib/date.ts';
import { sumYen, type Yen } from '../../lib/money.ts';
import type { Transaction } from '../transaction.ts';

/** 1か月の収支。 */
export interface MonthlySummary {
  /** 収入の合計。 */
  income: Yen;
  /** 支出の合計。正の数で持つ。 */
  expense: Yen;
  /** 収入から支出を引いた差額。支出が多ければ負になる。 */
  balance: Yen;
}

/**
 * `month` を含む月の、収入・支出・差額を計算する。`month` はその月のどの日付でもよい。
 *
 * 取引の `date` がその月の 1 日から末日までにあるものを数える。振替は口座の間でお金を移すだけなので、数えない。
 * `month` が `YYYY-MM-DD` でないときや、金額が整数でないとき、合計が扱える範囲を超えたときは例外を投げる。
 */
export function calculateMonthlySummary(
  transactions: readonly Transaction[],
  month: DateString,
): MonthlySummary {
  const from = startOfMonth(month);
  const to = endOfMonth(month);
  const incomes: Yen[] = [];
  const expenses: Yen[] = [];

  for (const transaction of transactions) {
    if (transaction.date < from || transaction.date > to) continue;
    if (transaction.type === 'income') incomes.push(transaction.amount);
    else if (transaction.type === 'expense') expenses.push(transaction.amount);
  }

  const income = sumYen(incomes);
  const expense = sumYen(expenses);
  return { income, expense, balance: sumYen([income, -expense]) };
}
