import { isDayOfMonth, type DayOfMonth } from './recurring.ts';

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
  /**
   * カードの締め日。1〜31 の整数で、その月に無い日は末日とみなす。
   * 決めていないときと、カード以外の口座では `null`。
   */
  closingDay: DayOfMonth | null;
  /**
   * カードの引き落とし日。1〜31 の整数で、その月に無い日は末日とみなす。
   * 決めていないときと、カード以外の口座では `null`。
   */
  paymentDay: DayOfMonth | null;
}

export function isInitialBalance(value: unknown): value is number {
  return Number.isSafeInteger(value);
}

/** 締め日・引き落とし日として取れる値か。1〜31 の整数か、決めていないことを表す `null`。 */
export function isBillingDay(value: unknown): value is DayOfMonth | null {
  return value === null || isDayOfMonth(value);
}
