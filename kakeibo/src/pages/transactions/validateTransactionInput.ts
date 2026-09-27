import { isDateString, type DateString } from '../../lib/date.ts';
import { parseYen, type Yen } from '../../lib/money.ts';

/** フォームに入力されたままの値。 */
export type TransactionInput = {
  date: string;
  amount: string;
  categoryId: string;
  accountId: string;
};

/** 入力チェックの対象になる欄。 */
export type TransactionInputField = keyof TransactionInput;

/** 欄ごとのエラーメッセージ。エラーの無い欄は持たない。 */
export type TransactionInputErrors = Partial<Record<TransactionInputField, string>>;

export type ValidTransactionInput = {
  date: DateString;
  amount: Yen;
  categoryId: string;
  accountId: string;
};

export type ValidationResult =
  { ok: true; value: ValidTransactionInput } | { ok: false; errors: TransactionInputErrors };

/**
 * 取引の入力を確かめる。
 *
 * 金額は正の整数（1円以上）、日付・カテゴリ・口座は必須。
 * 通れば値を直して返し、通らなければ欄ごとのエラーメッセージを返す。
 */
export function validateTransactionInput(input: TransactionInput): ValidationResult {
  const errors: TransactionInputErrors = {};

  if (input.date === '') errors.date = '日付を入れてください';
  else if (!isDateString(input.date)) errors.date = '日付が正しくありません';

  const amount = parseYen(input.amount);
  if (input.amount.trim() === '') errors.amount = '金額を入れてください';
  else if (amount === null) errors.amount = '金額は整数で入れてください';
  else if (amount <= 0) errors.amount = '金額は1円以上にしてください';

  if (input.categoryId === '') errors.categoryId = 'カテゴリを選んでください';
  if (input.accountId === '') errors.accountId = '口座を選んでください';

  if (Object.keys(errors).length > 0 || amount === null) return { ok: false, errors };
  return {
    ok: true,
    value: {
      date: input.date,
      amount,
      categoryId: input.categoryId,
      accountId: input.accountId,
    },
  };
}
