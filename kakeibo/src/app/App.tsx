import { AppLayout } from '../components/layout/AppLayout.tsx';
import { navItems } from './navItems.ts';

export function App() {
  return <AppLayout title="家計簿" navItems={navItems} />;
}
