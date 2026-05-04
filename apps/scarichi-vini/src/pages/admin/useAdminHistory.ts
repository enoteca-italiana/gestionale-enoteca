import { useEffect, useRef, useState } from 'react';
import { sha256Base64 } from '@/pages/admin/crypto';
import { storageKeys } from '@/pages/admin/storage';
import {
  listSubmittedDischargeSessionItems,
  type DischargeSessionItemDetail,
  type DischargeSessionSummary,
  type SubmittedHistoryRetention
} from '@/data/dischargeRepository';
import {
  DatePreset,
  getPresetRange,
  HISTORY_RENDER_BATCH,
  toLocalDateKey
} from '@/pages/admin/historyUtils';

export function useAdminHistory({
  history,
  onReset,
  onDeleteSession
}: {
  history: DischargeSessionSummary[];
  onReset: (retention: SubmittedHistoryRetention) => void;
  onDeleteSession: (sessionId: string) => Promise<void>;
}) {
  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [confirm1, setConfirm1] = useState(false);
  const [confirm2, setConfirm2] = useState(false);
  const [resetPin, setResetPin] = useState('');
  const [resetRetention, setResetRetention] = useState<SubmittedHistoryRetention>('12m');
  const [resetPinError, setResetPinError] = useState<string | null>(null);
  const [resetBusy, setResetBusy] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<DischargeSessionSummary | null>(null);
  const [detailItems, setDetailItems] = useState<DischargeSessionItemDetail[]>([]);
  const [deleteTargetSession, setDeleteTargetSession] = useState<DischargeSessionSummary | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(HISTORY_RENDER_BATCH);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const normalizedDateFrom = dateFrom && dateTo && dateFrom > dateTo ? dateTo : dateFrom;
  const normalizedDateTo = dateFrom && dateTo && dateFrom > dateTo ? dateFrom : dateTo;
  const hasActiveDateFilter =
    datePreset !== 'all' || normalizedDateFrom.length > 0 || normalizedDateTo.length > 0;

  const filteredHistory = history.filter((session) => {
    const sessionDate = toLocalDateKey(session.submittedAt ?? session.createdAt);
    if (normalizedDateFrom && sessionDate < normalizedDateFrom) return false;
    if (normalizedDateTo && sessionDate > normalizedDateTo) return false;
    return true;
  });
  const renderedHistory = filteredHistory.slice(0, visibleCount);
  const hasMoreRows = renderedHistory.length < filteredHistory.length;

  useEffect(() => {
    setVisibleCount(HISTORY_RENDER_BATCH);
  }, [dateFrom, dateTo, datePreset, history]);

  useEffect(() => {
    if (!hasMoreRows) return;
    const target = loadMoreRef.current;
    if (!target) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisibleCount((prev) => prev + HISTORY_RENDER_BATCH);
        }
      },
      { rootMargin: '220px 0px' }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMoreRows, renderedHistory.length, filteredHistory.length]);

  const closeSessionDetail = () => {
    setDetailOpen(false);
    setSelectedSession(null);
    setDetailItems([]);
    setDetailError(null);
    setDetailLoading(false);
  };

  const openSessionDetail = async (session: DischargeSessionSummary) => {
    setSelectedSession(session);
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailError(null);
    try {
      const items = await listSubmittedDischargeSessionItems(session.id);
      setDetailItems(items);
    } catch (error) {
      console.error('[AdminHistory] load session detail failed', error);
      setDetailError('Impossibile caricare il contenuto della sessione.');
      setDetailItems([]);
    } finally {
      setDetailLoading(false);
    }
  };

  const confirmResetWithPin = async () => {
    if (resetBusy) return;
    setResetPinError(null);
    setResetBusy(true);
    try {
      const storedHash = localStorage.getItem(storageKeys.adminPasswordHash);
      if (!storedHash) {
        setResetPinError('PIN admin non disponibile');
        return;
      }
      const pinHash = await sha256Base64(resetPin.trim());
      if (pinHash !== storedHash) {
        setResetPinError('PIN non corretto');
        return;
      }
      setConfirm2(false);
      setResetPin('');
      onReset(resetRetention);
    } finally {
      setResetBusy(false);
    }
  };

  const handlePresetChange = (nextPreset: DatePreset) => {
    setDatePreset(nextPreset);
    const nextRange = getPresetRange(nextPreset);
    if (!nextRange) {
      if (nextPreset === 'all') {
        setDateFrom('');
        setDateTo('');
      }
      return;
    }
    setDateFrom(nextRange.from);
    setDateTo(nextRange.to);
  };

  const resetDateFilter = () => {
    setDatePreset('all');
    setDateFrom('');
    setDateTo('');
  };

  const requestDeleteSession = (session: DischargeSessionSummary) => {
    if (deleteBusy) return;
    setDeleteError(null);
    setDeleteTargetSession(session);
  };

  const cancelDeleteSession = () => {
    if (deleteBusy) return;
    setDeleteError(null);
    setDeleteTargetSession(null);
  };

  const confirmDeleteSession = async () => {
    if (!deleteTargetSession || deleteBusy) return;
    setDeleteError(null);
    setDeleteBusy(true);
    try {
      await onDeleteSession(deleteTargetSession.id);
      if (selectedSession?.id === deleteTargetSession.id) {
        closeSessionDetail();
      }
      setDeleteTargetSession(null);
    } catch (error) {
      console.error('[AdminHistory] delete session failed', error);
      setDeleteError('Impossibile eliminare la sessione selezionata.');
    } finally {
      setDeleteBusy(false);
    }
  };

  return {
    datePreset,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    confirm1,
    setConfirm1,
    confirm2,
    setConfirm2,
    resetPin,
    setResetPin,
    resetRetention,
    setResetRetention,
    resetPinError,
    setResetPinError,
    resetBusy,
    detailOpen,
    detailLoading,
    detailError,
    selectedSession,
    detailItems,
    deleteTargetSession,
    deleteBusy,
    deleteError,
    visibleCount,
    setVisibleCount,
    loadMoreRef,
    hasActiveDateFilter,
    filteredHistory,
    renderedHistory,
    hasMoreRows,
    closeSessionDetail,
    openSessionDetail,
    requestDeleteSession,
    cancelDeleteSession,
    confirmDeleteSession,
    confirmResetWithPin,
    handlePresetChange,
    resetDateFilter
  };
}
