import { render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, expect, test } from 'vitest';
import { navigate } from './hash.ts';
import { Router, type Route } from './Router.tsx';

const routes: Route[] = [
  { path: '/', render: () => <p>トップ</p> },
  { path: '/transactions', render: () => <p>取引</p> },
  { path: '/transactions/:id', render: ({ id }) => <p>取引 {id}</p> },
];

afterEach(() => {
  document.body.innerHTML = '';
  window.location.hash = '';
});

function renderRouter() {
  const root = document.createElement('div');
  document.body.append(root);
  act(() => {
    render(<Router routes={routes} notFound={(path) => <p>無い: {path}</p>} />, root);
  });
  return root;
}

async function go(path: string) {
  await act(async () => {
    navigate(path);
    // jsdom は hashchange を非同期で出す
    await new Promise((resolve) => window.addEventListener('hashchange', resolve, { once: true }));
  });
}

test('ハッシュが空ならトップを出す', () => {
  const root = renderRouter();
  expect(root.textContent).toBe('トップ');
});

test('ハッシュが変わると画面を切り替える', async () => {
  const root = renderRouter();
  await go('/transactions');
  expect(root.textContent).toBe('取引');
  await go('/transactions/42');
  expect(root.textContent).toBe('取引 42');
});

test('どのルートにも合わなければ notFound を出す', async () => {
  const root = renderRouter();
  await go('/nowhere');
  expect(root.textContent).toBe('無い: /nowhere');
});
