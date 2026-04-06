import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import type { Wine } from '@/domain/types';
import { ConfirmModal } from '@/components/ConfirmModal';
import {
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  ChevronDown,
  FileText,
  Pencil,
  Trash2
} from 'lucide-react';

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

const TOTAL_COLUMNS = 11;
const BASE_ROWS = 14;
const ROW_HEIGHT_ESTIMATE = 33;
const TABLE_OFFSET = 340;
const TABLE_RENDER_BATCH = 40;
const TABLE_SORT_COLLATOR = new Intl.Collator('it', { sensitivity: 'base' });
const MONEY_FORMATTER = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' });
type SortKey = 'category' | 'name' | 'producer' | 'origin';
type SortDir = 'az' | 'za';
type InlineSelectField = 'category' | 'producer' | 'origin';
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

function formatPriceInput(value?: number) {
  if (value === undefined || value === null || Number.isNaN(value)) return '';
  return String(value).replace('.', ',');
}

function normalizePriceInput(rawValue: string): string {
  const cleaned = rawValue.replace(/[^\d.,]/g, '');
  if (!cleaned) return '';
  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');
  const separatorIndex = Math.max(lastComma, lastDot);
  if (separatorIndex === -1) return cleaned.replace(/[.,]/g, '');

  const intPart = cleaned.slice(0, separatorIndex).replace(/[.,]/g, '');
  const decimalPart = cleaned.slice(separatorIndex + 1).replace(/[.,]/g, '').slice(0, 2);
  return `${intPart},${decimalPart}`;
}

function parsePriceInput(rawValue: string): number | undefined {
  const normalized = rawValue.replace(',', '.').trim();
  if (!normalized) return undefined;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) return undefined;
  return Number(parsed.toFixed(2));
}

type InlineStickyAddSelectProps = {
  value: string;
  options: string[];
  addLabel: string;
  onChange: (nextValue: string) => void;
  onAdd: () => void;
  onCancel: () => void;
  ariaLabel: string;
  disabled?: boolean;
};

