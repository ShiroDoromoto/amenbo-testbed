import { endOfMonth, startOfMonth, type DateString } from '../../lib/date.ts';
import { sumYen, type Yen } from '../../lib/money.ts';
import type { Transaction } from '../transaction.ts';

/** 1つのカテゴリの、支出の合計。 */
export interface CategoryExpense {
  categoryId: string;
  /** 支出の合計。正の数で持つ。 */
  total: Yen;
}

/**
 * `month` を含む月の支出を、カテゴリごとに合計する。`month` はその月のどの日付でもよい。
 *
 * 取引の `date` がその月の 1 日から末日までにある支出を数える。収入と振替は数えない。
 * 支出の無いカテゴリは返さない。合計の大きい順に並べ、合計が同じなら `categoryId` の順にする。
 * `month` が `YYYY-MM-DD` でないときや、金額が整数でないとき、合計が扱える範囲を超えたときは例外を投げる。
 */
export function calculateExpenseByCategory(
  transactions: readonly Transaction[],
  month: DateString,
): CategoryExpense[] {
  const from = startOfMonth(month);
  const to = endOfMonth(month);
  const amountsByCategory = new Map<string, Yen[]>();

  for (const transaction of transactions) {
    if (transaction.type !== 'expense') continue;
    if (transaction.date < from || transaction.date > to) continue;
    const amounts = amountsByCategory.get(transaction.categoryId);
    if (amounts) amounts.push(transaction.amount);
    else amountsByCategory.set(transaction.categoryId, [transaction.amount]);
  }

  return Array.from(amountsByCategory, ([categoryId, amounts]) => ({
    categoryId,
    total: sumYen(amounts),
  })).sort(
    (a, b) =>
      b.total - a.total || (a.categoryId < b.categoryId ? -1 : a.categoryId > b.categoryId ? 1 : 0),
  );
}
