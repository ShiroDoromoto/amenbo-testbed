import { expect, test } from 'vitest';
import type { Transaction } from '../../domain/transaction.ts';
import { filterTransactionsByAccount } from './filterTransactionsByAccount.ts';

const base = { date: '2026-09-10', amount: 100, memo: '' };
const lunch: Transaction = {
  ...base,
  id: 'lunch',
  type: 'expense',
  categoryId: 'food',
  accountId: 'cash',
};
const salary: Transaction = {
  ...base,
  id: 'salary',
  type: 'income',
  categoryId: 'pay',
  accountId: 'bank',
};
const withdrawal: Transaction = {
  ...base,
  id: 'withdrawal',
  type: 'transfer',
  accountId: 'bank',
  toAccountId: 'cash',
};
const all = [lunch, salary, withdrawal];

test('その口座の収入・支出を、渡された順のまま残す', () => {
  expect(filterTransactionsByAccount(all, 'bank')).toEqual([salary, withdrawal]);
});

test('振替は、振替先がその口座でも残す', () => {
  expect(filterTransactionsByAccount(all, 'cash')).toEqual([lunch, withdrawal]);
});

test('その口座の取引が無ければ空を返す', () => {
  expect(filterTransactionsByAccount(all, 'card')).toEqual([]);
});
