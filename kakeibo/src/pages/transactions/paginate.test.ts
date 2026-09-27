import { expect, test } from 'vitest';
import { paginate } from './paginate.ts';

const items = Array.from({ length: 7 }, (_, i) => i + 1);

test('pageSize 件ずつに分け、指定したページの項目を返す', () => {
  expect(paginate(items, 1, 3)).toEqual({
    items: [1, 2, 3],
    page: 1,
    pageCount: 3,
    first: 1,
    last: 3,
    total: 7,
  });
  expect(paginate(items, 2, 3).items).toEqual([4, 5, 6]);
});

test('最後のページは、残りの項目だけを返す', () => {
  const page = paginate(items, 3, 3);
  expect(page.items).toEqual([7]);
  expect(page.first).toBe(7);
  expect(page.last).toBe(7);
});

test('ページの数を超えたら最後のページを、1 より小さければ最初のページを返す', () => {
  expect(paginate(items, 9, 3).page).toBe(3);
  expect(paginate(items, 0, 3).page).toBe(1);
});

test('項目の数がちょうど pageSize の倍数なら、空のページを足さない', () => {
  expect(paginate(items.slice(0, 6), 1, 3).pageCount).toBe(2);
});

test('項目が無くても、1ページとして数える', () => {
  expect(paginate([], 1, 3)).toEqual({
    items: [],
    page: 1,
    pageCount: 1,
    first: 0,
    last: 0,
    total: 0,
  });
});
