import { expect, test } from 'vitest';
import { validateTransactionInput, type TransactionInput } from './validateTransactionInput.ts';

const valid: TransactionInput = {
  date: '2026-09-28',
  amount: '1,234円',
  categoryId: 'food',
  accountId: 'cash',
};

test('通った入力は、金額を整数に直して返す', () => {
  expect(validateTransactionInput(valid)).toEqual({
    ok: true,
    value: { date: '2026-09-28', amount: 1234, categoryId: 'food', accountId: 'cash' },
  });
});

test.each([
  ['', '金額を入れてください'],
  ['  ', '金額を入れてください'],
  ['abc', '金額は整数で入れてください'],
  ['12.5', '金額は整数で入れてください'],
  ['0', '金額は1円以上にしてください'],
  ['-500', '金額は1円以上にしてください'],
])('金額が「%s」なら「%s」', (amount, message) => {
  expect(validateTransactionInput({ ...valid, amount })).toEqual({
    ok: false,
    errors: { amount: message },
  });
});

test.each([
  ['', '日付を入れてください'],
  ['2026-02-30', '日付が正しくありません'],
  ['2026/09/28', '日付が正しくありません'],
])('日付が「%s」なら「%s」', (date, message) => {
  expect(validateTransactionInput({ ...valid, date })).toEqual({
    ok: false,
    errors: { date: message },
  });
});

test('カテゴリと口座が空なら、両方にエラーを出す', () => {
  expect(validateTransactionInput({ ...valid, categoryId: '', accountId: '' })).toEqual({
    ok: false,
    errors: { categoryId: 'カテゴリを選んでください', accountId: '口座を選んでください' },
  });
});

test('全部の欄が通らなければ、全部の欄にエラーを出す', () => {
  const result = validateTransactionInput({ date: '', amount: '', categoryId: '', accountId: '' });
  expect(result.ok).toBe(false);
  expect(!result.ok && Object.keys(result.errors)).toEqual([
    'date',
    'amount',
    'categoryId',
    'accountId',
  ]);
});
