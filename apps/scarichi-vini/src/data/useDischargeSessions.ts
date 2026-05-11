import { useCallback, useEffect, useState } from 'react';
import type { AppDomain } from '@/app/appDomainContext';
import {
  clearSubmittedHistoryByRetentionDomain,
  deleteSubmittedDischargeSessionByDomain,
  listDischargeSessionsByDomain,
  type DischargeSessionSummary,
  type SubmittedHistoryRetention
} from '@/data/dischargeRepository';

const HISTORY_LIMIT = 300;
const CACHE_TTL_MS = 60_000;

let historyCacheByDomain: Partial<
  Record<AppDomain, { data: DischargeSessionSummary[]; at: number }>
> = {};

function readHistoryCache(domain: AppDomain) {
  const cache = historyCacheByDomain[domain];
  if (!cache) return null;
  const age = Date.now() - cache.at;
  if (age > CACHE_TTL_MS) return null;
  return cache.data;
}

function writeHistoryCache(domain: AppDomain, data: DischargeSessionSummary[]) {
  historyCacheByDomain = { ...historyCacheByDomain, [domain]: { data, at: Date.now() } };
}

export function useDischargeSessions(enabled = true, domain: AppDomain = 'wine') {
  const cachedHistory = readHistoryCache(domain) ?? [];
  const hasCachedHistory = Array.isArray(cachedHistory) && cachedHistory.length > 0;
  const [history, setHistory] = useState<DischargeSessionSummary[]>(cachedHistory ?? []);
  const [loading, setLoading] = useState(enabled && !hasCachedHistory);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(
    async (force = false) => {
      if (!enabled) return;
      if (!force) {
        const cached = readHistoryCache(domain);
        if (cached) {
          setHistory(cached);
          setLoading(false);
          return;
        }
      }
      setLoading(true);
      setError(null);
      try {
        const submittedRows = await listDischargeSessionsByDomain(domain, 'submitted', {
          limit: HISTORY_LIMIT
        });
        writeHistoryCache(domain, submittedRows);
        setHistory(submittedRows);
      } catch (err) {
        console.error('[useDischargeSessions] refresh failed', err);
        setError('Impossibile caricare le sessioni da Supabase.');
      } finally {
        setLoading(false);
      }
    },
    [domain, enabled]
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
      await clearSubmittedHistoryByRetentionDomain(domain, retention);
      const submittedRows = await listDischargeSessionsByDomain(domain, 'submitted', {
        limit: HISTORY_LIMIT
      });
      writeHistoryCache(domain, submittedRows);
      setHistory(submittedRows);
      setLoading(false);
      setError(null);
    },
    [domain, enabled]
  );

  const deleteHistorySession = useCallback(
    async (sessionId: string) => {
      if (!enabled) return;
      await deleteSubmittedDischargeSessionByDomain(domain, sessionId);
      const submittedRows = await listDischargeSessionsByDomain(domain, 'submitted', {
        limit: HISTORY_LIMIT
      });
      writeHistoryCache(domain, submittedRows);
      setHistory(submittedRows);
      setLoading(false);
      setError(null);
    },
    [domain, enabled]
  );

  return {
    history,
    loading,
    error,
    refresh,
    clearHistory,
    deleteHistorySession
  };
}
