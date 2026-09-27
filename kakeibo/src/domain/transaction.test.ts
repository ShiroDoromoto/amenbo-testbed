import { describe, expect, it } from 'vitest';
import {
  incomeExpenseTypes,
  isIncomeExpenseType,
  isTransactionType,
  isTransfer,
  transactionTypes,
} from './transaction.ts';

describe('isTransactionType', () => {
  it.each(transactionTypes)('accepts %s', (type) => {
    expect(isTransactionType(type)).toBe(true);
  });

  it.each(['Transfer', 'Income', '', null, undefined, 1])('rejects %s', (value) => {
    expect(isTransactionType(value)).toBe(false);
  });
});

describe('isIncomeExpenseType', () => {
  it.each(incomeExpenseTypes)('accepts %s', (type) => {
    expect(isIncomeExpenseType(type)).toBe(true);
  });

  it.each(['transfer', 'Income', '', null, undefined, 1])('rejects %s', (value) => {
    expect(isIncomeExpenseType(value)).toBe(false);
  });
});

describe('isTransfer', () => {
  const base = { id: 't', date: '2026-01-01', amount: 1000, memo: '' };

  it('is true for a transfer', () => {
    expect(isTransfer({ ...base, type: 'transfer', accountId: 'a', toAccountId: 'b' })).toBe(true);
  });

  it('is false for income and expense', () => {
    for (const type of incomeExpenseTypes) {
      expect(isTransfer({ ...base, type, categoryId: 'c', accountId: 'a' })).toBe(false);
    }
  });
});
