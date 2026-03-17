import { useEffect, useState } from 'react';
import { clearWineArchive } from '@/data/wineRepository';
import { useDischargeSessions } from '@/data/useDischargeSessions';
import { AdminHistory } from '@/pages/admin/AdminHistory';
import { AdminHome, type AdminRootSection } from '@/pages/admin/AdminHome';
import { AdminRegistryManager } from '@/pages/admin/AdminRegistryManager';
import { AdminSettings } from '@/pages/admin/AdminSettings';
import { useAdminAuth } from '@/pages/admin/useAdminAuth';

type AdminSection = 'home' | 'history' | 'registryManager';
type SettingsAction = 'password' | 'import' | 'threshold' | 'pinRequest' | 'reset' | null;

export function AdminGate() {
  const { ready, logout, changePassword } = useAdminAuth();
  const [section, setSection] = useState<AdminSection>('home');
  const [settingsAction, setSettingsAction] = useState<SettingsAction>(null);
  const {
    history,
    loading: sessionsLoading,
    error: sessionsError,
    clearHistory
  } = useDischargeSessions(section === 'history');

  useEffect(() => {
    const onOpenAdminHome = () => {
      setSection('home');
      setSettingsAction(null);
    };
    window.addEventListener('scarichi:openAdminHome', onOpenAdminHome);
    return () => window.removeEventListener('scarichi:openAdminHome', onOpenAdminHome);
  }, []);

  const openRootSection = (target: AdminRootSection) => {
    if (target === 'history') {
      setSection('history');
      return;
    }
    if (target === 'registryManager') {
      setSection('registryManager');
      return;
    }
    setSettingsAction(target);
    setSection('home');
  };

  if (!ready) {
    return (
      <div className="card">
        <div className="title">Admin</div>
        <div className="subtle mt6">Caricamento…</div>
      </div>
    );
  }

  return (
    <>
      {section === 'home' ? <AdminHome onOpen={openRootSection} /> : null}

      {section === 'history' ? (
        sessionsLoading ? null : sessionsError ? (
          <div className="card adminCard">
            <div className="title">Storico Sessioni</div>
            <div className="errorText mt6">{sessionsError}</div>
          </div>
        ) : (
          <AdminHistory
            history={history}
            onReset={(retention) => {
              void clearHistory(retention).catch((error) => {
                console.error('[AdminGate] clearHistory failed', error);
              });
            }}
          />
        )
      ) : null}

      {section === 'registryManager' ? <AdminRegistryManager /> : null}

      <AdminSettings
        hidePanel
        onBack={() => setSection('home')}
        openAction={settingsAction}
        onActionHandled={() => setSettingsAction(null)}
        onLogout={() => {
          logout();
        }}
        onHardReset={async () => {
          await clearWineArchive();
        }}
        onChangePassword={async (currentPwd, newPwd) => {
          return changePassword(currentPwd, newPwd);
        }}
      />
    </>
  );
}
