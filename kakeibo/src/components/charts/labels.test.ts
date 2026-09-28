import { expect, test } from 'vitest';
import { compactYenLabel, longMonthLabel, shortMonthLabel } from './labels.ts';

test('月は、目盛りでは月だけ、ツールチップでは年と月にする', () => {
  expect(shortMonthLabel('2026-01-01')).toBe('1月');
  expect(longMonthLabel('2025-12-01')).toBe('2025年12月');
});

test('金額の目盛りは、万の単位で短くする', () => {
  expect(compactYenLabel(250000)).toBe('25万円');
  expect(compactYenLabel(-30000)).toBe('-3万円');
  expect(compactYenLabel(0)).toBe('0円');
});
