import { Route, Switch, useLocation } from 'wouter';
import { useCallback, useState } from 'react';
import { AdminPage } from '@/pages/AdminPage';
import { HomePage } from '@/pages/HomePage';
import { WineAdminPage } from '@/pages/admina/WineAdminPage';
import { BottomNav } from '@/components/BottomNav';

export function App() {
  const [location] = useLocation();
  const [hideNav, setHideNav] = useState(() => location === '/');

  const onIntroVisibilityChange = useCallback((visible: boolean) => {
    setHideNav(visible);
  }, []);

  return (
    <>
      <Switch>
        <Route path="/admina" component={WineAdminPage} />
        <Route path="/admin" component={AdminPage} />
        <Route path="/">{() => <HomePage onIntroVisibilityChange={onIntroVisibilityChange} />}</Route>
      </Switch>
      <BottomNav currentPath={location} hidden={hideNav} />
    </>
  );
}
