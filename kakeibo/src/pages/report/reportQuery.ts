import { isDateString, type DateString } from '../../lib/date.ts';

/** `today` の年を返す。 */
export function yearOf(today: DateString): number {
  return Number(today.slice(0, 4));
}

/** URL のクエリから、出す年を読む。無いか読めなければ、`today` の年にする。 */
export function readReportYear(query: URLSearchParams, today: DateString): number {
  const year = query.get('year') ?? '';
  return /^\d{4}$/.test(year) && isDateString(`${year}-01-01`) ? Number(year) : yearOf(today);
}

/** 出す年を URL のクエリにする。`today` の年なら書かない。 */
export function writeReportYear(year: number, today: DateString): URLSearchParams {
  return new URLSearchParams(year === yearOf(today) ? {} : { year: String(year).padStart(4, '0') });
}
