import { useEffect, useMemo, useRef, useState } from 'react';
import type { Wine } from '@/domain/types';
import { formatWineInfoLine } from '@/domain/formatWineInfoLine';

export function ResultsList({
  wines,
  getSessionQty,
  onIncrement,
  onDecrement,
  sessionOpen,
  interactive = true
}: {
  wines: Wine[];
  getSessionQty?: (wineId: string) => number;
  onIncrement?: (wineId: string) => void;
  onDecrement?: (wineId: string) => void;
  sessionOpen: boolean;
  interactive?: boolean;
}) {
  const showActions = interactive && sessionOpen;
  const [selectedWineId, setSelectedWineId] = useState<string | null>(null);
  const [selectedWineSnapshot, setSelectedWineSnapshot] = useState<Wine | null>(null);
  const [showConfirmMessage, setShowConfirmMessage] = useState(false);
  const confirmCloseTimer = useRef<number | null>(null);
  const selectedWine = useMemo(() => {
    if (!selectedWineId) return null;
    const fromList = wines.find((wine) => wine.id === selectedWineId);
    if (fromList) return fromList;
    if (selectedWineSnapshot?.id === selectedWineId) return selectedWineSnapshot;
    return null;
  }, [selectedWineId, selectedWineSnapshot, wines]);
  const selectedQty = selectedWineId && getSessionQty ? getSessionQty(selectedWineId) : 0;

  useEffect(() => {
    if (!selectedWineId) return;
    const latest = wines.find((wine) => wine.id === selectedWineId);
    if (!latest) return;
    setSelectedWineSnapshot(latest);
  }, [selectedWineId, wines]);

  useEffect(() => {
    return () => {
      if (confirmCloseTimer.current !== null) {
        window.clearTimeout(confirmCloseTimer.current);
      }
    };
  }, []);

  const closeModal = () => {
    if (confirmCloseTimer.current !== null) {
      window.clearTimeout(confirmCloseTimer.current);
      confirmCloseTimer.current = null;
    }
    setShowConfirmMessage(false);
    setSelectedWineId(null);
    setSelectedWineSnapshot(null);
  };

  if (!interactive) {
    return (
      <div className="mt12 consultiveList" role="list" aria-label="Lista vini consultiva">
        {wines.map((w, idx) => (
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
    );
  }

  return (
    <>
      <div className="mt12 consultiveList" role="list" aria-label="Lista vini sessione">
        {wines.map((w, idx) => (
          <button
            key={w.id}
            className={`consultiveRow consultiveRowButton ${idx === 0 ? 'consultiveRowFirst' : ''}`}
            type="button"
            onClick={() => {
              if (!showActions) return;
              setSelectedWineId(w.id);
              setSelectedWineSnapshot(w);
            }}
            disabled={!showActions}
            role="listitem"
          >
            <div className="min0">
              <div className="consultiveTopRow">
                <div className="lineTitle">{w.name}</div>
                <div className={`consultiveQty ${w.qty <= 0 ? 'consultiveQtyZero' : ''}`}>{w.qty}</div>
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
            <div className="subtle centered mt6">Scarico: {selectedQty}</div>

            <div className="summaryEditControls mt14">
              <button
                className="resultControlButton resultControlButtonSecondary"
                type="button"
                onClick={() => {
                  onDecrement?.(selectedWine.id);
                }}
              >
                -
              </button>
              <div className="resultControlValue">{selectedQty}</div>
              <button className="resultControlButton" type="button" onClick={() => onIncrement?.(selectedWine.id)}>
                +
              </button>
            </div>

            <div className="summaryEditActions summaryEditActionsSingle mt14">
              <button
                className="button buttonConfirmSoft"
                type="button"
                onClick={() => {
                  if (showConfirmMessage) return;
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
            {showConfirmMessage ? <div className="okText centered mt10">Scarico Aggiunto!</div> : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
