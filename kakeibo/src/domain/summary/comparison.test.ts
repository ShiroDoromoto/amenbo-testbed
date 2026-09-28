import { describe, expect, it } from 'vitest';
import type { Transaction } from '../transaction.ts';
import { calculateChange, calculateMonthlyComparison } from './comparison.ts';

let nextId = 0;

function income(date: string, amount: number): Transaction {
  return {
    id: `t${nextId++}`,
    type: 'income',
    date,
    amount,
    memo: '',
    categoryId: 'salary',
    accountId: 'bank',
  };
}

function expense(date: string, amount: number): Transaction {
  return {
    id: `t${nextId++}`,
    type: 'expense',
    date,
    amount,
    memo: '',
    categoryId: 'food',
    accountId: 'wallet',
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

describe('calculateChange', () => {
  it('差と、比べる元に対する割合を出す', () => {
    expect(calculateChange(12000, 10000)).toEqual({ difference: 2000, rate: 0.2 });
    expect(calculateChange(7500, 10000)).toEqual({ difference: -2500, rate: -0.25 });
  });

  it('比べる元が負なら、絶対値で割って増減の向きを差と揃える', () => {
    expect(calculateChange(-1000, -4000)).toEqual({ difference: 3000, rate: 0.75 });
    expect(calculateChange(-6000, -4000)).toEqual({ difference: -2000, rate: -0.5 });
  });

  it('比べる元が 0 なら、割合を null にする', () => {
    expect(calculateChange(5000, 0)).toEqual({ difference: 5000, rate: null });
    expect(calculateChange(0, 0)).toEqual({ difference: 0, rate: null });
  });
});

describe('calculateMonthlyComparison', () => {
  it('今月の収支を、前月と前年同月の収支と比べる', () => {
    const transactions = [
      income('2026-09-25', 250000),
      expense('2026-09-10', 90000),
      income('2026-08-25', 200000),
      expense('2026-08-31', 100000),
      income('2025-09-25', 250000),
      expense('2025-09-01', 60000),
      // 比べる月のどれでもない
      expense('2026-07-31', 9999),
      expense('2025-10-01', 9999),
    ];

    const result = calculateMonthlyComparison(transactions, '2026-09-28');

    expect(result.current).toEqual({ income: 250000, expense: 90000, balance: 160000 });
    expect(result.previousMonth).toEqual({
      income: { difference: 50000, rate: 0.25 },
      expense: { difference: -10000, rate: -0.1 },
      balance: { difference: 60000, rate: 0.6 },
    });
    expect(result.previousYear).toEqual({
      income: { difference: 0, rate: 0 },
      expense: { difference: 30000, rate: 0.5 },
      balance: { difference: -30000, rate: -30000 / 190000 },
    });
  });

  it('1月の前月は、前年の12月にする', () => {
    const transactions = [expense('2025-12-31', 4000), expense('2026-01-01', 5000)];

    const result = calculateMonthlyComparison(transactions, '2026-01-15');

    expect(result.previousMonth.expense).toEqual({ difference: 1000, rate: 0.25 });
  });

  it('振替は数えない', () => {
    const transactions = [transfer('2026-09-10', 30000), transfer('2026-08-10', 10000)];

    const result = calculateMonthlyComparison(transactions, '2026-09-28');

    expect(result.current).toEqual({ income: 0, expense: 0, balance: 0 });
    expect(result.previousMonth.expense).toEqual({ difference: 0, rate: null });
  });

  it('日付が YYYY-MM-DD でなければ、例外を投げる', () => {
    expect(() => calculateMonthlyComparison([], '2026/09/28')).toThrow();
  });
});
