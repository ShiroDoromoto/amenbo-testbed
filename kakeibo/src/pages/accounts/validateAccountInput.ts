import { isAccountType, type AccountType } from '../../domain/account.ts';
import { parseYen, type Yen } from '../../lib/money.ts';

/** フォームに入力されたままの値。 */
export type AccountInput = {
  name: string;
  type: string;
  initialBalance: string;
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
};

export type AccountValidationResult =
  { ok: true; value: ValidAccountInput } | { ok: false; errors: AccountInputErrors };

/**
 * 口座の入力を確かめる。
 *
 * 名前は前後の空白を除いて1文字以上、種類は現金・銀行口座・クレジットカードのどれか、初期残高は整数。
 * 初期残高は、カードの未払い分のように負の値も受け付ける。
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

  if (Object.keys(errors).length > 0 || initialBalance === null || !isAccountType(input.type)) {
    return { ok: false, errors };
  }
  return { ok: true, value: { name, type: input.type, initialBalance } };
}
