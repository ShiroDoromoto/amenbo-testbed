import { expect, test } from 'vitest';
import type { Transaction } from '../../domain/transaction.ts';
import { groupTransactionsByDate } from './groupTransactionsByDate.ts';

function expense(id: string, date: string, amount: number): Transaction {
  return { id, date, amount, type: 'expense', categoryId: 'c', accountId: 'a', memo: '' };
}

function income(id: string, date: string, amount: number): Transaction {
  return { id, date, amount, type: 'income', categoryId: 'c', accountId: 'a', memo: '' };
}

function transfer(id: string, date: string, amount: number): Transaction {
  return { id, date, amount, type: 'transfer', accountId: 'a', toAccountId: 'b', memo: '' };
}

test('同じ日付の取引をまとめ、日付と取引の並びは渡された順のまま保つ', () => {
  const days = groupTransactionsByDate([
    expense('1', '2026-09-25', 100),
    expense('2', '2026-09-25', 200),
    expense('3', '2026-09-10', 300),
  ]);

  expect(days.map((d) => d.date)).toEqual(['2026-09-25', '2026-09-10']);
  expect(days.map((d) => d.transactions.map((t) => t.id))).toEqual([['1', '2'], ['3']]);
});

test('小計は収入から支出を引いた額にし、振替は数えない', () => {
  const [day] = groupTransactionsByDate([
    income('1', '2026-09-25', 1000),
    expense('2', '2026-09-25', 300),
    transfer('3', '2026-09-25', 5000),
  ]);

  expect(day!.subtotal).toBe(700);
});

test('振替だけの日の小計は 0 にする', () => {
  const [day] = groupTransactionsByDate([transfer('1', '2026-09-01', 30000)]);

  expect(day!.subtotal).toBe(0);
});

test('取引が無ければ、空の配列を返す', () => {
  expect(groupTransactionsByDate([])).toEqual([]);
});
