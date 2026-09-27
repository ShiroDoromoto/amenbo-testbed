import { describe, expect, it } from 'vitest';
import { isDayOfMonth, isTransferRecurring } from './recurring.ts';
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
