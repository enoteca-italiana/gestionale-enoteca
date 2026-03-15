import { useMemo, useState } from 'react';
import type { SessionItem, Wine } from '@/domain/types';
import { useDebouncedValue } from '@/app/useDebouncedValue';

function buildWineSearchText(wine: Wine) {
  return [
    wine.category,
    wine.name,
    wine.age,
    wine.producer,
    wine.origin,
    wine.supplier,
    wine.notes,
    wine.warehouse
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export function useLocalSession({
  inventory,
  setInventory
}: {
  inventory: Wine[];
  setInventory: (inv: Wine[] | ((prev: Wine[]) => Wine[])) => void;
}) {
  const [sessionOpen, setSessionOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<Record<string, SessionItem>>({});
  const debouncedQuery = useDebouncedValue(query, 120);
  const inventoryById = useMemo(() => {
    const map = new Map<string, Wine>();
    for (const wine of inventory) {
      map.set(wine.id, wine);
    }
    return map;
  }, [inventory]);
  const inventoryIndexById = useMemo(() => {
    const map = new Map<string, number>();
    for (let i = 0; i < inventory.length; i += 1) {
      map.set(inventory[i].id, i);
    }
    return map;
  }, [inventory]);
  const inventorySearchTextById = useMemo(() => {
    const map = new Map<string, string>();
    for (const wine of inventory) {
      map.set(wine.id, buildWineSearchText(wine));
    }
    return map;
  }, [inventory]);

  const filtered = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    if (!q) return inventory;
    return inventory.filter((w) => {
      const haystack = inventorySearchTextById.get(w.id) ?? '';
      return haystack.includes(q);
    });
  }, [debouncedQuery, inventory, inventorySearchTextById]);

  const sessionList = useMemo(() => {
    return Object.values(items)
      .filter((i) => i.qty > 0)
      .sort((a, b) => a.wineId.localeCompare(b.wineId));
  }, [items]);

  const sessionCount = useMemo(() => sessionList.reduce((sum, i) => sum + i.qty, 0), [sessionList]);

  const resetSession = () => {
    setItems({});
    setQuery('');
  };

  const startSession = () => {
    setSessionOpen(true);
    resetSession();
  };

  const endSession = () => {
    setSessionOpen(false);
    resetSession();
  };

  const adjustWineQty = (wineId: string, delta: number) => {
    if (!delta) return;
    setInventory((prev) => {
      let idx = inventoryIndexById.get(wineId) ?? -1;
      if (idx < 0 || prev[idx]?.id !== wineId) {
        idx = prev.findIndex((wine) => wine.id === wineId);
      }
      if (idx < 0) return prev;
      const target = prev[idx];
      const nextQty = target.qty + delta;
      if (nextQty === target.qty) return prev;
      const next = [...prev];
      next[idx] = { ...target, qty: nextQty };
      return next;
    });
  };

  const addToSession = (wineId: string, amount: number) => {
    if (!sessionOpen) return;
    const wine = inventoryById.get(wineId);
    if (!wine) return;
    if (wine.qty <= 0) return;

    const allowed = Math.min(amount, wine.qty);
    if (allowed <= 0) return;

    adjustWineQty(wineId, -allowed);
    setItems((prev) => {
      const current = prev[wineId]?.qty ?? 0;
      return {
        ...prev,
        [wineId]: { wineId, qty: current + allowed }
      };
    });
  };

  const incrementItem = (wineId: string) => {
    if (!sessionOpen) return;
    addToSession(wineId, 1);
  };

  const decrementItem = (wineId: string) => {
    if (!sessionOpen) return;
    const current = items[wineId]?.qty ?? 0;
    if (current <= 0) return;
    adjustWineQty(wineId, 1);
    setItems((prev) => ({
      ...prev,
      [wineId]: { wineId, qty: (prev[wineId]?.qty ?? 0) - 1 }
    }));
  };

  const deleteItem = (wineId: string) => {
    if (!sessionOpen) return;
    const current = items[wineId]?.qty ?? 0;
    if (current <= 0) return;
    adjustWineQty(wineId, current);
    setItems((prev) => ({ ...prev, [wineId]: { wineId, qty: 0 } }));
  };

  return {
    inventory,
    sessionOpen,
    query,
    items,
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
  };
}
