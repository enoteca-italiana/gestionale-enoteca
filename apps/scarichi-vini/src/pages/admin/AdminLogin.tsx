import { useState } from 'react';

export function AdminLogin({ onLogin }: { onLogin: (password: string) => Promise<boolean> }) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      const ok = await onLogin(password);
      if (!ok) setError('Password non corretta');
      setPassword('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card adminCard">
      <div className="title">Admin</div>
      <div className="subtle mt6">Inserisci la password per accedere alle impostazioni.</div>

      <div className="mt14">
        <input
          className="input adminInput"
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>

      {error ? <div className="errorText mt10">{error}</div> : null}

      <div className="mt14">
        <button className="button" type="button" disabled={busy || password.length === 0} onClick={submit}>
          Entra
        </button>
      </div>
    </div>
  );
}
