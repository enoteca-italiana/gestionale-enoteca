import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { ConfirmModal } from '@/components/ConfirmModal';
import { Logo } from '@/components/Logo';
import { Toast } from '@/components/Toast';
import { useOnlineStatus } from '@/app/useOnlineStatus';
import { dischargeNoteChangedEvent } from '@/data/dischargeNote';
import type { DischargeQueueStatusDetail } from '@/data/offlineDischargeQueue';
import {
  dischargeQueueChangedEvent,
  dischargeQueueStatusEvent,
  enqueuePendingDischargeSession,
  getPendingDischargeQueueCount,
  isDischargeQueueRecoverableError
} from '@/data/offlineDischargeQueue';
import { useLocalDb } from '@/data/useLocalDb';
import { ResultsList } from '@/pages/home/ResultsList';
import { SessionConfirmModal } from '@/pages/home/SessionConfirmModal';
import { SummaryList } from '@/pages/home/SummaryList';
import { useLocalSession } from '@/pages/home/useLocalSession';
import { RefreshCcw } from 'lucide-react';
import type { Wine } from '@/domain/types';

type StockFilter = 'all' | 'threshold' | 'out';
const INTRO_SEEN_SESSION_KEY = 'scarichi:intro-seen';
const FORCE_HOME_ONCE_SESSION_KEY = 'scarichi:force-home-once';
const BEFORE_NAV_EVENT = 'scarichi:beforeNav';
const READY_NOTE_POLL_MS = 12000;
let dischargeRepositoryPromise: Promise<typeof import('@/data/dischargeRepository')> | null = null;
let dischargeNoteRepositoryPromise: Promise<
  typeof import('@/data/dischargeNoteRepository')
> | null = null;
let wineRepositoryPromise: Promise<typeof import('@/data/wineRepository')> | null = null;

async function loadDischargeRepository() {
  dischargeRepositoryPromise ??= import('@/data/dischargeRepository');
  return dischargeRepositoryPromise;
}

async function loadDischargeNoteRepository() {
  dischargeNoteRepositoryPromise ??= import('@/data/dischargeNoteRepository');
  return dischargeNoteRepositoryPromise;
}

async function loadWineRepository() {
  wineRepositoryPromise ??= import('@/data/wineRepository');
  return wineRepositoryPromise;
}

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

