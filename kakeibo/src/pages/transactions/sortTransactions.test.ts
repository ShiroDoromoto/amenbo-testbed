import { expect, test } from 'vitest';
import type { Transaction } from '../../domain/transaction.ts';
import { isTransactionSortOrder, sortTransactions } from './sortTransactions.ts';

const base = { type: 'expense', categoryId: 'food', accountId: 'cash', memo: '' } as const;
const lunch: Transaction = { ...base, id: 'lunch', date: '2026-09-10', amount: 800 };
const coffee: Transaction = { ...base, id: 'coffee', date: '2026-09-10', amount: 400 };
const salary: Transaction = {
  ...base,
  id: 'salary',
  type: 'income',
  date: '2026-09-25',
  amount: 250000,
};
const withdrawal: Transaction = {
  id: 'withdrawal',
  type: 'transfer',
  date: '2026-09-01',
  amount: 30000,
  accountId: 'bank',
  toAccountId: 'cash',
  memo: '',
};
const book: Transaction = { ...base, id: 'book', date: '2026-09-20', amount: 800 };
const all = [withdrawal, lunch, coffee, book, salary];

test('日付の新しい順に並べ、同じ日の取引は渡された順のまま保つ', () => {
  expect(sortTransactions(all, 'date-desc')).toEqual([salary, book, lunch, coffee, withdrawal]);
});

test('日付の古い順に並べる', () => {
  expect(sortTransactions(all, 'date-asc')).toEqual([withdrawal, lunch, coffee, book, salary]);
});

test('金額の大きい順に、収支区分によらず符号の無い額で並べ、同じ額なら日付の新しい順にする', () => {
  expect(sortTransactions(all, 'amount-desc')).toEqual([salary, withdrawal, book, lunch, coffee]);
});

test('金額の小さい順に並べ、同じ額なら日付の新しい順にする', () => {
  expect(sortTransactions(all, 'amount-asc')).toEqual([coffee, book, lunch, withdrawal, salary]);
});

test('渡された配列は並べ替えない', () => {
  const given = [...all];
  sortTransactions(given, 'amount-desc');
  expect(given).toEqual(all);
});

test('並び順の値かどうかを確かめる', () => {
  expect(isTransactionSortOrder('amount-asc')).toBe(true);
  expect(isTransactionSortOrder('')).toBe(false);
});
