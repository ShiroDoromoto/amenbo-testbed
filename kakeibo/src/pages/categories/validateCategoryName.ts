import type { Category } from '../../domain/category.ts';
import type { IncomeExpenseType } from '../../domain/transaction.ts';

export type CategoryNameValidationResult =
  { ok: true; name: string } | { ok: false; error: string };

type Target = {
  type: IncomeExpenseType;
  /** 名前を変えるカテゴリの id。追加のときは省く。 */
  id?: string;
};

/**
 * カテゴリの名前を確かめる。前後の空白は落とす。
 * 同じ収支区分に同じ名前のカテゴリがあれば通さない。収入と支出の間では同じ名前でもよい。
 */
export function validateCategoryName(
  input: string,
  target: Target,
  categories: readonly Category[],
): CategoryNameValidationResult {
  const name = input.trim();
  if (name === '') return { ok: false, error: '名前を入力してください' };
  const taken = categories.some(
    (c) => c.type === target.type && c.id !== target.id && c.name === name,
  );
  if (taken) return { ok: false, error: '同じ名前のカテゴリがあります' };
  return { ok: true, name };
}
