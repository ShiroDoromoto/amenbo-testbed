import { describe, expect, test } from 'vitest';
import {
  periodOf,
  readReportSelection,
  validateReportRange,
  writeReportSelection,
} from './reportQuery.ts';

const today = '2026-09-28';

describe('readReportSelection', () => {
  test('クエリの year を読む', () => {
    expect(readReportSelection(new URLSearchParams('year=2024'), today)).toEqual({
      kind: 'year',
      year: 2024,
    });
  });

  test.each(['', 'year=', 'year=24', 'year=abcd', 'year=2024-01'])(
    'クエリ %j は読めないので今年にする',
    (query) => {
      expect(readReportSelection(new URLSearchParams(query), today)).toEqual({
        kind: 'year',
        year: 2026,
      });
    },
  );

  test('クエリの from と to を、指定した期間として読む', () => {
    expect(
      readReportSelection(new URLSearchParams('from=2025-04-01&to=2026-03-31&year=2024'), today),
    ).toEqual({ kind: 'range', from: '2025-04-01', to: '2026-03-31' });
  });

  test.each([
    'from=2025-04-01',
    'from=2025-04-01&to=2025-02-30',
    'from=2025-04-01&to=2025-03-31',
    'from=2000-01-01&to=2010-01-01',
  ])('クエリ %j は正しい期間ではないので、year を読む', (query) => {
    expect(readReportSelection(new URLSearchParams(`${query}&year=2024`), today)).toEqual({
      kind: 'year',
      year: 2024,
    });
  });
});

test('今年なら何も書かず、ほかの年なら year を4桁で書き、指定した期間なら from と to を書く', () => {
  expect(writeReportSelection({ kind: 'year', year: 2026 }, today).toString()).toBe('');
  expect(writeReportSelection({ kind: 'year', year: 2024 }, today).toString()).toBe('year=2024');
  expect(writeReportSelection({ kind: 'year', year: 999 }, today).toString()).toBe('year=0999');
  expect(
    writeReportSelection({ kind: 'range', from: '2025-04-01', to: '2026-03-31' }, today).toString(),
  ).toBe('from=2025-04-01&to=2026-03-31');
});

test('1年ごとならその年の 1月1日〜12月31日、指定した期間ならその期間にする', () => {
  expect(periodOf({ kind: 'year', year: 2025 })).toEqual({ from: '2025-01-01', to: '2025-12-31' });
  expect(periodOf({ kind: 'range', from: '2025-04-01', to: '2025-04-30' })).toEqual({
    from: '2025-04-01',
    to: '2025-04-30',
  });
});

describe('validateReportRange', () => {
  test('開始日と終了日が同じ日でも通す', () => {
    expect(validateReportRange('2026-01-10', '2026-01-10')).toBeNull();
  });

  test('日付が入っていなければ、その欄の誤りにする', () => {
    expect(validateReportRange('', '')).toEqual({
      from: '開始日を入れてください',
      to: '終了日を入れてください',
    });
    expect(validateReportRange('2026-01-10', '')).toEqual({ to: '終了日を入れてください' });
  });

  test('終了日が開始日より前なら、終了日の誤りにする', () => {
    expect(validateReportRange('2026-01-10', '2026-01-09')).toEqual({
      to: '終了日は開始日と同じ日か、それより後にしてください',
    });
  });

  test('120 か月までは通し、121 か月にかかると終了日の誤りにする', () => {
    expect(validateReportRange('2016-01-31', '2025-12-01')).toBeNull();
    expect(validateReportRange('2016-01-31', '2026-01-01')).toEqual({
      to: '期間は 10 年（120 か月）以内にしてください',
    });
  });
});
