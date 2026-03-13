import { useEffect, useMemo, useState } from 'react';
import { Logo } from '@/components/Logo';
import { Toast } from '@/components/Toast';
import { useAppSettings } from '@/app/useAppSettings';
import { useOnlineStatus } from '@/app/useOnlineStatus';
import { newId } from '@/data/localDb';
import { useLocalDb } from '@/data/useLocalDb';
import { ResultsList } from '@/pages/home/ResultsList';
import { SessionConfirmModal } from '@/pages/home/SessionConfirmModal';
import { SummaryList } from '@/pages/home/SummaryList';
import { useLocalSession } from '@/pages/home/useLocalSession';

export function HomePage() {
  const [showIntro, setShowIntro] = useState(true);
  const [introVisible, setIntroVisible] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const settings = useAppSettings();
  const online = useOnlineStatus();

  const { inventory, setInventory, addHistory, addPending, flushPendingToHistory, refreshInventory } =
    useLocalDb();

  const {
    sessionOpen,
    query,
    filtered,
    sessionList,
    sessionCount,
    setQuery,
    resetSession,
    startSession,
    endSession,
    addToSession,
    incrementItem,
    decrementItem,
    deleteItem
  } = useLocalSession({ inventory, setInventory });

  useEffect(() => {
    const r = window.requestAnimationFrame(() => setIntroVisible(true));
    const t = window.setTimeout(() => setShowIntro(false), 2500);
    return () => {
      window.cancelAnimationFrame(r);
      window.clearTimeout(t);
    };
  }, []);

  useEffect(() => {
    if (!online) return;
    flushPendingToHistory();
  }, [flushPendingToHistory, online]);

  useEffect(() => {
    void refreshInventory();
  }, [refreshInventory]);

  const confirmSubmit = () => {
    if (sessionCount <= 0) return;
    if (!settings.requireFinalConfirm && !settings.enableUserLabel) {
      submitSession();
      return;
    }
    setConfirmOpen(true);
  };

  const submitSession = (userLabel?: string) => {
    const createdAt = Date.now();
    const session = {
      id: newId('s'),
      createdAt,
      submittedAt: online ? createdAt : undefined,
      userLabel,
      items: sessionList.map((i) => ({ wineId: i.wineId, qty: i.qty }))
    };

    setConfirmOpen(false);
    resetSession();

    if (online) {
      addHistory(session);
      setToast('Sessione inviata');
      return;
    }

    addPending(session);
    setToast('Offline: salvata in coda');
  };

  const sessionQtyByWineId = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of sessionList) m.set(i.wineId, i.qty);
    return m;
  }, [sessionList]);

  const getSessionQty = (wineId: string) => sessionQtyByWineId.get(wineId) ?? 0;

  if (showIntro) {
    return (
      <div className="container introLayout">
        <div className={`introCenter ${introVisible ? 'introVisible' : ''}`}>
          <Logo variant="intro" />
          <div className="subtle mt8">Avvio…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="homeHeader">
        <Logo variant="header" />
      </div>

      {!online ? (
        <div className="banner">Offline: le sessioni confermate verranno messe in coda.</div>
      ) : null}

      <div className="mt12">
        {sessionOpen ? (
          <div className="row">
            <button className="button buttonSecondary buttonAuto sessionCloseButton" type="button" onClick={endSession}>
              ×
            </button>
            <button
              className={`button buttonAuto ${sessionCount > 0 ? 'buttonSessionConfirmActive' : ''}`}
              type="button"
              onClick={confirmSubmit}
              disabled={sessionCount <= 0}
            >
              Conferma Sessione
            </button>
          </div>
        ) : (
          <button className="button" type="button" onClick={startSession}>
            Inizia sessione di scarico
          </button>
        )}
      </div>

      <div className="mt12">
        <input
          className="input inputSearch"
          placeholder="Cerca vino per nome…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {!sessionOpen || query.trim() ? (
        <ResultsList
          wines={sessionOpen ? filtered : inventory}
          sessionOpen={sessionOpen}
          interactive={sessionOpen}
          getSessionQty={sessionOpen ? getSessionQty : undefined}
          onIncrement={sessionOpen ? (wineId) => addToSession(wineId, 1) : undefined}
          onDecrement={sessionOpen ? (wineId) => decrementItem(wineId) : undefined}
        />
      ) : null}

      {sessionOpen ? (
        <SummaryList
          sessionCount={sessionCount}
          items={sessionList}
          wines={inventory}
          onIncrement={incrementItem}
          onDecrement={decrementItem}
          onDelete={deleteItem}
        />
      ) : null}

      <SessionConfirmModal
        open={confirmOpen}
        enableUserLabel={settings.enableUserLabel}
        sessionCount={sessionCount}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={(userLabel) => submitSession(userLabel)}
      />

      {toast ? <Toast message={toast} onClose={() => setToast(null)} /> : null}
    </div>
  );
}
