import type { IncomeExpenseType } from './transaction.ts';

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
