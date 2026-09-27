import { describe, expect, it } from 'vitest';
import { accountTypes, isAccountType, isInitialBalance } from './account.ts';

describe('isAccountType', () => {
  it.each(accountTypes)('accepts %s', (type) => {
    expect(isAccountType(type)).toBe(true);
  });

  it.each(['wallet', 'Cash', '', null, undefined, 1])('rejects %s', (value) => {
    expect(isAccountType(value)).toBe(false);
  });
});

describe('isInitialBalance', () => {
  it.each([0, 1000, -5000])('accepts %s', (value) => {
    expect(isInitialBalance(value)).toBe(true);
  });

  it.each([1.5, Number.NaN, Number.POSITIVE_INFINITY, 2 ** 53, '1000', null, undefined])(
    'rejects %s',
    (value) => {
      expect(isInitialBalance(value)).toBe(false);
    },
  );
});
