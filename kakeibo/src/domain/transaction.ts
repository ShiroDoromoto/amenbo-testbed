/** 収支区分。カテゴリは、このどちらかに属する。 */
export const incomeExpenseTypes = ['income', 'expense'] as const;

export type IncomeExpenseType = (typeof incomeExpenseTypes)[number];

export function isIncomeExpenseType(value: unknown): value is IncomeExpenseType {
  return incomeExpenseTypes.includes(value as IncomeExpenseType);
}

/** 取引の区分。収入・支出と、口座間の振替。 */
export const transactionTypes = [...incomeExpenseTypes, 'transfer'] as const;

export type TransactionType = (typeof transactionTypes)[number];

export function isTransactionType(value: unknown): value is TransactionType {
  return transactionTypes.includes(value as TransactionType);
}

interface TransactionBase {
  id: string;
  /** 取引の日付。`YYYY-MM-DD` 形式。 */
  date: string;
  /** 金額（円）。正の整数で持ち、お金の向きは `type` で分ける。 */
  amount: number;
  /** 空文字なら、メモなし。 */
  memo: string;
}

/** 収入か支出。1つの口座にお金が入るか、口座から出る。 */
export interface IncomeExpenseTransaction extends TransactionBase {
  type: IncomeExpenseType;
  categoryId: string;
  accountId: string;
}

/** 振替。`accountId` の口座から `toAccountId` の口座へお金を移す。カテゴリは持たない。 */
export interface TransferTransaction extends TransactionBase {
  type: 'transfer';
  /** 振替元の口座。 */
  accountId: string;
  /** 振替先の口座。振替元と同じ口座にはしない。 */
  toAccountId: string;
}

export type Transaction = IncomeExpenseTransaction | TransferTransaction;

export function isTransfer(transaction: Transaction): transaction is TransferTransaction {
  return transaction.type === 'transfer';
}
