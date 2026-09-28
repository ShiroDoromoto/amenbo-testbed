import { describe, expect, it } from 'vitest';
import type { Transaction } from '../transaction.ts';
import { calculateExpensePace } from './pace.ts';

let nextId = 0;

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

describe('calculateExpensePace', () => {
  it('月初から今日までの支出を日数で割り、その月の日数を掛けて見込みを出す', () => {
    const transactions = [expense('2026-09-01', 30000), expense('2026-09-10', 30000)];

    expect(calculateExpensePace(transactions, '2026-09-10')).toEqual({
      spent: 60000,
      elapsedDays: 10,
      daysInMonth: 30,
      dailyAverage: 6000,
      projected: 180000,
    });
  });

  it('ほかの月の支出、今日より後の支出、収入と振替は数えない', () => {
    const transactions = [
      expense('2026-09-05', 20000),
      expense('2026-08-31', 9999),
      expense('2026-09-11', 9999),
      expense('2026-10-01', 9999),
      income('2026-09-05', 250000),
      transfer('2026-09-05', 50000),
    ];

    const result = calculateExpensePace(transactions, '2026-09-10');

    expect(result.spent).toBe(20000);
    expect(result.dailyAverage).toBe(2000);
    expect(result.projected).toBe(60000);
  });

  it('平均と見込みは、割り切れなければ円に丸める', () => {
    // 10000 / 3 = 3333.33…、× 31 = 103333.33…
    const result = calculateExpensePace([expense('2026-10-02', 10000)], '2026-10-03');

    expect(result.dailyAverage).toBe(3333);
    expect(result.projected).toBe(103333);
  });

  it('うるう年の 2 月は 29 日で見込む', () => {
    const result = calculateExpensePace([expense('2028-02-01', 1000)], '2028-02-01');

    expect(result.daysInMonth).toBe(29);
    expect(result.projected).toBe(29000);
  });

  it('月末の日には、見込みが月初からの支出と同じになる', () => {
    const result = calculateExpensePace([expense('2026-09-15', 12345)], '2026-09-30');

    expect(result.projected).toBe(12345);
  });

  it('支出が無ければ、平均も見込みも 0 にする', () => {
    expect(calculateExpensePace([], '2026-09-28')).toEqual({
      spent: 0,
      elapsedDays: 28,
      daysInMonth: 30,
      dailyAverage: 0,
      projected: 0,
    });
  });

  it('日付が YYYY-MM-DD でなければ例外を投げる', () => {
    expect(() => calculateExpensePace([], '2026-9-1')).toThrow(RangeError);
  });
});
