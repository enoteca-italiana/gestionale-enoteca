import { useCallback, useEffect, useState } from 'react';
import {
  clearSubmittedHistoryByRetention,
  listDischargeSessions,
  type DischargeSessionSummary,
  type SubmittedHistoryRetention
} from '@/data/dischargeRepository';

const HISTORY_LIMIT = 300;
const CACHE_TTL_MS = 60_000;

let historyCache: { data: DischargeSessionSummary[]; at: number } | null = null;

function readHistoryCache() {
  if (!historyCache) return null;
  const age = Date.now() - historyCache.at;
  if (age > CACHE_TTL_MS) return null;
  return historyCache.data;
}

function writeHistoryCache(data: DischargeSessionSummary[]) {
  historyCache = { data, at: Date.now() };
}

export function useDischargeSessions(enabled = true) {
  const cachedHistory = readHistoryCache();
  const [history, setHistory] = useState<DischargeSessionSummary[]>(cachedHistory ?? []);
  const [loading, setLoading] = useState(enabled && !cachedHistory);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(
    async (force = false) => {
      if (!enabled) return;
      if (!force) {
        const cached = readHistoryCache();
        if (cached) {
          setHistory(cached);
          setLoading(false);
          return;
        }
      }
      setLoading(true);
      setError(null);
      try {
        const submittedRows = await listDischargeSessions('submitted', { limit: HISTORY_LIMIT });
        writeHistoryCache(submittedRows);
        setHistory(submittedRows);
      } catch (err) {
        console.error('[useDischargeSessions] refresh failed', err);
        setError('Impossibile caricare le sessioni da Supabase.');
      } finally {
        setLoading(false);
      }
    },
    [enabled]
  );

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    void refresh();
  }, [enabled, refresh]);

  const clearHistory = useCallback(
    async (retention: SubmittedHistoryRetention = 'all') => {
      if (!enabled) return;
      await clearSubmittedHistoryByRetention(retention);
      const submittedRows = await listDischargeSessions('submitted', { limit: HISTORY_LIMIT });
      writeHistoryCache(submittedRows);
      setHistory(submittedRows);
      setLoading(false);
      setError(null);
    },
    [enabled]
  );

  return {
    history,
    loading,
    error,
    refresh,
    clearHistory
  };
}
