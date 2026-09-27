import 'fake-indexeddb/auto';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, expect, test } from 'vitest';
import { App } from './App.tsx';

let root: HTMLElement | undefined;

afterEach(() => {
  // 外さずに終えると、テストファイルが片付いた後に useEffect が走って window が無いと落ちる
  if (root) act(() => render(null, root!));
  root = undefined;
  document.body.innerHTML = '';
  window.location.hash = '';
});

// act の中で描くと、useEffect もテストの中で流し切れる
function renderApp() {
  root = document.createElement('div');
  document.body.append(root);
  act(() => {
    render(<App />, root!);
  });
  return root;
}

test('ヘッダー・ナビ・本文の骨組みを出す', () => {
  const root = renderApp();
  expect(root.querySelector('header h1')?.textContent).toBe('家計簿');
  expect(root.querySelectorAll('nav a').length).toBeGreaterThan(0);
  expect(root.querySelector('main')).not.toBeNull();
});

test('ハッシュに合った画面を本文に出す', () => {
  window.location.hash = '#/transactions';
  const root = renderApp();
  expect(root.querySelector('main h2')?.textContent).toBe('取引');
});

test('取引の id のハッシュでは、取引の編集画面を出す', () => {
  window.location.hash = '#/transactions/abc';
  const root = renderApp();
  expect(root.querySelector('main h2')?.textContent).toBe('取引の編集');
});

test('`#/transactions/new` では、編集画面ではなく入力画面を出す', () => {
  window.location.hash = '#/transactions/new';
  const root = renderApp();
  expect(root.querySelector('main h2')?.textContent).toBe('取引の入力');
});

test.each([
  ['#/recurring', '定期取引'],
  ['#/recurring/new', '定期取引の追加'],
  ['#/recurring/abc', '定期取引の編集'],
  ['#/categories', 'カテゴリ'],
])('%s では、%s の画面を出す', (hash, heading) => {
  window.location.hash = hash;
  const root = renderApp();
  expect(root.querySelector('main h2')?.textContent).toBe(heading);
});

test('知らないハッシュでは見つからない旨を出す', () => {
  window.location.hash = '#/nowhere';
  const root = renderApp();
  expect(root.querySelector('main h2')?.textContent).toBe('ページが見つかりません');
});
