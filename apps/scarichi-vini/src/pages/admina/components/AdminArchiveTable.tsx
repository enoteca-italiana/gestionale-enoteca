import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import type { Wine } from '@/domain/types';
import { ConfirmModal } from '@/components/ConfirmModal';
import { ArrowDownWideNarrow, ArrowUpNarrowWide, FileText, Pencil, Trash2 } from 'lucide-react';

type Props = {
  wines: Wine[];
  categories: string[];
  producers: string[];
  origins: string[];
  suppliers: string[];
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
      supplier?: string;
    }
  ) => Promise<boolean>;
  resetVersion: number;
  bulkEditEnabled: boolean;
  onOpenBulkEdit: () => void;
};

const TOTAL_COLUMNS = 12;
const BASE_ROWS = 14;
const ROW_HEIGHT_ESTIMATE = 33;
const TABLE_OFFSET = 340;
const TABLE_RENDER_BATCH = 40;
const TABLE_SORT_COLLATOR = new Intl.Collator('it', { sensitivity: 'base' });
const MONEY_FORMATTER = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' });
type SortKey = 'category' | 'name' | 'producer' | 'origin' | 'supplier';
type SortDir = 'az' | 'za';
type InlineSelectField = 'category' | 'producer' | 'origin' | 'supplier';
const DEFAULT_SORT_STATE: { key: SortKey; dir: SortDir } = { key: 'name', dir: 'az' };

function formatMoney(value?: number) {
  if (value === undefined || value === null || Number.isNaN(value)) return '—';
  return MONEY_FORMATTER.format(value);
}

function formatText(value?: string) {
  return value && value.trim().length > 0 ? value : '—';
}

