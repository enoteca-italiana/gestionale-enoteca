import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Wine } from '@/domain/types';
import type { LocalDbState } from '@/data/localDb';
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
    setInventory,
    clearHistory,
    hardResetAll,
    refreshInventory,
    summary
  };
}
