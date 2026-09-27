import type { KakeiboDBConnection } from '../index.ts';
import type { DateString } from '../../lib/date.ts';
import type { Transaction } from '../../domain/transaction.ts';
import {
  dueOccurrences,
  isDayOfMonth,
  transactionFor,
  type IncomeExpenseRecurringTransaction,
  type RecurringTransaction,
  type TransferRecurringTransaction,
} from '../../domain/recurring.ts';

export type NewRecurringTransaction =
  Omit<IncomeExpenseRecurringTransaction, 'id'> | Omit<TransferRecurringTransaction, 'id'>;

/** 1〜31 に無い日と、振替元と振替先が同じ口座の振替は、保存せずに投げる。 */
function assertSavable(recurring: NewRecurringTransaction): void {
  if (!isDayOfMonth(recurring.dayOfMonth)) {
    throw new Error(`Invalid day of month: ${recurring.dayOfMonth}`);
  }
  if (recurring.type === 'transfer' && recurring.accountId === recurring.toAccountId) {
    throw new Error(`Transfer to the same account: ${recurring.accountId}`);
  }
}

/** 定期取引を追加し、id を振って返す。 */
export async function addRecurringTransaction(
  db: KakeiboDBConnection,
  input: NewRecurringTransaction,
): Promise<RecurringTransaction> {
  assertSavable(input);
  const recurring: RecurringTransaction = { ...input, id: crypto.randomUUID() };
  await db.add('recurringTransactions', recurring);
  return recurring;
}

/** id の定期取引を返す。無ければ `undefined` を返す。 */
export async function getRecurringTransaction(
  db: KakeiboDBConnection,
  id: string,
): Promise<RecurringTransaction | undefined> {
  return db.get('recurringTransactions', id);
}

/** 既存の定期取引を丸ごと置き換える。収支と振替の間で区分を変えてもよい。id の定期取引が無ければ投げる。 */
export async function updateRecurringTransaction(
  db: KakeiboDBConnection,
  recurring: RecurringTransaction,
): Promise<void> {
  assertSavable(recurring);
  const tx = db.transaction('recurringTransactions', 'readwrite');
  if ((await tx.store.getKey(recurring.id)) === undefined) {
    tx.abort();
    await tx.done.catch(() => {});
    throw new Error(`Recurring transaction not found: ${recurring.id}`);
  }
  await tx.store.put(recurring);
  await tx.done;
}

/** 定期取引を消す。id の定期取引が無ければ何もしない。 */
export async function deleteRecurringTransaction(
  db: KakeiboDBConnection,
  id: string,
): Promise<void> {
  await db.delete('recurringTransactions', id);
}

/** 定期取引を、毎月の日の早い順に返す。同じ日の中の順は決めない。 */
export async function listRecurringTransactions(
  db: KakeiboDBConnection,
): Promise<RecurringTransaction[]> {
  const recurrings = await db.getAll('recurringTransactions');
  return recurrings.sort((a, b) => a.dayOfMonth - b.dayOfMonth);
}

/**
 * 定期取引のうち `today` までに起こすべき回の取引を作り、作った取引を日付の古い順に返す。
 * 取引の追加と `lastGeneratedOn` の書き換えは1つのトランザクションで行う。途中で失敗すれば何も残さず、同じ回を二度作らない。
 */
export async function generateDueTransactions(
  db: KakeiboDBConnection,
  today: DateString,
): Promise<Transaction[]> {
  const tx = db.transaction(['recurringTransactions', 'transactions'], 'readwrite');
  const recurringStore = tx.objectStore('recurringTransactions');
  const transactionStore = tx.objectStore('transactions');
  const created: Transaction[] = [];
  for (const recurring of await recurringStore.getAll()) {
    const dates = dueOccurrences(recurring, today);
    const lastDate = dates.at(-1);
    if (lastDate === undefined) continue;
    for (const date of dates) {
      const transaction: Transaction = {
        ...transactionFor(recurring, date),
        id: crypto.randomUUID(),
      };
      await transactionStore.add(transaction);
      created.push(transaction);
    }
    await recurringStore.put({ ...recurring, lastGeneratedOn: lastDate });
  }
  await tx.done;
  return created.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}
