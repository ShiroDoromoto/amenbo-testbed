import { describe, expect, it } from 'vitest';
import type { Transaction } from '../transaction.ts';
import { calculateMonthlyTrend, TREND_MONTHS } from './trend.ts';

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

describe('calculateMonthlyTrend', () => {
  it('指定した月までの 12 か月を、古い月から順に返す', () => {
    const trend = calculateMonthlyTrend([], '2026-09-18');

    expect(trend).toHaveLength(TREND_MONTHS);
    expect(trend.map((point) => point.month)).toEqual([
      '2025-10-01',
      '2025-11-01',
      '2025-12-01',
      '2026-01-01',
      '2026-02-01',
      '2026-03-01',
      '2026-04-01',
      '2026-05-01',
      '2026-06-01',
      '2026-07-01',
      '2026-08-01',
      '2026-09-01',
    ]);
  });

  it('取引の無い月は、収支を 0 で返す', () => {
    const trend = calculateMonthlyTrend([], '2026-09-01');

    expect(trend[0]).toEqual({ month: '2025-10-01', income: 0, expense: 0, balance: 0 });
  });

  it('月ごとに収入と支出を合計し、差額を出す', () => {
    const transactions = [
      income('2026-09-25', 250000),
      expense('2026-09-03', 81200),
      income('2026-08-25', 250000),
      expense('2026-08-31', 300000),
      expense('2025-10-01', 500),
    ];

    const trend = calculateMonthlyTrend(transactions, '2026-09-30');

    expect(trend[11]).toEqual({
      month: '2026-09-01',
      income: 250000,
      expense: 81200,
      balance: 168800,
    });
    expect(trend[10]).toEqual({
      month: '2026-08-01',
      income: 250000,
      expense: 300000,
      balance: -50000,
    });
    expect(trend[0]).toEqual({ month: '2025-10-01', income: 0, expense: 500, balance: -500 });
  });

  it('12 か月より前と、指定した月より後の取引は数えない', () => {
    const transactions = [expense('2025-09-30', 1000), expense('2026-10-01', 2000)];

    const trend = calculateMonthlyTrend(transactions, '2026-09-15');

    expect(trend.every((point) => point.expense === 0)).toBe(true);
  });

  it('振替は数えない', () => {
    const trend = calculateMonthlyTrend([transfer('2026-09-10', 30000)], '2026-09-01');

    expect(trend[11]).toEqual({ month: '2026-09-01', income: 0, expense: 0, balance: 0 });
  });

  it('年をまたいでも月を正しく並べる', () => {
    const trend = calculateMonthlyTrend([], '2026-01-31');

    expect(trend[0]?.month).toBe('2025-02-01');
    expect(trend[11]?.month).toBe('2026-01-01');
  });

  it('month が YYYY-MM-DD でなければ例外を投げる', () => {
    expect(() => calculateMonthlyTrend([], '2026-09')).toThrow();
  });
});
