import { pathFromHash, type Route } from '../router/index.ts';
import { navItems } from './navItems.ts';

// 画面がまだ無いので、メニューの項目ごとに見出しだけを出す。
// 画面を作るタスクで、ここを本物の画面に差し替える。
export const routes: readonly Route[] = navItems.map((item) => ({
  path: pathFromHash(item.href),
  render: () => <h2>{item.label}</h2>,
}));

export function NotFound() {
  return <h2>ページが見つかりません</h2>;
}
