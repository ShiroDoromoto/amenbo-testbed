import type { KakeiboDBConnection } from '../index.ts';
import { compareCategories, type Category } from '../../domain/category.ts';
import type { IncomeExpenseType } from '../../domain/transaction.ts';

export type NewCategory = Omit<Category, 'id'>;

/** カテゴリを追加し、id を振って返す。 */
export async function addCategory(db: KakeiboDBConnection, input: NewCategory): Promise<Category> {
  const category: Category = { ...input, id: crypto.randomUUID() };
  await db.add('categories', category);
  return category;
}

/** 既存のカテゴリを丸ごと置き換える。id のカテゴリが無ければ投げる。 */
export async function updateCategory(db: KakeiboDBConnection, category: Category): Promise<void> {
  const tx = db.transaction('categories', 'readwrite');
  if ((await tx.store.getKey(category.id)) === undefined) {
    tx.abort();
    await tx.done.catch(() => {});
    throw new Error(`Category not found: ${category.id}`);
  }
  await tx.store.put(category);
  await tx.done;
}

/**
 * カテゴリを消す。id のカテゴリが無ければ何もしない。取引から参照されていても消す。
 * 使っている取引を別のカテゴリに付け替えるときは `deleteCategoryAndReassign` を使う。
 */
export async function deleteCategory(db: KakeiboDBConnection, id: string): Promise<void> {
  await db.delete('categories', id);
}

/**
 * カテゴリ `id` を消し、それを使っている取引と定期取引のカテゴリを `toCategoryId` に付け替える。
 * 削除と付け替えは1つのトランザクションで行い、途中で失敗すればどちらも起きない。
 * どちらかのカテゴリが無いとき、2つが同じとき、収支区分が違うときは、何もせずに投げる。
 */
export async function deleteCategoryAndReassign(
  db: KakeiboDBConnection,
  id: string,
  toCategoryId: string,
): Promise<void> {
  if (id === toCategoryId) throw new Error(`Cannot reassign to the deleted category: ${id}`);
  const tx = db.transaction(['categories', 'transactions', 'recurringTransactions'], 'readwrite');
  const fail = async (message: string): Promise<never> => {
    tx.abort();
    await tx.done.catch(() => {});
    throw new Error(message);
  };

  const categories = tx.objectStore('categories');
  const from = await categories.get(id);
  if (from === undefined) return fail(`Category not found: ${id}`);
  const to = await categories.get(toCategoryId);
  if (to === undefined) return fail(`Category not found: ${toCategoryId}`);
  if (from.type !== to.type) {
    return fail(`Category type mismatch: ${from.type} to ${to.type}`);
  }

  let cursor = await tx.objectStore('transactions').index('by-category').openCursor(id);
  while (cursor) {
    // 索引 `by-category` に載るのは `categoryId` を持つ取引、つまり収入か支出だけ。
    const transaction = cursor.value;
    if (transaction.type !== 'transfer') {
      await cursor.update({ ...transaction, categoryId: toCategoryId });
    }
    cursor = await cursor.continue();
  }

  const recurringStore = tx.objectStore('recurringTransactions');
  for (const recurring of await recurringStore.getAll()) {
    if (recurring.type !== 'transfer' && recurring.categoryId === id) {
      await recurringStore.put({ ...recurring, categoryId: toCategoryId });
    }
  }

  await categories.delete(id);
  await tx.done;
}

/** id のカテゴリを返す。無ければ `undefined`。 */
export async function getCategory(
  db: KakeiboDBConnection,
  id: string,
): Promise<Category | undefined> {
  return db.get('categories', id);
}

/**
 * カテゴリを並び順（`compareCategories`）で返す。
 * `type` を渡すと、その収支区分のカテゴリだけを返す。
 */
export async function listCategories(
  db: KakeiboDBConnection,
  type?: IncomeExpenseType,
): Promise<Category[]> {
  const categories = await db.getAll('categories');
  return categories.filter((c) => type === undefined || c.type === type).sort(compareCategories);
}
