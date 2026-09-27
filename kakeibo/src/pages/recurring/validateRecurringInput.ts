import { isDayOfMonth, type DayOfMonth } from '../../domain/recurring.ts';
import type { IncomeExpenseType, TransactionType } from '../../domain/transaction.ts';
import { parseYen, type Yen } from '../../lib/money.ts';

/** フォームに入力されたままの値。どの欄を使うかは、取引の区分で変わる。 */
export type RecurringInput = {
  /** 毎月、取引を起こす日。`1`〜`31`。 */
  dayOfMonth: string;
  amount: string;
  /** 収入・支出のときだけ使う。 */
  categoryId: string;
  /** 収入・支出では、お金が出入りする口座。振替では、振替元の口座。 */
  accountId: string;
  /** 振替のときだけ使う。振替先の口座。 */
  toAccountId: string;
};

/** 入力チェックの対象になる欄。 */
export type RecurringInputField = keyof RecurringInput;

/** 欄ごとのエラーメッセージ。エラーの無い欄は持たない。 */
export type RecurringInputErrors = Partial<Record<RecurringInputField, string>>;

type ValidInputBase = {
  dayOfMonth: DayOfMonth;
  amount: Yen;
  accountId: string;
};

/** 通った入力。メモはフォームがそのまま足す。 */
export type ValidRecurringInput =
  | (ValidInputBase & { type: IncomeExpenseType; categoryId: string })
  | (ValidInputBase & { type: 'transfer'; toAccountId: string });

export type RecurringValidationResult =
  { ok: true; value: ValidRecurringInput } | { ok: false; errors: RecurringInputErrors };

/**
 * 定期取引の入力を、取引の区分 `type` に合わせて確かめる。
 *
 * 日は 1〜31 の整数、金額は正の整数（1円以上）、口座は必須。
 * 収入・支出ではカテゴリも必須。振替では振替先の口座も必須で、振替元と別の口座にする。
 * 通れば値を直して返し、通らなければ欄ごとのエラーメッセージを返す。
 * その区分で使わない欄は、確かめず、返す値にも入れない。
 */
export function validateRecurringInput(
  input: RecurringInput,
  type: TransactionType,
): RecurringValidationResult {
  const errors: RecurringInputErrors = {};

  const dayOfMonth = Number(input.dayOfMonth);
  if (input.dayOfMonth === '') errors.dayOfMonth = '日を選んでください';
  else if (!isDayOfMonth(dayOfMonth)) errors.dayOfMonth = '日は1〜31日から選んでください';

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
  const base = { dayOfMonth, amount, accountId: input.accountId };
  return {
    ok: true,
    value:
      type === 'transfer'
        ? { ...base, type, toAccountId: input.toAccountId }
        : { ...base, type, categoryId: input.categoryId },
  };
}
