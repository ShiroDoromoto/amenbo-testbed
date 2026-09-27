import { afterEach, expect, test } from 'vitest';
import { loadLastSelection, saveLastSelection } from './lastSelection.ts';

afterEach(() => {
  localStorage.clear();
});

test('何も覚えていなければ、空の選択を返す', () => {
  expect(loadLastSelection()).toEqual({ categoryIds: {} });
});

test('収支区分ごとにカテゴリを覚え、口座は最後に保存したものを覚える', () => {
  const base = { date: '2026-09-28', amount: 100, memo: '' };
  saveLastSelection({ ...base, type: 'expense', categoryId: 'food', accountId: 'cash' });
  saveLastSelection({ ...base, type: 'income', categoryId: 'salary', accountId: 'bank' });
  expect(loadLastSelection()).toEqual({
    categoryIds: { expense: 'food', income: 'salary' },
    accountId: 'bank',
  });
});

test('振替は、カテゴリを変えずに口座だけを覚える', () => {
  const base = { date: '2026-09-28', amount: 100, memo: '' };
  saveLastSelection({ ...base, type: 'expense', categoryId: 'food', accountId: 'cash' });
  saveLastSelection({ ...base, type: 'transfer', accountId: 'bank', toAccountId: 'cash' });
  expect(loadLastSelection()).toEqual({
    categoryIds: { expense: 'food', income: undefined },
    accountId: 'bank',
  });
});

test('保存された値が壊れていたら、空の選択を返す', () => {
  localStorage.setItem('kakeibo:lastSelection', '{');
  expect(loadLastSelection()).toEqual({ categoryIds: {} });
  localStorage.setItem('kakeibo:lastSelection', JSON.stringify({ categoryIds: { expense: 1 } }));
  expect(loadLastSelection()).toEqual({
    categoryIds: { expense: undefined, income: undefined },
    accountId: undefined,
  });
});
