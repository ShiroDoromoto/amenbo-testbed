import { describe, expect, it } from 'vitest';
import { budgetMonthOf, isBudgetAmount, isBudgetMonth } from './budget.ts';

describe('isBudgetMonth', () => {
  it.each(['2025-01', '2025-12', '0001-06', '9999-12'])('accepts %s', (month) => {
    expect(isBudgetMonth(month)).toBe(true);
  });

  it.each(['2025-00', '2025-13', '2025-1', '25-01', '2025-01-01', '2025/01', '', 202501, null])(
    'rejects %s',
    (value) => {
      expect(isBudgetMonth(value)).toBe(false);
    },
  );
});

describe('budgetMonthOf', () => {
  it('returns the month that contains the date', () => {
    expect(budgetMonthOf('2025-03-15')).toBe('2025-03');
    expect(budgetMonthOf('2024-12-31')).toBe('2024-12');
  });

  it('throws when the date is not YYYY-MM-DD', () => {
    expect(() => budgetMonthOf('2025-02-30')).toThrow(RangeError);
    expect(() => budgetMonthOf('2025-03')).toThrow(RangeError);
  });
});

describe('isBudgetAmount', () => {
  it.each([0, 1, 30000, Number.MAX_SAFE_INTEGER])('accepts %s', (amount) => {
    expect(isBudgetAmount(amount)).toBe(true);
  });

  it.each([-1, 1.5, Number.NaN, Infinity, '1000', null, undefined])('rejects %s', (value) => {
    expect(isBudgetAmount(value)).toBe(false);
  });
});
