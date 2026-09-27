import { describe, expect, it } from 'vitest';
import { compareCategories, isCategoryColor, type Category } from './category.ts';

function category(overrides: Partial<Category>): Category {
  return { id: 'c', name: '食費', type: 'expense', color: '#ff0000', order: 0, ...overrides };
}

describe('isCategoryColor', () => {
  it.each(['#ff8800', '#FF8800', '#000000'])('accepts %s', (value) => {
    expect(isCategoryColor(value)).toBe(true);
  });

  it.each(['ff8800', '#f80', '#ff880000', 'red', '', null, undefined])('rejects %s', (value) => {
    expect(isCategoryColor(value)).toBe(false);
  });
});

describe('compareCategories', () => {
  it('sorts by order ascending', () => {
    const categories = [
      category({ id: 'b', order: 2 }),
      category({ id: 'a', order: 1 }),
      category({ id: 'c', order: 3 }),
    ];
    expect(categories.sort(compareCategories).map((c) => c.id)).toEqual(['a', 'b', 'c']);
  });

  it('breaks ties by name', () => {
    const categories = [
      category({ id: 'b', name: '日用品', order: 1 }),
      category({ id: 'a', name: '交通費', order: 1 }),
    ];
    expect(categories.sort(compareCategories).map((c) => c.id)).toEqual(['a', 'b']);
  });
});
