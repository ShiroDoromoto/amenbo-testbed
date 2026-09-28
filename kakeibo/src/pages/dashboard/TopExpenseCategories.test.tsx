import { render } from 'preact';
import { afterEach, expect, test } from 'vitest';
import type { Category } from '../../domain/category.ts';
import { TopExpenseCategories } from './TopExpenseCategories.tsx';

function category(id: string, name: string, color: string): Category {
  return { id, name, type: 'expense', color, order: 0 };
}

const food = category('food', '食費', '#e5534b');
const rent = category('rent', '住居', '#539bf5');

afterEach(() => {
  render(null, document.body);
  document.body.innerHTML = '';
});

function rows() {
  return [...document.querySelectorAll('.top-expense-categories-item')].map((item) =>
    [...item.querySelectorAll('span:not([aria-hidden])')]
      .filter((s) => !s.closest('[aria-hidden]'))
      .map((s) => s.textContent),
  );
}

function bars() {
  return [...document.querySelectorAll<HTMLElement>('.top-expense-categories-bar > span')].map(
    (bar) => [bar.style.width, bar.style.backgroundColor],
  );
}

test('順位・名前・金額・支出全体に占める割合を、渡された順に出す', () => {
  render(
    <TopExpenseCategories
      expenses={[
        { categoryId: 'rent', total: 75000 },
        { categoryId: 'food', total: 25000 },
      ]}
      categories={[food, rent]}
    />,
    document.body,
  );

  expect(document.querySelector('ol')?.getAttribute('aria-label')).toBe('支出の多いカテゴリ');
  expect(rows()).toEqual([
    ['1', '住居', '75,000円', '75%'],
    ['2', '食費', '25,000円', '25%'],
  ]);
  expect(bars()).toEqual([
    ['100%', 'rgb(83, 155, 245)'],
    ['33.33333333333333%', 'rgb(229, 83, 75)'],
  ]);
});

test('6 件目からは出さないが、割合は 6 件目以降も含めた支出全体で数える', () => {
  const categories = [1, 2, 3, 4, 5, 6].map((n) => category(`c${n}`, `カテゴリ${n}`, '#000000'));
  render(
    <TopExpenseCategories
      expenses={[6000, 5000, 4000, 3000, 1000, 1000].map((total, i) => ({
        categoryId: `c${i + 1}`,
        total,
      }))}
      categories={categories}
    />,
    document.body,
  );

  expect(rows()).toEqual([
    ['1', 'カテゴリ1', '6,000円', '30%'],
    ['2', 'カテゴリ2', '5,000円', '25%'],
    ['3', 'カテゴリ3', '4,000円', '20%'],
    ['4', 'カテゴリ4', '3,000円', '15%'],
    ['5', 'カテゴリ5', '1,000円', '5%'],
  ]);
});

test('消されたカテゴリは「（削除済み）」と --color-text-muted の色で出す', () => {
  render(
    <TopExpenseCategories expenses={[{ categoryId: 'gone', total: 1200 }]} categories={[food]} />,
    document.body,
  );

  expect(rows()).toEqual([['1', '（削除済み）', '1,200円', '100%']]);
  expect(bars()[0]![1]).toBe('var(--color-text-muted)');
});

test('支出が無ければ、一覧を出さずにそう書く', () => {
  render(<TopExpenseCategories expenses={[]} categories={[food]} />, document.body);

  expect(document.querySelector('ol')).toBeNull();
  expect(document.body.textContent).toBe('今月の支出はまだありません。');
});
