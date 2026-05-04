import { Suspense, lazy, useEffect, useState } from 'react';
import { clearWineArchive } from '@/data/wineRepository';
import { useDischargeSessions } from '@/data/useDischargeSessions';
import { AdminHome, type AdminRootSection } from '@/pages/admin/AdminHome';
import { AdminLogin } from '@/pages/admin/AdminLogin';
import { AdminSettings } from '@/pages/admin/AdminSettings';
import { useAdminAuth } from '@/pages/admin/useAdminAuth';
import { useAppDomain } from '@/app/appDomain';

type AdminSection = 'home' | 'history' | 'registryManager';
type SettingsAction =
  | 'password'
  | 'import'
  | 'export'
  | 'threshold'
  | 'pinRequest'
  | 'reset'
  | null;

const AdminHistory = lazy(() =>
  import('@/pages/admin/AdminHistory').then((m) => ({ default: m.AdminHistory }))
);
const AdminRegistryManager = lazy(() =>
  import('@/pages/admin/AdminRegistryManager').then((m) => ({ default: m.AdminRegistryManager }))
);

export function AdminGate() {
  const { activeDomain } = useAppDomain();
  const { ready, isAuthed, login, logout, changePassword } = useAdminAuth();
  const [section, setSection] = useState<AdminSection>('home');
  const [settingsAction, setSettingsAction] = useState<SettingsAction>(null);

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent('scarichi:adminSectionChange', { detail: { section } })
    );
  }, [section]);
  const {
    history,
    loading: sessionsLoading,
    error: sessionsError,
    clearHistory,
    deleteHistorySession
  } = useDischargeSessions(section === 'history', activeDomain);

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

  if (!isAuthed) {
    return <AdminLogin onLogin={login} />;
  }

  return (
    <>
      {section === 'home' ? <AdminHome onOpen={openRootSection} activeDomain={activeDomain} /> : null}

      {section === 'history' ? (
        sessionsLoading ? null : sessionsError ? (
          <div className="card adminCard">
            <div className="title">Storico Sessioni</div>
            <div className="errorText mt6">{sessionsError}</div>
          </div>
        ) : (
          <Suspense fallback={<div className="card adminCard">Caricamento…</div>}>
            <AdminHistory
              history={history}
              domain={activeDomain}
              onReset={(retention) => {
                void clearHistory(retention).catch((error) => {
                  console.error('[AdminGate] clearHistory failed', error);
                });
              }}
              onDeleteSession={async (sessionId) => {
                await deleteHistorySession(sessionId);
              }}
            />
          </Suspense>
        )
      ) : null}

      {section === 'registryManager' ? (
        activeDomain === 'wine' ? (
          <Suspense fallback={<div className="card adminCard">Caricamento…</div>}>
            <AdminRegistryManager />
          </Suspense>
        ) : (
          <div className="card adminCard">
            <div className="title">Gestione voci filtri</div>
            <div className="subtle mt8">
              Sezione in attivazione per Spirits: al momento resta disponibile solo per Vini.
            </div>
          </div>
        )
      ) : null}

      <AdminSettings
        hidePanel
        activeDomain={activeDomain}
        onBack={() => setSection('home')}
        openAction={settingsAction}
        onActionHandled={() => setSettingsAction(null)}
        onLogout={() => {
          logout();
        }}
        onHardReset={async () => {
          if (activeDomain === 'wine') {
            await clearWineArchive();
            return;
          }
          const { clearSpiritsArchive } = await import('@/data/spiritsRepository');
          await clearSpiritsArchive();
        }}
        onChangePassword={async (currentPwd, newPwd) => {
          return changePassword(currentPwd, newPwd);
        }}
      />
    </>
  );
}
