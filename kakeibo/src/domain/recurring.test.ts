import { describe, expect, it } from 'vitest';
import {
  dueOccurrences,
  isDayOfMonth,
  isTransferRecurring,
  transactionFor,
  type RecurringTransaction,
} from './recurring.ts';
import { incomeExpenseTypes } from './transaction.ts';

describe('isDayOfMonth', () => {
  it.each([1, 15, 28, 29, 30, 31])('accepts %s', (day) => {
    expect(isDayOfMonth(day)).toBe(true);
  });

  it.each([0, 32, -1, 1.5, Number.NaN, Infinity, '1', null, undefined])('rejects %s', (value) => {
    expect(isDayOfMonth(value)).toBe(false);
  });
});

describe('isTransferRecurring', () => {
  const base = { id: 'r', dayOfMonth: 25, amount: 80000, memo: '' };

  it('is true for a transfer', () => {
    expect(
      isTransferRecurring({ ...base, type: 'transfer', accountId: 'a', toAccountId: 'b' }),
    ).toBe(true);
  });

  it('is false for income and expense', () => {
    for (const type of incomeExpenseTypes) {
      expect(isTransferRecurring({ ...base, type, categoryId: 'c', accountId: 'a' })).toBe(false);
    }
  });
});

describe('dueOccurrences', () => {
  function recurring(dayOfMonth: number, lastGeneratedOn?: string): RecurringTransaction {
    return {
      id: 'r',
      dayOfMonth,
      amount: 80000,
      memo: '',
      type: 'expense',
      categoryId: 'c',
      accountId: 'a',
      ...(lastGeneratedOn === undefined ? {} : { lastGeneratedOn }),
    };
  }

  it("returns this month's date when it has never generated and the day has come", () => {
    expect(dueOccurrences(recurring(25), '2025-03-25')).toEqual(['2025-03-25']);
  });

  it('returns nothing when it has never generated and the day has not come', () => {
    expect(dueOccurrences(recurring(25), '2025-03-24')).toEqual([]);
  });

  it('returns nothing more in the month it last generated', () => {
    expect(dueOccurrences(recurring(25, '2025-03-25'), '2025-03-31')).toEqual([]);
  });

  it('returns every missed month, oldest first', () => {
    expect(dueOccurrences(recurring(10, '2024-11-10'), '2025-02-10')).toEqual([
      '2024-12-10',
      '2025-01-10',
      '2025-02-10',
    ]);
  });

  it('uses the last day of a month that lacks the day', () => {
    expect(dueOccurrences(recurring(31, '2024-01-31'), '2024-04-30')).toEqual([
      '2024-02-29',
      '2024-03-31',
      '2024-04-30',
    ]);
  });

  it('does not generate twice in a month after the day was moved later', () => {
    expect(dueOccurrences(recurring(20, '2025-03-10'), '2025-03-31')).toEqual([]);
  });
});

describe('transactionFor', () => {
  it('copies an income or expense onto the date', () => {
    expect(
      transactionFor(
        {
          id: 'r',
          dayOfMonth: 25,
          amount: 250000,
          memo: '給料',
          type: 'income',
          categoryId: 'salary',
          accountId: 'bank',
          lastGeneratedOn: '2025-02-25',
        },
        '2025-03-25',
      ),
    ).toEqual({
      type: 'income',
      date: '2025-03-25',
      amount: 250000,
      memo: '給料',
      categoryId: 'salary',
      accountId: 'bank',
    });
  });

  it('copies a transfer onto the date', () => {
    expect(
      transactionFor(
        {
          id: 'r',
          dayOfMonth: 1,
          amount: 30000,
          memo: '',
          type: 'transfer',
          accountId: 'bank',
          toAccountId: 'savings',
        },
        '2025-03-01',
      ),
    ).toEqual({
      type: 'transfer',
      date: '2025-03-01',
      amount: 30000,
      memo: '',
      accountId: 'bank',
      toAccountId: 'savings',
    });
  });
});
