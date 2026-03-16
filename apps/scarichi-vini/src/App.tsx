import { Route, Switch, useLocation } from 'wouter';
import { Suspense, lazy, useCallback, useState } from 'react';
import { BottomNav } from '@/components/BottomNav';
import { sha256Base64 } from '@/pages/admin/crypto';
import { getBool, settingsChangedEvent, storageKeys } from '@/pages/admin/storage';
import { useEffect } from 'react';

const AdminPage = lazy(() => import('@/pages/AdminPage').then((m) => ({ default: m.AdminPage })));
const HomePage = lazy(() => import('@/pages/HomePage').then((m) => ({ default: m.HomePage })));
const WineAdminPage = lazy(() =>
  import('@/pages/admina/WineAdminPage').then((m) => ({ default: m.WineAdminPage }))
);

const APP_PIN_UNLOCKED_SESSION_KEY = 'scarichi.app.pinUnlocked.v1';
const DEFAULT_ADMIN_PIN = '1909';

function readPinUnlockedSession() {
  try {
    return window.sessionStorage.getItem(APP_PIN_UNLOCKED_SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

function writePinUnlockedSession(unlocked: boolean) {
  try {
    if (unlocked) {
      window.sessionStorage.setItem(APP_PIN_UNLOCKED_SESSION_KEY, '1');
      return;
    }
    window.sessionStorage.removeItem(APP_PIN_UNLOCKED_SESSION_KEY);
  } catch {
    // Ignore storage failures.
  }
}

export function App() {
  const [location] = useLocation();
  const [hideNav, setHideNav] = useState(() => location === '/');
  const [introVisible, setIntroVisible] = useState(() => location === '/');
  const [appPinRequiredOnStart, setAppPinRequiredOnStart] = useState(() =>
    getBool(storageKeys.appPinRequiredOnStart, false)
  );
  const [appPinUnlocked, setAppPinUnlocked] = useState(() => readPinUnlockedSession());
  const [appPin, setAppPin] = useState('');
  const [appPinError, setAppPinError] = useState<string | null>(null);
  const [appPinBusy, setAppPinBusy] = useState(false);

  const ensureAdminPinHash = useCallback(async () => {
    const storedHash = localStorage.getItem(storageKeys.adminPasswordHash);
    if (storedHash) return storedHash;
    const defaultHash = await sha256Base64(DEFAULT_ADMIN_PIN);
    localStorage.setItem(storageKeys.adminPasswordHash, defaultHash);
    return defaultHash;
  }, []);

  const onIntroVisibilityChange = useCallback((visible: boolean) => {
    setHideNav(visible);
    setIntroVisible(visible);
  }, []);

  useEffect(() => {
    setAppPinRequiredOnStart(getBool(storageKeys.appPinRequiredOnStart, false));
  }, []);

  useEffect(() => {
    const onSettingsChanged = (event: Event) => {
      const changedKey = (event as CustomEvent<{ key?: string }>).detail?.key;
      if (changedKey !== storageKeys.appPinRequiredOnStart) return;
      const nextEnabled = getBool(storageKeys.appPinRequiredOnStart, false);
      setAppPinRequiredOnStart(nextEnabled);
      // Runtime toggle should apply from next app start.
      setAppPinUnlocked(true);
      writePinUnlockedSession(true);
      setAppPin('');
      setAppPinError(null);
    };
    window.addEventListener(settingsChangedEvent, onSettingsChanged as EventListener);
    return () => {
      window.removeEventListener(settingsChangedEvent, onSettingsChanged as EventListener);
    };
  }, []);

  const unlockAppWithPin = async () => {
    if (appPinBusy) return;
    const enteredPin = appPin.trim();
    if (!enteredPin) {
      setAppPinError('Inserisci PIN');
      return;
    }
    setAppPinError(null);
    setAppPinBusy(true);
    try {
      const storedHash = await ensureAdminPinHash();
      const enteredHash = await sha256Base64(enteredPin);
      if (enteredHash !== storedHash) {
        setAppPinError('PIN non corretto');
        return;
      }
      setAppPinUnlocked(true);
      writePinUnlockedSession(true);
      setAppPin('');
      setAppPinError(null);
    } finally {
      setAppPinBusy(false);
    }
  };

  const showAppPinGate = appPinRequiredOnStart && !appPinUnlocked && !introVisible;

  return (
    <>
      <Suspense fallback={<div className="container">Caricamento…</div>}>
        <Switch>
          <Route path="/admina" component={WineAdminPage} />
          <Route path="/admin" component={AdminPage} />
          <Route path="/">
            {() => <HomePage onIntroVisibilityChange={onIntroVisibilityChange} />}
          </Route>
        </Switch>
      </Suspense>
      {showAppPinGate ? (
        <div
          className="modalOverlay"
          role="dialog"
          aria-modal="true"
          aria-label="Richiesta PIN avvio app"
        >
          <div className="modalCard">
            <div className="modalTitle">Inserisci PIN</div>
            <div className="modalDescription">
              Richiesta PIN attiva. Inserisci il PIN per accedere all&apos;app.
            </div>
            <div className="mt12">
              <input
                className="input"
                type="password"
                inputMode="numeric"
                placeholder="Inserisci PIN"
                value={appPin}
                onChange={(event) => {
                  setAppPin(event.target.value);
                  if (appPinError) setAppPinError(null);
                }}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') return;
                  event.preventDefault();
                  void unlockAppWithPin();
                }}
              />
            </div>
            {appPinError ? <div className="errorText mt10">{appPinError}</div> : null}
            <div className="modalActions">
              <button
                className="button"
                type="button"
                disabled={appPinBusy || appPin.trim().length === 0}
                onClick={() => {
                  void unlockAppWithPin();
                }}
              >
                {appPinBusy ? 'Verifica…' : 'Conferma PIN'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <BottomNav currentPath={location} hidden={hideNav || showAppPinGate} />
    </>
  );
}
