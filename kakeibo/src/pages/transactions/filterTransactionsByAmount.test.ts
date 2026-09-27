import { expect, test } from 'vitest';
import type { Transaction } from '../../domain/transaction.ts';
import { filterTransactionsByAmount } from './filterTransactionsByAmount.ts';

const base = { date: '2026-09-10', type: 'expense', categoryId: 'food', memo: '' } as const;
const coffee: Transaction = { ...base, id: 'coffee', amount: 300, accountId: 'cash' };
const lunch: Transaction = { ...base, id: 'lunch', amount: 1000, accountId: 'cash' };
const dinner: Transaction = { ...base, id: 'dinner', amount: 5000, accountId: 'cash' };
const withdrawal: Transaction = {
  ...base,
  id: 'withdrawal',
  type: 'transfer',
  amount: 3000,
  accountId: 'bank',
  toAccountId: 'cash',
};
const all = [coffee, lunch, dinner, withdrawal];

test('下限と上限の間の取引を、両端を含め、振替も含めて渡された順のまま残す', () => {
  expect(filterTransactionsByAmount(all, 1000, 3000)).toEqual([lunch, withdrawal]);
});

test('下限だけなら、下限以上の取引を残す', () => {
  expect(filterTransactionsByAmount(all, 3000, null)).toEqual([dinner, withdrawal]);
});

test('上限だけなら、上限以下の取引を残す', () => {
  expect(filterTransactionsByAmount(all, null, 1000)).toEqual([coffee, lunch]);
});

test('下限も上限も無ければ、すべて返す', () => {
  expect(filterTransactionsByAmount(all, null, null)).toEqual(all);
});

test('範囲に入る取引が無ければ空を返す', () => {
  expect(filterTransactionsByAmount(all, 6000, null)).toEqual([]);
  expect(filterTransactionsByAmount(all, 5000, 1000)).toEqual([]);
});
