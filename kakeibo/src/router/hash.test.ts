import { afterEach, expect, test } from 'vitest';
import { hashFromPath, navigate, pathFromHash } from './hash.ts';

afterEach(() => {
  window.location.hash = '';
});

test.each([
  ['', '/'],
  ['#', '/'],
  ['#/', '/'],
  ['#/transactions', '/transactions'],
  ['#/transactions/', '/transactions'],
  ['#transactions', '/transactions'],
  ['#/transactions/42?tab=memo', '/transactions/42'],
])('ハッシュ %j のパスは %j', (hash, path) => {
  expect(pathFromHash(hash)).toBe(path);
});

test('パスからハッシュを作る', () => {
  expect(hashFromPath('/transactions')).toBe('#/transactions');
  expect(hashFromPath('settings')).toBe('#/settings');
});

test('navigate でハッシュを書き換える', () => {
  navigate('/accounts');
  expect(window.location.hash).toBe('#/accounts');
});
