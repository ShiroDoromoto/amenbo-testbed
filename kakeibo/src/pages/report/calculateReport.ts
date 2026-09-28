import type { Category } from '../../domain/category.ts';
import type { IncomeExpenseType, Transaction } from '../../domain/transaction.ts';
import { addMonths, startOfMonth, type DateString } from '../../lib/date.ts';
import { sumYen, type Yen } from '../../lib/money.ts';

/** レポートに出す期間。`from` から `to` までの両端を含む。 */
export interface ReportPeriod {
  from: DateString;
  to: DateString;
}

/** `year` 年の 1月1日から 12月31日までの期間。 */
export function yearPeriod(year: number): ReportPeriod {
  const y = String(year).padStart(4, '0');
  return { from: `${y}-01-01`, to: `${y}-12-31` };
}

/**
 * 期間がかかる月の 1 日を、古い順に返す。例：`2025-11-20`〜`2026-01-05` → 2025年11月・12月・2026年1月。
 * `from` が `to` より後なら空を返す。
 */
export function reportMonths(period: ReportPeriod): DateString[] {
  if (period.from > period.to) return [];
  const months = [startOfMonth(period.from)];
  const last = startOfMonth(period.to);
  // 9999年12月の次の月は作れないので、最後の月を入れたら止める。
  while (months.at(-1)! !== last) months.push(addMonths(months.at(-1)!, 1));
  return months;
}

/** 1つのカテゴリの、期間の月ごとの合計。 */
export interface ReportRow {
  categoryId: string;
  /** 月ごとの合計。`Report.months` と同じ順・同じ件数。 */
  months: Yen[];
  /** 期間の合計。 */
  total: Yen;
}

/** 収入か支出の、カテゴリ × 月の表。 */
export interface ReportTable {
  rows: ReportRow[];
  /** 月ごとの、すべてのカテゴリの合計。`Report.months` と同じ順・同じ件数。 */
  months: Yen[];
  /** 期間の、すべてのカテゴリの合計。 */
  total: Yen;
}

export interface Report {
  /** 表の列にする月の 1 日。古い順。 */
  months: DateString[];
  income: ReportTable;
  expense: ReportTable;
}

/**
 * `period` の取引を、収入と支出に分けて、カテゴリごと・月ごとに合計する。
 *
 * 取引の `date` が `period` の中にあるものを数える。振替は数えない。
 * 期間の最初と最後の月は、期間に入る日の分だけを数える。
 * 期間に取引の無いカテゴリは行にしない。行は `categories` に並んでいる順にし、
 * `categories` に無いカテゴリ（消されたカテゴリ）はその後ろに `categoryId` の順で置く。
 * 金額が整数でないときや、合計が扱える範囲を超えたときは例外を投げる。
 */
export function calculateReport(
  transactions: readonly Transaction[],
  categories: readonly Category[],
  period: ReportPeriod,
): Report {
  const months = reportMonths(period);
  const monthIndex = new Map(months.map((month, i) => [month.slice(0, 7), i]));
  const amounts: Record<IncomeExpenseType, Map<string, Yen[][]>> = {
    income: new Map(),
    expense: new Map(),
  };
  for (const transaction of transactions) {
    if (transaction.type === 'transfer') continue;
    if (transaction.date < period.from || transaction.date > period.to) continue;
    const index = monthIndex.get(transaction.date.slice(0, 7))!;
    const byCategory = amounts[transaction.type];
    let byMonth = byCategory.get(transaction.categoryId);
    if (!byMonth) {
      byMonth = months.map(() => []);
      byCategory.set(transaction.categoryId, byMonth);
    }
    byMonth[index]!.push(transaction.amount);
  }

  const order = new Map(categories.map((c, i) => [c.id, i]));
  return {
    months,
    income: toTable(amounts.income, order, months.length),
    expense: toTable(amounts.expense, order, months.length),
  };
}

function toTable(
  byCategory: Map<string, Yen[][]>,
  order: Map<string, number>,
  monthCount: number,
): ReportTable {
  const rows = Array.from(byCategory, ([categoryId, byMonth]) => {
    const months = byMonth.map((amounts) => sumYen(amounts));
    return { categoryId, months, total: sumYen(months) };
  }).sort((a, b) => {
    const orderA = order.get(a.categoryId) ?? Infinity;
    const orderB = order.get(b.categoryId) ?? Infinity;
    if (orderA !== orderB) return orderA - orderB;
    return a.categoryId < b.categoryId ? -1 : a.categoryId > b.categoryId ? 1 : 0;
  });
  const months = Array.from({ length: monthCount }, (_, i) =>
    sumYen(rows.map((row) => row.months[i]!)),
  );
  return { rows, months, total: sumYen(months) };
}
