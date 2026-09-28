import type { ComponentChildren } from 'preact';
import { pathFromHash, type Route } from '../router/index.ts';
import { AccountList } from '../pages/accounts/AccountList.tsx';
import { EditAccountPage } from '../pages/accounts/EditAccountPage.tsx';
import { NewAccountPage } from '../pages/accounts/NewAccountPage.tsx';
import { CategoryList } from '../pages/categories/CategoryList.tsx';
import { Dashboard } from '../pages/dashboard/Dashboard.tsx';
import { EditRecurringPage } from '../pages/recurring/EditRecurringPage.tsx';
import { NewRecurringPage } from '../pages/recurring/NewRecurringPage.tsx';
import { RecurringList } from '../pages/recurring/RecurringList.tsx';
import { ReportPage } from '../pages/report/ReportPage.tsx';
import { EditTransactionPage } from '../pages/transactions/EditTransactionPage.tsx';
import { NewTransactionPage } from '../pages/transactions/NewTransactionPage.tsx';
import { TransactionList } from '../pages/transactions/TransactionList.tsx';
import { navItems } from './navItems.ts';

const pages: Readonly<Record<string, () => ComponentChildren>> = {
  '/': () => <Dashboard />,
  '/transactions': () => <TransactionList />,
  '/transactions/new': () => <NewTransactionPage />,
  '/recurring': () => <RecurringList />,
  '/accounts': () => <AccountList />,
  '/categories': () => <CategoryList />,
  '/reports': () => <ReportPage />,
};

// 画面がまだ無い項目は、見出しだけを出す。
// 画面を作るタスクで、`pages` に本物の画面を足す。
const navRoutes: readonly Route[] = navItems.map((item) => {
  const path = pathFromHash(item.href);
  return { path, render: pages[path] ?? (() => <h2>{item.label}</h2>) };
});

// メニューに出ない画面。`/transactions/new`・`/recurring/new`・`/accounts/new` に合わないよう、`:id` の画面は
// メニューの画面と `new` の画面より後ろに置く。
export const routes: readonly Route[] = [
  ...navRoutes,
  { path: '/transactions/:id', render: ({ id }) => <EditTransactionPage key={id} id={id ?? ''} /> },
  { path: '/recurring/new', render: () => <NewRecurringPage /> },
  { path: '/recurring/:id', render: ({ id }) => <EditRecurringPage key={id} id={id ?? ''} /> },
  { path: '/accounts/new', render: () => <NewAccountPage /> },
  { path: '/accounts/:id', render: ({ id }) => <EditAccountPage key={id} id={id ?? ''} /> },
];

export function NotFound() {
  return <h2>ページが見つかりません</h2>;
}
