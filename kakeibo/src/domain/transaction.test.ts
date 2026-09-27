import { describe, expect, it } from 'vitest';
import { isTransactionType, transactionTypes } from './transaction.ts';

describe('isTransactionType', () => {
  it.each(transactionTypes)('accepts %s', (type) => {
    expect(isTransactionType(type)).toBe(true);
  });

  it.each(['transfer', 'Income', '', null, undefined, 1])('rejects %s', (value) => {
    expect(isTransactionType(value)).toBe(false);
  });
});
