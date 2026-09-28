import { isDateString, type DateString } from '../lib/date.ts';
import { isYen, type Yen } from '../lib/money.ts';

/** 予算を立てる月。`YYYY-MM` 形式の文字列で持つ。 */
export type BudgetMonth = string;

const budgetMonthPattern = /^\d{4}-\d{2}$/;

/** `YYYY-MM` 形式で、暦に在る月かを確かめる。`2025-13` は通らない。 */
export function isBudgetMonth(value: unknown): value is BudgetMonth {
  return typeof value === 'string' && budgetMonthPattern.test(value) && isDateString(`${value}-01`);
}

/** 日付を含む月を返す。例：`2025-03-15` → `2025-03`。 */
export function budgetMonthOf(date: DateString): BudgetMonth {
  if (!isDateString(date)) throw new RangeError(`日付が YYYY-MM-DD ではありません: ${date}`);
  return date.slice(0, 7);
}

/** 予算の額として取れる値か。0 以上の円の整数。 */
export function isBudgetAmount(value: unknown): value is Yen {
  return isYen(value) && value >= 0;
}

/** 予算。1つの支出のカテゴリに、1つの月で使ってよい額を決める。カテゴリと月の組ごとに1件まで。 */
export interface Budget {
  id: string;
  /** 予算を立てる支出のカテゴリ。 */
  categoryId: string;
  month: BudgetMonth;
  /** その月に、そのカテゴリで使ってよい額（円）。0 以上の整数。 */
  amount: Yen;
}
