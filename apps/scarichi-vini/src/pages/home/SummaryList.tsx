import { useEffect, useMemo, useState } from 'react';
import type { SessionItem, Wine } from '@/domain/types';
import { ConfirmModal } from '@/components/ConfirmModal';
import { ChevronDown } from 'lucide-react';
import { formatWineInfoLine } from '@/domain/formatWineInfoLine';

export function SummaryList({
  items,
  wines,
  onIncrement,
  onDecrement,
  onDelete
}: {
  items: SessionItem[];
  wines: Wine[];
  onIncrement: (wineId: string) => void;
  onDecrement: (wineId: string) => void;
  onDelete: (wineId: string) => void;
}) {
  const [selectedWineId, setSelectedWineId] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const winesById = useMemo(() => {
    const map = new Map<string, Wine>();
    for (const wine of wines) {
      map.set(wine.id, wine);
    }
    return map;
  }, [wines]);

  const selectedItem = useMemo(
    () => (selectedWineId ? (items.find((item) => item.wineId === selectedWineId) ?? null) : null),
    [items, selectedWineId]
  );
  const selectedWine = useMemo(
    () => (selectedWineId ? (winesById.get(selectedWineId) ?? null) : null),
    [selectedWineId, winesById]
  );

  useEffect(() => {
    if (!selectedWineId) return;
    const stillPresent = items.some((item) => item.wineId === selectedWineId && item.qty > 0);
    if (!stillPresent) {
      setSelectedWineId(null);
      setConfirmDeleteOpen(false);
    }
  }, [items, selectedWineId]);

  const handleDecrement = () => {
    if (!selectedItem) return;
    onDecrement(selectedItem.wineId);
    if (selectedItem.qty <= 1) {
      setSelectedWineId(null);
    }
  };

  const handleDelete = () => {
    if (!selectedItem) return;
    onDelete(selectedItem.wineId);
    setConfirmDeleteOpen(false);
    setSelectedWineId(null);
  };

  const toggleOpen = () => {
    setIsOpen((prev) => {
      const next = !prev;
      if (!next) {
        setSelectedWineId(null);
        setConfirmDeleteOpen(false);
      }
      return next;
    });
  };

  return (
    <>
      <div className="card summaryDock">
        <button
          className="summaryToggle"
          type="button"
          onClick={toggleOpen}
          aria-expanded={isOpen ? 'true' : 'false'}
        >
          <div className="summaryToggleMain">
            <div className="summaryToggleLead" aria-hidden="true" />
            <div className="sectionTitle summaryToggleTitle">Riepilogo</div>
            <div
              className={`summaryToggleArrow ${isOpen ? 'summaryToggleArrowOpen' : ''}`}
              aria-hidden="true"
            >
              <ChevronDown size={22} strokeWidth={2} />
            </div>
          </div>
        </button>

        {isOpen ? (
          <>
            <div className="list mt12">
              {items.length === 0 ? (
                <div className="listItem centered">
                  <div className="lineTitle">Nessun vino</div>
                  <div className="subtle mt6">Aggiungi scarichi dai risultati.</div>
                </div>
              ) : (
                items.map((i) => {
                  const wine = winesById.get(i.wineId);
                  if (!wine) return null;
                  return (
                    <button
                      key={i.wineId}
                      className="summaryItemButton"
                      type="button"
                      onClick={() => setSelectedWineId(i.wineId)}
                    >
                      <div className="row">
                        <div className="min0">
                          <div className="lineTitle">{wine.name}</div>
                          <div className="subtle mt4">
                            {formatWineInfoLine({
                              producer: wine.producer,
                              year: wine.age ?? wine.vintage,
                              origin: wine.origin
                            })}
                          </div>
                        </div>
                        <div className="pill summaryQtyPill">-{i.qty}</div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </>
        ) : null}
      </div>
      <div
        className={`summaryDockSpacer ${isOpen ? '' : 'summaryDockSpacerCollapsed'}`}
        aria-hidden="true"
      />

      {isOpen && selectedItem && selectedWine ? (
        <div className="modalOverlay" role="dialog" aria-modal="true">
          <div className="modalCard summaryEditModal">
            <button
              className="summaryEditClose"
              type="button"
              aria-label="Chiudi"
              onClick={() => setSelectedWineId(null)}
            >
              ×
            </button>
            <div className="modalTitle centered">{selectedWine.name}</div>
            <div className="subtle centered mt6">Scarico: {selectedItem.qty}</div>

            <div className="summaryEditControls mt14">
              <button
                className="resultControlButton resultControlButtonSecondary"
                type="button"
                onClick={handleDecrement}
              >
                -
              </button>
              <div className="resultControlValue">{selectedItem.qty}</div>
              <button
                className="resultControlButton"
                type="button"
                onClick={() => onIncrement(selectedItem.wineId)}
              >
                +
              </button>
            </div>

            <div className="summaryEditActions mt14">
              <button
                className="button buttonDangerSoft"
                type="button"
                onClick={() => setConfirmDeleteOpen(true)}
              >
                Elimina
              </button>
              <button
                className="button buttonConfirmSoft"
                type="button"
                onClick={() => setSelectedWineId(null)}
              >
                Conferma
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmModal
        open={confirmDeleteOpen}
        title="Eliminare vino dal riepilogo?"
        description="Il vino verrà rimosso dal riepilogo della sessione."
        confirmLabel="Sì, elimina"
        cancelLabel="Annulla"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDeleteOpen(false)}
      />
    </>
  );
}
