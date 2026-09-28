import { describe, expect, it } from 'vitest';
import type { Transaction } from '../transaction.ts';
import { calculateMonthlySummary } from './monthly.ts';

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

describe('calculateMonthlySummary', () => {
  it('その月の収入と支出を合計し、差額を出す', () => {
    const transactions = [
      income('2026-09-25', 250000),
      expense('2026-09-03', 1200),
      expense('2026-09-10', 80000),
    ];

    expect(calculateMonthlySummary(transactions, '2026-09-01')).toEqual({
      income: 250000,
      expense: 81200,
      balance: 168800,
    });
  });

  it('支出が収入より多ければ、差額は負になる', () => {
    const transactions = [income('2026-09-25', 1000), expense('2026-09-03', 3000)];

    expect(calculateMonthlySummary(transactions, '2026-09-01')).toEqual({
      income: 1000,
      expense: 3000,
      balance: -2000,
    });
  });

  it('月の 1 日と末日の取引を数え、前後の月の取引は数えない', () => {
    const transactions = [
      income('2024-01-31', 1),
      income('2024-02-01', 10),
      expense('2024-02-29', 100),
      expense('2024-03-01', 1000),
    ];

    expect(calculateMonthlySummary(transactions, '2024-02-15')).toEqual({
      income: 10,
      expense: 100,
      balance: -90,
    });
  });

  it('振替は数えない', () => {
    const transactions = [transfer('2026-09-05', 30000), expense('2026-09-05', 500)];

    expect(calculateMonthlySummary(transactions, '2026-09-01')).toEqual({
      income: 0,
      expense: 500,
      balance: -500,
    });
  });

  it('取引が無い月は、すべて 0 になる', () => {
    expect(calculateMonthlySummary([], '2026-09-01')).toEqual({
      income: 0,
      expense: 0,
      balance: 0,
    });
  });

  it('月が YYYY-MM-DD でなければ例外を投げる', () => {
    expect(() => calculateMonthlySummary([], '2026-09')).toThrow(RangeError);
  });

  it('金額が整数でなければ例外を投げる', () => {
    expect(() => calculateMonthlySummary([income('2026-09-01', 0.5)], '2026-09-01')).toThrow(
      RangeError,
    );
  });

  it('合計が扱える範囲を超えたら例外を投げる', () => {
    const transactions = [income('2026-09-01', Number.MAX_SAFE_INTEGER), income('2026-09-02', 1)];

    expect(() => calculateMonthlySummary(transactions, '2026-09-01')).toThrow(RangeError);
  });
});
