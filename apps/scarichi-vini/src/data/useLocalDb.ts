import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Wine } from '@/domain/types';
import type { LocalDbState } from '@/data/localDb';
import { dbChangedEvent, loadDb, notifyDbChanged, resetDb, saveDb } from '@/data/localDb';
import { listWines } from '@/data/wineRepository';

const WRITE_COALESCE_MS = 120;

export function useLocalDb() {
  const [db, setDb] = useState<LocalDbState>(() => loadDb());
  const sourceIdRef = useRef(`useLocalDb_${Math.random().toString(36).slice(2)}`);
  const pendingDbRef = useRef<LocalDbState | null>(null);
  const flushTimerRef = useRef<number | null>(null);

  const flushPending = useCallback(() => {
    if (!pendingDbRef.current) return;
    const next = pendingDbRef.current;
    pendingDbRef.current = null;
    if (flushTimerRef.current !== null) {
      window.clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    saveDb(next);
    notifyDbChanged(sourceIdRef.current);
  }, []);

  useEffect(() => {
    const onExternal = (event?: Event) => {
      const custom = event as CustomEvent<{ sourceId?: string }> | undefined;
      const sourceId = custom?.detail?.sourceId;
      if (sourceId && sourceId === sourceIdRef.current) return;
      setDb(loadDb());
    };

    const onStorage = (e: StorageEvent) => {
      if (!e.key) return;
      if (!e.key.startsWith('scarichi.localDb.v1')) return;
      onExternal();
    };

    window.addEventListener(dbChangedEvent, onExternal);
    window.addEventListener('storage', onStorage);
    return () => {
      flushPending();
      window.removeEventListener(dbChangedEvent, onExternal);
      window.removeEventListener('storage', onStorage);
    };
  }, [flushPending]);

  const commit = useCallback((next: LocalDbState | ((prev: LocalDbState) => LocalDbState)) => {
    setDb((prev) => {
      const computed =
        typeof next === 'function' ? (next as (p: LocalDbState) => LocalDbState)(prev) : next;
      pendingDbRef.current = computed;
      if (flushTimerRef.current !== null) {
        window.clearTimeout(flushTimerRef.current);
      }
      flushTimerRef.current = window.setTimeout(() => {
        flushPending();
      }, WRITE_COALESCE_MS);
      return computed;
    });
  }, [flushPending]);

  const inventory = db.inventory;
  const history = db.history;

  const setInventory = useCallback(
    (inv: Wine[] | ((prev: Wine[]) => Wine[])) => {
      commit((prev) => {
        const nextInv =
          typeof inv === 'function' ? (inv as (p: Wine[]) => Wine[])(prev.inventory) : inv;
        return { ...prev, inventory: nextInv };
      });
    },
    [commit]
  );

  const clearHistory = useCallback(() => {
    commit((prev) => ({ ...prev, history: [] }));
  }, [commit]);

  const hardResetAll = useCallback(() => {
    pendingDbRef.current = null;
    if (flushTimerRef.current !== null) {
      window.clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    resetDb();
    notifyDbChanged(sourceIdRef.current);
    setDb(loadDb());
  }, []);

  const refreshInventory = useCallback(async () => {
    try {
      const wines = await listWines();
      setDb((prev) => {
        const next = { ...prev, inventory: wines };
        pendingDbRef.current = next;
        if (flushTimerRef.current !== null) {
          window.clearTimeout(flushTimerRef.current);
          flushTimerRef.current = null;
        }
        saveDb(next);
        notifyDbChanged(sourceIdRef.current);
        return next;
      });
      return wines;
    } catch (error) {
      console.error('[useLocalDb] refreshInventory failed', error);
      throw error;
    }
  }, []);

  const summary = useMemo(() => {
    const totalQty = inventory.reduce((sum, w) => sum + (w.qty ?? 0), 0);
    return { totalQty, winesCount: inventory.length };
  }, [inventory]);

  return {
    inventory,
    history,
    setInventory,
    clearHistory,
    hardResetAll,
    refreshInventory,
    summary
  };
}
