import { isAccountType, isBillingDay, type AccountType } from '../../domain/account.ts';
import type { DayOfMonth } from '../../domain/recurring.ts';
import { parseYen, type Yen } from '../../lib/money.ts';

/** フォームに入力されたままの値。 */
export type AccountInput = {
  name: string;
  type: string;
  initialBalance: string;
  /** カードの締め日。空なら決めていない。 */
  closingDay: string;
  /** カードの引き落とし日。空なら決めていない。 */
  paymentDay: string;
};

/** 入力チェックの対象になる欄。 */
export type AccountInputField = keyof AccountInput;

/** 欄ごとのエラーメッセージ。エラーの無い欄は持たない。 */
export type AccountInputErrors = Partial<Record<AccountInputField, string>>;

/** 通った入力。 */
export type ValidAccountInput = {
  name: string;
  type: AccountType;
  initialBalance: Yen;
  closingDay: DayOfMonth | null;
  paymentDay: DayOfMonth | null;
};

export type AccountValidationResult =
  { ok: true; value: ValidAccountInput } | { ok: false; errors: AccountInputErrors };

/**
 * 口座の入力を確かめる。
 *
 * 名前は前後の空白を除いて1文字以上、種類は現金・銀行口座・クレジットカードのどれか、初期残高は整数。
 * 初期残高は、カードの未払い分のように負の値も受け付ける。
 * 締め日と引き落とし日は、カードのときだけ見る。空なら決めていない（`null`）、入っていれば 1〜31 の整数。
 * カード以外では、入力に関わらず `null` にする。
 * 通れば値を直して返し、通らなければ欄ごとのエラーメッセージを返す。
 */
export function validateAccountInput(input: AccountInput): AccountValidationResult {
  const errors: AccountInputErrors = {};

  const name = input.name.trim();
  if (name === '') errors.name = '名前を入れてください';

  if (!isAccountType(input.type)) errors.type = '種類を選んでください';

  const initialBalance = parseYen(input.initialBalance);
  if (input.initialBalance.trim() === '') errors.initialBalance = '初期残高を入れてください';
  else if (initialBalance === null) errors.initialBalance = '初期残高は整数で入れてください';

  const card = input.type === 'card';
  const closingDay = card ? parseBillingDay(input.closingDay) : null;
  if (closingDay === undefined) errors.closingDay = '締め日は1〜31日から選んでください';
  const paymentDay = card ? parseBillingDay(input.paymentDay) : null;
  if (paymentDay === undefined) errors.paymentDay = '引き落とし日は1〜31日から選んでください';

  if (
    Object.keys(errors).length > 0 ||
    initialBalance === null ||
    !isAccountType(input.type) ||
    closingDay === undefined ||
    paymentDay === undefined
  ) {
    return { ok: false, errors };
  }
  return {
    ok: true,
    value: { name, type: input.type, initialBalance, closingDay, paymentDay },
  };
}

/** 締め日・引き落とし日の入力を読む。空なら `null`、日として読めなければ `undefined`。 */
function parseBillingDay(value: string): DayOfMonth | null | undefined {
  const day = value === '' ? null : Number(value);
  return isBillingDay(day) ? day : undefined;
}
