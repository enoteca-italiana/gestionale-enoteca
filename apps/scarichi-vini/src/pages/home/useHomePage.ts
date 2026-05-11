import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import type { AppDomain } from '@/app/appDomainContext';
import { useOnlineStatus } from '@/app/useOnlineStatus';
import type { DischargeQueueStatusDetail } from '@/data/offlineDischargeQueue';
import {
  dischargeQueueChangedEvent,
  dischargeQueueStatusEvent,
  enqueuePendingDischargeSession,
  getPendingDischargeQueueCount,
  isDischargeQueueRecoverableError
} from '@/data/offlineDischargeQueue';
import { useLocalDb } from '@/data/useLocalDb';
import { useLocalSession } from '@/pages/home/useLocalSession';
import { useStockEditor } from '@/pages/home/useStockEditor';

type StockFilter = 'all' | 'threshold' | 'out';

const INTRO_SEEN_SESSION_KEY = 'scarichi:intro-seen';
const FORCE_HOME_ONCE_SESSION_KEY = 'scarichi:force-home-once';
const BEFORE_NAV_EVENT = 'scarichi:beforeNav';
let dischargeRepositoryPromise: Promise<typeof import('@/data/dischargeRepository')> | null = null;

async function loadDischargeRepository() {
  dischargeRepositoryPromise ??= import('@/data/dischargeRepository');
  return dischargeRepositoryPromise;
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
    if (forced) window.sessionStorage.removeItem(FORCE_HOME_ONCE_SESSION_KEY);
    return forced;
  } catch {
    return false;
  }
}

