import type { AccountType } from '../../domain/account.ts';

/** 口座の種類を画面に出すときの名前。 */
export const accountTypeLabels: Readonly<Record<AccountType, string>> = {
  cash: '現金',
  bank: '銀行口座',
  card: 'クレジットカード',
};
