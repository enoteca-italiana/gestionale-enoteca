import { useMemo, useState } from 'react';
import type { SessionItem, Wine } from '@/domain/types';

export function useMockSession(initialWines: Wine[]) {
  const [wines, setWines] = useState<Wine[]>(initialWines);
  const [sessionOpen, setSessionOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<Record<string, SessionItem>>({});

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!sessionOpen) return [];
    if (!q) return wines;
    return wines.filter((w) => w.name.toLowerCase().includes(q));
  }, [query, sessionOpen, wines]);

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
    setWines((prev) => prev.map((w) => (w.id === wineId ? { ...w, qty: w.qty + delta } : w)));
  };

  const addToSession = (wineId: string, amount: number) => {
    const wine = wines.find((w) => w.id === wineId);
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
    addToSession(wineId, 1);
  };

  const decrementItem = (wineId: string) => {
    const current = items[wineId]?.qty ?? 0;
    if (current <= 0) return;
    adjustWineQty(wineId, 1);
    setItems((prev) => ({
      ...prev,
      [wineId]: { wineId, qty: (prev[wineId]?.qty ?? 0) - 1 }
    }));
  };

  const deleteItem = (wineId: string) => {
    const current = items[wineId]?.qty ?? 0;
    if (current <= 0) return;
    adjustWineQty(wineId, current);
    setItems((prev) => ({ ...prev, [wineId]: { wineId, qty: 0 } }));
  };

  return {
    wines,
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
