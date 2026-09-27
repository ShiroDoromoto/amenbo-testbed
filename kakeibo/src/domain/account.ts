/** 口座の種類。現金・銀行口座・クレジットカード。 */
export const accountTypes = ['cash', 'bank', 'card'] as const;

export type AccountType = (typeof accountTypes)[number];

export function isAccountType(value: unknown): value is AccountType {
  return accountTypes.includes(value as AccountType);
}

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  /** 初期残高（円）。整数で持つ。カードの未払い分のように、負の値も取る。 */
  initialBalance: number;
}

export function isInitialBalance(value: unknown): value is number {
  return Number.isSafeInteger(value);
}
