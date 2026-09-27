import { expect, test } from 'vitest';
import type { Category } from '../../domain/category.ts';
import { validateCategoryName } from './validateCategoryName.ts';

const categories: Category[] = [
  { id: 'food', name: '食費', type: 'expense', color: '#e8590c', order: 0 },
  { id: 'salary', name: '給与', type: 'income', color: '#2f9e44', order: 0 },
];

test('前後の空白を落とした名前を返す', () => {
  expect(validateCategoryName('  外食 ', { type: 'expense' }, categories)).toEqual({
    ok: true,
    name: '外食',
  });
});

test('空白だけの名前は通さない', () => {
  expect(validateCategoryName('   ', { type: 'expense' }, categories)).toEqual({
    ok: false,
    error: '名前を入力してください',
  });
});

test('同じ収支区分に同じ名前があれば通さない', () => {
  expect(validateCategoryName('食費', { type: 'expense' }, categories)).toEqual({
    ok: false,
    error: '同じ名前のカテゴリがあります',
  });
});

test('収支区分が違えば、同じ名前でも通す', () => {
  expect(validateCategoryName('食費', { type: 'income' }, categories).ok).toBe(true);
});

test('名前を変えるカテゴリ自身の名前とは比べない', () => {
  expect(validateCategoryName('食費', { type: 'expense', id: 'food' }, categories).ok).toBe(true);
});
