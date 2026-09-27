/** 日付。`YYYY-MM-DD` 形式の文字列で持つ。時刻とタイムゾーンは持たない。 */
export type DateString = string;

const dateStringPattern = /^(\d{4})-(\d{2})-(\d{2})$/;

/** 月の日数。`month` は 1〜12。 */
function daysInMonth(year: number, month: number): number {
  // 日に 0 を渡すと前の月の末日になる。0〜99 年を 1900 年代に読み替えないよう、年は setUTCFullYear で入れる。
  const date = new Date(0);
  date.setUTCFullYear(year, month, 0);
  return date.getUTCDate();
}

function pad(value: number, length: number): string {
  return String(value).padStart(length, '0');
}

function format(year: number, month: number, day: number): DateString {
  return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`;
}

/** `YYYY-MM-DD` を年・月・日に分ける。形式が崩れているか、暦に無い日付なら `null` を返す。 */
function split(value: string): [year: number, month: number, day: number] | null {
  const match = dateStringPattern.exec(value);
  if (!match) return null;
  const [year, month, day] = match.slice(1).map(Number) as [number, number, number];
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > daysInMonth(year, month)) return null;
  return [year, month, day];
}

function splitOrThrow(date: DateString): [year: number, month: number, day: number] {
  const parts = split(date);
  if (!parts) throw new RangeError(`日付が YYYY-MM-DD ではありません: ${date}`);
  return parts;
}

/** `YYYY-MM-DD` 形式で、暦に在る日付かを確かめる。`2025-02-30` は通らない。 */
export function isDateString(value: unknown): value is DateString {
  return typeof value === 'string' && split(value) !== null;
}

/** `Date` を、端末のタイムゾーンでの日付にする。 */
export function toDateString(date: Date): DateString {
  if (Number.isNaN(date.getTime())) throw new RangeError('Invalid Date は日付にできません');
  return format(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

/** `YYYY-MM-DD` を、端末のタイムゾーンでその日の 0 時の `Date` にする。直せなければ `null` を返す。 */
export function parseDateString(value: string): Date | null {
  const parts = split(value);
  if (!parts) return null;
  const [year, month, day] = parts;
  const date = new Date(year, month - 1, day);
  // 0〜99 年は Date のコンストラクタが 1900 年代に読み替えるため、年を入れ直す。
  date.setFullYear(year);
  return date;
}

/** その月の 1 日を返す。例：`2025-03-15` → `2025-03-01`。 */
export function startOfMonth(date: DateString): DateString {
  const [year, month] = splitOrThrow(date);
  return format(year, month, 1);
}

/** その月の末日を返す。例：`2024-02-10` → `2024-02-29`。 */
export function endOfMonth(date: DateString): DateString {
  const [year, month] = splitOrThrow(date);
  return format(year, month, daysInMonth(year, month));
}

/**
 * `months` か月あとの日付を返す。負の数なら前に戻る。
 * 移った先の月にその日が無ければ、その月の末日にする。例：`2025-01-31` に 1 か月 → `2025-02-28`。
 */
export function addMonths(date: DateString, months: number): DateString {
  if (!Number.isSafeInteger(months)) throw new RangeError(`月数が整数ではありません: ${months}`);
  const [year, month, day] = splitOrThrow(date);
  const index = year * 12 + (month - 1) + months;
  const nextYear = Math.floor(index / 12);
  const nextMonth = index - nextYear * 12 + 1;
  if (nextYear < 0 || nextYear > 9999)
    throw new RangeError(`扱える年の範囲を超えました: ${nextYear}`);
  return format(nextYear, nextMonth, Math.min(day, daysInMonth(nextYear, nextMonth)));
}
