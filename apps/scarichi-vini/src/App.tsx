import { Route, Switch, useLocation } from 'wouter';
import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { BottomNav } from '@/components/BottomNav';
import { APP_ROUTES, isSettingsPath } from '@/app/routes';
import { useOfflineDischargeQueueSync } from '@/app/useOfflineDischargeQueueSync';
import { sha256Base64 } from '@/pages/admin/crypto';
import { getBool, settingsChangedEvent, storageKeys } from '@/pages/admin/storage';

const AdminPage = lazy(() => import('@/pages/AdminPage').then((m) => ({ default: m.AdminPage })));
const HomePage = lazy(() => import('@/pages/HomePage').then((m) => ({ default: m.HomePage })));
const WineAdminPage = lazy(() =>
  import('@/pages/admina/WineAdminPage').then((m) => ({ default: m.WineAdminPage }))
);
const WineTotalsPage = lazy(() =>
  import('@/pages/admina/WineTotalsPage').then((m) => ({ default: m.WineTotalsPage }))
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
  useOfflineDischargeQueueSync();

  const [location] = useLocation();
  const [hideNav, setHideNav] = useState(() => location === '/');
  const [introVisible, setIntroVisible] = useState(() => location === '/');
  const [appPinRequiredOnStart, setAppPinRequiredOnStart] = useState(() =>
    getBool(storageKeys.appPinRequiredOnStart, false)
  );
  const [appPinRequiredForSettings, setAppPinRequiredForSettings] = useState(() =>
    getBool(storageKeys.appPinRequiredForSettings, false)
  );
  const [appPinUnlocked, setAppPinUnlocked] = useState(() => readPinUnlockedSession());
  const [settingsPinUnlocked, setSettingsPinUnlocked] = useState(false);
  const [appPin, setAppPin] = useState('');
  const [appPinError, setAppPinError] = useState<string | null>(null);
  const [appPinBusy, setAppPinBusy] = useState(false);
  const [settingsPin, setSettingsPin] = useState('');
  const [settingsPinError, setSettingsPinError] = useState<string | null>(null);
  const [settingsPinBusy, setSettingsPinBusy] = useState(false);
  const appPinInputRef = useRef<HTMLInputElement | null>(null);
  const settingsPinInputRef = useRef<HTMLInputElement | null>(null);

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
    setAppPinRequiredForSettings(getBool(storageKeys.appPinRequiredForSettings, false));
  }, []);

  useEffect(() => {
    const onSettingsChanged = (event: Event) => {
      const changedKey = (event as CustomEvent<{ key?: string }>).detail?.key;
      if (changedKey === storageKeys.appPinRequiredOnStart) {
        const nextEnabled = getBool(storageKeys.appPinRequiredOnStart, false);
        setAppPinRequiredOnStart(nextEnabled);
        if (nextEnabled) {
          // ON: attiva subito il gate PIN e forza nuova verifica sessione.
          setAppPinUnlocked(false);
          writePinUnlockedSession(false);
        } else {
          // OFF: disattiva subito il gate PIN.
          setAppPinUnlocked(true);
          writePinUnlockedSession(true);
          setAppPin('');
          setAppPinError(null);
        }
        return;
      }

      if (changedKey === storageKeys.appPinRequiredForSettings) {
        const nextEnabled = getBool(storageKeys.appPinRequiredForSettings, false);
        setAppPinRequiredForSettings(nextEnabled);
        setSettingsPinUnlocked(false);
        setSettingsPin('');
        setSettingsPinError(null);
      }
    };
    window.addEventListener(settingsChangedEvent, onSettingsChanged as EventListener);
    return () => {
      window.removeEventListener(settingsChangedEvent, onSettingsChanged as EventListener);
    };
  }, []);

  useEffect(() => {
    // Richiede nuovamente il PIN ogni volta che si rientra in Impostazioni.
    if (!appPinRequiredForSettings) {
      setSettingsPinUnlocked(false);
      setSettingsPin('');
      setSettingsPinError(null);
      return;
    }
    if (!isSettingsPath(location)) {
      setSettingsPinUnlocked(false);
      setSettingsPin('');
      setSettingsPinError(null);
    }
  }, [appPinRequiredForSettings, location]);

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

  const unlockSettingsWithPin = async () => {
    if (settingsPinBusy) return;
    const enteredPin = settingsPin.trim();
    if (!enteredPin) {
      setSettingsPinError('Inserisci PIN');
      return;
    }
    setSettingsPinError(null);
    setSettingsPinBusy(true);
    try {
      const storedHash = await ensureAdminPinHash();
      const enteredHash = await sha256Base64(enteredPin);
      if (enteredHash !== storedHash) {
        setSettingsPinError('PIN non corretto');
        return;
      }
      setSettingsPinUnlocked(true);
      setSettingsPin('');
      setSettingsPinError(null);
    } finally {
      setSettingsPinBusy(false);
    }
  };

  const showAppPinGate = appPinRequiredOnStart && !appPinUnlocked && !introVisible;
  const isSettingsRoute = isSettingsPath(location);
  const showSettingsPinGate =
    isSettingsRoute &&
    appPinRequiredForSettings &&
    !settingsPinUnlocked &&
    !introVisible &&
    !showAppPinGate;

  useEffect(() => {
    if (!showAppPinGate && !showSettingsPinGate) return;

    const getActivePinInput = () =>
      showAppPinGate ? appPinInputRef.current : settingsPinInputRef.current;

    const focusPinInput = () => {
      const input = getActivePinInput();
      if (!input) return;
      input.focus({ preventScroll: true });
      const cursor = input.value.length;
      try {
        input.setSelectionRange(cursor, cursor);
      } catch {
        // Ignore selection failures on non-text-capable inputs.
      }
    };

    const frame = window.requestAnimationFrame(focusPinInput);
    const onFocusIn = (event: FocusEvent) => {
      const input = getActivePinInput();
      const target = event.target as Node | null;
      if (!input || !target) return;
      if (target === input || input.contains(target)) return;
      focusPinInput();
    };

    document.addEventListener('focusin', onFocusIn, true);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('focusin', onFocusIn, true);
    };
  }, [showAppPinGate, showSettingsPinGate]);

  return (
    <>
      <Suspense fallback={<div className="container">Caricamento…</div>}>
        <Switch>
          <Route path={APP_ROUTES.ARCHIVE_TOTALS} component={WineTotalsPage} />
          <Route path={APP_ROUTES.ARCHIVE} component={WineAdminPage} />
          <Route path={APP_ROUTES.SETTINGS} component={AdminPage} />
          <Route path={APP_ROUTES.SETTINGS_LEGACY} component={AdminPage} />
          <Route path={APP_ROUTES.HOME}>
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
                ref={appPinInputRef}
                autoFocus
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
      {showSettingsPinGate ? (
        <div
          className="modalOverlay"
          role="dialog"
          aria-modal="true"
          aria-label="Richiesta PIN accesso impostazioni"
        >
          <div className="modalCard">
            <div className="modalTitle">Inserisci PIN</div>
            <div className="modalDescription">
              Richiesta PIN attiva. Inserisci il PIN per accedere alla pagina Impostazioni.
            </div>
            <div className="mt12">
              <input
                ref={settingsPinInputRef}
                autoFocus
                className="input"
                type="password"
                inputMode="numeric"
                placeholder="Inserisci PIN"
                value={settingsPin}
                onChange={(event) => {
                  setSettingsPin(event.target.value);
                  if (settingsPinError) setSettingsPinError(null);
                }}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') return;
                  event.preventDefault();
                  void unlockSettingsWithPin();
                }}
              />
            </div>
            {settingsPinError ? <div className="errorText mt10">{settingsPinError}</div> : null}
            <div className="modalActions">
              <button
                className="button"
                type="button"
                disabled={settingsPinBusy || settingsPin.trim().length === 0}
                onClick={() => {
                  void unlockSettingsWithPin();
                }}
              >
                {settingsPinBusy ? 'Verifica…' : 'Conferma PIN'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <BottomNav currentPath={location} hidden={hideNav || showAppPinGate || showSettingsPinGate} />
    </>
  );
}
