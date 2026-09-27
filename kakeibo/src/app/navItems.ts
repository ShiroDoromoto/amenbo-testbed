import type { NavItem } from '../components/layout/AppLayout.tsx';

export const navItems: readonly NavItem[] = [
  { label: 'ダッシュボード', href: '#/' },
  { label: '取引', href: '#/transactions' },
  { label: 'カテゴリ', href: '#/categories' },
  { label: '口座', href: '#/accounts' },
  { label: '予算', href: '#/budgets' },
  { label: 'レポート', href: '#/reports' },
  { label: '設定', href: '#/settings' },
];
