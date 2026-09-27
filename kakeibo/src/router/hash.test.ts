import { afterEach, expect, test } from 'vitest';
import { hashFromPath, navigate, pathFromHash, queryFromHash, replaceHashQuery } from './hash.ts';

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

test('ハッシュのクエリを読む', () => {
  expect(queryFromHash('#/transactions?type=income&memo=%E3%83%A9').get('memo')).toBe('ラ');
  expect(queryFromHash('#/transactions?type=income').get('type')).toBe('income');
  expect(queryFromHash('#/transactions').toString()).toBe('');
});

test('replaceHashQuery はパスを残してクエリだけを置き換え、履歴を積まない', () => {
  navigate('/transactions');
  const length = window.history.length;
  replaceHashQuery(new URLSearchParams({ type: 'income' }));
  expect(window.location.hash).toBe('#/transactions?type=income');
  replaceHashQuery(new URLSearchParams());
  expect(window.location.hash).toBe('#/transactions');
  expect(window.history.length).toBe(length);
});
