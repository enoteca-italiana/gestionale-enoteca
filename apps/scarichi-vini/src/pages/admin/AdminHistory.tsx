import type { DischargeSessionSummary } from '@/data/dischargeRepository';
import { ConfirmModal } from '@/components/ConfirmModal';
import { useEffect, useRef, useState } from 'react';
import { RefreshCcw } from 'lucide-react';
import { sha256Base64 } from '@/pages/admin/crypto';
import { storageKeys } from '@/pages/admin/storage';
import { formatWineInfoLine } from '@/domain/formatWineInfoLine';
import {
  listSubmittedDischargeSessionItems,
  type DischargeSessionItemDetail
} from '@/data/dischargeRepository';

function formatDateTime(ts: number) {
  const d = new Date(ts);
  const dateParts = new Intl.DateTimeFormat('it-IT', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  }).formatToParts(d);
  const day = dateParts.find((part) => part.type === 'day')?.value ?? '';
  const monthRaw = dateParts.find((part) => part.type === 'month')?.value ?? '';
  const year = dateParts.find((part) => part.type === 'year')?.value ?? '';
  const formattedMonth = monthRaw ? monthRaw.charAt(0).toUpperCase() + monthRaw.slice(1) : '';
  const formattedDate = `${day} ${formattedMonth} ${year}`.trim();
  const time = d.toLocaleTimeString('it-IT', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit'
  });
  return { formattedDate, formattedTime: time };
}

function formatDateTimeLabel(ts: number) {
  const value = formatDateTime(ts);
  return `${value.formattedDate}, ${value.formattedTime}`;
}

