import { useCallback, useEffect, useState } from 'react';
import {
  clearDischargeSessionsByStatus,
  deleteDischargeSession,
  listDischargeSessions,
  type DischargeSessionSummary
} from '@/data/dischargeRepository';

export function useDischargeSessions() {
  const [history, setHistory] = useState<DischargeSessionSummary[]>([]);
  const [pending, setPending] = useState<DischargeSessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [submittedRows, pendingRows] = await Promise.all([
        listDischargeSessions('submitted'),
        listDischargeSessions('pending')
      ]);
      setHistory(submittedRows);
      setPending(pendingRows);
    } catch (err) {
      console.error('[useDischargeSessions] refresh failed', err);
      setError('Impossibile caricare le sessioni da Supabase.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const deletePending = useCallback(
    async (id: string) => {
      await deleteDischargeSession(id);
      await refresh();
    },
    [refresh]
  );

  const clearPending = useCallback(async () => {
    await clearDischargeSessionsByStatus('pending');
    await refresh();
  }, [refresh]);

  const clearHistory = useCallback(async () => {
    await clearDischargeSessionsByStatus('submitted');
    await refresh();
  }, [refresh]);

  return {
    history,
    pending,
    loading,
    error,
    refresh,
    deletePending,
    clearPending,
    clearHistory
  };
}