function hasSeenIntroInSession() {
  try {
    return window.sessionStorage.getItem(INTRO_SEEN_SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

function markIntroSeenInSession() {
  try {
    window.sessionStorage.setItem(INTRO_SEEN_SESSION_KEY, '1');
  } catch {
    // Ignore storage failures and keep runtime behavior.
  }
}

function consumeForcedHomeNavigation() {
  try {
    const forced = window.sessionStorage.getItem(FORCE_HOME_ONCE_SESSION_KEY) === '1';
    if (forced) {
      window.sessionStorage.removeItem(FORCE_HOME_ONCE_SESSION_KEY);
    }
    return forced;
  } catch {
    return false;
  }
}

export function HomePage({
  onIntroVisibilityChange
}: {
  onIntroVisibilityChange?: (visible: boolean) => void;
}) {
  const [forceHomeOnMount] = useState(() => consumeForcedHomeNavigation());
  const [shouldShowIntroOnMount] = useState(() => !forceHomeOnMount && !hasSeenIntroInSession());
  const [showIntro, setShowIntro] = useState(shouldShowIntroOnMount);
  const [autoRedirectToArchiveAfterIntro] = useState(
    () => !forceHomeOnMount && shouldShowIntroOnMount && isDesktopDevice()
  );
  const [introVisible, setIntroVisible] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [leaveSessionConfirmOpen, setLeaveSessionConfirmOpen] = useState(false);
  const [pendingNavPath, setPendingNavPath] = useState<string | null>(null);
  const [pendingNoteQtyByWineId, setPendingNoteQtyByWineId] = useState<Record<string, number>>({});
  const [pendingQueueCount, setPendingQueueCount] = useState(() => getPendingDischargeQueueCount());
  const [toast, setToast] = useState<string | null>(null);
  const [stockFilter, setStockFilter] = useState<StockFilter>('all');
  const [forceRefreshBusy, setForceRefreshBusy] = useState(false);
  const [editingStockWine, setEditingStockWine] = useState<Wine | null>(null);
  const [editingStockQty, setEditingStockQty] = useState(0);
  const [stockConfirmOpen, setStockConfirmOpen] = useState(false);
  const [stockSaveBusy, setStockSaveBusy] = useState(false);
  const [readyDischargeNoteItems, setReadyDischargeNoteItems] = useState<
    {
      wineId: string;
      qty: number;
    }[]
  >([]);
  const [location, setLocation] = useLocation();

  const online = useOnlineStatus();
  const previousOnlineRef = useRef(online);

  const { inventory, setInventory, refreshInventory } = useLocalDb();

  const {
    sessionOpen,
    query,
    filtered,
    sessionList,
    sessionCount,
    setQuery,
    resetSession,
    endSession,
    startSession,
    addToSession,
    incrementItem,
    decrementItem,
    deleteItem
  } = useLocalSession({ inventory, setInventory });

  useEffect(() => {
    if (!shouldShowIntroOnMount) return;
    markIntroSeenInSession();
    const r = window.requestAnimationFrame(() => setIntroVisible(true));
    const t = window.setTimeout(() => setShowIntro(false), 2500);
    return () => {
      window.cancelAnimationFrame(r);
      window.clearTimeout(t);
    };
  }, [shouldShowIntroOnMount]);

  useEffect(() => {
    onIntroVisibilityChange?.(showIntro);
    return () => onIntroVisibilityChange?.(false);
  }, [onIntroVisibilityChange, showIntro]);

  useEffect(() => {
    if (showIntro) return;
    if (!autoRedirectToArchiveAfterIntro) return;
    if (location !== '/') return;
    setLocation('/admina', { replace: true });
  }, [autoRedirectToArchiveAfterIntro, location, setLocation, showIntro]);

  useEffect(() => {
    void refreshInventory();
  }, [refreshInventory]);

  useEffect(() => {
    setPendingQueueCount(getPendingDischargeQueueCount());
    const onQueueChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ pendingCount?: unknown }>).detail;
      const pendingCount = Number(detail?.pendingCount);
      if (Number.isFinite(pendingCount) && pendingCount >= 0) {
        setPendingQueueCount(Math.round(pendingCount));
        return;
      }
      setPendingQueueCount(getPendingDischargeQueueCount());
    };
    window.addEventListener(dischargeQueueChangedEvent, onQueueChanged as EventListener);
    return () => {
      window.removeEventListener(dischargeQueueChangedEvent, onQueueChanged as EventListener);
    };
  }, []);

  useEffect(() => {
    const previousOnline = previousOnlineRef.current;
    if (previousOnline !== online) {
      setToast(online ? 'Online: sincronizzazione automatica in corso' : 'Offline: sessioni salvate in coda');
    }
    previousOnlineRef.current = online;
  }, [online]);

  useEffect(() => {
    const onQueueStatus = (event: Event) => {
      const detail = (event as CustomEvent<DischargeQueueStatusDetail>).detail;
      if (!detail) return;
      if (detail.type === 'sync_success' && detail.processed > 0) {
        const label =
          detail.processed === 1
            ? '1 sessione in coda inviata'
            : `${detail.processed} sessioni in coda inviate`;
        setToast(label);
        void refreshInventory();
        return;
      }
      if (detail.type === 'sync_error') {
        setToast('Errore sincronizzazione coda');
      }
    };

    window.addEventListener(dischargeQueueStatusEvent, onQueueStatus as EventListener);
    return () => {
      window.removeEventListener(dischargeQueueStatusEvent, onQueueStatus as EventListener);
    };
  }, [refreshInventory]);

  useEffect(() => {
    const onFocus = () => {
      void refreshInventory();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void refreshInventory();
      }
    };

    window.addEventListener('focus', onFocus);
    window.addEventListener('pageshow', onFocus);
    window.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('pageshow', onFocus);
      window.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [refreshInventory]);

  useEffect(() => {
    if (!sessionOpen) return;

    const onBeforeNav = (event: Event) => {
      const navEvent = event as CustomEvent<{ href?: string }>;
      const href = navEvent.detail?.href;
      if (!href) return;

      // If session is open but summary is empty, allow quick return to Home
      // by closing the session immediately (no confirmation modal needed).
      if (sessionCount <= 0 && href === '/') {
        endSession();
        setPendingNoteQtyByWineId({});
        return;
      }

      if (sessionCount > 0) {
        navEvent.preventDefault();
        setPendingNavPath(href);
        setLeaveSessionConfirmOpen(true);
      }
    };

    window.addEventListener(BEFORE_NAV_EVENT, onBeforeNav as EventListener);
    return () => {
      window.removeEventListener(BEFORE_NAV_EVENT, onBeforeNav as EventListener);
    };
  }, [endSession, sessionCount, sessionOpen]);

  useEffect(() => {
    let alive = true;
    const syncReadyNote = async () => {
      try {
        const noteRepository = await loadDischargeNoteRepository();
        if (!alive) return;
        const items = await noteRepository.getReadyDischargeNoteItems();
        if (!alive) return;
        setReadyDischargeNoteItems(items);
      } catch (error) {
        console.error('[HomePage] sync ready note failed', error);
      }
    };
    const onFocus = () => {
      void syncReadyNote();
    };
    const onPageShow = () => {
      void syncReadyNote();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void syncReadyNote();
      }
    };

    void syncReadyNote();
    const poll = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      void syncReadyNote();
    }, READY_NOTE_POLL_MS);

    window.addEventListener(dischargeNoteChangedEvent, onFocus);
    window.addEventListener('focus', onFocus);
    window.addEventListener('pageshow', onPageShow);
    window.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      alive = false;
      window.clearInterval(poll);
      window.removeEventListener(dischargeNoteChangedEvent, onFocus);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('pageshow', onPageShow);
      window.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [location]);

  useEffect(() => {
    if (sessionOpen && sessionCount > 0) return;
    if (!leaveSessionConfirmOpen && !pendingNavPath) return;
    setLeaveSessionConfirmOpen(false);
    setPendingNavPath(null);
  }, [leaveSessionConfirmOpen, pendingNavPath, sessionCount, sessionOpen]);

  useEffect(() => {
    if (!sessionOpen && Object.keys(pendingNoteQtyByWineId).length > 0) {
      setPendingNoteQtyByWineId({});
    }
  }, [pendingNoteQtyByWineId, sessionOpen]);

  const confirmSubmit = () => {
    if (sessionCount <= 0) return;
    setConfirmOpen(true);
  };

  const startSessionFromReadyNote = async () => {
    const noteRepository = await loadDischargeNoteRepository();
    const noteItems = await noteRepository.startReadyDischargeNoteItems();
    if (noteItems.length === 0) {
      startSession();
      return;
    }
    startSession();
    setPendingNoteQtyByWineId(
      Object.fromEntries(
        noteItems
          .filter((item) => item.qty > 0)
          .map((item) => [item.wineId, Math.max(1, Math.min(99, Math.round(item.qty)))])
      )
    );
    setReadyDischargeNoteItems([]);
    setToast('Nota scarico caricata');
  };

  const submitSession = async () => {
    const items = sessionList.map((item) => ({ wineId: item.wineId, qty: item.qty }));
    const expectedQtyByWineId = Object.fromEntries(
      sessionList.map((item) => [item.wineId, inventoryQtyByWineId.get(item.wineId) ?? 0])
    );

    const enqueueSession = (message: string) => {
      enqueuePendingDischargeSession({ items, expectedQtyByWineId });
      setPendingNoteQtyByWineId({});
      setReadyDischargeNoteItems([]);
      setConfirmOpen(false);
      resetSession();
      setToast(message);
    };

    if (!online) {
      try {
        enqueueSession('Offline: sessione salvata in coda');
      } catch (error) {
        console.error('[HomePage] enqueue offline session failed', error);
        setToast('Offline: errore salvataggio coda');
      }
      return;
    }

    try {
      const dischargeRepository = await loadDischargeRepository();
      const noteRepository = await loadDischargeNoteRepository();
      await dischargeRepository.createAndSubmitDischargeSession({
        items,
        expectedQtyByWineId
      });
      await noteRepository.completeInProgressDischargeNote();
      setPendingNoteQtyByWineId({});
      setReadyDischargeNoteItems([]);
      await refreshInventory();
      setToast('Sessione inviata');
    } catch (error) {
      if (isDischargeQueueRecoverableError(error)) {
        try {
          enqueueSession('Rete instabile: sessione salvata in coda');
          return;
        } catch (enqueueError) {
          console.error('[HomePage] enqueue recoverable session failed', enqueueError);
        }
      }
      console.error('[HomePage] submitSession failed', error);
      setToast('Errore invio sessione');
      return;
    }

    setConfirmOpen(false);
    resetSession();
  };

  const confirmLeaveSession = () => {
    if (!pendingNavPath) {
      setLeaveSessionConfirmOpen(false);
      return;
    }
    endSession();
    setLeaveSessionConfirmOpen(false);
    setLocation('/');
    setPendingNavPath(null);
  };

  const cancelLeaveSession = () => {
    setLeaveSessionConfirmOpen(false);
    setPendingNavPath(null);
  };

  const sessionQtyByWineId = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of sessionList) m.set(i.wineId, i.qty);
    return m;
  }, [sessionList]);
  const pendingNoteWineIdSet = useMemo(() => {
    const set = new Set<string>();
    for (const [wineId, qty] of Object.entries(pendingNoteQtyByWineId)) {
      if (qty > 0 && !sessionQtyByWineId.has(wineId)) set.add(wineId);
    }
    return set;
  }, [pendingNoteQtyByWineId, sessionQtyByWineId]);
  const inventoryQtyByWineId = useMemo(() => {
    const m = new Map<string, number>();
    for (const wine of inventory) m.set(wine.id, wine.qty);
    return m;
  }, [inventory]);

  const visibleWines = useMemo(() => {
    const winesAvailableForSelection = sessionOpen
      ? filtered.filter((wine) => !sessionQtyByWineId.has(wine.id))
      : filtered;
    const pendingNoteModeActive =
      sessionOpen &&
      pendingNoteWineIdSet.size > 0 &&
      query.trim().length === 0 &&
      stockFilter === 'all';
    const baseSelection = pendingNoteModeActive
      ? winesAvailableForSelection.filter((wine) => pendingNoteWineIdSet.has(wine.id))
      : winesAvailableForSelection;

    if (stockFilter === 'threshold') {
      return baseSelection.filter((wine) => isInThreshold(wine.qty, wine.threshold));
    }
    if (stockFilter === 'out') {
      return baseSelection.filter((wine) => wine.qty <= 0);
    }
    return baseSelection;
  }, [filtered, pendingNoteWineIdSet, query, sessionOpen, sessionQtyByWineId, stockFilter]);

  const confirmPendingNoteWine = (wineId: string, targetQty: number) => {
    const currentQty = getSessionQty(wineId);
    const roundedTarget = Math.max(0, Math.min(99, Math.round(targetQty)));
    if (roundedTarget > currentQty) {
      addToSession(wineId, roundedTarget - currentQty);
    } else if (roundedTarget < currentQty) {
      const toRemove = currentQty - roundedTarget;
      for (let i = 0; i < toRemove; i += 1) {
        decrementItem(wineId);
      }
    }

    setPendingNoteQtyByWineId((prev) => {
      if (!(wineId in prev)) return prev;
      const next = { ...prev };
      delete next[wineId];
      return next;
    });
  };

  const getSessionQty = (wineId: string) => sessionQtyByWineId.get(wineId) ?? 0;
  const showResults =
    !sessionOpen ||
    query.trim().length > 0 ||
    stockFilter !== 'all' ||
    pendingNoteWineIdSet.size > 0;

  const forceRefreshHome = async () => {
    if (forceRefreshBusy) return;
    setForceRefreshBusy(true);
    try {
      // Reset filters first so UI always restarts from default state.
      setQuery('');
      setStockFilter('all');

      // Force a SW update check before refreshing inventory.
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(
          registrations.map(async (registration) => {
            try {
              await registration.update();
            } catch {
              // Ignore update errors and continue with hard refresh flow.
            }
          })
        );
      }

      await refreshInventory({ forceRemote: true });
      setToast('Archivio aggiornato');
    } catch (error) {
      console.error('[HomePage] force refresh failed', error);
      setToast('Errore refresh archivio');
    } finally {
      setForceRefreshBusy(false);
    }
  };

  const openStockEditor = (wine: Wine) => {
    if (sessionOpen) return;
    setEditingStockWine(wine);
    setEditingStockQty(Math.max(0, Math.round(Number(wine.qty) || 0)));
    setStockConfirmOpen(false);
  };

  const closeStockEditor = () => {
    if (stockSaveBusy) return;
    setStockConfirmOpen(false);
    setEditingStockWine(null);
  };

  const stockQtyOptions = useMemo(() => {
    const current = Math.max(0, Math.round(Number(editingStockWine?.qty) || 0));
    const max = Math.min(999, Math.max(99, current + 200));
    return Array.from({ length: max + 1 }, (_, idx) => idx);
  }, [editingStockWine?.qty]);

  const requestStockSave = () => {
    if (!editingStockWine || stockSaveBusy) return;
    setStockConfirmOpen(true);
  };

  const confirmStockSave = async () => {
    if (!editingStockWine || stockSaveBusy) return;
    const nextQty = Math.max(0, Math.min(999, Math.round(editingStockQty)));
    const currentQty = Math.max(0, Math.round(Number(editingStockWine.qty) || 0));
    if (nextQty === currentQty) {
      closeStockEditor();
      return;
    }

    setStockSaveBusy(true);
    try {
      const wineRepository = await loadWineRepository();
      await wineRepository.updateWine({
        id: editingStockWine.id,
        category: editingStockWine.category ?? '',
        name: editingStockWine.name,
        age: editingStockWine.age ?? '',
        producer: editingStockWine.producer,
        origin: editingStockWine.origin,
        supplier: editingStockWine.supplier ?? '',
        threshold: editingStockWine.threshold,
        purchasePrice: editingStockWine.purchasePrice,
        salePrice: editingStockWine.salePrice,
        vintage: editingStockWine.vintage ?? '',
        qty: nextQty,
        notes: editingStockWine.notes ?? ''
      });
      await refreshInventory();
      setToast('Giacenza aggiornata');
      setStockConfirmOpen(false);
      setEditingStockWine(null);
    } catch (error) {
      console.error('[HomePage] update stock qty failed', error);
      setToast('Errore aggiornamento giacenza');
    } finally {
      setStockSaveBusy(false);
    }
  };

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
    <div className="container homeSessionContainer">
      <div className="homeHeader">
        <Logo variant="header" />
      </div>

      {!online ? (
        <div className="banner">
          Offline: {pendingQueueCount > 0 ? `${pendingQueueCount} sessioni in coda. ` : ''}
          Le conferme verranno inviate appena torni online.
        </div>
      ) : null}

      <div className="mt12 homeSessionActionRow">
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
          <button
            className={`button ${readyDischargeNoteItems.length > 0 ? 'buttonSessionConfirmActive' : ''}`}
            type="button"
            onClick={() => {
              if (readyDischargeNoteItems.length > 0) {
                void startSessionFromReadyNote();
                return;
              }
              startSession();
            }}
          >
            {readyDischargeNoteItems.length > 0
              ? `Avvia scarico da nota (${readyDischargeNoteItems.length})`
              : 'Inizia sessione di scarico'}
          </button>
        )}
        <button
          className="homeForceRefreshButton"
          type="button"
          aria-label="Refresh forzato app"
          title="Refresh forzato app"
          onClick={() => {
            void forceRefreshHome();
          }}
          disabled={forceRefreshBusy}
        >
          <RefreshCcw
            size={18}
            strokeWidth={2.2}
            className={forceRefreshBusy ? 'homeForceRefreshIconSpinning' : ''}
          />
        </button>
      </div>

      <div className="mt12 searchRow">
        <input
          className="input inputSearch inputSearchCompact"
          placeholder="Cerca vino..."
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
            onSelectWine={!sessionOpen ? openStockEditor : undefined}
            getSessionQty={sessionOpen ? getSessionQty : undefined}
            getPendingNoteQty={
              sessionOpen ? (wineId) => pendingNoteQtyByWineId[wineId] ?? 0 : undefined
            }
            onConfirmPendingNote={sessionOpen ? confirmPendingNoteWine : undefined}
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

      {editingStockWine ? (
        <div className="modalOverlay" role="dialog" aria-modal="true">
          <div className="modalCard homeStockModalCard">
            <div className="modalTitle centered">Giacenza</div>
            <div className="subtle centered mt6">{editingStockWine.name}</div>
            <label className="modalLabel mt12">
              <select
                className="input homeStockQtySelect"
                value={String(editingStockQty)}
                onChange={(event) => {
                  const next = Math.max(0, Math.min(999, Math.round(Number(event.target.value))));
                  setEditingStockQty(next);
                }}
                disabled={stockSaveBusy}
              >
                {stockQtyOptions.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            <div className="modalActions mt12">
              <button
                className="button homeStockCancelButton"
                type="button"
                disabled={stockSaveBusy}
                onClick={closeStockEditor}
              >
                Annulla
              </button>
              <button
                className="button"
                type="button"
                disabled={stockSaveBusy}
                onClick={requestStockSave}
              >
                Conferma
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmModal
        open={stockConfirmOpen && editingStockWine !== null}
        title="Confermare aggiornamento giacenza?"
        description={
          editingStockWine
            ? `Vuoi aggiornare "${editingStockWine.name}" da ${Math.max(
                0,
                Math.round(Number(editingStockWine.qty) || 0)
              )} a ${Math.max(0, Math.round(editingStockQty))}?`
            : undefined
        }
        confirmLabel={stockSaveBusy ? 'Salvataggio...' : 'Conferma'}
        cancelLabel="Annulla"
        onConfirm={() => {
          void confirmStockSave();
        }}
        onCancel={() => {
          if (stockSaveBusy) return;
          setStockConfirmOpen(false);
        }}
      />

      <SessionConfirmModal
        open={confirmOpen}
        sessionCount={sessionCount}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => submitSession()}
      />

      <ConfirmModal
        open={leaveSessionConfirmOpen}
        title="Abbandonare sessione in corso?"
        description="Sei sicuro che vuoi abbandonare la sessione in corso?"
        confirmLabel="Conferma"
        cancelLabel="Annulla"
        onConfirm={confirmLeaveSession}
        onCancel={cancelLeaveSession}
      />

      {toast ? <Toast message={toast} onClose={() => setToast(null)} /> : null}
    </div>
  );
}
