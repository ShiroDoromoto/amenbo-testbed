import { isDateString, type DateString } from '../../lib/date.ts';
import { yearPeriod, type ReportPeriod } from './calculateReport.ts';

/** 1回のレポートで出せる月の数の上限。表の列がこれより増えないようにする。 */
export const MAX_REPORT_MONTHS = 120;

/** レポートの期間の選び方。1年ごとか、始まりと終わりの日付を指定するか。 */
export type ReportSelection =
  { kind: 'year'; year: number } | { kind: 'range'; from: DateString; to: DateString };

/** 期間を指定するときの、欄ごとの誤り。 */
export interface ReportRangeErrors {
  from?: string;
  to?: string;
}

/** `today` の年を返す。 */
export function yearOf(today: DateString): number {
  return Number(today.slice(0, 4));
}

/** 選び方から、表に出す期間を決める。 */
export function periodOf(selection: ReportSelection): ReportPeriod {
  return selection.kind === 'year'
    ? yearPeriod(selection.year)
    : { from: selection.from, to: selection.to };
}

function monthIndex(date: DateString): number {
  return Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7));
}

/** 指定した期間を確かめる。誤りが無ければ `null` を返す。 */
export function validateReportRange(from: string, to: string): ReportRangeErrors | null {
  const errors: ReportRangeErrors = {};
  if (!isDateString(from)) errors.from = '開始日を入れてください';
  if (!isDateString(to)) errors.to = '終了日を入れてください';
  else if (!errors.from && to < from)
    errors.to = '終了日は開始日と同じ日か、それより後にしてください';
  else if (!errors.from && monthIndex(to) - monthIndex(from) + 1 > MAX_REPORT_MONTHS)
    errors.to = `期間は ${MAX_REPORT_MONTHS / 12} 年（${MAX_REPORT_MONTHS} か月）以内にしてください`;
  return errors.from || errors.to ? errors : null;
}

/**
 * URL のクエリから、期間の選び方を読む。
 * `from` と `to` が正しい期間なら、その期間にする。そうでなければ `year` の年にし、
 * それも無いか読めなければ、`today` の年にする。
 */
export function readReportSelection(query: URLSearchParams, today: DateString): ReportSelection {
  const from = query.get('from');
  const to = query.get('to');
  if (from !== null && to !== null && validateReportRange(from, to) === null)
    return { kind: 'range', from, to };
  const year = query.get('year') ?? '';
  return {
    kind: 'year',
    year: /^\d{4}$/.test(year) && isDateString(`${year}-01-01`) ? Number(year) : yearOf(today),
  };
}

/** 期間の選び方を URL のクエリにする。1年ごとで `today` の年なら、何も書かない。 */
export function writeReportSelection(
  selection: ReportSelection,
  today: DateString,
): URLSearchParams {
  if (selection.kind === 'range')
    return new URLSearchParams({ from: selection.from, to: selection.to });
  return new URLSearchParams(
    selection.year === yearOf(today) ? {} : { year: String(selection.year).padStart(4, '0') },
  );
}
