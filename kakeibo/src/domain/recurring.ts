import { addMonths, endOfMonth, startOfMonth, type DateString } from '../lib/date.ts';
import type {
  IncomeExpenseTransaction,
  IncomeExpenseType,
  TransferTransaction,
} from './transaction.ts';

/** 日の最大値。どの月にも無い 32 日以降は取らない。 */
const maxDayOfMonth = 31;

/**
 * 毎月、取引を起こす日。1〜31 の整数。
 * その月に無い日（2 月の 30 日など）を指したときは、その月の末日とみなす。
 */
export type DayOfMonth = number;

export function isDayOfMonth(value: unknown): value is DayOfMonth {
  return (
    Number.isSafeInteger(value) && (value as number) >= 1 && (value as number) <= maxDayOfMonth
  );
}

interface RecurringTransactionBase {
  id: string;
  dayOfMonth: DayOfMonth;
  /** 金額（円）。取引と同じく正の整数で持ち、お金の向きは `type` で分ける。 */
  amount: number;
  /** 起こした取引に写すメモ。空文字なら、メモなし。 */
  memo: string;
  /**
   * 最後に取引を起こした回の日付。`YYYY-MM-DD` 形式。
   * 取引は、この日の月より後の月の分から起こす。まだ一度も起こしていなければ持たない。
   */
  lastGeneratedOn?: DateString;
}

/** 毎月の収入か支出。家賃や給料のように、同じ口座・カテゴリで同じ額が動く。 */
export interface IncomeExpenseRecurringTransaction extends RecurringTransactionBase {
  type: IncomeExpenseType;
  categoryId: string;
  accountId: string;
}

/** 毎月の振替。`accountId` の口座から `toAccountId` の口座へお金を移す。カテゴリは持たない。 */
export interface TransferRecurringTransaction extends RecurringTransactionBase {
  type: 'transfer';
  /** 振替元の口座。 */
  accountId: string;
  /** 振替先の口座。振替元と同じ口座にはしない。 */
  toAccountId: string;
}

/** 定期取引。毎月 `dayOfMonth` 日に、`amount` 円の取引を起こすための決まり。 */
export type RecurringTransaction = IncomeExpenseRecurringTransaction | TransferRecurringTransaction;

export function isTransferRecurring(
  recurring: RecurringTransaction,
): recurring is TransferRecurringTransaction {
  return recurring.type === 'transfer';
}

/** `month` の月で、定期取引が取引を起こす日。その月に `dayOfMonth` 日が無ければ末日にする。 */
function occurrenceIn(month: DateString, dayOfMonth: DayOfMonth): DateString {
  const last = endOfMonth(month);
  const day = Math.min(dayOfMonth, Number(last.slice(8)));
  return `${last.slice(0, 8)}${String(day).padStart(2, '0')}`;
}

/**
 * `today` までに起こすべきで、まだ起こしていない回の日付を、古い順に返す。
 * 起こすのは月に一度で、`lastGeneratedOn` の月より後の月から数える。`dayOfMonth` を変えても、同じ月に二度は起こさない。
 * 一度も起こしていなければ、`today` の月から数える。それより前の月の分はさかのぼって起こさない。
 */
export function dueOccurrences(recurring: RecurringTransaction, today: DateString): DateString[] {
  let month =
    recurring.lastGeneratedOn === undefined
      ? startOfMonth(today)
      : addMonths(startOfMonth(recurring.lastGeneratedOn), 1);
  const dates: DateString[] = [];
  for (;;) {
    const date = occurrenceIn(month, recurring.dayOfMonth);
    if (date > today) return dates;
    dates.push(date);
    month = addMonths(month, 1);
  }
}

/** 定期取引が `date` に起こす取引。id はまだ振らない。 */
export function transactionFor(
  recurring: RecurringTransaction,
  date: DateString,
): Omit<IncomeExpenseTransaction, 'id'> | Omit<TransferTransaction, 'id'> {
  const { amount, memo, accountId } = recurring;
  if (isTransferRecurring(recurring)) {
    return { type: 'transfer', date, amount, memo, accountId, toAccountId: recurring.toAccountId };
  }
  return { type: recurring.type, date, amount, memo, accountId, categoryId: recurring.categoryId };
}
