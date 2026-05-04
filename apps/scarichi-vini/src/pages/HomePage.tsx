import { ConfirmModal } from '@/components/ConfirmModal';
import { Logo } from '@/components/Logo';
import { Toast } from '@/components/Toast';
import { ResultsList } from '@/pages/home/ResultsList';
import { SessionConfirmModal } from '@/pages/home/SessionConfirmModal';
import { StockEditorModal } from '@/pages/home/StockEditorModal';
import { SummaryList } from '@/pages/home/SummaryList';
import { useHomePage } from '@/pages/home/useHomePage';
import { RefreshCcw } from 'lucide-react';

export function HomePage({
  onIntroVisibilityChange
}: {
  onIntroVisibilityChange?: (visible: boolean) => void;
}) {
  const {
    showIntro,
    introVisible,
    online,
    pendingQueueCount,
    sessionOpen,
    sessionCount,
    query,
    setQuery,
    stockFilter,
    setStockFilter,
    visibleWines,
    getSessionQty,
    showResults,
    forceRefreshBusy,
    sessionList,
    inventory,
    incrementItem,
    decrementItem,
    deleteItem,
    addToSession,
    editingStockWine,
    editingStockQty,
    stockSaveBusy,
    setEditingStockQty,
    closeStockEditor,
    confirmStockSave,
    openStockEditor,
    confirmOpen,
    setConfirmOpen,
    leaveSessionConfirmOpen,
    toast,
    setToast,
    confirmSubmit,
    startSession,
    submitSession,
    confirmLeaveSession,
    cancelLeaveSession,
    forceRefreshHome
  } = useHomePage({ onIntroVisibilityChange });

  if (showIntro) {
    return (
      <div className="container introLayout">
        <div className={`introCenter ${introVisible ? 'introVisible' : ''}`}>
          <Logo variant="intro" />
        </div>
      </div>
    );
  }

  return (
    <div className="container homeSessionContainer">
      <div className="homeHeader">
        <Logo variant="header" />
      </div>

      {!online ? (
        <div className="banner">
          Offline: {pendingQueueCount > 0 ? `${pendingQueueCount} sessioni in coda. ` : ''}
          Le conferme verranno inviate appena torni online.
        </div>
      ) : null}

      <div className="mt12 homeSessionActionRow">
        {sessionOpen ? (
          <button
            className={`button ${sessionCount > 0 ? 'buttonSessionConfirmActive' : 'buttonSessionConfirmInactive'}`}
            type="button"
            onClick={confirmSubmit}
            disabled={sessionCount <= 0}
          >
            Conferma Scarico
          </button>
        ) : (
          <button className="button" type="button" onClick={startSession}>
            Inizia sessione di scarico
          </button>
        )}
        <button
          className="homeForceRefreshButton"
          type="button"
          aria-label="Refresh forzato app"
          title="Refresh forzato app"
          onClick={() => void forceRefreshHome()}
          disabled={forceRefreshBusy}
        >
          <RefreshCcw
            size={18}
            strokeWidth={2.2}
            className={forceRefreshBusy ? 'homeForceRefreshIconSpinning' : ''}
          />
        </button>
      </div>

      <div className="mt12 searchRow">
        <input
          className="input inputSearch inputSearchCompact"
          placeholder="Cerca vino..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button
          className={`searchStockButton searchStockButtonThreshold ${
            stockFilter === 'threshold' ? 'searchStockButtonActive' : ''
          }`}
          type="button"
          onClick={() => setStockFilter((prev) => (prev === 'threshold' ? 'all' : 'threshold'))}
          aria-pressed={stockFilter === 'threshold' ? 'true' : 'false'}
        >
          Soglia
        </button>
        <button
          className={`searchStockButton searchStockButtonOut ${
            stockFilter === 'out' ? 'searchStockButtonActive' : ''
          }`}
          type="button"
          onClick={() => setStockFilter((prev) => (prev === 'out' ? 'all' : 'out'))}
          aria-pressed={stockFilter === 'out' ? 'true' : 'false'}
        >
          Esaurito
        </button>
      </div>

      <div className={sessionOpen ? 'homeResultsArea homeResultsAreaSession' : 'homeResultsArea'}>
        {showResults ? (
          <ResultsList
            wines={visibleWines}
            sessionOpen={sessionOpen}
            interactive={sessionOpen}
            onSelectWine={!sessionOpen ? openStockEditor : undefined}
            getSessionQty={sessionOpen ? getSessionQty : undefined}
            onIncrement={sessionOpen ? (wineId) => addToSession(wineId, 1) : undefined}
            onDecrement={sessionOpen ? (wineId) => decrementItem(wineId) : undefined}
          />
        ) : null}
      </div>

      {sessionOpen ? (
        <SummaryList
          items={sessionList}
          wines={inventory}
          onIncrement={incrementItem}
          onDecrement={decrementItem}
          onDelete={deleteItem}
        />
      ) : null}

      {editingStockWine ? (
        <StockEditorModal
          wine={editingStockWine}
          qty={editingStockQty}
          busy={stockSaveBusy}
          onQtyChange={setEditingStockQty}
          onClose={closeStockEditor}
          onConfirm={() => void confirmStockSave()}
        />
      ) : null}

      <SessionConfirmModal
        open={confirmOpen}
        sessionCount={sessionCount}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => submitSession()}
      />

      <ConfirmModal
        open={leaveSessionConfirmOpen}
        title="Abbandonare sessione in corso?"
        description="Sei sicuro che vuoi abbandonare la sessione in corso?"
        confirmLabel="Conferma"
        cancelLabel="Annulla"
        onConfirm={confirmLeaveSession}
        onCancel={cancelLeaveSession}
      />

      {toast ? <Toast message={toast} onClose={() => setToast(null)} /> : null}
    </div>
  );
}
