import type { ComponentChildren } from 'preact';
import { pathFromHash, type Route } from '../router/index.ts';
import { NewTransactionPage } from '../pages/transactions/NewTransactionPage.tsx';
import { navItems } from './navItems.ts';

const pages: Readonly<Record<string, () => ComponentChildren>> = {
  '/transactions/new': () => <NewTransactionPage />,
};

// 画面がまだ無い項目は、見出しだけを出す。
// 画面を作るタスクで、`pages` に本物の画面を足す。
export const routes: readonly Route[] = navItems.map((item) => {
  const path = pathFromHash(item.href);
  return { path, render: pages[path] ?? (() => <h2>{item.label}</h2>) };
});

export function NotFound() {
  return <h2>ページが見つかりません</h2>;
}
