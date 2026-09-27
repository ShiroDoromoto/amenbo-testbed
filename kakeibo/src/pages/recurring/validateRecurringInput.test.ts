import { expect, test } from 'vitest';
import { validateRecurringInput, type RecurringInput } from './validateRecurringInput.ts';

const valid: RecurringInput = {
  dayOfMonth: '25',
  amount: '80,000',
  categoryId: 'rent',
  accountId: 'bank',
  toAccountId: '',
};

test('収入・支出の入力が通れば、数に直した値を返す', () => {
  expect(validateRecurringInput(valid, 'expense')).toEqual({
    ok: true,
    value: {
      dayOfMonth: 25,
      amount: 80000,
      type: 'expense',
      categoryId: 'rent',
      accountId: 'bank',
    },
  });
});

test('振替の入力が通れば、カテゴリを入れずに振替先を返す', () => {
  const input = { ...valid, categoryId: 'rent', toAccountId: 'cash' };
  expect(validateRecurringInput(input, 'transfer')).toEqual({
    ok: true,
    value: {
      dayOfMonth: 25,
      amount: 80000,
      type: 'transfer',
      accountId: 'bank',
      toAccountId: 'cash',
    },
  });
});

test.each([
  ['', '日を選んでください'],
  ['0', '日は1〜31日から選んでください'],
  ['32', '日は1〜31日から選んでください'],
  ['1.5', '日は1〜31日から選んでください'],
])('日が %j なら、日のエラーを返す', (dayOfMonth, message) => {
  expect(validateRecurringInput({ ...valid, dayOfMonth }, 'expense')).toEqual({
    ok: false,
    errors: { dayOfMonth: message },
  });
});

test.each([
  ['', '金額を入れてください'],
  ['12.5', '金額は整数で入れてください'],
  ['0', '金額は1円以上にしてください'],
  ['-100', '金額は1円以上にしてください'],
])('金額が %j なら、金額のエラーを返す', (amount, message) => {
  expect(validateRecurringInput({ ...valid, amount }, 'expense')).toEqual({
    ok: false,
    errors: { amount: message },
  });
});

test('収入・支出では、カテゴリと口座を求める', () => {
  expect(validateRecurringInput({ ...valid, categoryId: '', accountId: '' }, 'income')).toEqual({
    ok: false,
    errors: { categoryId: 'カテゴリを選んでください', accountId: '口座を選んでください' },
  });
});

test('振替では、振替元と別の振替先を求める', () => {
  expect(validateRecurringInput({ ...valid, toAccountId: '' }, 'transfer')).toEqual({
    ok: false,
    errors: { toAccountId: '振替先の口座を選んでください' },
  });
  expect(validateRecurringInput({ ...valid, toAccountId: 'bank' }, 'transfer')).toEqual({
    ok: false,
    errors: { toAccountId: '振替元と別の口座を選んでください' },
  });
});
