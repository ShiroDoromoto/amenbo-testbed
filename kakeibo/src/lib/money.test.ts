import { describe, expect, it } from 'vitest';
import { formatYen, isYen, parseYen, sumYen } from './money.ts';

describe('isYen', () => {
  it.each([0, 1, -1, 1234567, Number.MAX_SAFE_INTEGER])('accepts %s', (value) => {
    expect(isYen(value)).toBe(true);
  });

  it.each([1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, '100', null, undefined])(
    'rejects %s',
    (value) => {
      expect(isYen(value)).toBe(false);
    },
  );
});

describe('parseYen', () => {
  it.each([
    ['0', 0],
    ['1234', 1234],
    ['1,234', 1234],
    ['1,234,567', 1234567],
    ['  500  ', 500],
    ['¥1,000', 1000],
    ['￥1000', 1000],
    ['1000円', 1000],
    ['１，２３４', 1234],
    ['-500', -500],
    ['－500', -500],
    ['−500', -500],
    ['-¥500円', -500],
    ['-0', 0],
    ['007', 7],
  ])('parses %j as %d', (input, expected) => {
    expect(parseYen(input)).toBe(expected);
  });

  it.each([
    '',
    ' ',
    'abc',
    '1.5',
    '12,34',
    '1,2345',
    ',100',
    '100,',
    '1 000',
    '--1',
    '9'.repeat(20),
  ])('rejects %j', (input) => {
    expect(parseYen(input)).toBeNull();
  });
});

describe('sumYen', () => {
  it('adds amounts', () => {
    expect(sumYen([1000, 2500, -300])).toBe(3200);
  });

  it('returns 0 for no amounts', () => {
    expect(sumYen([])).toBe(0);
  });

  it('throws on a non-integer amount', () => {
    expect(() => sumYen([100, 0.5])).toThrow(RangeError);
  });

  it('throws when the total leaves the safe range', () => {
    expect(() => sumYen([Number.MAX_SAFE_INTEGER, 1])).toThrow(RangeError);
  });
});

describe('formatYen', () => {
  it.each([
    [0, '0円'],
    [500, '500円'],
    [1234, '1,234円'],
    [1234567, '1,234,567円'],
    [-500, '-500円'],
    [-1234, '-1,234円'],
    [-0, '0円'],
  ])('formats %d as %s', (amount, expected) => {
    expect(formatYen(amount)).toBe(expected);
  });
});
