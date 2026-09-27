import { expect, test } from 'vitest';
import type { Transaction } from '../../domain/transaction.ts';
import { filterTransactionsByMemo } from './filterTransactionsByMemo.ts';

const base = { date: '2026-09-10', amount: 100, type: 'expense', categoryId: 'food' } as const;
const lunch: Transaction = { ...base, id: 'lunch', accountId: 'cash', memo: '会社でランチ' };
const coffee: Transaction = { ...base, id: 'coffee', accountId: 'cash', memo: 'Coffee' };
const blank: Transaction = { ...base, id: 'blank', accountId: 'cash', memo: '' };
const withdrawal: Transaction = {
  ...base,
  id: 'withdrawal',
  type: 'transfer',
  accountId: 'bank',
  toAccountId: 'cash',
  memo: 'ランチ代をおろす',
};
const all = [lunch, coffee, blank, withdrawal];

test('メモにキーワードを含む取引を、振替も含めて渡された順のまま残す', () => {
  expect(filterTransactionsByMemo(all, 'ランチ')).toEqual([lunch, withdrawal]);
});

test('英字の大文字と小文字は区別しない', () => {
  expect(filterTransactionsByMemo(all, 'cOFFEE')).toEqual([coffee]);
});

test('キーワードの前後の空白は無視する', () => {
  expect(filterTransactionsByMemo(all, '  会社 ')).toEqual([lunch]);
});

test('キーワードが空か空白だけなら、すべて返す', () => {
  expect(filterTransactionsByMemo(all, '')).toEqual(all);
  expect(filterTransactionsByMemo(all, '   ')).toEqual(all);
});

test('メモにキーワードを含む取引が無ければ空を返す', () => {
  expect(filterTransactionsByMemo(all, '家賃')).toEqual([]);
});
