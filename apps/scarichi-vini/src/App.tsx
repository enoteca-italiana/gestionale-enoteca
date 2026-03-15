import { Route, Switch, useLocation } from 'wouter';
import { Suspense, lazy, useCallback, useState } from 'react';
import { BottomNav } from '@/components/BottomNav';

const AdminPage = lazy(() => import('@/pages/AdminPage').then((m) => ({ default: m.AdminPage })));
const HomePage = lazy(() => import('@/pages/HomePage').then((m) => ({ default: m.HomePage })));
const WineAdminPage = lazy(() =>
  import('@/pages/admina/WineAdminPage').then((m) => ({ default: m.WineAdminPage }))
);

export function App() {
  const [location] = useLocation();
  const [hideNav, setHideNav] = useState(() => location === '/');

  const onIntroVisibilityChange = useCallback((visible: boolean) => {
    setHideNav(visible);
  }, []);

  return (
    <>
      <Suspense fallback={<div className="container">Caricamento…</div>}>
        <Switch>
          <Route path="/admina" component={WineAdminPage} />
          <Route path="/admin" component={AdminPage} />
          <Route path="/">{() => <HomePage onIntroVisibilityChange={onIntroVisibilityChange} />}</Route>
        </Switch>
      </Suspense>
      <BottomNav currentPath={location} hidden={hideNav} />
    </>
  );
}
