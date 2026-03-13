import { useState } from 'react';
import { useLocalDb } from '@/data/useLocalDb';
import { useDischargeSessions } from '@/data/useDischargeSessions';
import { AdminHistory } from '@/pages/admin/AdminHistory';
import { AdminHome, type AdminRootSection } from '@/pages/admin/AdminHome';
import { AdminLogin } from '@/pages/admin/AdminLogin';
import { AdminPending } from '@/pages/admin/AdminPending';
import { AdminSettings } from '@/pages/admin/AdminSettings';
import { useAdminAuth } from '@/pages/admin/useAdminAuth';

type AdminSection = 'home' | 'settings' | 'sessions' | 'history' | 'pending';

export function AdminGate() {
  const { ready, isAuthed, login, logout, changePassword } = useAdminAuth();
  const [toast, setToast] = useState<string | null>(null);
  const [section, setSection] = useState<AdminSection>('home');
  const { hardResetAll } = useLocalDb();
  const {
    history,
    pending,
    loading: sessionsLoading,
    error: sessionsError,
    clearHistory,
    clearPending,
    deletePending
  } = useDischargeSessions();

  const openRootSection = (target: AdminRootSection) => {
    if (target === 'sessions') {
      setSection('sessions');
      return;
    }
    setSection('settings');
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

  if (sessionsLoading) {
    return (
      <div className="card adminCard">
        <div className="title">Sessioni</div>
        <div className="subtle mt6">Caricamento dati Supabase…</div>
      </div>
    );
  }

  if (sessionsError) {
    return (
      <div className="card adminCard">
        <div className="title">Sessioni</div>
        <div className="errorText mt6">{sessionsError}</div>
      </div>
    );
  }

  return (
    <>
      {section === 'home' ? <AdminHome onOpen={openRootSection} /> : null}

      {section === 'settings' ? (
        <>
          <AdminSettings
            onBack={() => setSection('home')}
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
        </>
      ) : null}

      {section === 'sessions' ? (
        <div className="card adminCard">
          <div className="title">Sessioni</div>
          <div className="subtle mt6">Seleziona il registro sessioni.</div>

          <div className="list mt12">
            <button className="button buttonSecondary" type="button" onClick={() => setSection('history')}>
              Storico sessioni
            </button>
            <button className="button buttonSecondary" type="button" onClick={() => setSection('pending')}>
              Sessioni in sospeso
            </button>
            <button className="button buttonSecondary" type="button" onClick={() => setSection('home')}>
              Indietro
            </button>
          </div>
        </div>
      ) : null}

      {section === 'history' ? (
        <AdminHistory
          history={history}
          onBack={() => setSection('sessions')}
          onReset={() => {
            void clearHistory()
              .then(() => setToast('Storico resettato'))
              .catch((error) => {
                console.error('[AdminGate] clearHistory failed', error);
                setToast('Errore reset storico');
              });
          }}
        />
      ) : null}

      {section === 'pending' ? (
        <AdminPending
          pending={pending}
          onBack={() => setSection('sessions')}
          onDelete={(id) => {
            void deletePending(id)
              .then(() => setToast('Sessione eliminata'))
              .catch((error) => {
                console.error('[AdminGate] deletePending failed', error);
                setToast('Errore eliminazione sessione');
              });
          }}
          onClear={() => {
            void clearPending()
              .then(() => setToast('Sospesi eliminati'))
              .catch((error) => {
                console.error('[AdminGate] clearPending failed', error);
                setToast('Errore eliminazione sospesi');
              });
          }}
        />
      ) : null}

      {toast ? (
        <div className="mt12">
          <div className="toastInline">{toast}</div>
        </div>
      ) : null}
    </>
  );
}
