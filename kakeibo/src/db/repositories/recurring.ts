import type { KakeiboDBConnection } from '../index.ts';
import {
  isDayOfMonth,
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
