import type {
  DischargeSessionSummary,
  SubmittedHistoryRetention
} from '@/data/dischargeRepository';
import { ConfirmModal } from '@/components/ConfirmModal';
import { RefreshCcw, Trash2 } from 'lucide-react';
import { formatDateTime, formatDateTimeLabel } from '@/pages/admin/historyUtils';
import { formatWineInfoLine } from '@/domain/formatWineInfoLine';
import { useAdminHistory } from '@/pages/admin/useAdminHistory';
import { HISTORY_RENDER_BATCH } from '@/pages/admin/historyUtils';
import { useAppDomain } from '@/app/appDomain';

export function AdminHistory({
  history,
  onReset,
  onDeleteSession
}: {
  history: DischargeSessionSummary[];
  onReset: (retention: SubmittedHistoryRetention) => void;
  onDeleteSession: (sessionId: string) => Promise<void>;
}) {
  const { activeDomain, setActiveDomain } = useAppDomain();
  const {
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
  } = useAdminHistory({ history, onReset, onDeleteSession });

  return (
    <>
      <div className="adminHistoryListSection">
        <div className="adminHistoryHeaderRow">
          <div className="title centered adminHistoryTitle">Storico Sessioni</div>
          <div className="adminHistoryDomainSwitch" role="group" aria-label="Seleziona modalità">
            <button
              type="button"
              className={`adminHistoryDomainSwitchButton ${
                activeDomain === 'wine' ? 'adminHistoryDomainSwitchButtonActive' : ''
              }`}
              onClick={() => setActiveDomain('wine')}
              aria-pressed={activeDomain === 'wine'}
            >
              Vini
            </button>
            <button
              type="button"
              className={`adminHistoryDomainSwitchButton ${
                activeDomain === 'spirits' ? 'adminHistoryDomainSwitchButtonActive' : ''
              }`}
              onClick={() => setActiveDomain('spirits')}
              aria-pressed={activeDomain === 'spirits'}
            >
              Spirits
            </button>
          </div>
        </div>
        <div className="adminHistoryDateRangeWrap mt12">
          <div className="adminHistoryDateField">
            <label className="adminHistoryDateFilterLabel" htmlFor="admin-history-date-preset">
              {' '}
            </label>
            <select
              id="admin-history-date-preset"
              className="input adminHistoryDateFilterInput adminHistoryPresetInput"
              value={datePreset}
              onChange={(event) => handlePresetChange(event.target.value as typeof datePreset)}
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
                handlePresetChange('custom');
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
                handlePresetChange('custom');
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
            onClick={resetDateFilter}
            disabled={!hasActiveDateFilter}
          >
            <RefreshCcw size={18} strokeWidth={2.2} />
          </button>
        </div>
        <div className="adminHistoryCardsScroll mt12">
          <div className="list">
            {filteredHistory.length === 0 ? (
              <div className="listItem centered">
                <div className="lineTitle">
                  {history.length === 0 ? 'Nessuna sessione' : 'Nessun risultato'}
                </div>
                <div className="subtle mt6">
                  {history.length === 0
                    ? 'Lo storico si popola dopo le conferme.'
                    : 'Nessuna sessione trovata per la data selezionata.'}
                </div>
              </div>
            ) : (
              renderedHistory.map((s) => {
                const { formattedDate, formattedTime } = formatDateTime(
                  s.submittedAt ?? s.createdAt
                );
                return (
                  <div
                    key={s.id}
                    className="listItem listItemButton adminHistoryCardButton"
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      void openSessionDetail(s);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        void openSessionDetail(s);
                      }
                    }}
                  >
                    <div className="adminHistoryCardContent">
                      <div className="lineTitle adminHistoryDateLine">
                        <span>{formattedDate}</span>,{' '}
                        <span className="adminHistoryTime">{formattedTime}</span>
                      </div>
                      <div className="subtle mt4">
                        {s.itemsCount} vini • {s.totalQty} bottiglie
                      </div>
                    </div>
                    <button
                      className="adminHistoryDeleteIconButton"
                      type="button"
                      aria-label={`Elimina sessione ${formattedDate} ${formattedTime}`}
                      title="Elimina sessione"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        requestDeleteSession(s);
                      }}
                    >
                      <Trash2 size={16} strokeWidth={2} />
                    </button>
                  </div>
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

              {!detailLoading && detailError ? (
                <div className="errorText">{detailError}</div>
              ) : null}

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
        open={deleteTargetSession !== null}
        title="Eliminare questa sessione?"
        description={
          deleteTargetSession
            ? `La sessione del ${formatDateTimeLabel(
                deleteTargetSession.submittedAt ?? deleteTargetSession.createdAt
              )} verrà eliminata definitivamente dallo storico.`
            : undefined
        }
        titleCentered
        descriptionCentered
        confirmLabel={deleteBusy ? 'Elimino…' : 'Elimina'}
        cancelLabel="Annulla"
        onConfirm={() => void confirmDeleteSession()}
        onCancel={cancelDeleteSession}
      />

      {deleteError ? <div className="errorText centered mt10">{deleteError}</div> : null}

      <ConfirmModal
        open={confirm1}
        title="Reset storico?"
        description="Scegli nel passaggio successivo quanto storico mantenere."
        titleCentered
        descriptionCentered
        confirmLabel="Continua"
        cancelLabel="Annulla"
        onConfirm={() => {
          setConfirm1(false);
          setResetPin('');
          setResetPinError(null);
          setResetRetention('12m');
          setConfirm2(true);
        }}
        onCancel={() => setConfirm1(false)}
      />

      {confirm2 ? (
        <div className="modalOverlay" role="dialog" aria-modal="true">
          <div className="modalCard">
            <div className="modalTitle centered">Conferma reset definitivo</div>
            <div className="modalDescription centered">
              Seleziona quanto storico mantenere e
              <br />
              inserisci il PIN admin per confermare.
            </div>
            <div className="mt12 adminHistoryDateField adminHistoryResetRetentionRow">
              <label
                className="adminHistoryDateFilterLabel adminHistoryResetRetentionLabel"
                htmlFor="admin-history-reset-retention"
              >
                Mantieni storico
              </label>
              <select
                id="admin-history-reset-retention"
                className="input adminHistoryDateFilterInput adminHistoryPresetInput adminHistoryResetRetentionInput mt6"
                value={resetRetention}
                onChange={(event) => {
                  setResetRetention(event.target.value as SubmittedHistoryRetention);
                }}
                aria-label="Seleziona periodo storico da mantenere"
              >
                <option value="all">Niente (cancella tutto)</option>
                <option value="7d">Ultimi 7 giorni</option>
                <option value="30d">Ultimi 30 giorni</option>
                <option value="3m">Ultimi 3 mesi</option>
                <option value="12m">Ultimi 12 mesi</option>
                <option value="18m">Ultimi 18 mesi</option>
                <option value="2y">Ultimi 2 anni</option>
                <option value="3y">Ultimi 3 anni</option>
              </select>
            </div>
            <div className="mt12">
              <input
                className="input adminInput adminHistoryResetPinInput"
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
                  setResetRetention('12m');
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