function toLocalDateKey(ts: number) {
  const d = new Date(ts);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

type DatePreset = 'all' | 'today' | '7d' | '30d' | '90d' | '6m' | '12m' | 'ytd' | 'custom';
const HISTORY_RENDER_BATCH = 120;

function toInputDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getPresetRange(preset: DatePreset): { from: string; to: string } | null {
  if (preset === 'all' || preset === 'custom') return null;
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const start = new Date(end);
  if (preset === 'today') {
    return { from: toInputDate(start), to: toInputDate(end) };
  }
  if (preset === '7d') start.setDate(start.getDate() - 6);
  if (preset === '30d') start.setDate(start.getDate() - 29);
  if (preset === '90d') start.setDate(start.getDate() - 89);
  if (preset === '6m') start.setMonth(start.getMonth() - 6);
  if (preset === '12m') start.setMonth(start.getMonth() - 12);
  if (preset === 'ytd') start.setMonth(0, 1);
  return { from: toInputDate(start), to: toInputDate(end) };
}

export function AdminHistory({
  history,
  onReset
}: {
  history: DischargeSessionSummary[];
  onReset: () => void;
}) {
  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [confirm1, setConfirm1] = useState(false);
  const [confirm2, setConfirm2] = useState(false);
  const [resetPin, setResetPin] = useState('');
  const [resetPinError, setResetPinError] = useState<string | null>(null);
  const [resetBusy, setResetBusy] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<DischargeSessionSummary | null>(null);
  const [detailItems, setDetailItems] = useState<DischargeSessionItemDetail[]>([]);
  const [visibleCount, setVisibleCount] = useState(HISTORY_RENDER_BATCH);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const filteredHistory = history.filter((session) => {
    const sessionDate = toLocalDateKey(session.submittedAt ?? session.createdAt);
    if (dateFrom && sessionDate < dateFrom) return false;
    if (dateTo && sessionDate > dateTo) return false;
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
      onReset();
    } finally {
      setResetBusy(false);
    }
  };

  return (
    <>
      <div className="adminHistoryListSection">
        <div className="title centered adminHistoryTitle">Storico Sessioni</div>
        <div className="adminHistoryDateRangeWrap mt12">
          <div className="adminHistoryDateField">
            <label className="adminHistoryDateFilterLabel" htmlFor="admin-history-date-preset">
              Periodo
            </label>
            <select
              id="admin-history-date-preset"
              className="input adminHistoryDateFilterInput adminHistoryPresetInput"
              value={datePreset}
              onChange={(event) => {
                const nextPreset = event.target.value as DatePreset;
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
              }}
              aria-label="Periodo rapido filtri sessioni"
            >
              <option value="all">Tutto</option>
              <option value="today">Oggi</option>
              <option value="7d">Ultimi 7 giorni</option>
              <option value="30d">Ultimi 30 giorni</option>
              <option value="90d">Ultimi 90 giorni</option>
              <option value="6m">Ultimi 6 mesi</option>
              <option value="12m">Ultimi 12 mesi</option>
              <option value="ytd">Anno corrente</option>
              <option value="custom">Personalizzato</option>
            </select>
          </div>
          <div className="adminHistoryDateField">
            <label className="adminHistoryDateFilterLabel" htmlFor="admin-history-date-from">
              Da
            </label>
            <input
              id="admin-history-date-from"
              className="input adminHistoryDateFilterInput"
              type="date"
              value={dateFrom}
              onChange={(event) => {
                setDatePreset('custom');
                setDateFrom(event.target.value);
              }}
              aria-label="Data inizio filtro sessioni"
            />
          </div>
          <div className="adminHistoryDateField">
            <label className="adminHistoryDateFilterLabel" htmlFor="admin-history-date-to">
              A
            </label>
            <input
              id="admin-history-date-to"
              className="input adminHistoryDateFilterInput"
              type="date"
              value={dateTo}
              onChange={(event) => {
                setDatePreset('custom');
                setDateTo(event.target.value);
              }}
              aria-label="Data fine filtro sessioni"
            />
          </div>
          <button
            className="adminHistoryDateResetButton"
            type="button"
            aria-label="Reset filtri data"
            title="Reset filtri"
            onClick={() => {
              setDatePreset('all');
              setDateFrom('');
              setDateTo('');
            }}
            disabled={dateFrom.length === 0 && dateTo.length === 0}
          >
            <RefreshCcw size={18} strokeWidth={2.2} />
          </button>
        </div>
        <div className="list mt12">
          {filteredHistory.length === 0 ? (
            <div className="listItem centered">
              <div className="lineTitle">{history.length === 0 ? 'Nessuna sessione' : 'Nessun risultato'}</div>
              <div className="subtle mt6">
                {history.length === 0
                  ? 'Lo storico si popola dopo le conferme.'
                  : 'Nessuna sessione trovata per la data selezionata.'}
              </div>
            </div>
          ) : (
            renderedHistory.map((s) => {
              const { formattedDate, formattedTime } = formatDateTime(s.submittedAt ?? s.createdAt);
              return (
                <button
                  key={s.id}
                  className="listItem listItemButton"
                  type="button"
                  onClick={() => {
                    void openSessionDetail(s);
                  }}
                >
                  <div className="lineTitle adminHistoryDateLine">
                    <span>{formattedDate}</span>, <span className="adminHistoryTime">{formattedTime}</span>
                  </div>
                  <div className="subtle mt4">{s.itemsCount} vini • {s.totalQty} bottiglie</div>
                </button>
              );
            })
          )}
        </div>
        {hasMoreRows ? (
          <div className="centered mt12" ref={loadMoreRef}>
            <button
              className="button buttonSecondary"
              type="button"
              onClick={() => setVisibleCount((prev) => prev + HISTORY_RENDER_BATCH)}
            >
              Carica altre sessioni ({filteredHistory.length - renderedHistory.length})
            </button>
          </div>
        ) : null}
      </div>

      <div className="adminHistoryResetSpacer" />
      <div className="adminHistoryResetDock">
        <button
          className="button"
          type="button"
          onClick={() => setConfirm1(true)}
          disabled={history.length === 0}
        >
          Reset storico
        </button>
      </div>

      {detailOpen ? (
        <div className="modalOverlay" role="dialog" aria-modal="true">
          <div className="modalCard adminHistoryModalCard">
            <button
              className="adminHistoryModalClose"
              type="button"
              aria-label="Chiudi dettaglio sessione"
              onClick={closeSessionDetail}
            >
              ×
            </button>
            <div className="adminHistoryModalHeader">
              <div className="modalTitle adminHistoryModalTitle">
                {selectedSession
                  ? formatDateTimeLabel(selectedSession.submittedAt ?? selectedSession.createdAt)
                  : '-'}
              </div>
              {selectedSession ? (
                <div className="modalDescription adminHistoryModalSubtitle">
                  {selectedSession.itemsCount} vini • {selectedSession.totalQty} bottiglie
                </div>
              ) : null}
            </div>

            <div className="list mt12 adminHistoryDetailList">
              {detailLoading ? <div className="subtle">Caricamento contenuto sessione…</div> : null}

              {!detailLoading && detailError ? <div className="errorText">{detailError}</div> : null}

              {!detailLoading && !detailError && detailItems.length === 0 ? (
                <div className="subtle">Nessun dettaglio disponibile per questa sessione.</div>
              ) : null}

              {!detailLoading && !detailError && detailItems.length > 0
                ? detailItems.map((item) => (
                    <div key={`${item.sessionId}-${item.wineId}`} className="listItem">
                      <div className="min0">
                        <div className="adminHistoryDetailTopRow">
                          <div className="lineTitle">{item.wineName}</div>
                          <div className="adminHistoryDetailQty">-{item.qty}</div>
                        </div>
                        <div className="subtle mt4">
                          {formatWineInfoLine({
                            producer: item.producer,
                            year: item.age,
                            origin: item.origin
                          }) || '—'}
                        </div>
                      </div>
                    </div>
                  ))
                : null}
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmModal
        open={confirm1}
        title="Reset storico?"
        description="Questa azione cancella definitivamente tutte le sessioni in storico."
        confirmLabel="Continua"
        cancelLabel="Annulla"
        onConfirm={() => {
          setConfirm1(false);
          setResetPin('');
          setResetPinError(null);
          setConfirm2(true);
        }}
        onCancel={() => setConfirm1(false)}
      />

      {confirm2 ? (
        <div className="modalOverlay" role="dialog" aria-modal="true">
          <div className="modalCard">
            <div className="modalTitle">Conferma reset definitivo</div>
            <div className="modalDescription">
              Inserisci il PIN admin per confermare l&apos;eliminazione definitiva dello storico.
            </div>
            <div className="mt12">
              <input
                className="input adminInput"
                type="password"
                inputMode="numeric"
                placeholder="Inserisci PIN admin"
                value={resetPin}
                onChange={(e) => {
                  setResetPin(e.target.value);
                  if (resetPinError) setResetPinError(null);
                }}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') return;
                  event.preventDefault();
                  void confirmResetWithPin();
                }}
              />
            </div>
            {resetPinError ? <div className="errorText mt10">{resetPinError}</div> : null}
            <div className="modalActions">
              <button
                className="button"
                type="button"
                disabled={resetBusy || resetPin.trim().length === 0}
                onClick={() => void confirmResetWithPin()}
              >
                {resetBusy ? 'Verifica…' : 'Sì, reset definitivo'}
              </button>
              <button
                className="button buttonSecondary buttonCancel"
                type="button"
                onClick={() => {
                  if (resetBusy) return;
                  setConfirm2(false);
                  setResetPin('');
                  setResetPinError(null);
                }}
              >
                Annulla
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
