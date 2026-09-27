import type { TransactionType } from './transaction.ts';

export interface Category {
  id: string;
  name: string;
  /** 収入と支出のどちらのカテゴリか。 */
  type: TransactionType;
  /** 表示色。`#rrggbb` 形式。 */
  color: string;
  /** 並び順。小さいほど先に並ぶ。 */
  order: number;
}

const categoryColorPattern = /^#[0-9a-f]{6}$/i;

export function isCategoryColor(value: unknown): value is string {
  return typeof value === 'string' && categoryColorPattern.test(value);
}

/** `order` の昇順に並べる。`order` が同じなら名前順にする。 */
export function compareCategories(a: Category, b: Category): number {
  return a.order - b.order || a.name.localeCompare(b.name, 'ja');
}