function InlineStickyAddSelect({
  value,
  options,
  addLabel,
  onChange,
  onAdd,
  onCancel,
  ariaLabel,
  disabled
}: InlineStickyAddSelectProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (rootRef.current?.contains(target)) return;
      setOpen(false);
      onCancel();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      onCancel();
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onCancel, open]);

  return (
    <div className="archiveInlineSelectRoot" ref={rootRef}>
      <button
        className="archiveInlineCategorySelect archiveInlineSelectButton"
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open ? 'true' : 'false'}
        onClick={() => setOpen((prev) => !prev)}
        disabled={disabled}
      >
        <span className="archiveInlineSelectText">{value || '—'}</span>
        <ChevronDown size={14} strokeWidth={2} />
      </button>
      {open ? (
        <div className="archiveInlineSelectMenu" role="listbox" aria-label={ariaLabel}>
          <button
            className="archiveInlineSelectAdd"
            type="button"
            onClick={() => {
              setOpen(false);
              onAdd();
            }}
            disabled={disabled}
          >
            {addLabel}
          </button>
          <div className="archiveInlineSelectOptions">
            <button
              className={`archiveInlineSelectOption ${value === '' ? 'archiveInlineSelectOptionActive' : ''}`}
              type="button"
              onClick={() => {
                setOpen(false);
                onChange('');
              }}
              disabled={disabled}
            >
              —
            </button>
            {options.map((option) => (
              <button
                key={option}
                className={`archiveInlineSelectOption ${
                  value === option ? 'archiveInlineSelectOptionActive' : ''
                }`}
                type="button"
                onClick={() => {
                  setOpen(false);
                  onChange(option);
                }}
                disabled={disabled}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

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
  const swallowNextClickRef = useRef(false);
  const qtyInlineBoxRef = useRef<HTMLDivElement | null>(null);
  const categoryInlineBoxRef = useRef<HTMLDivElement | null>(null);
  const nameInlineBoxRef = useRef<HTMLDivElement | null>(null);
  const ageInlineBoxRef = useRef<HTMLDivElement | null>(null);
  const producerInlineBoxRef = useRef<HTMLDivElement | null>(null);
  const originInlineBoxRef = useRef<HTMLDivElement | null>(null);
  const purchasePriceInlineBoxRef = useRef<HTMLDivElement | null>(null);
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
  const [editingPurchasePriceWineId, setEditingPurchasePriceWineId] = useState<string | null>(null);
  const [editingPurchasePriceValue, setEditingPurchasePriceValue] = useState<string>('');
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
    setEditingPurchasePriceWineId(null);
    setEditingPurchasePriceValue('');
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
    setEditingPurchasePriceWineId(null);
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
    setEditingPurchasePriceWineId(null);
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
    setEditingPurchasePriceWineId(null);
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
    setEditingPurchasePriceWineId(null);
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
    setEditingPurchasePriceWineId(null);
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
    setEditingPurchasePriceWineId(null);
  };

  const cancelOriginEdit = useCallback(() => {
    if (savingQtyWineId || savingInlineWineId) return;
    setEditingOriginWineId(null);
    setEditingOriginValue('');
  }, [savingInlineWineId, savingQtyWineId]);

  const beginPurchasePriceEdit = (wine: Wine) => {
    if (savingQtyWineId || savingInlineWineId) return;
    setEditingPurchasePriceWineId(wine.id);
    setEditingPurchasePriceValue(formatPriceInput(wine.purchasePrice));
    setEditingQtyWineId(null);
    setEditingCategoryWineId(null);
    setEditingNameWineId(null);
    setEditingAgeWineId(null);
    setEditingProducerWineId(null);
    setEditingOriginWineId(null);
  };

  const cancelPurchasePriceEdit = useCallback(() => {
    if (savingQtyWineId || savingInlineWineId) return;
    setEditingPurchasePriceWineId(null);
    setEditingPurchasePriceValue('');
  }, [savingInlineWineId, savingQtyWineId]);

  useEffect(() => {
    if (
      !editingQtyWineId &&
      !editingCategoryWineId &&
      !editingNameWineId &&
      !editingAgeWineId &&
      !editingProducerWineId &&
      !editingOriginWineId &&
      !editingPurchasePriceWineId
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
      if (purchasePriceInlineBoxRef.current?.contains(target)) return;
      swallowNextClickRef.current = true;
      cancelQtyEdit();
      cancelCategoryEdit();
      cancelNameEdit();
      cancelAgeEdit();
      cancelProducerEdit();
      cancelOriginEdit();
      cancelPurchasePriceEdit();
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
    cancelPurchasePriceEdit,
    cancelProducerEdit,
    cancelQtyEdit,
    editingCategoryWineId,
    editingAgeWineId,
    editingOriginWineId,
    editingNameWineId,
    editingPurchasePriceWineId,
    editingProducerWineId,
    editingQtyWineId,
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

  const savePurchasePriceEdit = async (wine: Wine) => {
    const normalized = editingPurchasePriceValue.trim();
    const parsed = parsePriceInput(normalized);
    if (normalized.length > 0 && parsed === undefined) return;
    const current = wine.purchasePrice;
    if (parsed === current) {
      cancelPurchasePriceEdit();
      return;
    }
    setSavingInlineWineId(wine.id);
    const updated = await onUpdateInlineFields(wine, { purchasePrice: parsed });
    setSavingInlineWineId(null);
    if (updated) {
      setEditingPurchasePriceWineId(null);
      setEditingPurchasePriceValue('');
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
    } else {
      setEditingOriginValue(inlineSelectConfirmModal.currentValue);
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
    await saveOriginEdit(modal.wine, modal.nextValue);
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
                          <InlineStickyAddSelect
                            value={editingCategoryValue}
                            options={categories}
                            addLabel="+ Aggiungi categoria..."
                            onChange={(next) => {
                              setEditingCategoryValue(next);
                              requestInlineSelectEditConfirm(
                                wine,
                                'category',
                                wine.category ?? '',
                                next
                              );
                            }}
                            onAdd={() => {
                              onRequestAddCategory((created) => {
                                if (!created) return;
                                setEditingCategoryValue(created);
                                requestInlineSelectEditConfirm(
                                  wine,
                                  'category',
                                  wine.category ?? '',
                                  created
                                );
                              });
                            }}
                            onCancel={cancelCategoryEdit}
                            ariaLabel={`Modifica categoria ${wine.name}`}
                            disabled={
                              savingInlineWineId === wine.id || inlineSelectConfirmModal !== null
                            }
                          />
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
                          <InlineStickyAddSelect
                            value={editingProducerValue}
                            options={producers}
                            addLabel="+ Aggiungi produttore..."
                            onChange={(next) => {
                              setEditingProducerValue(next);
                              requestInlineSelectEditConfirm(
                                wine,
                                'producer',
                                wine.producer ?? '',
                                next
                              );
                            }}
                            onAdd={() => {
                              onRequestAddProducer((created) => {
                                if (!created) return;
                                setEditingProducerValue(created);
                                requestInlineSelectEditConfirm(
                                  wine,
                                  'producer',
                                  wine.producer ?? '',
                                  created
                                );
                              });
                            }}
                            onCancel={cancelProducerEdit}
                            ariaLabel={`Modifica produttore ${wine.name}`}
                            disabled={
                              savingInlineWineId === wine.id || inlineSelectConfirmModal !== null
                            }
                          />
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
                          <InlineStickyAddSelect
                            value={editingOriginValue}
                            options={origins}
                            addLabel="+ Aggiungi provenienza..."
                            onChange={(next) => {
                              setEditingOriginValue(next);
                              requestInlineSelectEditConfirm(
                                wine,
                                'origin',
                                wine.origin ?? '',
                                next
                              );
                            }}
                            onAdd={() => {
                              onRequestAddOrigin((created) => {
                                if (!created) return;
                                setEditingOriginValue(created);
                                requestInlineSelectEditConfirm(
                                  wine,
                                  'origin',
                                  wine.origin ?? '',
                                  created
                                );
                              });
                            }}
                            onCancel={cancelOriginEdit}
                            ariaLabel={`Modifica provenienza ${wine.name}`}
                            disabled={
                              savingInlineWineId === wine.id || inlineSelectConfirmModal !== null
                            }
                          />
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
                    <td className="archiveColCenter">
                      {editingPurchasePriceWineId === wine.id ? (
                        <div className="archiveInlineEditBox" ref={purchasePriceInlineBoxRef}>
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
                            value={editingPurchasePriceValue}
                            onChange={(e) => {
                              setEditingPurchasePriceValue(normalizePriceInput(e.target.value));
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
                                void savePurchasePriceEdit(wine);
                              }
                              if (e.key === 'Escape') {
                                e.preventDefault();
                                cancelPurchasePriceEdit();
                              }
                            }}
                            aria-label={`Modifica prezzo acquisto ${wine.name}`}
                            disabled={savingInlineWineId === wine.id}
                            autoFocus
                          />
                        </div>
                      ) : (
                        <button
                          className="archiveInlineMoneyButton"
                          type="button"
                          onClick={() => beginPurchasePriceEdit(wine)}
                          aria-label={`Modifica prezzo acquisto di ${wine.name}`}
                        >
                          {formatMoney(wine.purchasePrice)}
                        </button>
                      )}
                    </td>
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
                    : 'provenienza'
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
