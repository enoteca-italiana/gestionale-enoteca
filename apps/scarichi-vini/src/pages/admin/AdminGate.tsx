import { useState } from 'react';
import { useLocalDb } from '@/data/useLocalDb';
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
  const { history, pending, clearHistory, clearPending, deletePending, hardResetAll } =
    useLocalDb();

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
            clearHistory();
            setToast('Storico resettato');
          }}
        />
      ) : null}

      {section === 'pending' ? (
        <AdminPending
          pending={pending}
          onBack={() => setSection('sessions')}
          onDelete={(id) => {
            deletePending(id);
            setToast('Sessione eliminata');
          }}
          onClear={() => {
            clearPending();
            setToast('Sospesi eliminati');
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
