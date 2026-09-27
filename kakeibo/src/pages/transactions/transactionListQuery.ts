import { isIncomeExpenseType, type IncomeExpenseType } from '../../domain/transaction.ts';
import { isDateString, startOfMonth, type DateString } from '../../lib/date.ts';

/**
 * 取引の一覧で選んだ月と絞り込みの条件。
 * 金額の下限・上限は、打った文字のまま持つ。整数に直せない入力も、そのまま残す。
 */
export type TransactionListQuery = {
  /** 出す月の 1 日 */
  month: DateString;
  /** 空文字はすべての口座 */
  accountId: string;
  /** 空文字はすべての区分 */
  type: IncomeExpenseType | '';
  /** 空文字はすべてのカテゴリ */
  categoryId: string;
  /** 空文字は検索しない */
  keyword: string;
  minAmount: string;
  maxAmount: string;
};

/**
 * URL のクエリから条件を読む。無い項目と読めない項目は、絞り込まない値にする。
 * 月が無いか読めなければ、`today` の月にする。
 */
export function readTransactionListQuery(
  query: URLSearchParams,
  today: DateString,
): TransactionListQuery {
  const month = `${query.get('month') ?? ''}-01`;
  const type = query.get('type');
  return {
    month: isDateString(month) ? month : startOfMonth(today),
    accountId: query.get('account') ?? '',
    type: isIncomeExpenseType(type) ? type : '',
    categoryId: query.get('category') ?? '',
    keyword: query.get('memo') ?? '',
    minAmount: query.get('min') ?? '',
    maxAmount: query.get('max') ?? '',
  };
}

/**
 * 条件を URL のクエリにする。絞り込まない項目と、`today` の月は書かない。
 * 何も絞り込まず今月を出していれば、空のクエリになる。
 */
export function writeTransactionListQuery(
  { month, accountId, type, categoryId, keyword, minAmount, maxAmount }: TransactionListQuery,
  today: DateString,
): URLSearchParams {
  const entries: [string, string][] = [
    ['month', month === startOfMonth(today) ? '' : month.slice(0, 7)],
    ['account', accountId],
    ['type', type],
    ['category', categoryId],
    ['memo', keyword],
    ['min', minAmount],
    ['max', maxAmount],
  ];
  return new URLSearchParams(entries.filter(([, value]) => value !== ''));
}
