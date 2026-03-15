import { useState } from 'react';
import { useLocalDb } from '@/data/useLocalDb';
import { useDischargeSessions } from '@/data/useDischargeSessions';
import { AdminHistory } from '@/pages/admin/AdminHistory';
import { AdminHome, type AdminRootSection } from '@/pages/admin/AdminHome';
import { AdminLogin } from '@/pages/admin/AdminLogin';
import { AdminSettings } from '@/pages/admin/AdminSettings';
import { useAdminAuth } from '@/pages/admin/useAdminAuth';

type AdminSection = 'home' | 'history';
type SettingsAction = 'password' | 'import' | 'threshold' | 'reset' | null;

export function AdminGate() {
  const { ready, isAuthed, login, logout, changePassword } = useAdminAuth();
  const [toast, setToast] = useState<string | null>(null);
  const [section, setSection] = useState<AdminSection>('home');
  const [settingsAction, setSettingsAction] = useState<SettingsAction>(null);
  const { hardResetAll } = useLocalDb();
  const {
    history,
    loading: sessionsLoading,
    error: sessionsError,
    clearHistory
  } = useDischargeSessions(section === 'history');

  const openRootSection = (target: AdminRootSection) => {
    if (target === 'history') {
      setSection('history');
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
    return (
      <>
        <AdminLogin
          onLogin={async (pwd) => {
            const ok = await login(pwd);
            if (ok) setToast('Accesso effettuato');
            return ok;
          }}
        />
        {toast ? (
          <div className="mt12">
            <div className="toastInline">{toast}</div>
          </div>
        ) : null}
      </>
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
            onReset={() => {
              void clearHistory().catch((error) => {
                console.error('[AdminGate] clearHistory failed', error);
                setToast('Errore reset storico');
              });
            }}
          />
        )
      ) : null}

      <AdminSettings
        hidePanel
        onBack={() => setSection('home')}
        openAction={settingsAction}
        onActionHandled={() => setSettingsAction(null)}
        onLogout={() => {
          logout();
          setToast('Logout');
        }}
        onHardReset={() => {
          hardResetAll();
          setToast('Reset totale eseguito');
        }}
        onChangePassword={async (currentPwd, newPwd) => {
          const ok = await changePassword(currentPwd, newPwd);
          if (ok) setToast('Password aggiornata');
          return ok;
        }}
      />

      {toast ? (
        <div className="mt12">
          <div className="toastInline">{toast}</div>
        </div>
      ) : null}
    </>
  );
}
