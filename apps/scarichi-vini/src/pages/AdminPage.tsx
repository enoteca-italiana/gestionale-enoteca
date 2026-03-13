import { AdminGate } from '@/pages/admin/AdminGate';
import { Logo } from '@/components/Logo';

export function AdminPage() {
  return (
    <div className="container">
      <div className="homeHeader">
        <Logo variant="header" />
      </div>
      <AdminGate />
    </div>
  );
}
