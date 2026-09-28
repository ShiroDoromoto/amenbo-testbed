import type { KakeiboDBConnection } from '../index.ts';
import {
  isBudgetAmount,
  isBudgetMonth,
  type Budget,
  type BudgetMonth,
} from '../../domain/budget.ts';

export type NewBudget = Omit<Budget, 'id'>;

/**
 * カテゴリ `categoryId` の月 `month` の予算を `amount` にし、保存した予算を返す。
 * その組の予算が既にあれば、同じ id のまま額を置き換える。無ければ id を振って足す。
 * 月が `YYYY-MM` でないとき、額が 0 以上の整数でないとき、カテゴリが無いか支出のカテゴリでないときは、何もせずに投げる。
 */
export async function setBudget(db: KakeiboDBConnection, input: NewBudget): Promise<Budget> {
  if (!isBudgetMonth(input.month)) throw new Error(`Invalid budget month: ${input.month}`);
  if (!isBudgetAmount(input.amount)) throw new Error(`Invalid budget amount: ${input.amount}`);

  const tx = db.transaction(['budgets', 'categories'], 'readwrite');
  const category = await tx.objectStore('categories').get(input.categoryId);
  if (category?.type !== 'expense') {
    tx.abort();
    await tx.done.catch(() => {});
    throw new Error(`Expense category not found: ${input.categoryId}`);
  }
  const store = tx.objectStore('budgets');
  const existing = await store.index('by-category-month').get([input.categoryId, input.month]);
  const budget: Budget = { ...input, id: existing?.id ?? crypto.randomUUID() };
  await store.put(budget);
  await tx.done;
  return budget;
}

/** カテゴリ `categoryId` の月 `month` の予算を返す。無ければ `undefined` を返す。 */
export async function getBudget(
  db: KakeiboDBConnection,
  categoryId: string,
  month: BudgetMonth,
): Promise<Budget | undefined> {
  return db.getFromIndex('budgets', 'by-category-month', [categoryId, month]);
}

/** 月 `month` の予算を返す。並びは決めない。 */
export async function listBudgets(db: KakeiboDBConnection, month: BudgetMonth): Promise<Budget[]> {
  return db.getAllFromIndex('budgets', 'by-month', month);
}

/** 予算を消す。id の予算が無ければ何もしない。 */
export async function deleteBudget(db: KakeiboDBConnection, id: string): Promise<void> {
  await db.delete('budgets', id);
}
