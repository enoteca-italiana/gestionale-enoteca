import { useState } from 'react';
import { useLocalDb } from '@/data/useLocalDb';
import { AdminHistory } from '@/pages/admin/AdminHistory';
import { AdminHome, type AdminSection } from '@/pages/admin/AdminHome';
import { AdminLogin } from '@/pages/admin/AdminLogin';
import { AdminPending } from '@/pages/admin/AdminPending';
import { AdminSettings } from '@/pages/admin/AdminSettings';
import { useAdminAuth } from '@/pages/admin/useAdminAuth';

export function AdminGate() {
  const { ready, isAuthed, login, logout, changePassword } = useAdminAuth();
  const [toast, setToast] = useState<string | null>(null);
  const [section, setSection] = useState<AdminSection>('settings');
  const { history, pending, clearHistory, clearPending, deletePending, hardResetAll } =
    useLocalDb();

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
      {section === 'settings' ? (
        <>
          <AdminHome onOpen={setSection} />
          <div className="mt12">
            <AdminSettings
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
          </div>
        </>
      ) : null}

      {section === 'history' ? (
        <AdminHistory
          history={history}
          onBack={() => setSection('settings')}
          onReset={() => {
            clearHistory();
            setToast('Storico resettato');
          }}
        />
      ) : null}

      {section === 'pending' ? (
        <AdminPending
          pending={pending}
          onBack={() => setSection('settings')}
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
