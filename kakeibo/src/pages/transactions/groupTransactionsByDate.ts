import type { Transaction } from '../../domain/transaction.ts';
import { sumYen, type Yen } from '../../lib/money.ts';

/** 同じ日付の取引の組と、その日の小計。 */
export type TransactionDay = {
  date: string;
  transactions: Transaction[];
  /** 収入から支出を引いた額。振替はお金が増えも減りもしないので、数えない。 */
  subtotal: Yen;
};

function signedAmount(transaction: Transaction): Yen {
  if (transaction.type === 'income') return transaction.amount;
  if (transaction.type === 'expense') return -transaction.amount;
  return 0;
}

/** 取引を日付ごとにまとめる。日付の並びと、日付の中の並びは、渡された順のまま保つ。 */
export function groupTransactionsByDate(transactions: readonly Transaction[]): TransactionDay[] {
  const byDate = new Map<string, Transaction[]>();
  for (const transaction of transactions) {
    const day = byDate.get(transaction.date);
    if (day) day.push(transaction);
    else byDate.set(transaction.date, [transaction]);
  }
  return [...byDate].map(([date, day]) => ({
    date,
    transactions: day,
    subtotal: sumYen(day.map(signedAmount)),
  }));
}
