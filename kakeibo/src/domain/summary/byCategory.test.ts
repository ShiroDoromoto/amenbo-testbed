import { describe, expect, it } from 'vitest';
import type { Transaction } from '../transaction.ts';
import { calculateExpenseByCategory } from './byCategory.ts';

let nextId = 0;

function expense(date: string, categoryId: string, amount: number): Transaction {
  return {
    id: `t${nextId++}`,
    type: 'expense',
    date,
    amount,
    memo: '',
    categoryId,
    accountId: 'wallet',
  };
}

function income(date: string, categoryId: string, amount: number): Transaction {
  return {
    id: `t${nextId++}`,
    type: 'income',
    date,
    amount,
    memo: '',
    categoryId,
    accountId: 'bank',
  };
}

function transfer(date: string, amount: number): Transaction {
  return {
    id: `t${nextId++}`,
    type: 'transfer',
    date,
    amount,
    memo: '',
    accountId: 'bank',
    toAccountId: 'wallet',
  };
}

describe('calculateExpenseByCategory', () => {
  it('その月の支出をカテゴリごとに合計し、合計の大きい順に並べる', () => {
    const transactions = [
      expense('2026-09-03', 'food', 1200),
      expense('2026-09-10', 'rent', 80000),
      expense('2026-09-15', 'food', 800),
      expense('2026-09-20', 'daily', 3000),
    ];

    expect(calculateExpenseByCategory(transactions, '2026-09-01')).toEqual([
      { categoryId: 'rent', total: 80000 },
      { categoryId: 'daily', total: 3000 },
      { categoryId: 'food', total: 2000 },
    ]);
  });

  it('合計が同じなら、カテゴリの id の順に並べる', () => {
    const transactions = [expense('2026-09-03', 'b', 500), expense('2026-09-03', 'a', 500)];

    expect(calculateExpenseByCategory(transactions, '2026-09-01')).toEqual([
      { categoryId: 'a', total: 500 },
      { categoryId: 'b', total: 500 },
    ]);
  });

  it('月の 1 日と末日の支出を数え、前後の月の支出は数えない', () => {
    const transactions = [
      expense('2024-01-31', 'food', 1),
      expense('2024-02-01', 'food', 10),
      expense('2024-02-29', 'food', 100),
      expense('2024-03-01', 'food', 1000),
    ];

    expect(calculateExpenseByCategory(transactions, '2024-02-15')).toEqual([
      { categoryId: 'food', total: 110 },
    ]);
  });

  it('収入と振替は数えない', () => {
    const transactions = [
      income('2026-09-25', 'salary', 250000),
      transfer('2026-09-05', 30000),
      expense('2026-09-05', 'food', 500),
    ];

    expect(calculateExpenseByCategory(transactions, '2026-09-01')).toEqual([
      { categoryId: 'food', total: 500 },
    ]);
  });

  it('支出が無い月は、空の配列を返す', () => {
    expect(calculateExpenseByCategory([], '2026-09-01')).toEqual([]);
  });

  it('月が YYYY-MM-DD でなければ例外を投げる', () => {
    expect(() => calculateExpenseByCategory([], '2026-09')).toThrow(RangeError);
  });

  it('金額が整数でなければ例外を投げる', () => {
    expect(() =>
      calculateExpenseByCategory([expense('2026-09-01', 'food', 0.5)], '2026-09-01'),
    ).toThrow(RangeError);
  });
});
