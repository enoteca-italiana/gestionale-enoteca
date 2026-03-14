import { useCallback, useEffect, useState } from 'react';
import {
  clearDischargeSessionsByStatus,
  listDischargeSessions,
  type DischargeSessionSummary
} from '@/data/dischargeRepository';

export function useDischargeSessions() {
  const [history, setHistory] = useState<DischargeSessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const submittedRows = await listDischargeSessions('submitted');
      setHistory(submittedRows);
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

  const clearHistory = useCallback(async () => {
    await clearDischargeSessionsByStatus('submitted');
    await refresh();
  }, [refresh]);

  return {
    history,
    loading,
    error,
    refresh,
    clearHistory
  };
}
