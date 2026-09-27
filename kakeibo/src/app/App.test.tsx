import { render } from 'preact';
import { afterEach, expect, test } from 'vitest';
import { App } from './App.tsx';

afterEach(() => {
  document.body.innerHTML = '';
  window.location.hash = '';
});

test('ヘッダー・ナビ・本文の骨組みを出す', () => {
  const root = document.createElement('div');
  document.body.append(root);
  render(<App />, root);
  expect(root.querySelector('header h1')?.textContent).toBe('家計簿');
  expect(root.querySelectorAll('nav a').length).toBeGreaterThan(0);
  expect(root.querySelector('main')).not.toBeNull();
});

test('ハッシュに合った画面を本文に出す', () => {
  window.location.hash = '#/transactions';
  const root = document.createElement('div');
  document.body.append(root);
  render(<App />, root);
  expect(root.querySelector('main h2')?.textContent).toBe('取引');
});

test('知らないハッシュでは見つからない旨を出す', () => {
  window.location.hash = '#/nowhere';
  const root = document.createElement('div');
  document.body.append(root);
  render(<App />, root);
  expect(root.querySelector('main h2')?.textContent).toBe('ページが見つかりません');
});
