import { useEffect, useMemo, useState } from 'react';
import type { Wine } from '@/domain/types';
import { ArrowDownWideNarrow, ArrowUpNarrowWide, FileText, Pencil, Trash2 } from 'lucide-react';

type Props = {
  wines: Wine[];
  loading: boolean;
  onEdit: (wine: Wine) => void;
  onDelete: (wineId: string) => void;
};

const TOTAL_COLUMNS = 11;
const BASE_ROWS = 14;
const ROW_HEIGHT_ESTIMATE = 33;
const TABLE_OFFSET = 340;
type SortKey = 'category' | 'name' | 'producer' | 'origin';
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

export function AdminArchiveTable({ wines, loading, onEdit, onDelete }: Props) {
  const [targetRows, setTargetRows] = useState(BASE_ROWS);
  const [notePreview, setNotePreview] = useState<{ wineName: string; note: string } | null>(null);
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
              : a.name ?? '';
      const bValue =
        sortState.key === 'category'
          ? b.category ?? ''
          : sortState.key === 'producer'
            ? b.producer ?? ''
            : sortState.key === 'origin'
              ? b.origin ?? ''
              : b.name ?? '';
      return aValue.localeCompare(bValue, 'it', { sensitivity: 'base' });
    });
    return sortState.dir === 'az' ? byField : byField.reverse();
  }, [sortState, wines]);

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

  const fillerRows = useMemo(() => {
    if (loading) return 0;
    return Math.max(0, targetRows - sortedWines.length);
  }, [loading, sortedWines.length, targetRows]);

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
              sortedWines.map((wine) => {
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
                  <td className="archiveColCenter">{formatMoney(wine.purchasePrice)}</td>
                  <td className="archiveColCenter">{formatMoney(wine.salePrice)}</td>
                  <td className={`archiveColCenter ${qtyClass}`}>
                    {wine.qty}
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
    </section>
  );
}
