import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import { Logo } from '@/components/Logo';
import { Toast } from '@/components/Toast';
import { useOnlineStatus } from '@/app/useOnlineStatus';
import { createAndSubmitDischargeSession } from '@/data/dischargeRepository';
import { useLocalDb } from '@/data/useLocalDb';
import { ResultsList } from '@/pages/home/ResultsList';
import { SessionConfirmModal } from '@/pages/home/SessionConfirmModal';
import { SummaryList } from '@/pages/home/SummaryList';
import { useLocalSession } from '@/pages/home/useLocalSession';

type StockFilter = 'all' | 'threshold' | 'out';

function isInThreshold(qty: number, threshold?: number) {
  const parsedQty = Number(qty);
  const parsedThreshold = Number(threshold);
  if (!Number.isFinite(parsedQty) || parsedQty <= 0) return false;
  if (!Number.isFinite(parsedThreshold) || parsedThreshold < 1) return false;
  return parsedQty <= parsedThreshold;
}

function isDesktopDevice() {
  return window.matchMedia('(min-width: 1024px) and (hover: hover) and (pointer: fine)').matches;
}

export function HomePage({
  onIntroVisibilityChange
}: {
  onIntroVisibilityChange?: (visible: boolean) => void;
}) {
  const [showIntro, setShowIntro] = useState(true);
  const [introVisible, setIntroVisible] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [stockFilter, setStockFilter] = useState<StockFilter>('all');
  const [location, setLocation] = useLocation();

  const online = useOnlineStatus();

  const { inventory, setInventory, refreshInventory } = useLocalDb();

  const {
    sessionOpen,
    query,
    filtered,
    sessionList,
    sessionCount,
    setQuery,
    resetSession,
    startSession,
    addToSession,
    incrementItem,
    decrementItem,
    deleteItem
  } = useLocalSession({ inventory, setInventory });
  const deferredFiltered = useDeferredValue(filtered);

  useEffect(() => {
    const r = window.requestAnimationFrame(() => setIntroVisible(true));
    const t = window.setTimeout(() => setShowIntro(false), 2500);
    return () => {
      window.cancelAnimationFrame(r);
      window.clearTimeout(t);
    };
  }, []);

  useEffect(() => {
    onIntroVisibilityChange?.(showIntro);
    return () => onIntroVisibilityChange?.(false);
  }, [onIntroVisibilityChange, showIntro]);

  useEffect(() => {
    if (showIntro) return;
    if (location !== '/') return;
    if (!isDesktopDevice()) return;
    setLocation('/admina', { replace: true });
  }, [location, setLocation, showIntro]);

  useEffect(() => {
    void refreshInventory();
  }, [refreshInventory]);

  const confirmSubmit = () => {
    if (sessionCount <= 0) return;
    setConfirmOpen(true);
  };

  const submitSession = async () => {
    if (!online) {
      setToast('Offline: impossibile confermare sessione');
      setConfirmOpen(false);
      return;
    }

    const expectedQtyByWineId = Object.fromEntries(
      sessionList.map((item) => [
        item.wineId,
        inventory.find((wine) => wine.id === item.wineId)?.qty ?? 0
      ])
    );

    try {
      await createAndSubmitDischargeSession({
        items: sessionList.map((item) => ({ wineId: item.wineId, qty: item.qty })),
        expectedQtyByWineId
      });
      await refreshInventory();
      setToast('Sessione inviata');
    } catch (error) {
      console.error('[HomePage] submitSession failed', error);
      setToast('Errore invio sessione');
      return;
    }

    setConfirmOpen(false);
    resetSession();
  };

  const sessionQtyByWineId = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of sessionList) m.set(i.wineId, i.qty);
    return m;
  }, [sessionList]);

  const visibleWines = useMemo(() => {
    const winesAvailableForSelection = sessionOpen
      ? deferredFiltered.filter((wine) => !sessionQtyByWineId.has(wine.id))
      : deferredFiltered;

    if (stockFilter === 'threshold') {
      return winesAvailableForSelection.filter((wine) => isInThreshold(wine.qty, wine.threshold));
    }
    if (stockFilter === 'out') {
      return winesAvailableForSelection.filter((wine) => wine.qty <= 0);
    }
    return winesAvailableForSelection;
  }, [deferredFiltered, sessionOpen, sessionQtyByWineId, stockFilter]);

  const getSessionQty = (wineId: string) => sessionQtyByWineId.get(wineId) ?? 0;
  const showResults = !sessionOpen || query.trim().length > 0 || stockFilter !== 'all';

  if (showIntro) {
    return (
      <div className="container introLayout">
        <div className={`introCenter ${introVisible ? 'introVisible' : ''}`}>
          <Logo variant="intro" />
        </div>
        <div className="introByline">By DERO</div>
      </div>
    );
  }

  return (
    <div className={`container ${sessionOpen ? 'homeSessionContainer' : ''}`}>
      <div className="homeHeader">
        <Logo variant="header" />
      </div>

      {!online ? <div className="banner">Offline: conferma sessione non disponibile.</div> : null}

      <div className="mt12">
        {sessionOpen ? (
          <button
            className={`button ${sessionCount > 0 ? 'buttonSessionConfirmActive' : 'buttonSessionConfirmInactive'}`}
            type="button"
            onClick={confirmSubmit}
            disabled={sessionCount <= 0}
          >
            Conferma Scarico
          </button>
        ) : (
          <button className="button" type="button" onClick={startSession}>
            Inizia sessione di scarico
          </button>
        )}
      </div>

      <div className="mt12 searchRow">
        <input
          className="input inputSearch inputSearchCompact"
          placeholder="Cerca per nome, produttore, provenienza, note…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button
          className={`searchStockButton searchStockButtonThreshold ${
            stockFilter === 'threshold' ? 'searchStockButtonActive' : ''
          }`}
          type="button"
          onClick={() => setStockFilter((prev) => (prev === 'threshold' ? 'all' : 'threshold'))}
          aria-pressed={stockFilter === 'threshold' ? 'true' : 'false'}
        >
          Soglia
        </button>
        <button
          className={`searchStockButton searchStockButtonOut ${
            stockFilter === 'out' ? 'searchStockButtonActive' : ''
          }`}
          type="button"
          onClick={() => setStockFilter((prev) => (prev === 'out' ? 'all' : 'out'))}
          aria-pressed={stockFilter === 'out' ? 'true' : 'false'}
        >
          Esaurito
        </button>
      </div>

      <div className={sessionOpen ? 'homeResultsArea homeResultsAreaSession' : 'homeResultsArea'}>
        {showResults ? (
          <ResultsList
            wines={visibleWines}
            sessionOpen={sessionOpen}
            interactive={sessionOpen}
            getSessionQty={sessionOpen ? getSessionQty : undefined}
            onIncrement={sessionOpen ? (wineId) => addToSession(wineId, 1) : undefined}
            onDecrement={sessionOpen ? (wineId) => decrementItem(wineId) : undefined}
          />
        ) : null}
      </div>

      {sessionOpen ? (
        <SummaryList
          items={sessionList}
          wines={inventory}
          onIncrement={incrementItem}
          onDecrement={decrementItem}
          onDelete={deleteItem}
        />
      ) : null}

      <SessionConfirmModal
        open={confirmOpen}
        sessionCount={sessionCount}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => submitSession()}
      />

      {toast ? <Toast message={toast} onClose={() => setToast(null)} /> : null}
    </div>
  );
}
