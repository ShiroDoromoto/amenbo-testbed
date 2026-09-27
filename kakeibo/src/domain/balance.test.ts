import { describe, expect, it } from 'vitest';
import type { Account } from './account.ts';
import { calculateBalances } from './balance.ts';
import type { Transaction } from './transaction.ts';

const wallet: Account = { id: 'wallet', name: '財布', type: 'cash', initialBalance: 5000 };
const bank: Account = { id: 'bank', name: '銀行', type: 'bank', initialBalance: 100000 };
const card: Account = { id: 'card', name: 'カード', type: 'card', initialBalance: -20000 };

let nextId = 0;

function income(accountId: string, amount: number): Transaction {
  return {
    id: `t${nextId++}`,
    type: 'income',
    date: '2026-09-01',
    amount,
    memo: '',
    categoryId: 'salary',
    accountId,
  };
}

function expense(accountId: string, amount: number): Transaction {
  return {
    id: `t${nextId++}`,
    type: 'expense',
    date: '2026-09-01',
    amount,
    memo: '',
    categoryId: 'food',
    accountId,
  };
}

function transfer(accountId: string, toAccountId: string, amount: number): Transaction {
  return {
    id: `t${nextId++}`,
    type: 'transfer',
    date: '2026-09-01',
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