export function useHomePage({
  onIntroVisibilityChange,
  domain = 'wine'
}: {
  onIntroVisibilityChange?: (visible: boolean) => void;
  domain?: AppDomain;
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
  const [pendingQueueCount, setPendingQueueCount] = useState(() => getPendingDischargeQueueCount());
  const [toast, setToast] = useState<string | null>(null);
  const [stockFilter, setStockFilter] = useState<StockFilter>('all');
  const [forceRefreshBusy, setForceRefreshBusy] = useState(false);
  const [location, setLocation] = useLocation();

  const online = useOnlineStatus();
  const previousOnlineRef = useRef(online);

  const { inventory, setInventory, refreshInventory } = useLocalDb(domain);

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

  const {
    editingStockWine,
    editingStockQty,
    stockSaveBusy,
    openStockEditor,
    closeStockEditor,
    confirmStockSave,
    setEditingStockQty
  } = useStockEditor({
    domain,
    sessionOpen,
    onToast: setToast,
    onRefreshInventory: refreshInventory
  });

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
      setToast(
        online
          ? 'Online: sincronizzazione automatica in corso'
          : 'Offline: sessioni salvate in coda'
      );
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
    const onFocus = () => void refreshInventory();
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void refreshInventory();
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
      if (sessionCount <= 0 && href === '/') {
        endSession();
        return;
      }
      if (sessionCount > 0) {
        navEvent.preventDefault();
        setPendingNavPath(href);
        setLeaveSessionConfirmOpen(true);
      }
    };
    window.addEventListener(BEFORE_NAV_EVENT, onBeforeNav as EventListener);
    return () => window.removeEventListener(BEFORE_NAV_EVENT, onBeforeNav as EventListener);
  }, [endSession, sessionCount, sessionOpen]);

  useEffect(() => {
    if (sessionOpen && sessionCount > 0) return;
    if (!leaveSessionConfirmOpen && !pendingNavPath) return;
    setLeaveSessionConfirmOpen(false);
    setPendingNavPath(null);
  }, [leaveSessionConfirmOpen, pendingNavPath, sessionCount, sessionOpen]);

  const sessionQtyByWineId = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of sessionList) m.set(i.wineId, i.qty);
    return m;
  }, [sessionList]);

  const inventoryQtyByWineId = useMemo(() => {
    const m = new Map<string, number>();
    for (const wine of inventory) m.set(wine.id, wine.qty);
    return m;
  }, [inventory]);

  const visibleWines = useMemo(() => {
    const baseSelection = sessionOpen
      ? filtered.filter((wine) => !sessionQtyByWineId.has(wine.id))
      : filtered;
    if (stockFilter === 'threshold') {
      return baseSelection.filter((wine) => isInThreshold(wine.qty, wine.threshold));
    }
    if (stockFilter === 'out') {
      return baseSelection.filter((wine) => wine.qty <= 0);
    }
    return baseSelection;
  }, [filtered, sessionOpen, sessionQtyByWineId, stockFilter]);

  const getSessionQty = useCallback(
    (wineId: string) => sessionQtyByWineId.get(wineId) ?? 0,
    [sessionQtyByWineId]
  );

  const showResults = !sessionOpen || query.trim().length > 0 || stockFilter !== 'all';

  const confirmSubmit = () => {
    if (sessionCount <= 0) return;
    setConfirmOpen(true);
  };

  const submitSession = async () => {
    const items = sessionList.map((item) => ({ wineId: item.wineId, qty: item.qty }));
    const spiritItems = sessionList.map((item) => ({ spiritId: item.wineId, qty: item.qty }));
    const expectedQtyByWineId = Object.fromEntries(
      sessionList.map((item) => [item.wineId, inventoryQtyByWineId.get(item.wineId) ?? 0])
    );

    const enqueueSession = (message: string) => {
      enqueuePendingDischargeSession({
        items,
        expectedQtyByWineId,
        domain
      });
      setConfirmOpen(false);
      resetSession();
      setToast(message);
    };

    if (!online) {
      try {
        enqueueSession(
          domain === 'wine'
            ? 'Offline: sessione salvata in coda'
            : 'Offline: sessione Spirits salvata in coda'
        );
      } catch (error) {
        console.error('[HomePage] enqueue offline session failed', error);
        setToast('Offline: errore salvataggio coda');
      }
      return;
    }

    try {
      const dischargeRepository = await loadDischargeRepository();
      if (domain === 'wine') {
        await dischargeRepository.createAndSubmitDischargeSession({ items, expectedQtyByWineId });
      } else {
        await dischargeRepository.createAndSubmitSpiritsDischargeSession({ items: spiritItems });
      }
      await refreshInventory();
      setToast('Sessione inviata');
    } catch (error) {
      if (isDischargeQueueRecoverableError(error)) {
        try {
          enqueueSession(
            domain === 'wine'
              ? 'Rete instabile: sessione salvata in coda'
              : 'Rete instabile: sessione Spirits salvata in coda'
          );
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

  const forceRefreshHome = async () => {
    if (forceRefreshBusy) return;
    setForceRefreshBusy(true);
    try {
      setQuery('');
      setStockFilter('all');
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
      await refreshInventory({ forceRemote: true, skipTtl: true });
      setToast('Archivio aggiornato');
    } catch (error) {
      console.error('[HomePage] force refresh failed', error);
      setToast('Errore refresh archivio');
    } finally {
      setForceRefreshBusy(false);
    }
  };

  return {
    showIntro,
    introVisible,
    online,
    pendingQueueCount,
    sessionOpen,
    sessionCount,
    query,
    setQuery,
    stockFilter,
    setStockFilter,
    visibleWines,
    getSessionQty,
    showResults,
    forceRefreshBusy,
    sessionList,
    inventory,
    incrementItem,
    decrementItem,
    deleteItem,
    addToSession,
    editingStockWine,
    editingStockQty,
    stockSaveBusy,
    setEditingStockQty,
    closeStockEditor,
    confirmStockSave,
    openStockEditor,
    confirmOpen,
    setConfirmOpen,
    leaveSessionConfirmOpen,
    toast,
    setToast,
    confirmSubmit,
    startSession,
    submitSession,
    confirmLeaveSession,
    cancelLeaveSession,
    forceRefreshHome
  };
}