function hasTextValue(value?: string) {
  return Boolean(value && value.trim().length > 0);
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

export function AdminArchiveTable({
  wines,
  categories,
  producers,
  origins,
  suppliers,
  loading,
  onEdit,
  onDelete,
  onUpdateQty,
  onUpdateInlineFields,
  resetVersion,
  bulkEditEnabled,
  onOpenBulkEdit
}: Props) {
  const [, startTransition] = useTransition();
  const swallowNextClickRef = useRef(false);
  const qtyInlineBoxRef = useRef<HTMLDivElement | null>(null);
  const categoryInlineBoxRef = useRef<HTMLDivElement | null>(null);
  const nameInlineBoxRef = useRef<HTMLDivElement | null>(null);
  const ageInlineBoxRef = useRef<HTMLDivElement | null>(null);
  const producerInlineBoxRef = useRef<HTMLDivElement | null>(null);
  const originInlineBoxRef = useRef<HTMLDivElement | null>(null);
  const supplierInlineBoxRef = useRef<HTMLDivElement | null>(null);
  const loadMoreRowRef = useRef<HTMLTableRowElement | null>(null);
  const autoLoadLockRef = useRef(false);
  const [targetRows, setTargetRows] = useState(BASE_ROWS);
  const [notePreview, setNotePreview] = useState<{ wineName: string; note: string } | null>(null);
  const [editingQtyWineId, setEditingQtyWineId] = useState<string | null>(null);
  const [editingQtyValue, setEditingQtyValue] = useState<string>('');
  const [editingCategoryWineId, setEditingCategoryWineId] = useState<string | null>(null);
  const [editingCategoryValue, setEditingCategoryValue] = useState<string>('');
  const [editingNameWineId, setEditingNameWineId] = useState<string | null>(null);
  const [editingNameValue, setEditingNameValue] = useState<string>('');
  const [editingAgeWineId, setEditingAgeWineId] = useState<string | null>(null);
  const [editingAgeValue, setEditingAgeValue] = useState<string>('');
  const [editingProducerWineId, setEditingProducerWineId] = useState<string | null>(null);
  const [editingProducerValue, setEditingProducerValue] = useState<string>('');
  const [editingOriginWineId, setEditingOriginWineId] = useState<string | null>(null);
  const [editingOriginValue, setEditingOriginValue] = useState<string>('');
  const [editingSupplierWineId, setEditingSupplierWineId] = useState<string | null>(null);
  const [editingSupplierValue, setEditingSupplierValue] = useState<string>('');
  const [savingQtyWineId, setSavingQtyWineId] = useState<string | null>(null);
  const [savingInlineWineId, setSavingInlineWineId] = useState<string | null>(null);
  const [visibleRows, setVisibleRows] = useState(TABLE_RENDER_BATCH);
  const [qtyConfirmModal, setQtyConfirmModal] = useState<{
    wine: Wine;
    currentQty: number;
    nextQty: number;
  } | null>(null);
  const [inlineSelectConfirmModal, setInlineSelectConfirmModal] = useState<{
    wine: Wine;
    field: InlineSelectField;
    currentValue: string;
    nextValue: string;
  } | null>(null);
  const [sortState, setSortState] = useState<{ key: SortKey; dir: SortDir }>(DEFAULT_SORT_STATE);

  const sortedWines = useMemo(() => {
    if (sortState.key === 'name' && sortState.dir === 'az') {
      // The repository already returns wines sorted by name asc.
      // Skip an unnecessary full array copy/sort on the default view.
      return wines;
    }
    const byField = [...wines].sort((a, b) => {
      const aValue =
        sortState.key === 'category'
          ? (a.category ?? '')
          : sortState.key === 'producer'
            ? (a.producer ?? '')
            : sortState.key === 'origin'
              ? (a.origin ?? '')
              : sortState.key === 'supplier'
                ? (a.supplier ?? '')
                : (a.name ?? '');
      const bValue =
        sortState.key === 'category'
          ? (b.category ?? '')
          : sortState.key === 'producer'
            ? (b.producer ?? '')
            : sortState.key === 'origin'
              ? (b.origin ?? '')
              : sortState.key === 'supplier'
                ? (b.supplier ?? '')
                : (b.name ?? '');
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
    startTransition(() => {
      setVisibleRows(TABLE_RENDER_BATCH);
    });
  }, [loading, sortState, startTransition, wines]);

  useEffect(() => {
    if (!hasMoreRows) return;
    const target = loadMoreRowRef.current;
    if (!target) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting) && !autoLoadLockRef.current) {
          autoLoadLockRef.current = true;
          startTransition(() => {
            setVisibleRows((prev) => Math.min(prev + TABLE_RENDER_BATCH, sortedWines.length));
          });
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
    setNotePreview(null);
    setQtyConfirmModal(null);
    setInlineSelectConfirmModal(null);
    setEditingQtyWineId(null);
    setEditingQtyValue('');
    setEditingCategoryWineId(null);
    setEditingCategoryValue('');
    setEditingNameWineId(null);
    setEditingNameValue('');
    setEditingAgeWineId(null);
    setEditingAgeValue('');
    setEditingProducerWineId(null);
    setEditingProducerValue('');
    setEditingOriginWineId(null);
    setEditingOriginValue('');
    setEditingSupplierWineId(null);
    setEditingSupplierValue('');
    startTransition(() => {
      setVisibleRows(TABLE_RENDER_BATCH);
    });
  }, [resetVersion, startTransition]);

  const fillerRows = useMemo(() => {
    if (loading) return 0;
    return Math.max(0, targetRows - renderedWines.length);
  }, [loading, renderedWines.length, targetRows]);

  const beginQtyEdit = (wine: Wine) => {
    if (savingQtyWineId || savingInlineWineId) return;
    setEditingQtyWineId(wine.id);
    setEditingQtyValue(String(Math.max(0, Math.min(99, Math.round(wine.qty)))));
    setEditingCategoryWineId(null);
    setEditingNameWineId(null);
    setEditingAgeWineId(null);
    setEditingProducerWineId(null);
    setEditingOriginWineId(null);
    setEditingSupplierWineId(null);
  };

  const cancelQtyEdit = useCallback(() => {
    if (savingQtyWineId || savingInlineWineId) return;
    setEditingQtyWineId(null);
    setEditingQtyValue('');
  }, [savingInlineWineId, savingQtyWineId]);

  const beginNameEdit = (wine: Wine) => {
    if (savingQtyWineId || savingInlineWineId) return;
    setEditingNameWineId(wine.id);
    setEditingNameValue(wine.name);
    setEditingQtyWineId(null);
    setEditingCategoryWineId(null);
    setEditingAgeWineId(null);
    setEditingProducerWineId(null);
    setEditingOriginWineId(null);
    setEditingSupplierWineId(null);
  };

  const cancelNameEdit = useCallback(() => {
    if (savingQtyWineId || savingInlineWineId) return;
    setEditingNameWineId(null);
    setEditingNameValue('');
  }, [savingInlineWineId, savingQtyWineId]);

  const beginAgeEdit = (wine: Wine) => {
    if (savingQtyWineId || savingInlineWineId) return;
    setEditingAgeWineId(wine.id);
    setEditingAgeValue(wine.age ?? '');
    setEditingQtyWineId(null);
    setEditingCategoryWineId(null);
    setEditingNameWineId(null);
    setEditingProducerWineId(null);
    setEditingOriginWineId(null);
    setEditingSupplierWineId(null);
  };

  const cancelAgeEdit = useCallback(() => {
    if (savingQtyWineId || savingInlineWineId) return;
    setEditingAgeWineId(null);
    setEditingAgeValue('');
  }, [savingInlineWineId, savingQtyWineId]);

  const beginCategoryEdit = (wine: Wine) => {
    if (savingQtyWineId || savingInlineWineId) return;
    setEditingCategoryWineId(wine.id);
    setEditingCategoryValue(wine.category ?? '');
    setEditingQtyWineId(null);
    setEditingNameWineId(null);
    setEditingAgeWineId(null);
    setEditingProducerWineId(null);
    setEditingOriginWineId(null);
    setEditingSupplierWineId(null);
  };

  const cancelCategoryEdit = useCallback(() => {
    if (savingQtyWineId || savingInlineWineId) return;
    setEditingCategoryWineId(null);
    setEditingCategoryValue('');
  }, [savingInlineWineId, savingQtyWineId]);

  const beginProducerEdit = (wine: Wine) => {
    if (savingQtyWineId || savingInlineWineId) return;
    setEditingProducerWineId(wine.id);
    setEditingProducerValue(wine.producer ?? '');
    setEditingQtyWineId(null);
    setEditingCategoryWineId(null);
    setEditingNameWineId(null);
    setEditingAgeWineId(null);
    setEditingOriginWineId(null);
    setEditingSupplierWineId(null);
  };

  const cancelProducerEdit = useCallback(() => {
    if (savingQtyWineId || savingInlineWineId) return;
    setEditingProducerWineId(null);
    setEditingProducerValue('');
  }, [savingInlineWineId, savingQtyWineId]);

  const beginOriginEdit = (wine: Wine) => {
    if (savingQtyWineId || savingInlineWineId) return;
    setEditingOriginWineId(wine.id);
    setEditingOriginValue(wine.origin ?? '');
    setEditingQtyWineId(null);
    setEditingCategoryWineId(null);
    setEditingNameWineId(null);
    setEditingAgeWineId(null);
    setEditingProducerWineId(null);
    setEditingSupplierWineId(null);
  };

  const cancelOriginEdit = useCallback(() => {
    if (savingQtyWineId || savingInlineWineId) return;
    setEditingOriginWineId(null);
    setEditingOriginValue('');
  }, [savingInlineWineId, savingQtyWineId]);

  const beginSupplierEdit = (wine: Wine) => {
    if (savingQtyWineId || savingInlineWineId) return;
    setEditingSupplierWineId(wine.id);
    setEditingSupplierValue(wine.supplier ?? '');
    setEditingQtyWineId(null);
    setEditingCategoryWineId(null);
    setEditingNameWineId(null);
    setEditingAgeWineId(null);
    setEditingProducerWineId(null);
    setEditingOriginWineId(null);
  };

  const cancelSupplierEdit = useCallback(() => {
    if (savingQtyWineId || savingInlineWineId) return;
    setEditingSupplierWineId(null);
    setEditingSupplierValue('');
  }, [savingInlineWineId, savingQtyWineId]);

  useEffect(() => {
    if (
      !editingQtyWineId &&
      !editingCategoryWineId &&
      !editingNameWineId &&
      !editingAgeWineId &&
      !editingProducerWineId &&
      !editingOriginWineId &&
      !editingSupplierWineId
    )
      return;
    if (qtyConfirmModal || inlineSelectConfirmModal) return;

    const handlePointerDownOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (qtyInlineBoxRef.current?.contains(target)) return;
      if (categoryInlineBoxRef.current?.contains(target)) return;
      if (nameInlineBoxRef.current?.contains(target)) return;
      if (ageInlineBoxRef.current?.contains(target)) return;
      if (producerInlineBoxRef.current?.contains(target)) return;
      if (originInlineBoxRef.current?.contains(target)) return;
      if (supplierInlineBoxRef.current?.contains(target)) return;
      swallowNextClickRef.current = true;
      cancelQtyEdit();
      cancelCategoryEdit();
      cancelNameEdit();
      cancelAgeEdit();
      cancelProducerEdit();
      cancelOriginEdit();
      cancelSupplierEdit();
    };
    const handleClickCapture = (event: MouseEvent) => {
      if (!swallowNextClickRef.current) return;
      swallowNextClickRef.current = false;
      event.preventDefault();
      event.stopPropagation();
    };

    document.addEventListener('mousedown', handlePointerDownOutside);
    document.addEventListener('touchstart', handlePointerDownOutside, { passive: true });
    document.addEventListener('click', handleClickCapture, true);
    return () => {
      document.removeEventListener('mousedown', handlePointerDownOutside);
      document.removeEventListener('touchstart', handlePointerDownOutside);
      document.removeEventListener('click', handleClickCapture, true);
      swallowNextClickRef.current = false;
    };
  }, [
    cancelAgeEdit,
    cancelCategoryEdit,
    cancelNameEdit,
    cancelOriginEdit,
    cancelProducerEdit,
    cancelQtyEdit,
    cancelSupplierEdit,
    editingCategoryWineId,
    editingAgeWineId,
    editingOriginWineId,
    editingNameWineId,
    editingProducerWineId,
    editingQtyWineId,
    editingSupplierWineId,
    inlineSelectConfirmModal,
    qtyConfirmModal
  ]);

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

  const saveNameEdit = async (wine: Wine) => {
    const nextName = editingNameValue.trim();
    if (!nextName) return;
    if (nextName === wine.name.trim()) {
      cancelNameEdit();
      return;
    }
    setSavingInlineWineId(wine.id);
    const updated = await onUpdateInlineFields(wine, { name: nextName });
    setSavingInlineWineId(null);
    if (updated) {
      setEditingNameWineId(null);
      setEditingNameValue('');
    }
  };

  const saveAgeEdit = async (wine: Wine) => {
    const normalized = editingAgeValue.trim();
    if (normalized && normalized.length !== 4) return;
    const current = (wine.age ?? '').trim();
    if (normalized === current) {
      cancelAgeEdit();
      return;
    }
    setSavingInlineWineId(wine.id);
    const updated = await onUpdateInlineFields(wine, { age: normalized });
    setSavingInlineWineId(null);
    if (updated) {
      setEditingAgeWineId(null);
      setEditingAgeValue('');
    }
  };

  const saveCategoryEdit = async (wine: Wine, nextCategory: string) => {
    const normalizedNext = nextCategory.trim();
    const current = (wine.category ?? '').trim();
    if (normalizedNext === current) {
      cancelCategoryEdit();
      return;
    }
    setSavingInlineWineId(wine.id);
    const updated = await onUpdateInlineFields(wine, { category: normalizedNext });
    setSavingInlineWineId(null);
    if (updated) {
      setEditingCategoryWineId(null);
      setEditingCategoryValue('');
    }
  };

  const saveProducerEdit = async (wine: Wine, nextProducer: string) => {
    const normalizedNext = nextProducer.trim();
    const current = (wine.producer ?? '').trim();
    if (normalizedNext === current) {
      cancelProducerEdit();
      return;
    }
    setSavingInlineWineId(wine.id);
    const updated = await onUpdateInlineFields(wine, { producer: normalizedNext });
    setSavingInlineWineId(null);
    if (updated) {
      setEditingProducerWineId(null);
      setEditingProducerValue('');
    }
  };

  const saveOriginEdit = async (wine: Wine, nextOrigin: string) => {
    const normalizedNext = nextOrigin.trim();
    const current = (wine.origin ?? '').trim();
    if (normalizedNext === current) {
      cancelOriginEdit();
      return;
    }
    setSavingInlineWineId(wine.id);
    const updated = await onUpdateInlineFields(wine, { origin: normalizedNext });
    setSavingInlineWineId(null);
    if (updated) {
      setEditingOriginWineId(null);
      setEditingOriginValue('');
    }
  };

  const saveSupplierEdit = async (wine: Wine, nextSupplier: string) => {
    const normalizedNext = nextSupplier.trim();
    const current = (wine.supplier ?? '').trim();
    if (normalizedNext === current) {
      cancelSupplierEdit();
      return;
    }
    setSavingInlineWineId(wine.id);
    const updated = await onUpdateInlineFields(wine, { supplier: normalizedNext });
    setSavingInlineWineId(null);
    if (updated) {
      setEditingSupplierWineId(null);
      setEditingSupplierValue('');
    }
  };

  const requestInlineSelectEditConfirm = (
    wine: Wine,
    field: InlineSelectField,
    currentValue: string,
    nextValue: string
  ) => {
    if (savingQtyWineId || savingInlineWineId || inlineSelectConfirmModal) return;
    const normalizedCurrent = currentValue.trim();
    const normalizedNext = nextValue.trim();
    if (normalizedCurrent === normalizedNext) return;
    setInlineSelectConfirmModal({
      wine,
      field,
      currentValue: normalizedCurrent,
      nextValue: normalizedNext
    });
  };

  const cancelInlineSelectEditConfirm = () => {
    if (!inlineSelectConfirmModal) return;
    if (inlineSelectConfirmModal.field === 'category') {
      setEditingCategoryValue(inlineSelectConfirmModal.currentValue);
    } else if (inlineSelectConfirmModal.field === 'producer') {
      setEditingProducerValue(inlineSelectConfirmModal.currentValue);
    } else if (inlineSelectConfirmModal.field === 'origin') {
      setEditingOriginValue(inlineSelectConfirmModal.currentValue);
    } else {
      setEditingSupplierValue(inlineSelectConfirmModal.currentValue);
    }
    setInlineSelectConfirmModal(null);
  };

  const confirmInlineSelectEdit = async () => {
    if (!inlineSelectConfirmModal) return;
    const modal = inlineSelectConfirmModal;
    setInlineSelectConfirmModal(null);
    if (modal.field === 'category') {
      await saveCategoryEdit(modal.wine, modal.nextValue);
      return;
    }
    if (modal.field === 'producer') {
      await saveProducerEdit(modal.wine, modal.nextValue);
      return;
    }
    if (modal.field === 'origin') {
      await saveOriginEdit(modal.wine, modal.nextValue);
      return;
    }
    await saveSupplierEdit(modal.wine, modal.nextValue);
  };

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
                    <td>
                      {editingCategoryWineId === wine.id ? (
                        <div className="archiveInlineEditBox" ref={categoryInlineBoxRef}>
                          <select
                            className="archiveInlineCategorySelect"
                            value={editingCategoryValue}
                            onChange={(e) => {
                              const next = e.target.value;
                              setEditingCategoryValue(next);
                              requestInlineSelectEditConfirm(
                                wine,
                                'category',
                                wine.category ?? '',
                                next
                              );
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Escape') {
                                e.preventDefault();
                                cancelCategoryEdit();
                              }
                            }}
                            aria-label={`Modifica categoria ${wine.name}`}
                            disabled={
                              savingInlineWineId === wine.id || inlineSelectConfirmModal !== null
                            }
                            autoFocus
                          >
                            <option value="">—</option>
                            {categories.map((category) => (
                              <option key={category} value={category}>
                                {category}
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <button
                          className={`archiveInlineCategoryButton ${
                            hasTextValue(wine.category) ? '' : 'archiveInlineCategoryButtonEmpty'
                          }`}
                          type="button"
                          onClick={() => beginCategoryEdit(wine)}
                          aria-label={`Modifica categoria di ${wine.name}`}
                        >
                          {formatText(wine.category)}
                        </button>
                      )}
                    </td>
                    <td className="archiveTableName">
                      {editingNameWineId === wine.id ? (
                        <div className="archiveInlineEditBox" ref={nameInlineBoxRef}>
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
                            value={editingNameValue}
                            onChange={(e) =>
                              setEditingNameValue(e.target.value.toLocaleUpperCase('it-IT'))
                            }
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                void saveNameEdit(wine);
                              }
                              if (e.key === 'Escape') {
                                e.preventDefault();
                                cancelNameEdit();
                              }
                            }}
                            aria-label={`Modifica nome ${wine.name}`}
                            disabled={savingInlineWineId === wine.id}
                            autoFocus
                          />
                        </div>
                      ) : (
                        <button
                          className="archiveInlineTextButton"
                          type="button"
                          onClick={() => beginNameEdit(wine)}
                          aria-label={`Modifica nome di ${wine.name}`}
                        >
                          {wine.name}
                        </button>
                      )}
                    </td>
                    <td className="archiveColCenter">
                      {editingAgeWineId === wine.id ? (
                        <div className="archiveInlineEditBox" ref={ageInlineBoxRef}>
                          <input
                            className="archiveInlineYearInput"
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
                            maxLength={4}
                            value={editingAgeValue}
                            onChange={(e) => {
                              const digits = e.target.value.replace(/\D/g, '').slice(0, 4);
                              setEditingAgeValue(digits);
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
                                void saveAgeEdit(wine);
                              }
                              if (e.key === 'Escape') {
                                e.preventDefault();
                                cancelAgeEdit();
                              }
                            }}
                            aria-label={`Modifica anno ${wine.name}`}
                            disabled={savingInlineWineId === wine.id}
                            autoFocus
                          />
                        </div>
                      ) : (
                        <button
                          className="archiveInlineYearButton"
                          type="button"
                          onClick={() => beginAgeEdit(wine)}
                          aria-label={`Modifica anno di ${wine.name}`}
                        >
                          {formatYear(wine.age) || '—'}
                        </button>
                      )}
                    </td>
                    <td>
                      {editingProducerWineId === wine.id ? (
                        <div className="archiveInlineEditBox" ref={producerInlineBoxRef}>
                          <select
                            className="archiveInlineCategorySelect"
                            value={editingProducerValue}
                            onChange={(e) => {
                              const next = e.target.value;
                              setEditingProducerValue(next);
                              requestInlineSelectEditConfirm(
                                wine,
                                'producer',
                                wine.producer ?? '',
                                next
                              );
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Escape') {
                                e.preventDefault();
                                cancelProducerEdit();
                              }
                            }}
                            aria-label={`Modifica produttore ${wine.name}`}
                            disabled={
                              savingInlineWineId === wine.id || inlineSelectConfirmModal !== null
                            }
                            autoFocus
                          >
                            <option value="">—</option>
                            {producers.map((producer) => (
                              <option key={producer} value={producer}>
                                {producer}
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <button
                          className={`archiveInlineCategoryButton ${
                            hasTextValue(wine.producer) ? '' : 'archiveInlineCategoryButtonEmpty'
                          }`}
                          type="button"
                          onClick={() => beginProducerEdit(wine)}
                          aria-label={`Modifica produttore di ${wine.name}`}
                        >
                          {formatText(wine.producer)}
                        </button>
                      )}
                    </td>
                    <td>
                      {editingOriginWineId === wine.id ? (
                        <div className="archiveInlineEditBox" ref={originInlineBoxRef}>
                          <select
                            className="archiveInlineCategorySelect"
                            value={editingOriginValue}
                            onChange={(e) => {
                              const next = e.target.value;
                              setEditingOriginValue(next);
                              requestInlineSelectEditConfirm(
                                wine,
                                'origin',
                                wine.origin ?? '',
                                next
                              );
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Escape') {
                                e.preventDefault();
                                cancelOriginEdit();
                              }
                            }}
                            aria-label={`Modifica provenienza ${wine.name}`}
                            disabled={
                              savingInlineWineId === wine.id || inlineSelectConfirmModal !== null
                            }
                            autoFocus
                          >
                            <option value="">—</option>
                            {origins.map((origin) => (
                              <option key={origin} value={origin}>
                                {origin}
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <button
                          className={`archiveInlineCategoryButton ${
                            hasTextValue(wine.origin) ? '' : 'archiveInlineCategoryButtonEmpty'
                          }`}
                          type="button"
                          onClick={() => beginOriginEdit(wine)}
                          aria-label={`Modifica provenienza di ${wine.name}`}
                        >
                          {formatText(wine.origin)}
                        </button>
                      )}
                    </td>
                    <td>
                      {editingSupplierWineId === wine.id ? (
                        <div className="archiveInlineEditBox" ref={supplierInlineBoxRef}>
                          <select
                            className="archiveInlineCategorySelect"
                            value={editingSupplierValue}
                            onChange={(e) => {
                              const next = e.target.value;
                              setEditingSupplierValue(next);
                              requestInlineSelectEditConfirm(
                                wine,
                                'supplier',
                                wine.supplier ?? '',
                                next
                              );
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Escape') {
                                e.preventDefault();
                                cancelSupplierEdit();
                              }
                            }}
                            aria-label={`Modifica fornitore ${wine.name}`}
                            disabled={
                              savingInlineWineId === wine.id || inlineSelectConfirmModal !== null
                            }
                            autoFocus
                          >
                            <option value="">—</option>
                            {suppliers.map((supplier) => (
                              <option key={supplier} value={supplier}>
                                {supplier}
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <button
                          className={`archiveInlineCategoryButton ${
                            hasTextValue(wine.supplier) ? '' : 'archiveInlineCategoryButtonEmpty'
                          }`}
                          type="button"
                          onClick={() => beginSupplierEdit(wine)}
                          aria-label={`Modifica fornitore di ${wine.name}`}
                        >
                          {formatText(wine.supplier)}
                        </button>
                      )}
                    </td>
                    <td className="archiveColCenter">{formatMoney(wine.purchasePrice)}</td>
                    <td className="archiveColCenter">{formatMoney(wine.salePrice)}</td>
                    <td className={`archiveColCenter ${qtyClass}`}>
                      {editingQtyWineId === wine.id ? (
                        <div className="archiveQtyInlineBox" ref={qtyInlineBoxRef}>
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
              <tr ref={loadMoreRowRef}>
                <td colSpan={TOTAL_COLUMNS} className="archiveTableEmptyCell">
                  <button
                    className="button buttonSecondary archiveLoadMoreButton"
                    type="button"
                    onClick={() => {
                      startTransition(() => {
                        setVisibleRows((prev) =>
                          Math.min(prev + TABLE_RENDER_BATCH, sortedWines.length)
                        );
                      });
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
      <ConfirmModal
        open={inlineSelectConfirmModal !== null}
        title="Confermare modifica campo?"
        description={
          inlineSelectConfirmModal
            ? `Vuoi aggiornare ${
                inlineSelectConfirmModal.field === 'category'
                  ? 'categoria'
                  : inlineSelectConfirmModal.field === 'producer'
                    ? 'produttore'
                    : inlineSelectConfirmModal.field === 'origin'
                      ? 'provenienza'
                      : 'fornitore'
              } di "${inlineSelectConfirmModal.wine.name}" da "${
                inlineSelectConfirmModal.currentValue || '—'
              }" a "${inlineSelectConfirmModal.nextValue || '—'}"?`
            : undefined
        }
        confirmLabel={savingInlineWineId ? 'Confermo…' : 'Conferma'}
        cancelLabel="Annulla modifica"
        onConfirm={() => void confirmInlineSelectEdit()}
        onCancel={cancelInlineSelectEditConfirm}
      />
    </section>
  );
}
