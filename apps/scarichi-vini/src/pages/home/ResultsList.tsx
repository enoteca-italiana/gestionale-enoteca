import { useEffect, useMemo, useRef, useState } from 'react';
import type { Wine } from '@/domain/types';
import { formatWineInfoLine } from '@/domain/formatWineInfoLine';

const LIST_RENDER_BATCH = 180;

export function ResultsList({
  wines,
  getSessionQty,
  getPendingNoteQty,
  onConfirmPendingNote,
  onIncrement,
  onDecrement,
  sessionOpen,
  interactive = true
}: {
  wines: Wine[];
  getSessionQty?: (wineId: string) => number;
  getPendingNoteQty?: (wineId: string) => number;
  onConfirmPendingNote?: (wineId: string, targetQty: number) => void;
  onIncrement?: (wineId: string) => void;
  onDecrement?: (wineId: string) => void;
  sessionOpen: boolean;
  interactive?: boolean;
}) {
  const showActions = interactive && sessionOpen;
  const [selectedWineId, setSelectedWineId] = useState<string | null>(null);
  const [selectedWineSnapshot, setSelectedWineSnapshot] = useState<Wine | null>(null);
  const [selectedDraftQty, setSelectedDraftQty] = useState(0);
  const [showConfirmMessage, setShowConfirmMessage] = useState(false);
  const [visibleCount, setVisibleCount] = useState(LIST_RENDER_BATCH);
  const confirmCloseTimer = useRef<number | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const winesById = useMemo(() => {
    const map = new Map<string, Wine>();
    for (const wine of wines) {
      map.set(wine.id, wine);
    }
    return map;
  }, [wines]);
  const renderedWines = useMemo(() => wines.slice(0, visibleCount), [visibleCount, wines]);
  const hasMoreRows = renderedWines.length < wines.length;
  const selectedWine = useMemo(() => {
    if (!selectedWineId) return null;
    const fromList = winesById.get(selectedWineId);
    if (fromList) return fromList;
    if (selectedWineSnapshot?.id === selectedWineId) return selectedWineSnapshot;
    return null;
  }, [selectedWineId, selectedWineSnapshot, winesById]);
  const selectedQty = selectedWineId && getSessionQty ? getSessionQty(selectedWineId) : 0;
  const selectedPendingNoteQty =
    selectedWineId && getPendingNoteQty ? getPendingNoteQty(selectedWineId) : 0;
  const selectedHasPendingNote = selectedPendingNoteQty > 0 && selectedQty <= 0;

  useEffect(() => {
    if (!selectedWineId) return;
    const latest = winesById.get(selectedWineId);
    if (!latest) return;
    setSelectedWineSnapshot(latest);
  }, [selectedWineId, winesById]);

  useEffect(() => {
    if (!selectedWineId) return;
    const wine = winesById.get(selectedWineId);
    if (!wine) return;
    if (selectedHasPendingNote) {
      const maxQty = Math.max(0, Math.round(wine.qty)) + selectedQty;
      const suggested = Math.max(0, Math.round(selectedPendingNoteQty));
      setSelectedDraftQty(Math.max(0, Math.min(maxQty, suggested)));
      return;
    }
    setSelectedDraftQty(selectedQty);
  }, [selectedHasPendingNote, selectedPendingNoteQty, selectedQty, selectedWineId, winesById]);

  useEffect(() => {
    setVisibleCount(LIST_RENDER_BATCH);
  }, [wines, interactive, sessionOpen]);

  useEffect(() => {
    return () => {
      if (confirmCloseTimer.current !== null) {
        window.clearTimeout(confirmCloseTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!hasMoreRows) return;
    const target = loadMoreRef.current;
    if (!target) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisibleCount((prev) => prev + LIST_RENDER_BATCH);
        }
      },
      { rootMargin: '180px 0px' }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMoreRows, renderedWines.length, wines.length]);

  const closeModal = () => {
    if (confirmCloseTimer.current !== null) {
      window.clearTimeout(confirmCloseTimer.current);
      confirmCloseTimer.current = null;
    }
    setShowConfirmMessage(false);
    setSelectedWineId(null);
    setSelectedWineSnapshot(null);
    setSelectedDraftQty(0);
  };

  if (!interactive) {
    return (
      <>
        <div className="mt12 consultiveList" role="list" aria-label="Lista vini consultiva">
          {renderedWines.map((w, idx) => (
            <div
              key={w.id}
              className={`consultiveRow ${idx === 0 ? 'consultiveRowFirst' : ''}`}
              role="listitem"
            >
              <div className="min0">
                <div className="consultiveTopRow">
                  <div className="lineTitle">{w.name}</div>
                  <div className={`consultiveQty ${w.qty <= 0 ? 'consultiveQtyZero' : ''}`}>
                    {w.qty}
                  </div>
                </div>
                <div className="subtle mt4">
                  {formatWineInfoLine({
                    producer: w.producer,
                    year: w.age ?? w.vintage,
                    origin: w.origin
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
        {hasMoreRows ? (
          <div className="centered mt12" ref={loadMoreRef}>
            <button
              className="button buttonSecondary"
              type="button"
              onClick={() => setVisibleCount((prev) => prev + LIST_RENDER_BATCH)}
            >
              Carica altri vini ({wines.length - renderedWines.length})
            </button>
          </div>
        ) : null}
      </>
    );
  }

  return (
    <>
      <div className="mt12 consultiveList" role="list" aria-label="Lista vini sessione">
        {renderedWines.map((w, idx) => (
          <button
            key={w.id}
            className={`consultiveRow consultiveRowButton ${idx === 0 ? 'consultiveRowFirst' : ''}`}
            type="button"
            onClick={() => {
              if (!showActions) return;
              setSelectedWineId(w.id);
              setSelectedWineSnapshot(w);
              const currentQty = getSessionQty ? getSessionQty(w.id) : 0;
              const pendingQty = getPendingNoteQty ? getPendingNoteQty(w.id) : 0;
              if (currentQty <= 0 && pendingQty > 0) {
                const maxQty = Math.max(0, Math.round(w.qty));
                setSelectedDraftQty(Math.max(0, Math.min(maxQty, Math.round(pendingQty))));
              } else {
                setSelectedDraftQty(currentQty);
              }
            }}
            disabled={!showActions}
            role="listitem"
          >
            <div className="min0">
              <div className="consultiveTopRow">
                <div className="lineTitle">{w.name}</div>
                <div className={`consultiveQty ${w.qty <= 0 ? 'consultiveQtyZero' : ''}`}>
                  {w.qty}
                </div>
              </div>
              <div className="subtle mt4">
                {formatWineInfoLine({
                  producer: w.producer,
                  year: w.age ?? w.vintage,
                  origin: w.origin
                })}
              </div>
            </div>
          </button>
        ))}
      </div>
      {hasMoreRows ? (
        <div className="centered mt12" ref={loadMoreRef}>
          <button
            className="button buttonSecondary"
            type="button"
            onClick={() => setVisibleCount((prev) => prev + LIST_RENDER_BATCH)}
          >
            Carica altri vini ({wines.length - renderedWines.length})
          </button>
        </div>
      ) : null}

      {showActions && selectedWine ? (
        <div className="modalOverlay" role="dialog" aria-modal="true">
          <div className="modalCard summaryEditModal">
            <button
              className="summaryEditClose"
              type="button"
              aria-label="Chiudi"
              onClick={closeModal}
            >
              ×
            </button>
            <div className="modalTitle centered">{selectedWine.name}</div>
            <div className="subtle centered mt6">
              Scarico: {selectedHasPendingNote ? selectedDraftQty : selectedQty}
            </div>

            <div className="summaryEditControls mt14">
              <button
                className="resultControlButton resultControlButtonSecondary"
                type="button"
                onClick={() => {
                  if (selectedHasPendingNote) {
                    setSelectedDraftQty((prev) => Math.max(0, prev - 1));
                    return;
                  }
                  onDecrement?.(selectedWine.id);
                }}
              >
                -
              </button>
              <div className="resultControlValue">
                {selectedHasPendingNote ? selectedDraftQty : selectedQty}
              </div>
              <button
                className="resultControlButton"
                type="button"
                onClick={() => {
                  if (selectedHasPendingNote) {
                    const maxQty = Math.max(0, Math.round(selectedWine.qty)) + selectedQty;
                    setSelectedDraftQty((prev) => Math.min(maxQty, prev + 1));
                    return;
                  }
                  onIncrement?.(selectedWine.id);
                }}
              >
                +
              </button>
            </div>

            <div className="summaryEditActions summaryEditActionsSingle mt14">
              <button
                className="button buttonConfirmSoft"
                type="button"
                onClick={() => {
                  if (showConfirmMessage) return;
                  if (selectedHasPendingNote) {
                    onConfirmPendingNote?.(selectedWine.id, selectedDraftQty);
                  }
                  setShowConfirmMessage(true);
                  confirmCloseTimer.current = window.setTimeout(() => {
                    setShowConfirmMessage(false);
                    setSelectedWineId(null);
                    confirmCloseTimer.current = null;
                  }, 900);
                }}
              >
                Conferma
              </button>
            </div>
            {showConfirmMessage ? (
              <div className="okText centered mt10">Scarico Aggiunto!</div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
