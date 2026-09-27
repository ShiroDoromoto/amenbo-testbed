import type { ComponentChildren } from 'preact';
import { pathFromHash, type Route } from '../router/index.ts';
import { EditTransactionPage } from '../pages/transactions/EditTransactionPage.tsx';
import { NewTransactionPage } from '../pages/transactions/NewTransactionPage.tsx';
import { navItems } from './navItems.ts';

const pages: Readonly<Record<string, () => ComponentChildren>> = {
  '/transactions/new': () => <NewTransactionPage />,
};

// 画面がまだ無い項目は、見出しだけを出す。
// 画面を作るタスクで、`pages` に本物の画面を足す。
const navRoutes: readonly Route[] = navItems.map((item) => {
  const path = pathFromHash(item.href);
  return { path, render: pages[path] ?? (() => <h2>{item.label}</h2>) };
});

// メニューに出ない画面。`/transactions/new` に合わないよう、メニューの画面より後ろに置く。
export const routes: readonly Route[] = [
  ...navRoutes,
  { path: '/transactions/:id', render: ({ id }) => <EditTransactionPage key={id} id={id ?? ''} /> },
];

export function NotFound() {
  return <h2>ページが見つかりません</h2>;
}
