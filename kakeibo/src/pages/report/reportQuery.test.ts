import { expect, test } from 'vitest';
import { readReportYear, writeReportYear } from './reportQuery.ts';

test('クエリの year を読む', () => {
  expect(readReportYear(new URLSearchParams('year=2024'), '2026-09-28')).toBe(2024);
});

test.each(['', 'year=', 'year=24', 'year=abcd', 'year=2024-01'])(
  'クエリ %j は読めないので今年にする',
  (query) => {
    expect(readReportYear(new URLSearchParams(query), '2026-09-28')).toBe(2026);
  },
);

test('今年なら year を書かず、ほかの年なら4桁で書く', () => {
  expect(writeReportYear(2026, '2026-09-28').toString()).toBe('');
  expect(writeReportYear(2024, '2026-09-28').toString()).toBe('year=2024');
  expect(writeReportYear(999, '2026-09-28').toString()).toBe('year=0999');
});
