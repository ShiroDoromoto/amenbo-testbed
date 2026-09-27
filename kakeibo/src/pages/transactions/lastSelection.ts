import type { IncomeExpenseType } from '../../domain/transaction.ts';
import type { NewTransaction } from '../../db/repositories/transactions.ts';

/** 前回の入力で選んだカテゴリと口座。カテゴリは収支区分ごとに持つ。 */
export type LastSelection = {
  categoryIds: Partial<Record<IncomeExpenseType, string>>;
  accountId?: string;
};

const storageKey = 'kakeibo:lastSelection';

/**
 * 保存しておいた前回の選択を読む。無いときや読めないときは、空の選択を返す。
 * ブラウザの localStorage に置くので、端末ごとに別になる。
 */
export function loadLastSelection(): LastSelection {
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw === null) return { categoryIds: {} };
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return { categoryIds: {} };
    const { categoryIds, accountId } = parsed as Record<string, unknown>;
    const ids = typeof categoryIds === 'object' && categoryIds !== null ? categoryIds : {};
    return {
      categoryIds: {
        expense: stringOrUndefined((ids as Record<string, unknown>).expense),
        income: stringOrUndefined((ids as Record<string, unknown>).income),
      },
      accountId: stringOrUndefined(accountId),
    };
  } catch {
    return { categoryIds: {} };
  }
}

/** 保存した取引から、カテゴリと口座を覚えておく。振替はカテゴリを持たないので、口座だけを覚える。 */
export function saveLastSelection(transaction: NewTransaction): void {
  const last = loadLastSelection();
  const next: LastSelection = {
    categoryIds:
      transaction.type === 'transfer'
        ? last.categoryIds
        : { ...last.categoryIds, [transaction.type]: transaction.categoryId },
    accountId: transaction.accountId,
  };
  try {
    localStorage.setItem(storageKey, JSON.stringify(next));
  } catch {
    // 覚えられなくても、入力そのものには差し障りが無い。
  }
}

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}
