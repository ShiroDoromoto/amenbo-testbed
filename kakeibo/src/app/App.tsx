import { AppLayout } from '../components/layout/AppLayout.tsx';
import { Router } from '../router/index.ts';
import { navItems } from './navItems.ts';
import { NotFound, routes } from './routes.tsx';

export function App() {
  return (
    <AppLayout title="家計簿" navItems={navItems}>
      <Router routes={routes} notFound={() => <NotFound />} />
    </AppLayout>
  );
}
