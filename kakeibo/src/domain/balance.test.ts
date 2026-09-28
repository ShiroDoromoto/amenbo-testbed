import { describe, expect, it } from 'vitest';
import type { Account } from './account.ts';
import { BALANCE_TREND_MONTHS, calculateBalanceTrend, calculateBalances } from './balance.ts';
import type { Transaction } from './transaction.ts';

const wallet: Account = {
  id: 'wallet',
  name: '財布',
  type: 'cash',
  initialBalance: 5000,
  closingDay: null,
  paymentDay: null,
};
const bank: Account = {
  id: 'bank',
  name: '銀行',
  type: 'bank',
  initialBalance: 100000,
  closingDay: null,
  paymentDay: null,
};
const card: Account = {
  id: 'card',
  name: 'カード',
  type: 'card',
  initialBalance: -20000,
  closingDay: null,
  paymentDay: null,
};

let nextId = 0;

function income(accountId: string, amount: number, date = '2026-09-01'): Transaction {
  return {
    id: `t${nextId++}`,
    type: 'income',
    date,
    amount,
    memo: '',
    categoryId: 'salary',
    accountId,
  };
}

function expense(accountId: string, amount: number, date = '2026-09-01'): Transaction {
  return {
    id: `t${nextId++}`,
    type: 'expense',
    date,
    amount,
    memo: '',
    categoryId: 'food',
    accountId,
  };
}

function transfer(
  accountId: string,
  toAccountId: string,
  amount: number,
  date = '2026-09-01',
): Transaction {
  return {
    id: `t${nextId++}`,
    type: 'transfer',
    date,
    amount,
    memo: '',
    accountId,
    toAccountId,
  };
}

describe('calculateBalances', () => {
  it('returns the initial balance of each account when there are no transactions', () => {
    expect(calculateBalances([wallet, bank, card], [])).toEqual(
      new Map([
        ['wallet', 5000],
        ['bank', 100000],
        ['card', -20000],
      ]),
    );
  });

  it('returns an empty map when there are no accounts', () => {
    expect(calculateBalances([], [income('wallet', 1000)])).toEqual(new Map());
  });

  it('adds income and subtracts expenses', () => {
    const balances = calculateBalances(
      [wallet, bank],
      [income('bank', 250000), expense('bank', 80000), expense('wallet', 1200)],
    );
    expect(balances.get('bank')).toBe(270000);
    expect(balances.get('wallet')).toBe(3800);
  });

  it('moves the amount of a transfer from the source to the destination', () => {
    const balances = calculateBalances(
      [wallet, bank, card],
      [transfer('bank', 'wallet', 10000), transfer('bank', 'card', 20000)],
    );
    expect(balances.get('bank')).toBe(70000);
    expect(balances.get('wallet')).toBe(15000);
    expect(balances.get('card')).toBe(0);
  });

  it('lets a balance go below zero', () => {
    expect(calculateBalances([wallet], [expense('wallet', 8000)]).get('wallet')).toBe(-3000);
  });

  it('ignores the side of a transaction that points to an unknown account', () => {
    const balances = calculateBalances(
      [wallet],
      [expense('gone', 1000), transfer('gone', 'wallet', 2000), transfer('wallet', 'gone', 500)],
    );
    expect(balances).toEqual(new Map([['wallet', 6500]]));
  });

  it('throws when a balance goes beyond the safe integer range', () => {
    const rich: Account = { ...bank, initialBalance: Number.MAX_SAFE_INTEGER };
    expect(() => calculateBalances([rich], [income('bank', 1)])).toThrow(RangeError);
  });
});

describe('calculateBalanceTrend', () => {
  it('returns 12 months ending with the month that contains the given date', () => {
    const trend = calculateBalanceTrend([wallet], [], '2026-09-17');
    expect(trend).toHaveLength(BALANCE_TREND_MONTHS);
    expect(trend[0]?.month).toBe('2025-10-01');
    expect(trend.at(-1)?.month).toBe('2026-09-01');
  });

  it('returns the sum of the initial balances when there are no transactions', () => {
    const trend = calculateBalanceTrend([wallet, bank, card], [], '2026-09-01');
    expect(trend.every((point) => point.balance === 85000)).toBe(true);
  });

  it('carries the balance forward from month to month', () => {
    const trend = calculateBalanceTrend(
      [wallet, bank],
      [
        income('bank', 200000, '2025-12-25'),
        expense('wallet', 3000, '2026-01-10'),
        expense('bank', 50000, '2026-08-31'),
      ],
      '2026-09-30',
    );
    const balanceOf = (month: string) => trend.find((point) => point.month === month)?.balance;
    expect(balanceOf('2025-11-01')).toBe(105000);
    expect(balanceOf('2025-12-01')).toBe(305000);
    expect(balanceOf('2026-01-01')).toBe(302000);
    expect(balanceOf('2026-07-01')).toBe(302000);
    expect(balanceOf('2026-08-01')).toBe(252000);
    expect(balanceOf('2026-09-01')).toBe(252000);
  });

  it('includes transactions from before the first month', () => {
    const trend = calculateBalanceTrend([bank], [income('bank', 1000, '2020-01-01')], '2026-09-01');
    expect(trend[0]?.balance).toBe(101000);
  });

  it('leaves out transactions after the month', () => {
    const trend = calculateBalanceTrend([bank], [income('bank', 1000, '2026-10-01')], '2026-09-01');
    expect(trend.at(-1)?.balance).toBe(100000);
  });

  it('does not change the total with a transfer between known accounts', () => {
    const trend = calculateBalanceTrend(
      [wallet, bank],
      [transfer('bank', 'wallet', 10000, '2026-09-05')],
      '2026-09-01',
    );
    expect(trend.at(-1)?.balance).toBe(105000);
  });

  it('counts only the side of a transfer that points to a known account', () => {
    const trend = calculateBalanceTrend(
      [wallet],
      [transfer('wallet', 'gone', 500, '2026-09-05')],
      '2026-09-01',
    );
    expect(trend.at(-1)?.balance).toBe(4500);
  });

  it('throws when the month is not a date', () => {
    expect(() => calculateBalanceTrend([wallet], [], '2026-09')).toThrow();
  });
});
