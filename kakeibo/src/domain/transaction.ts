/** 収支区分。振替は別の区分として後から足す。 */
export const transactionTypes = ['income', 'expense'] as const;

export type TransactionType = (typeof transactionTypes)[number];

export function isTransactionType(value: unknown): value is TransactionType {
  return transactionTypes.includes(value as TransactionType);
}

export interface Transaction {
  id: string;
  /** 取引の日付。`YYYY-MM-DD` 形式。 */
  date: string;
  /** 金額（円）。正の整数で持ち、収入か支出かは `type` で分ける。 */
  amount: number;
  type: TransactionType;
  categoryId: string;
  accountId: string;
  /** 空文字なら、メモなし。 */
  memo: string;
}
