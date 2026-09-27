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

/** カテゴリを消す。id のカテゴリが無ければ何もしない。取引から参照されていても消す。 */
export async function deleteCategory(db: KakeiboDBConnection, id: string): Promise<void> {
  await db.delete('categories', id);
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
