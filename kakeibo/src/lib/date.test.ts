import { describe, expect, it } from 'vitest';
import {
  addMonths,
  endOfMonth,
  isDateString,
  parseDateString,
  startOfMonth,
  toDateString,
} from './date.ts';

describe('isDateString', () => {
  it.each([
    '2025-01-01',
    '2025-12-31',
    '2024-02-29',
    '2000-02-29',
    '0001-01-01',
    '0000-02-29',
    '9999-12-31',
  ])('accepts %s', (value) => {
    expect(isDateString(value)).toBe(true);
  });

  it.each([
    '',
    '2025-1-1',
    '2025/01/01',
    '20250101',
    '2025-01-01T00:00:00',
    ' 2025-01-01',
    '2025-00-10',
    '2025-13-01',
    '2025-01-00',
    '2025-01-32',
    '2025-02-29',
    '1900-02-29',
    '2025-04-31',
    20250101,
    null,
    undefined,
  ])('rejects %j', (value) => {
    expect(isDateString(value)).toBe(false);
  });
});

describe('toDateString', () => {
  it('uses the local date', () => {
    expect(toDateString(new Date(2025, 0, 5, 23, 59))).toBe('2025-01-05');
    expect(toDateString(new Date(2025, 11, 31, 0, 0))).toBe('2025-12-31');
  });

  it('throws on an invalid date', () => {
    expect(() => toDateString(new Date(NaN))).toThrow(RangeError);
  });
});

describe('parseDateString', () => {
  it('returns local midnight of the day', () => {
    const date = parseDateString('2025-03-15');
    expect(date).toEqual(new Date(2025, 2, 15));
  });

  it('keeps years below 100', () => {
    expect(parseDateString('0050-06-01')?.getFullYear()).toBe(50);
  });

  it('round-trips with toDateString', () => {
    for (const value of ['2024-02-29', '2025-12-31', '0050-06-01']) {
      expect(toDateString(parseDateString(value)!)).toBe(value);
    }
  });

  it.each(['', '2025-02-30', '2025-1-1', 'abc'])('rejects %j', (value) => {
    expect(parseDateString(value)).toBeNull();
  });
});

describe('startOfMonth', () => {
  it.each([
    ['2025-03-15', '2025-03-01'],
    ['2025-03-01', '2025-03-01'],
    ['2025-12-31', '2025-12-01'],
  ])('%s → %s', (date, expected) => {
    expect(startOfMonth(date)).toBe(expected);
  });

  it('throws on a malformed date', () => {
    expect(() => startOfMonth('2025-3-1')).toThrow(RangeError);
  });
});

describe('endOfMonth', () => {
  it.each([
    ['2025-01-10', '2025-01-31'],
    ['2025-02-10', '2025-02-28'],
    ['2024-02-10', '2024-02-29'],
    ['1900-02-01', '1900-02-28'],
    ['2000-02-01', '2000-02-29'],
    ['2025-04-30', '2025-04-30'],
    ['2025-12-01', '2025-12-31'],
  ])('%s → %s', (date, expected) => {
    expect(endOfMonth(date)).toBe(expected);
  });

  it('throws on a malformed date', () => {
    expect(() => endOfMonth('2025-02-30')).toThrow(RangeError);
  });
});

describe('addMonths', () => {
  it.each([
    ['2025-03-15', 1, '2025-04-15'],
    ['2025-03-15', 0, '2025-03-15'],
    ['2025-03-15', -1, '2025-02-15'],
    ['2025-12-10', 1, '2026-01-10'],
    ['2025-01-10', -1, '2024-12-10'],
    ['2025-01-10', 25, '2027-02-10'],
    ['2025-01-10', -25, '2022-12-10'],
    ['2025-01-31', 1, '2025-02-28'],
    ['2024-01-31', 1, '2024-02-29'],
    ['2025-03-31', -1, '2025-02-28'],
    ['2025-05-31', 1, '2025-06-30'],
    ['2024-02-29', 12, '2025-02-28'],
  ])('%s + %d months → %s', (date, months, expected) => {
    expect(addMonths(date, months)).toBe(expected);
  });

  it('throws on a non-integer month count', () => {
    expect(() => addMonths('2025-01-01', 1.5)).toThrow(RangeError);
  });

  it('throws on a malformed date', () => {
    expect(() => addMonths('2025-13-01', 1)).toThrow(RangeError);
  });

  it('throws when the year leaves 0000–9999', () => {
    expect(() => addMonths('9999-12-01', 1)).toThrow(RangeError);
    expect(() => addMonths('0000-01-01', -1)).toThrow(RangeError);
  });
});
