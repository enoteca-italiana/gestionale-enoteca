import { Route, Switch, useLocation } from 'wouter';
import { AdminPage } from '@/pages/AdminPage';
import { HomePage } from '@/pages/HomePage';
import { WineAdminPage } from '@/pages/admina/WineAdminPage';
import { BottomNav } from '@/components/BottomNav';

export function App() {
  const [location] = useLocation();

  return (
    <>
      <Switch>
        <Route path="/admina" component={WineAdminPage} />
        <Route path="/admin" component={AdminPage} />
        <Route path="/" component={HomePage} />
      </Switch>
      <BottomNav currentPath={location} />
    </>
  );
}
