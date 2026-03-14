import type { DischargeSessionSummary } from '@/data/dischargeRepository';
import { ConfirmModal } from '@/components/ConfirmModal';
import { useState } from 'react';
import { sha256Base64 } from '@/pages/admin/crypto';
import { storageKeys } from '@/pages/admin/storage';
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

export function AdminHistory({
  history,
  onReset
}: {
  history: DischargeSessionSummary[];
  onReset: () => void;
}) {
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
        <div className="title">Storico Sessioni</div>
        <div className="list mt12">
          {history.length === 0 ? (
            <div className="listItem centered">
              <div className="lineTitle">Nessuna sessione</div>
              <div className="subtle mt6">Lo storico si popola dopo le conferme.</div>
            </div>
          ) : (
            history.map((s) => {
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
            <div className="row">
              <div className="min0">
                <div className="modalTitle">
                  {selectedSession
                    ? formatDateTimeLabel(selectedSession.submittedAt ?? selectedSession.createdAt)
                    : '-'}
                </div>
                {selectedSession ? (
                  <div className="modalDescription">
                    {selectedSession.itemsCount} vini • {selectedSession.totalQty} bottiglie
                    {selectedSession.userLabel ? ` • ${selectedSession.userLabel}` : ''}
                  </div>
                ) : null}
              </div>
              <button
                className="button buttonSecondary buttonAuto"
                type="button"
                onClick={() => {
                  setDetailOpen(false);
                  setSelectedSession(null);
                  setDetailItems([]);
                  setDetailError(null);
                  setDetailLoading(false);
                }}
              >
                Chiudi
              </button>
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
                      <div className="row">
                        <div className="min0">
                          <div className="lineTitle">{item.wineName}</div>
                          <div className="subtle mt4">
                            {[item.producer, item.origin].filter(Boolean).join(' • ') || '—'}
                          </div>
                        </div>
                        <div className="pill">-{item.qty}</div>
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
