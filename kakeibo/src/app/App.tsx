import { AppLayout } from '../components/layout/AppLayout.tsx';
import { ToastProvider } from '../components/Toast/index.ts';
import { Router } from '../router/index.ts';
import { navItems } from './navItems.ts';
import { NotFound, routes } from './routes.tsx';

export function App() {
  return (
    <ToastProvider>
      <AppLayout title="家計簿" navItems={navItems}>
        <Router routes={routes} notFound={() => <NotFound />} />
      </AppLayout>
    </ToastProvider>
  );
}
