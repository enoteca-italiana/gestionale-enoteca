import { useCallback, useEffect, useRef, useState } from 'react';
import type { Wine } from '@/domain/types';
import { formatPriceInput, normalizePriceInput, parsePriceInput } from './archiveTableUtils';
import type { InlineSelectField } from './archiveTableUtils';

type OnUpdateQty = (wine: Wine, nextQty: number) => Promise<boolean>;
type OnUpdateInlineFields = (
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

export type UseArchiveInlineEditOptions = {
  resetVersion: number;
  onUpdateQty: OnUpdateQty;
  onUpdateInlineFields: OnUpdateInlineFields;
};

export function useArchiveInlineEdit({
  resetVersion,
  onUpdateQty,
  onUpdateInlineFields
}: UseArchiveInlineEditOptions) {
  const swallowNextClickRef = useRef(false);
  const qtyInlineBoxRef = useRef<HTMLDivElement | null>(null);
  const categoryInlineBoxRef = useRef<HTMLDivElement | null>(null);
  const nameInlineBoxRef = useRef<HTMLDivElement | null>(null);
  const ageInlineBoxRef = useRef<HTMLDivElement | null>(null);
  const producerInlineBoxRef = useRef<HTMLDivElement | null>(null);
  const originInlineBoxRef = useRef<HTMLDivElement | null>(null);
  const purchasePriceInlineBoxRef = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => {
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
  }, [resetVersion]);

  const cancelQtyEdit = useCallback(() => {
    if (savingQtyWineId || savingInlineWineId) return;
    setEditingQtyWineId(null);
    setEditingQtyValue('');
  }, [savingInlineWineId, savingQtyWineId]);

  const cancelNameEdit = useCallback(() => {
    if (savingQtyWineId || savingInlineWineId) return;
    setEditingNameWineId(null);
    setEditingNameValue('');
  }, [savingInlineWineId, savingQtyWineId]);

  const cancelAgeEdit = useCallback(() => {
    if (savingQtyWineId || savingInlineWineId) return;
    setEditingAgeWineId(null);
    setEditingAgeValue('');
  }, [savingInlineWineId, savingQtyWineId]);

  const cancelCategoryEdit = useCallback(() => {
    if (savingQtyWineId || savingInlineWineId) return;
    setEditingCategoryWineId(null);
    setEditingCategoryValue('');
  }, [savingInlineWineId, savingQtyWineId]);

  const cancelProducerEdit = useCallback(() => {
    if (savingQtyWineId || savingInlineWineId) return;
    setEditingProducerWineId(null);
    setEditingProducerValue('');
  }, [savingInlineWineId, savingQtyWineId]);

  const cancelOriginEdit = useCallback(() => {
    if (savingQtyWineId || savingInlineWineId) return;
    setEditingOriginWineId(null);
    setEditingOriginValue('');
  }, [savingInlineWineId, savingQtyWineId]);

  const cancelPurchasePriceEdit = useCallback(() => {
    if (savingQtyWineId || savingInlineWineId) return;
    setEditingPurchasePriceWineId(null);
    setEditingPurchasePriceValue('');
  }, [savingInlineWineId, savingQtyWineId]);

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

  const saveAgeEditValue = async (wine: Wine, nextValue: string) => {
    const normalized = nextValue.trim();
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

  return {
    swallowNextClickRef,
    qtyInlineBoxRef,
    categoryInlineBoxRef,
    nameInlineBoxRef,
    ageInlineBoxRef,
    producerInlineBoxRef,
    originInlineBoxRef,
    purchasePriceInlineBoxRef,
    notePreview,
    setNotePreview,
    editingQtyWineId,
    editingQtyValue,
    setEditingQtyValue,
    editingCategoryWineId,
    editingCategoryValue,
    setEditingCategoryValue,
    editingNameWineId,
    editingNameValue,
    setEditingNameValue,
    editingAgeWineId,
    editingAgeValue,
    setEditingAgeValue,
    editingProducerWineId,
    editingProducerValue,
    setEditingProducerValue,
    editingOriginWineId,
    editingOriginValue,
    setEditingOriginValue,
    editingPurchasePriceWineId,
    editingPurchasePriceValue,
    setEditingPurchasePriceValue,
    savingQtyWineId,
    savingInlineWineId,
    qtyConfirmModal,
    setQtyConfirmModal,
    inlineSelectConfirmModal,
    beginQtyEdit,
    cancelQtyEdit,
    requestQtyEditConfirm,
    confirmQtyEdit,
    beginNameEdit,
    cancelNameEdit,
    saveNameEdit,
    beginAgeEdit,
    cancelAgeEdit,
    saveAgeEdit,
    saveAgeEditValue,
    beginCategoryEdit,
    cancelCategoryEdit,
    saveCategoryEdit,
    beginProducerEdit,
    cancelProducerEdit,
    saveProducerEdit,
    beginOriginEdit,
    cancelOriginEdit,
    saveOriginEdit,
    beginPurchasePriceEdit,
    cancelPurchasePriceEdit,
    savePurchasePriceEdit,
    requestInlineSelectEditConfirm,
    cancelInlineSelectEditConfirm,
    confirmInlineSelectEdit,
    normalizePriceInput
  };
}
