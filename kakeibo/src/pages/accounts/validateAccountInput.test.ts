import { expect, test } from 'vitest';
import { validateAccountInput, type AccountInput } from './validateAccountInput.ts';

const valid: AccountInput = { name: ' 財布 ', type: 'cash', initialBalance: '12,000' };

test('入力が通れば、名前の前後の空白を除き、初期残高を数に直して返す', () => {
  expect(validateAccountInput(valid)).toEqual({
    ok: true,
    value: { name: '財布', type: 'cash', initialBalance: 12000 },
  });
});

test('初期残高は 0 や負の値も受け付ける', () => {
  expect(validateAccountInput({ ...valid, initialBalance: '0' })).toMatchObject({
    ok: true,
    value: { initialBalance: 0 },
  });
  expect(validateAccountInput({ ...valid, type: 'card', initialBalance: '-35,000' })).toMatchObject(
    { ok: true, value: { type: 'card', initialBalance: -35000 } },
  );
});

test('空の欄には、欄ごとのエラーを返す', () => {
  expect(validateAccountInput({ name: '  ', type: '', initialBalance: '' })).toEqual({
    ok: false,
    errors: {
      name: '名前を入れてください',
      type: '種類を選んでください',
      initialBalance: '初期残高を入れてください',
    },
  });
});

test('知らない種類や、整数でない初期残高は通さない', () => {
  expect(validateAccountInput({ ...valid, type: 'wallet', initialBalance: '1.5' })).toEqual({
    ok: false,
    errors: {
      type: '種類を選んでください',
      initialBalance: '初期残高は整数で入れてください',
    },
  });
});
