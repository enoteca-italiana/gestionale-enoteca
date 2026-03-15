import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Wine } from '@/domain/types';
import { ConfirmModal } from '@/components/ConfirmModal';
import { ArrowDownWideNarrow, ArrowUpNarrowWide, FileText, Pencil, Trash2 } from 'lucide-react';

type Props = {
  wines: Wine[];
  loading: boolean;
  onEdit: (wine: Wine) => void;
  onDelete: (wineId: string) => void;
  onUpdateQty: (wine: Wine, nextQty: number) => Promise<boolean>;
};

const TOTAL_COLUMNS = 12;
const BASE_ROWS = 14;
const ROW_HEIGHT_ESTIMATE = 33;
const TABLE_OFFSET = 340;
const TABLE_RENDER_BATCH = 300;
const TABLE_SORT_COLLATOR = new Intl.Collator('it', { sensitivity: 'base' });
type SortKey = 'category' | 'name' | 'producer' | 'origin' | 'supplier';
type SortDir = 'az' | 'za';

function formatMoney(value?: number) {
  if (value === undefined || value === null || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(value);
}

function formatText(value?: string) {
  return value && value.trim().length > 0 ? value : '—';
}

function formatYear(value?: string) {
  if (!value) return '';
  const normalized = value.trim();
  if (!normalized) return '';
  if (normalized.toUpperCase() === 'NV') return '';
  return normalized;
}

function computeWarehouse(wine: Wine) {
  if (wine.purchasePrice === undefined) return undefined;
  return Number((wine.purchasePrice * Math.max(0, wine.qty)).toFixed(2));
}

function computeMargin(wine: Wine) {
  if (wine.purchasePrice === undefined || wine.salePrice === undefined) return undefined;
  return Number((wine.salePrice - wine.purchasePrice).toFixed(2));
}

export function AdminArchiveTable({ wines, loading, onEdit, onDelete, onUpdateQty }: Props) {
  const qtyInlineBoxRef = useRef<HTMLDivElement | null>(null);
  const [targetRows, setTargetRows] = useState(BASE_ROWS);
  const [notePreview, setNotePreview] = useState<{ wineName: string; note: string } | null>(null);
  const [editingQtyWineId, setEditingQtyWineId] = useState<string | null>(null);
  const [editingQtyValue, setEditingQtyValue] = useState<string>('');
  const [savingQtyWineId, setSavingQtyWineId] = useState<string | null>(null);
  const [visibleRows, setVisibleRows] = useState(TABLE_RENDER_BATCH);
  const [qtyConfirmModal, setQtyConfirmModal] = useState<{
    wine: Wine;
    currentQty: number;
    nextQty: number;
  } | null>(null);
  const [sortState, setSortState] = useState<{ key: SortKey; dir: SortDir }>({
    key: 'name',
    dir: 'az'
  });

  const sortedWines = useMemo(() => {
    const byField = [...wines].sort((a, b) => {
      const aValue =
        sortState.key === 'category'
          ? a.category ?? ''
          : sortState.key === 'producer'
            ? a.producer ?? ''
            : sortState.key === 'origin'
              ? a.origin ?? ''
              : sortState.key === 'supplier'
                ? a.supplier ?? ''
              : a.name ?? '';
      const bValue =
        sortState.key === 'category'
          ? b.category ?? ''
          : sortState.key === 'producer'
            ? b.producer ?? ''
            : sortState.key === 'origin'
              ? b.origin ?? ''
              : sortState.key === 'supplier'
                ? b.supplier ?? ''
              : b.name ?? '';
      return TABLE_SORT_COLLATOR.compare(aValue, bValue);
    });
    return sortState.dir === 'az' ? byField : byField.reverse();
  }, [sortState, wines]);
  const renderedWines = useMemo(
    () => sortedWines.slice(0, Math.max(TABLE_RENDER_BATCH, visibleRows)),
    [sortedWines, visibleRows]
  );
  const hasMoreRows = renderedWines.length < sortedWines.length;

  const toggleSort = (key: SortKey) => {
    setSortState((prev) => {
      if (prev.key === key) {
        return { key, dir: prev.dir === 'az' ? 'za' : 'az' };
      }
      return { key, dir: 'az' };
    });
  };

  const getSortAriaLabel = (key: SortKey) => {
    if (sortState.key !== key || sortState.dir === 'az') return 'Ordina da Z a A';
    return 'Ordina da A a Z';
  };

  useEffect(() => {
    const computeTargetRows = () => {
      const availableHeight = window.innerHeight - TABLE_OFFSET;
      const dynamicRows = Math.floor(availableHeight / ROW_HEIGHT_ESTIMATE);
      setTargetRows(Math.max(BASE_ROWS, dynamicRows));
    };

    computeTargetRows();
    window.addEventListener('resize', computeTargetRows);
    return () => window.removeEventListener('resize', computeTargetRows);
  }, []);

  useEffect(() => {
    setVisibleRows(TABLE_RENDER_BATCH);
  }, [loading, sortState, wines]);

  const fillerRows = useMemo(() => {
    if (loading) return 0;
    return Math.max(0, targetRows - renderedWines.length);
  }, [loading, renderedWines.length, targetRows]);

  const beginQtyEdit = (wine: Wine) => {
    if (savingQtyWineId) return;
    setEditingQtyWineId(wine.id);
    setEditingQtyValue(String(Math.max(0, Math.min(99, Math.round(wine.qty)))));
  };

  const cancelQtyEdit = useCallback(() => {
    if (savingQtyWineId) return;
    setEditingQtyWineId(null);
    setEditingQtyValue('');
  }, [savingQtyWineId]);

  useEffect(() => {
    if (!editingQtyWineId) return;
    if (qtyConfirmModal) return;

    const handlePointerDownOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (qtyInlineBoxRef.current?.contains(target)) return;
      cancelQtyEdit();
    };

    document.addEventListener('mousedown', handlePointerDownOutside);
    document.addEventListener('touchstart', handlePointerDownOutside, { passive: true });
    return () => {
      document.removeEventListener('mousedown', handlePointerDownOutside);
      document.removeEventListener('touchstart', handlePointerDownOutside);
    };
  }, [cancelQtyEdit, editingQtyWineId, qtyConfirmModal]);

  const requestQtyEditConfirm = (wine: Wine) => {
    if (savingQtyWineId) return;
    const parsed = Number(editingQtyValue);
    if (!Number.isFinite(parsed)) return;
    const nextQty = Math.max(0, Math.min(99, Math.round(parsed)));
    const currentQty = Math.max(0, Math.min(99, Math.round(wine.qty)));
    if (nextQty === currentQty) {
      cancelQtyEdit();
      return;
    }
    setQtyConfirmModal({ wine, currentQty, nextQty });
  };

  const confirmQtyEdit = async () => {
    if (!qtyConfirmModal) return;
    const { wine, nextQty } = qtyConfirmModal;

    setSavingQtyWineId(wine.id);
    const updated = await onUpdateQty(wine, nextQty);
    setSavingQtyWineId(null);
    setQtyConfirmModal(null);
    if (updated) {
      setEditingQtyWineId(null);
      setEditingQtyValue('');
    }
  };

  return (
    <section className="archiveTableSection">
      <div className="archiveTableWrap">
        <table className="archiveTable">
          <thead>
            <tr>
              <th>
                <div className="archiveSortableHeaderCell">
                  <span>CATEGORIA</span>
                  <button
                    className="archiveSortButton"
                    type="button"
                    onClick={() => toggleSort('category')}
                    aria-label={getSortAriaLabel('category')}
                    title={
                      sortState.key === 'category' && sortState.dir === 'za'
                        ? 'Ordine Z-A'
                        : 'Ordine A-Z'
                    }
                  >
                    {sortState.key === 'category' && sortState.dir === 'za' ? (
                      <ArrowDownWideNarrow size={14} strokeWidth={1.8} />
                    ) : (
                      <ArrowUpNarrowWide size={14} strokeWidth={1.8} />
                    )}
                  </button>
                </div>
              </th>
              <th>
                <div className="archiveSortableHeaderCell">
                  <span>NOME</span>
                  <button
                    className="archiveSortButton"
                    type="button"
                    onClick={() => toggleSort('name')}
                    aria-label={getSortAriaLabel('name')}
                    title={
                      sortState.key === 'name' && sortState.dir === 'za'
                        ? 'Ordine Z-A'
                        : 'Ordine A-Z'
                    }
                  >
                    {sortState.key === 'name' && sortState.dir === 'za' ? (
                      <ArrowDownWideNarrow size={14} strokeWidth={1.8} />
                    ) : (
                      <ArrowUpNarrowWide size={14} strokeWidth={1.8} />
                    )}
                  </button>
                </div>
              </th>
              <th className="archiveColCenter">ANNO</th>
              <th>
                <div className="archiveSortableHeaderCell">
                  <span>PRODUTTORE</span>
                  <button
                    className="archiveSortButton"
                    type="button"
                    onClick={() => toggleSort('producer')}
                    aria-label={getSortAriaLabel('producer')}
                    title={
                      sortState.key === 'producer' && sortState.dir === 'za'
                        ? 'Ordine Z-A'
                        : 'Ordine A-Z'
                    }
                  >
                    {sortState.key === 'producer' && sortState.dir === 'za' ? (
                      <ArrowDownWideNarrow size={14} strokeWidth={1.8} />
                    ) : (
                      <ArrowUpNarrowWide size={14} strokeWidth={1.8} />
                    )}
                  </button>
                </div>
              </th>
              <th>
                <div className="archiveSortableHeaderCell">
                  <span>PROVENIENZA</span>
                  <button
                    className="archiveSortButton"
                    type="button"
                    onClick={() => toggleSort('origin')}
                    aria-label={getSortAriaLabel('origin')}
                    title={
                      sortState.key === 'origin' && sortState.dir === 'za'
                        ? 'Ordine Z-A'
                        : 'Ordine A-Z'
                    }
                  >
                    {sortState.key === 'origin' && sortState.dir === 'za' ? (
                      <ArrowDownWideNarrow size={14} strokeWidth={1.8} />
                    ) : (
                      <ArrowUpNarrowWide size={14} strokeWidth={1.8} />
                    )}
                  </button>
                </div>
              </th>
              <th>
                <div className="archiveSortableHeaderCell">
                  <span>FORNITORE</span>
                  <button
                    className="archiveSortButton"
                    type="button"
                    onClick={() => toggleSort('supplier')}
                    aria-label={getSortAriaLabel('supplier')}
                    title={
                      sortState.key === 'supplier' && sortState.dir === 'za'
                        ? 'Ordine Z-A'
                        : 'Ordine A-Z'
                    }
                  >
                    {sortState.key === 'supplier' && sortState.dir === 'za' ? (
                      <ArrowDownWideNarrow size={14} strokeWidth={1.8} />
                    ) : (
                      <ArrowUpNarrowWide size={14} strokeWidth={1.8} />
                    )}
                  </button>
                </div>
              </th>
              <th>Acquisto</th>
              <th>Vendita</th>
              <th>Q.tà</th>
              <th>Magazzino</th>
              <th>Margine</th>
              <th>Azioni</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={TOTAL_COLUMNS} className="archiveTableEmptyCell">
                  Caricamento…
                </td>
              </tr>
            ) : sortedWines.length === 0 ? (
              <tr>
                <td colSpan={TOTAL_COLUMNS} className="archiveTableEmptyCell">
                  Nessun vino trovato con i filtri attivi.
                </td>
              </tr>
            ) : (
              renderedWines.map((wine) => {
                const qty = Number(wine.qty);
                const isZeroQty = Number.isFinite(qty) && qty === 0;
                const threshold = Number(wine.threshold);
                const isInThreshold =
                  Number.isFinite(qty) &&
                  qty > 0 &&
                  Number.isFinite(threshold) &&
                  threshold >= 1 &&
                  qty <= threshold;
                const note = wine.notes?.trim() ?? '';
                const hasNote = note.length > 0;
                const qtyClass = isZeroQty
                  ? 'archiveQtyZero'
                  : isInThreshold
                    ? 'archiveQtyThreshold'
                    : 'archiveQtyValue';

                return (
                <tr key={wine.id}>
                  <td>{formatText(wine.category)}</td>
                  <td className="archiveTableName">{wine.name}</td>
                  <td className="archiveColCenter">{formatYear(wine.age)}</td>
                  <td>{wine.producer}</td>
                  <td>{wine.origin}</td>
                  <td>{formatText(wine.supplier)}</td>
                  <td className="archiveColCenter">{formatMoney(wine.purchasePrice)}</td>
                  <td className="archiveColCenter">{formatMoney(wine.salePrice)}</td>
                  <td className={`archiveColCenter ${qtyClass}`}>
                    {editingQtyWineId === wine.id ? (
                      <div className="archiveQtyInlineBox" ref={qtyInlineBoxRef}>
                        <input
                          className="archiveQtyInlineInput"
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={editingQtyValue}
                          onChange={(e) => {
                            const onlyDigits = e.target.value.replace(/\D/g, '').slice(0, 2);
                            setEditingQtyValue(onlyDigits);
                          }}
                          onKeyDown={(e) => {
                            if (
                              e.key.length === 1 &&
                              !/[0-9]/.test(e.key) &&
                              !e.ctrlKey &&
                              !e.metaKey &&
                              !e.altKey
                            ) {
                              e.preventDefault();
                            }
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              requestQtyEditConfirm(wine);
                            }
                            if (e.key === 'Escape') {
                              e.preventDefault();
                              cancelQtyEdit();
                            }
                          }}
                          aria-label={`Modifica quantità ${wine.name}`}
                          disabled={savingQtyWineId === wine.id}
                          autoFocus
                        />
                      </div>
                    ) : (
                      <button
                        className="archiveQtyValueButton"
                        type="button"
                        onClick={() => beginQtyEdit(wine)}
                        aria-label={`Modifica quantità di ${wine.name}`}
                      >
                        {wine.qty}
                      </button>
                    )}
                  </td>
                  <td className="archiveColCenter">{formatMoney(computeWarehouse(wine))}</td>
                  <td className="archiveColCenter">{formatMoney(computeMargin(wine))}</td>
                  <td className="archiveColCenter">
                    <div className="archiveRowActions">
                      <button
                        className={`archiveIconAction archiveIconNote ${
                          hasNote ? 'archiveIconNoteActive' : 'archiveIconNoteInactive'
                        }`}
                        type="button"
                        onClick={() => {
                          if (!hasNote) return;
                          setNotePreview({ wineName: wine.name, note });
                        }}
                        aria-label={hasNote ? `Visualizza note di ${wine.name}` : 'Nessuna nota'}
                        disabled={!hasNote}
                      >
                        <FileText size={18} strokeWidth={1.4} />
                      </button>
                      <button
                        className="archiveIconAction"
                        type="button"
                        onClick={() => onEdit(wine)}
                        aria-label="Modifica vino"
                      >
                        <Pencil size={18} strokeWidth={1.4} />
                      </button>
                      <button
                        className="archiveIconAction archiveIconDanger"
                        type="button"
                        onClick={() => onDelete(wine.id)}
                        aria-label="Elimina vino"
                      >
                        <Trash2 size={18} strokeWidth={1.4} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
              })
            )}
            {hasMoreRows ? (
              <tr>
                <td colSpan={TOTAL_COLUMNS} className="archiveTableEmptyCell">
                  <button
                    className="button buttonSecondary archiveLoadMoreButton"
                    type="button"
                    onClick={() => setVisibleRows((prev) => prev + TABLE_RENDER_BATCH)}
                  >
                    Carica altre righe ({sortedWines.length - renderedWines.length})
                  </button>
                </td>
              </tr>
            ) : null}
            {Array.from({ length: fillerRows }).map((_, idx) => (
              <tr key={`empty-${idx}`} className="archiveEmptyRow" aria-hidden="true">
                {Array.from({ length: TOTAL_COLUMNS }).map((__, colIdx) => (
                  <td key={`empty-${idx}-${colIdx}`}>&nbsp;</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {notePreview ? (
        <div className="modalOverlay" role="dialog" aria-modal="true" aria-label="Note vino">
          <div className="modalCard archiveNoteModalCard">
            <div className="modalTitle">Note — {notePreview.wineName}</div>
            <div className="modalDescription archiveNoteModalText">{notePreview.note}</div>
            <div className="modalActions">
              <button className="button" type="button" onClick={() => setNotePreview(null)}>
                Chiudi
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <ConfirmModal
        open={qtyConfirmModal !== null}
        title="Confermare modifica quantità?"
        description={
          qtyConfirmModal
            ? `Vuoi aggiornare "${qtyConfirmModal.wine.name}" da ${qtyConfirmModal.currentQty} a ${qtyConfirmModal.nextQty}?`
            : undefined
        }
        confirmLabel={savingQtyWineId ? 'Confermo…' : 'Conferma'}
        cancelLabel="Annulla modifica"
        onConfirm={() => void confirmQtyEdit()}
        onCancel={() => {
          setQtyConfirmModal(null);
          cancelQtyEdit();
        }}
      />
    </section>
  );
}
