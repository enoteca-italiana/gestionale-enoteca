import { useMemo, useState } from 'react';
import type { SessionItem, Wine } from '@/domain/types';

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

  const inventoryById = useMemo(() => {
    const map = new Map<string, Wine>();
    for (const wine of inventory) map.set(wine.id, wine);
    return map;
  }, [inventory]);

  const inventorySearchTextById = useMemo(() => {
    const map = new Map<string, string>();
    for (const wine of inventory) map.set(wine.id, buildWineSearchText(wine));
    return map;
  }, [inventory]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return inventory;
    return inventory.filter((w) => {
      const haystack = inventorySearchTextById.get(w.id) ?? '';
      return haystack.includes(q);
    });
  }, [inventory, inventorySearchTextById, query]);

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
    setInventory((prev) => prev.map((w) => (w.id === wineId ? { ...w, qty: w.qty + delta } : w)));
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
