import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Wine } from '@/domain/types';
import type { LocalDbState, LocalSession } from '@/data/localDb';
import { dbChangedEvent, loadDb, notifyDbChanged, resetDb, saveDb } from '@/data/localDb';
import { listWines } from '@/data/wineRepository';

export function useLocalDb() {
  const [db, setDb] = useState<LocalDbState>(() => loadDb());

  useEffect(() => {
    const onExternal = () => {
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
      window.removeEventListener(dbChangedEvent, onExternal);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const commit = useCallback((next: LocalDbState | ((prev: LocalDbState) => LocalDbState)) => {
    setDb((prev) => {
      const computed =
        typeof next === 'function' ? (next as (p: LocalDbState) => LocalDbState)(prev) : next;
      saveDb(computed);
      notifyDbChanged();
      return computed;
    });
  }, []);

  const inventory = db.inventory;
  const history = db.history;
  const pending = db.pending;

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

  const addPending = useCallback(
    (session: LocalSession) => {
      commit((prev) => ({ ...prev, pending: [...prev.pending, session] }));
    },
    [commit]
  );

  const addHistory = useCallback(
    (session: LocalSession) => {
      commit((prev) => ({ ...prev, history: [session, ...prev.history] }));
    },
    [commit]
  );

  const deletePending = useCallback(
    (id: string) => {
      commit((prev) => ({ ...prev, pending: prev.pending.filter((s) => s.id !== id) }));
    },
    [commit]
  );

  const clearHistory = useCallback(() => {
    commit((prev) => ({ ...prev, history: [] }));
  }, [commit]);

  const clearPending = useCallback(() => {
    commit((prev) => ({ ...prev, pending: [] }));
  }, [commit]);

  const flushPendingToHistory = useCallback(() => {
    commit((prev) => {
      if (prev.pending.length === 0) return prev;
      const ordered = [...prev.pending].sort((a, b) => a.createdAt - b.createdAt);
      const now = Date.now();
      const moved = ordered.map((s) => ({ ...s, submittedAt: s.submittedAt ?? now }));
      return {
        ...prev,
        pending: [],
        history: [...moved.reverse(), ...prev.history]
      };
    });
  }, [commit]);

  const hardResetAll = useCallback(() => {
    resetDb();
    notifyDbChanged();
    setDb(loadDb());
  }, []);

  const refreshInventory = useCallback(async () => {
    try {
      const wines = await listWines();
      setDb(loadDb());
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
    pending,
    setInventory,
    addPending,
    addHistory,
    deletePending,
    clearHistory,
    clearPending,
    flushPendingToHistory,
    hardResetAll,
    refreshInventory,
    summary
  };
}
