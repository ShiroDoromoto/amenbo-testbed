import { render } from 'preact';
import { afterEach, expect, test } from 'vitest';
import { AppLayout } from './AppLayout.tsx';

afterEach(() => {
  document.body.innerHTML = '';
});

function renderLayout() {
  const root = document.createElement('div');
  document.body.append(root);
  render(
    <AppLayout
      title="家計簿"
      navItems={[
        { label: '取引', href: '#/transactions' },
        { label: '設定', href: '#/settings' },
      ]}
    >
      <p>本文</p>
    </AppLayout>,
    root,
  );
  return root;
}

test('ヘッダーに題名を出す', () => {
  const root = renderLayout();
  expect(root.querySelector('header h1')?.textContent).toBe('家計簿');
});

test('ナビに項目をリンクとして並べる', () => {
  const root = renderLayout();
  const links = [...root.querySelectorAll('nav a')];
  expect(links.map((a) => [a.textContent, a.getAttribute('href')])).toEqual([
    ['取引', '#/transactions'],
    ['設定', '#/settings'],
  ]);
});

test('本文に子要素を出す', () => {
  const root = renderLayout();
  expect(root.querySelector('main p')?.textContent).toBe('本文');
});
