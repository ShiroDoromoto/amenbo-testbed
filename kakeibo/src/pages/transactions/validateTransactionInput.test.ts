import { expect, test } from 'vitest';
import { validateTransactionInput, type TransactionInput } from './validateTransactionInput.ts';

const valid: TransactionInput = {
  date: '2026-09-28',
  amount: '1,234円',
  categoryId: 'food',
  accountId: 'cash',
  toAccountId: '',
};

test('通った入力は、金額を整数に直して返す', () => {
  expect(validateTransactionInput(valid, 'expense')).toEqual({
    ok: true,
    value: {
      type: 'expense',
      date: '2026-09-28',
      amount: 1234,
      categoryId: 'food',
      accountId: 'cash',
    },
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
  expect(validateTransactionInput({ ...valid, amount }, 'expense')).toEqual({
    ok: false,
    errors: { amount: message },
  });
});

test.each([
  ['', '日付を入れてください'],
  ['2026-02-30', '日付が正しくありません'],
  ['2026/09/28', '日付が正しくありません'],
])('日付が「%s」なら「%s」', (date, message) => {
  expect(validateTransactionInput({ ...valid, date }, 'expense')).toEqual({
    ok: false,
    errors: { date: message },
  });
});

test('カテゴリと口座が空なら、両方にエラーを出す', () => {
  expect(validateTransactionInput({ ...valid, categoryId: '', accountId: '' }, 'expense')).toEqual({
    ok: false,
    errors: { categoryId: 'カテゴリを選んでください', accountId: '口座を選んでください' },
  });
});

test('全部の欄が通らなければ、全部の欄にエラーを出す', () => {
  const result = validateTransactionInput(
    { date: '', amount: '', categoryId: '', accountId: '', toAccountId: '' },
    'expense',
  );
  expect(result.ok).toBe(false);
  expect(!result.ok && Object.keys(result.errors)).toEqual([
    'date',
    'amount',
    'categoryId',
    'accountId',
  ]);
});

const transfer: TransactionInput = {
  date: '2026-09-28',
  amount: '30000',
  categoryId: '',
  accountId: 'bank',
  toAccountId: 'cash',
};

test('振替は、カテゴリを確かめず、振替元と振替先の口座を返す', () => {
  expect(validateTransactionInput({ ...transfer, categoryId: 'food' }, 'transfer')).toEqual({
    ok: true,
    value: {
      type: 'transfer',
      date: '2026-09-28',
      amount: 30000,
      accountId: 'bank',
      toAccountId: 'cash',
    },
  });
});

test('振替元と振替先が空なら、両方にエラーを出す', () => {
  expect(
    validateTransactionInput({ ...transfer, accountId: '', toAccountId: '' }, 'transfer'),
  ).toEqual({
    ok: false,
    errors: {
      accountId: '振替元の口座を選んでください',
      toAccountId: '振替先の口座を選んでください',
    },
  });
});

test('振替先が振替元と同じ口座なら、振替先にエラーを出す', () => {
  expect(validateTransactionInput({ ...transfer, toAccountId: 'bank' }, 'transfer')).toEqual({
    ok: false,
    errors: { toAccountId: '振替元と別の口座を選んでください' },
  });
});

test('収入・支出では、振替先の口座を確かめず、返す値にも入れない', () => {
  const result = validateTransactionInput({ ...valid, toAccountId: 'cash' }, 'income');
  expect(result).toEqual({
    ok: true,
    value: {
      type: 'income',
      date: '2026-09-28',
      amount: 1234,
      categoryId: 'food',
      accountId: 'cash',
    },
  });
});
