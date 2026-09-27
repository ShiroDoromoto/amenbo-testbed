import type { IncomeExpenseType, TransactionType } from '../../domain/transaction.ts';
import { isDateString, type DateString } from '../../lib/date.ts';
import { parseYen, type Yen } from '../../lib/money.ts';

/** フォームに入力されたままの値。どの欄を使うかは、取引の区分で変わる。 */
export type TransactionInput = {
  date: string;
  amount: string;
  /** 収入・支出のときだけ使う。 */
  categoryId: string;
  /** 収入・支出では、お金が出入りする口座。振替では、振替元の口座。 */
  accountId: string;
  /** 振替のときだけ使う。振替先の口座。 */
  toAccountId: string;
};

/** 入力チェックの対象になる欄。 */
export type TransactionInputField = keyof TransactionInput;

/** 欄ごとのエラーメッセージ。エラーの無い欄は持たない。 */
export type TransactionInputErrors = Partial<Record<TransactionInputField, string>>;

type ValidInputBase = {
  date: DateString;
  amount: Yen;
  accountId: string;
};

export type ValidTransactionInput =
  | (ValidInputBase & { type: IncomeExpenseType; categoryId: string })
  | (ValidInputBase & { type: 'transfer'; toAccountId: string });

export type ValidationResult =
  { ok: true; value: ValidTransactionInput } | { ok: false; errors: TransactionInputErrors };

/**
 * 取引の入力を、取引の区分 `type` に合わせて確かめる。
 *
 * 金額は正の整数（1円以上）、日付と口座は必須。
 * 収入・支出ではカテゴリも必須。振替では振替先の口座も必須で、振替元と別の口座にする。
 * 通れば値を直して返し、通らなければ欄ごとのエラーメッセージを返す。
 * その区分で使わない欄は、確かめず、返す値にも入れない。
 */
export function validateTransactionInput(
  input: TransactionInput,
  type: TransactionType,
): ValidationResult {
  const errors: TransactionInputErrors = {};

  if (input.date === '') errors.date = '日付を入れてください';
  else if (!isDateString(input.date)) errors.date = '日付が正しくありません';

  const amount = parseYen(input.amount);
  if (input.amount.trim() === '') errors.amount = '金額を入れてください';
  else if (amount === null) errors.amount = '金額は整数で入れてください';
  else if (amount <= 0) errors.amount = '金額は1円以上にしてください';

  if (type === 'transfer') {
    if (input.accountId === '') errors.accountId = '振替元の口座を選んでください';
    if (input.toAccountId === '') errors.toAccountId = '振替先の口座を選んでください';
    else if (input.toAccountId === input.accountId) {
      errors.toAccountId = '振替元と別の口座を選んでください';
    }
  } else {
    if (input.categoryId === '') errors.categoryId = 'カテゴリを選んでください';
    if (input.accountId === '') errors.accountId = '口座を選んでください';
  }

  if (Object.keys(errors).length > 0 || amount === null) return { ok: false, errors };
  const base = { date: input.date, amount, accountId: input.accountId };
  return {
    ok: true,
    value:
      type === 'transfer'
        ? { ...base, type, toAccountId: input.toAccountId }
        : { ...base, type, categoryId: input.categoryId },
  };
}
