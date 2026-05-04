import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import type { Wine } from '@/domain/types';
import { ConfirmModal } from '@/components/ConfirmModal';
import { FileText, Pencil, Trash2 } from 'lucide-react';
import { InlineStickyAddSelect } from './InlineStickyAddSelect';
import {
  BASE_ROWS,
  computeMargin,
  computeWarehouse,
  DEFAULT_SORT_STATE,
  formatMoney,
  formatText,
  formatYear,
  hasTextValue,
  normalizePriceInput,
  ROW_HEIGHT_ESTIMATE,
  TABLE_OFFSET,
  TABLE_RENDER_BATCH,
  TABLE_SORT_COLLATOR,
  TOTAL_COLUMNS,
  type SortKey
} from './archiveTableUtils';
import { ArchiveTableHeader } from './ArchiveTableHeader';
import { useArchiveInlineEdit } from './useArchiveInlineEdit';

type Props = {
  wines: Wine[];
  categories: string[];
  producers: string[];
  origins: string[];
  loading: boolean;
  onEdit: (wine: Wine) => void;
  onDelete: (wineId: string) => void;
  onUpdateQty: (wine: Wine, nextQty: number) => Promise<boolean>;
  onUpdateInlineFields: (
    wine: Wine,
    patch: {
      name?: string;
      age?: string;
      category?: string;
      producer?: string;
      origin?: string;
      purchasePrice?: number;
    }
  ) => Promise<boolean>;
  onRequestAddCategory: (onResult: (created: string | null) => void) => void;
  onRequestAddProducer: (onResult: (created: string | null) => void) => void;
  onRequestAddOrigin: (onResult: (created: string | null) => void) => void;
  resetVersion: number;
  bulkEditEnabled: boolean;
  onOpenBulkEdit: () => void;
};

