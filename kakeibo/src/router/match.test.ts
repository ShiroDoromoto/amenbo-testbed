import { expect, test } from 'vitest';
import { matchPath } from './match.ts';

test('同じパスなら空のパラメータで合う', () => {
  expect(matchPath('/', '/')).toEqual({});
  expect(matchPath('/transactions', '/transactions')).toEqual({});
});

test('違うパスには合わない', () => {
  expect(matchPath('/transactions', '/accounts')).toBeNull();
  expect(matchPath('/', '/transactions')).toBeNull();
  expect(matchPath('/transactions', '/transactions/42')).toBeNull();
});

test(':name の区切りをパラメータとして取り出す', () => {
  expect(matchPath('/transactions/:id', '/transactions/42')).toEqual({ id: '42' });
  expect(matchPath('/a/:x/b/:y', '/a/1/b/%E9%A3%9F%E8%B2%BB')).toEqual({ x: '1', y: '食費' });
});
