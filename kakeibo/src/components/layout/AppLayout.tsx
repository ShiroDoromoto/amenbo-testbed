import type { ComponentChildren } from 'preact';
import './layout.css';

export type NavItem = {
  label: string;
  href: string;
};

type Props = {
  title: string;
  navItems: readonly NavItem[];
  children?: ComponentChildren;
};

export function AppLayout({ title, navItems, children }: Props) {
  return (
    <div class="layout">
      <header class="layout-header">
        <h1 class="layout-title">{title}</h1>
      </header>
      <nav class="layout-nav" aria-label="メインメニュー">
        <ul class="layout-nav-list">
          {navItems.map((item) => (
            <li key={item.href}>
              <a class="layout-nav-link" href={item.href}>
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <main class="layout-main">{children}</main>
    </div>
  );
}
