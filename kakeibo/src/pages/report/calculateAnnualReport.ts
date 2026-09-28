import type { Category } from '../../domain/category.ts';
import type { IncomeExpenseType, Transaction } from '../../domain/transaction.ts';
import { sumYen, type Yen } from '../../lib/money.ts';

/** 1年の月の数。 */
export const REPORT_MONTHS = 12;

/** 1つのカテゴリの、1年分の月ごとの合計。 */
export interface AnnualReportRow {
  categoryId: string;
  /** 1月から12月までの合計。12 件ある。 */
  months: Yen[];
  /** 1年の合計。 */
  total: Yen;
}

/** 収入か支出の、カテゴリ × 月の表。 */
export interface AnnualReportTable {
  rows: AnnualReportRow[];
  /** 月ごとの、すべてのカテゴリの合計。12 件ある。 */
  months: Yen[];
  /** 1年の、すべてのカテゴリの合計。 */
  total: Yen;
}

export interface AnnualReport {
  income: AnnualReportTable;
  expense: AnnualReportTable;
}

/**
 * `year` 年の取引を、収入と支出に分けて、カテゴリごと・月ごとに合計する。
 *
 * 取引の `date` が `year` 年の 1月1日から 12月31日までにあるものを数える。振替は数えない。
 * その年に取引の無いカテゴリは行にしない。行は `categories` に並んでいる順にし、
 * `categories` に無いカテゴリ（消されたカテゴリ）はその後ろに `categoryId` の順で置く。
 * 金額が整数でないときや、合計が扱える範囲を超えたときは例外を投げる。
 */
export function calculateAnnualReport(
  transactions: readonly Transaction[],
  categories: readonly Category[],
  year: number,
): AnnualReport {
  const prefix = `${String(year).padStart(4, '0')}-`;
  const amounts: Record<IncomeExpenseType, Map<string, Yen[][]>> = {
    income: new Map(),
    expense: new Map(),
  };
  for (const transaction of transactions) {
    if (transaction.type === 'transfer') continue;
    if (!transaction.date.startsWith(prefix)) continue;
    const monthIndex = Number(transaction.date.slice(5, 7)) - 1;
    const byCategory = amounts[transaction.type];
    let byMonth = byCategory.get(transaction.categoryId);
    if (!byMonth) {
      byMonth = Array.from({ length: REPORT_MONTHS }, () => []);
      byCategory.set(transaction.categoryId, byMonth);
    }
    byMonth[monthIndex]!.push(transaction.amount);
  }

  const order = new Map(categories.map((c, i) => [c.id, i]));
  return {
    income: toTable(amounts.income, order),
    expense: toTable(amounts.expense, order),
  };
}

function toTable(byCategory: Map<string, Yen[][]>, order: Map<string, number>): AnnualReportTable {
  const rows = Array.from(byCategory, ([categoryId, byMonth]) => {
    const months = byMonth.map((amounts) => sumYen(amounts));
    return { categoryId, months, total: sumYen(months) };
  }).sort((a, b) => {
    const orderA = order.get(a.categoryId) ?? Infinity;
    const orderB = order.get(b.categoryId) ?? Infinity;
    if (orderA !== orderB) return orderA - orderB;
    return a.categoryId < b.categoryId ? -1 : a.categoryId > b.categoryId ? 1 : 0;
  });
  const months = Array.from({ length: REPORT_MONTHS }, (_, i) =>
    sumYen(rows.map((row) => row.months[i]!)),
  );
  return { rows, months, total: sumYen(months) };
}