export function AdminArchiveTable({
  wines,
  categories,
  producers,
  origins,
  loading,
  onEdit,
  onDelete,
  onUpdateQty,
  onUpdateInlineFields,
  onRequestAddCategory,
  onRequestAddProducer,
  onRequestAddOrigin,
  resetVersion,
  bulkEditEnabled,
  onOpenBulkEdit
}: Props) {
  const [, startTransition] = useTransition();
  const loadMoreRowRef = useRef<HTMLTableRowElement | null>(null);
  const autoLoadLockRef = useRef(false);
  const [targetRows, setTargetRows] = useState(BASE_ROWS);
  const [visibleRows, setVisibleRows] = useState(TABLE_RENDER_BATCH);
  const [sortState, setSortState] = useState<{ key: SortKey; dir: 'az' | 'za' }>(
    DEFAULT_SORT_STATE
  );

  const edit = useArchiveInlineEdit({
    resetVersion,
    onUpdateQty,
    onUpdateInlineFields
  });

  const sortedWines = useMemo(() => {
    if (sortState.key === 'name' && sortState.dir === 'az') return wines;
    const byField = [...wines].sort((a, b) => {
      const aValue =
        sortState.key === 'category'
          ? (a.category ?? '')
          : sortState.key === 'producer'
            ? (a.producer ?? '')
            : sortState.key === 'origin'
              ? (a.origin ?? '')
              : (a.name ?? '');
      const bValue =
        sortState.key === 'category'
          ? (b.category ?? '')
          : sortState.key === 'producer'
            ? (b.producer ?? '')
            : sortState.key === 'origin'
              ? (b.origin ?? '')
              : (b.name ?? '');
      return TABLE_SORT_COLLATOR.compare(aValue, bValue);
    });
    return sortState.dir === 'az' ? byField : byField.reverse();
  }, [sortState, wines]);

  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const years: string[] = [];
    for (let year = currentYear; year >= 1900; year -= 1) years.push(String(year));
    return years;
  }, []);

  const renderedWines = useMemo(
    () => sortedWines.slice(0, Math.max(TABLE_RENDER_BATCH, visibleRows)),
    [sortedWines, visibleRows]
  );
  const hasMoreRows = renderedWines.length < sortedWines.length;

  const toggleSort = (key: SortKey) => {
    setSortState((prev) => {
      if (prev.key === key) return { key, dir: prev.dir === 'az' ? 'za' : 'az' };
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
    startTransition(() => setVisibleRows(TABLE_RENDER_BATCH));
  }, [loading, sortState, startTransition, wines]);

  useEffect(() => {
    if (!hasMoreRows) return;
    const target = loadMoreRowRef.current;
    if (!target) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting) && !autoLoadLockRef.current) {
          autoLoadLockRef.current = true;
          startTransition(() =>
            setVisibleRows((prev) => Math.min(prev + TABLE_RENDER_BATCH, sortedWines.length))
          );
        }
      },
      { rootMargin: '220px 0px' }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMoreRows, renderedWines.length, sortedWines.length, startTransition]);

  useEffect(() => {
    autoLoadLockRef.current = false;
  }, [renderedWines.length]);

  useEffect(() => {
    autoLoadLockRef.current = false;
    setSortState(DEFAULT_SORT_STATE);
    startTransition(() => setVisibleRows(TABLE_RENDER_BATCH));
  }, [resetVersion, startTransition]);

  const fillerRows = useMemo(() => {
    if (loading) return 0;
    return Math.max(0, targetRows - renderedWines.length);
  }, [loading, renderedWines.length, targetRows]);

  return (
    <section className="archiveTableSection">
      <div className="archiveTableWrap">
        <table
          className="archiveTable"
          onContextMenu={(event) => {
            if (!bulkEditEnabled) return;
            event.preventDefault();
            onOpenBulkEdit();
          }}
        >
          <ArchiveTableHeader
            sortState={sortState}
            onToggleSort={toggleSort}
            getSortAriaLabel={getSortAriaLabel}
          />
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
                    <td>
                      {edit.editingCategoryWineId === wine.id ? (
                        <div className="archiveInlineEditBox" ref={edit.categoryInlineBoxRef}>
                          <InlineStickyAddSelect
                            value={edit.editingCategoryValue}
                            options={categories}
                            addLabel="+ Aggiungi categoria..."
                            onChange={(next) => {
                              edit.setEditingCategoryValue(next);
                              edit.requestInlineSelectEditConfirm(
                                wine,
                                'category',
                                wine.category ?? '',
                                next
                              );
                            }}
                            onAdd={() => {
                              onRequestAddCategory((created) => {
                                if (!created) return;
                                edit.setEditingCategoryValue(created);
                                edit.requestInlineSelectEditConfirm(
                                  wine,
                                  'category',
                                  wine.category ?? '',
                                  created
                                );
                              });
                            }}
                            onCancel={edit.cancelCategoryEdit}
                            ariaLabel={`Modifica categoria ${wine.name}`}
                            disabled={
                              edit.savingInlineWineId === wine.id ||
                              edit.inlineSelectConfirmModal !== null
                            }
                          />
                        </div>
                      ) : (
                        <button
                          className={`archiveInlineCategoryButton ${
                            hasTextValue(wine.category) ? '' : 'archiveInlineCategoryButtonEmpty'
                          }`}
                          type="button"
                          onClick={() => edit.beginCategoryEdit(wine)}
                          aria-label={`Modifica categoria di ${wine.name}`}
                        >
                          {formatText(wine.category)}
                        </button>
                      )}
                    </td>
                    <td className="archiveTableName">
                      {edit.editingNameWineId === wine.id ? (
                        <div className="archiveInlineEditBox" ref={edit.nameInlineBoxRef}>
                          <input
                            className="archiveInlineTextInput"
                            type="text"
                            autoComplete="off"
                            autoCorrect="off"
                            autoCapitalize="off"
                            spellCheck={false}
                            data-form-type="other"
                            data-lpignore="true"
                            data-1p-ignore="true"
                            data-bwignore="true"
                            value={edit.editingNameValue}
                            onChange={(e) =>
                              edit.setEditingNameValue(e.target.value.toLocaleUpperCase('it-IT'))
                            }
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                void edit.saveNameEdit(wine);
                              }
                              if (e.key === 'Escape') {
                                e.preventDefault();
                                edit.cancelNameEdit();
                              }
                            }}
                            aria-label={`Modifica nome ${wine.name}`}
                            disabled={edit.savingInlineWineId === wine.id}
                            autoFocus
                          />
                        </div>
                      ) : (
                        <button
                          className="archiveInlineTextButton"
                          type="button"
                          onClick={() => edit.beginNameEdit(wine)}
                          aria-label={`Modifica nome di ${wine.name}`}
                        >
                          {wine.name}
                        </button>
                      )}
                    </td>
                    <td className="archiveColCenter">
                      {edit.editingAgeWineId === wine.id ? (
                        <div className="archiveInlineEditBox" ref={edit.ageInlineBoxRef}>
                          <select
                            className="archiveInlineYearInput archiveInlineYearSelect"
                            value={edit.editingAgeValue}
                            onChange={(e) => {
                              const nextValue = e.target.value;
                              edit.setEditingAgeValue(nextValue);
                              void edit.saveAgeEditValue(wine, nextValue);
                            }}
                            aria-label={`Modifica anno ${wine.name}`}
                            disabled={edit.savingInlineWineId === wine.id}
                            autoFocus
                          >
                            <option value="">Vuoto</option>
                            {yearOptions.map((year) => (
                              <option key={year} value={year}>
                                {year}
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <button
                          className="archiveInlineYearButton"
                          type="button"
                          onClick={() => edit.beginAgeEdit(wine)}
                          aria-label={`Modifica anno di ${wine.name}`}
                        >
                          {formatYear(wine.age) || '—'}
                        </button>
                      )}
                    </td>
                    <td>
                      {edit.editingProducerWineId === wine.id ? (
                        <div className="archiveInlineEditBox" ref={edit.producerInlineBoxRef}>
                          <InlineStickyAddSelect
                            value={edit.editingProducerValue}
                            options={producers}
                            addLabel="+ Aggiungi produttore..."
                            onChange={(next) => {
                              edit.setEditingProducerValue(next);
                              edit.requestInlineSelectEditConfirm(
                                wine,
                                'producer',
                                wine.producer ?? '',
                                next
                              );
                            }}
                            onAdd={() => {
                              onRequestAddProducer((created) => {
                                if (!created) return;
                                edit.setEditingProducerValue(created);
                                edit.requestInlineSelectEditConfirm(
                                  wine,
                                  'producer',
                                  wine.producer ?? '',
                                  created
                                );
                              });
                            }}
                            onCancel={edit.cancelProducerEdit}
                            ariaLabel={`Modifica produttore ${wine.name}`}
                            disabled={
                              edit.savingInlineWineId === wine.id ||
                              edit.inlineSelectConfirmModal !== null
                            }
                          />
                        </div>
                      ) : (
                        <button
                          className={`archiveInlineCategoryButton ${
                            hasTextValue(wine.producer) ? '' : 'archiveInlineCategoryButtonEmpty'
                          }`}
                          type="button"
                          onClick={() => edit.beginProducerEdit(wine)}
                          aria-label={`Modifica produttore di ${wine.name}`}
                        >
                          {formatText(wine.producer)}
                        </button>
                      )}
                    </td>
                    <td>
                      {edit.editingOriginWineId === wine.id ? (
                        <div className="archiveInlineEditBox" ref={edit.originInlineBoxRef}>
                          <InlineStickyAddSelect
                            value={edit.editingOriginValue}
                            options={origins}
                            addLabel="+ Aggiungi provenienza..."
                            onChange={(next) => {
                              edit.setEditingOriginValue(next);
                              edit.requestInlineSelectEditConfirm(
                                wine,
                                'origin',
                                wine.origin ?? '',
                                next
                              );
                            }}
                            onAdd={() => {
                              onRequestAddOrigin((created) => {
                                if (!created) return;
                                edit.setEditingOriginValue(created);
                                edit.requestInlineSelectEditConfirm(
                                  wine,
                                  'origin',
                                  wine.origin ?? '',
                                  created
                                );
                              });
                            }}
                            onCancel={edit.cancelOriginEdit}
                            ariaLabel={`Modifica provenienza ${wine.name}`}
                            disabled={
                              edit.savingInlineWineId === wine.id ||
                              edit.inlineSelectConfirmModal !== null
                            }
                          />
                        </div>
                      ) : (
                        <button
                          className={`archiveInlineCategoryButton ${
                            hasTextValue(wine.origin) ? '' : 'archiveInlineCategoryButtonEmpty'
                          }`}
                          type="button"
                          onClick={() => edit.beginOriginEdit(wine)}
                          aria-label={`Modifica provenienza di ${wine.name}`}
                        >
                          {formatText(wine.origin)}
                        </button>
                      )}
                    </td>
                    <td className="archiveColCenter">
                      {edit.editingPurchasePriceWineId === wine.id ? (
                        <div className="archiveInlineEditBox" ref={edit.purchasePriceInlineBoxRef}>
                          <input
                            className="archiveInlinePriceInput"
                            type="text"
                            autoComplete="off"
                            autoCorrect="off"
                            autoCapitalize="off"
                            spellCheck={false}
                            data-form-type="other"
                            data-lpignore="true"
                            data-1p-ignore="true"
                            data-bwignore="true"
                            inputMode="decimal"
                            value={edit.editingPurchasePriceValue}
                            onChange={(e) => {
                              edit.setEditingPurchasePriceValue(
                                normalizePriceInput(e.target.value)
                              );
                            }}
                            onKeyDown={(e) => {
                              if (
                                e.key.length === 1 &&
                                !/[0-9.,]/.test(e.key) &&
                                !e.ctrlKey &&
                                !e.metaKey &&
                                !e.altKey
                              ) {
                                e.preventDefault();
                              }
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                void edit.savePurchasePriceEdit(wine);
                              }
                              if (e.key === 'Escape') {
                                e.preventDefault();
                                edit.cancelPurchasePriceEdit();
                              }
                            }}
                            aria-label={`Modifica prezzo acquisto ${wine.name}`}
                            disabled={edit.savingInlineWineId === wine.id}
                            autoFocus
                          />
                        </div>
                      ) : (
                        <button
                          className="archiveInlineMoneyButton"
                          type="button"
                          onClick={() => edit.beginPurchasePriceEdit(wine)}
                          aria-label={`Modifica prezzo acquisto di ${wine.name}`}
                        >
                          {formatMoney(wine.purchasePrice)}
                        </button>
                      )}
                    </td>
                    <td className="archiveColCenter">{formatMoney(wine.salePrice)}</td>
                    <td className={`archiveColCenter ${qtyClass}`}>
                      {edit.editingQtyWineId === wine.id ? (
                        <div className="archiveQtyInlineBox" ref={edit.qtyInlineBoxRef}>
                          <input
                            className="archiveQtyInlineInput"
                            type="text"
                            autoComplete="off"
                            autoCorrect="off"
                            autoCapitalize="off"
                            spellCheck={false}
                            data-form-type="other"
                            data-lpignore="true"
                            data-1p-ignore="true"
                            data-bwignore="true"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={edit.editingQtyValue}
                            onChange={(e) => {
                              const onlyDigits = e.target.value.replace(/\D/g, '').slice(0, 2);
                              edit.setEditingQtyValue(onlyDigits);
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
                                edit.requestQtyEditConfirm(wine);
                              }
                              if (e.key === 'Escape') {
                                e.preventDefault();
                                edit.cancelQtyEdit();
                              }
                            }}
                            aria-label={`Modifica quantità ${wine.name}`}
                            disabled={edit.savingQtyWineId === wine.id}
                            autoFocus
                          />
                        </div>
                      ) : (
                        <button
                          className="archiveQtyValueButton"
                          type="button"
                          onClick={() => edit.beginQtyEdit(wine)}
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
                            edit.setNotePreview({ wineName: wine.name, note });
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
              <tr ref={loadMoreRowRef}>
                <td colSpan={TOTAL_COLUMNS} className="archiveTableEmptyCell">
                  <button
                    className="button buttonSecondary archiveLoadMoreButton"
                    type="button"
                    onClick={() => {
                      startTransition(() =>
                        setVisibleRows((prev) =>
                          Math.min(prev + TABLE_RENDER_BATCH, sortedWines.length)
                        )
                      );
                    }}
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

      {edit.notePreview ? (
        <div className="modalOverlay" role="dialog" aria-modal="true" aria-label="Note vino">
          <div className="modalCard archiveNoteModalCard">
            <div className="modalTitle">Note — {edit.notePreview.wineName}</div>
            <div className="modalDescription archiveNoteModalText">{edit.notePreview.note}</div>
            <div className="modalActions">
              <button className="button" type="button" onClick={() => edit.setNotePreview(null)}>
                Chiudi
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmModal
        open={edit.qtyConfirmModal !== null}
        title="Confermare modifica quantità?"
        description={
          edit.qtyConfirmModal
            ? `Vuoi aggiornare "${edit.qtyConfirmModal.wine.name}" da ${edit.qtyConfirmModal.currentQty} a ${edit.qtyConfirmModal.nextQty}?`
            : undefined
        }
        confirmLabel={edit.savingQtyWineId ? 'Confermo…' : 'Conferma'}
        cancelLabel="Annulla modifica"
        onConfirm={() => void edit.confirmQtyEdit()}
        onCancel={() => {
          edit.setQtyConfirmModal(null);
          edit.cancelQtyEdit();
        }}
      />

      <ConfirmModal
        open={edit.inlineSelectConfirmModal !== null}
        title="Confermare modifica campo?"
        description={
          edit.inlineSelectConfirmModal
            ? `Vuoi aggiornare ${
                edit.inlineSelectConfirmModal.field === 'category'
                  ? 'categoria'
                  : edit.inlineSelectConfirmModal.field === 'producer'
                    ? 'produttore'
                    : 'provenienza'
              } di "${edit.inlineSelectConfirmModal.wine.name}" da "${
                edit.inlineSelectConfirmModal.currentValue || '—'
              }" a "${edit.inlineSelectConfirmModal.nextValue || '—'}"?`
            : undefined
        }
        confirmLabel={edit.savingInlineWineId ? 'Confermo…' : 'Conferma'}
        cancelLabel="Annulla modifica"
        onConfirm={() => void edit.confirmInlineSelectEdit()}
        onCancel={edit.cancelInlineSelectEditConfirm}
      />
    </section>
  );
}
