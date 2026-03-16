import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import type { Wine } from '@/domain/types';
import { ConfirmModal } from '@/components/ConfirmModal';
import {
  listCategoryOptions,
  listSupabaseCategories,
  loadManagedCategories,
  upsertSupabaseCategory,
  upsertManagedCategory
} from '@/data/categoryRepository';
import {
  listOriginOptions,
  loadManagedOrigins,
  upsertManagedOrigin
} from '@/data/originRepository';
import {
  listSupplierOptions,
  listSupabaseSuppliers,
  loadManagedSuppliers,
  upsertSupabaseSupplier,
  upsertManagedSupplier
} from '@/data/supplierRepository';
import {
  listProducerOptions,
  loadManagedProducers,
  upsertManagedProducer
} from '@/data/producerRepository';
import { loadDb } from '@/data/localDb';
import { dischargeNoteChangedEvent } from '@/data/dischargeNote';
import { getDischargeNoteState } from '@/data/dischargeNoteRepository';
import {
  archiveResetEvent,
  createWine,
  deleteWine,
  listWines,
  updateWine
} from '@/data/wineRepository';
import { AdminArchiveToolbar } from '@/pages/admina/components/AdminArchiveToolbar';
import { AdminArchiveTable } from '@/pages/admina/components/AdminArchiveTable';
import { AiAssistantModal } from '@/pages/admina/components/AiAssistantModal';
import { BulkEditFilteredModal } from '@/pages/admina/components/BulkEditFilteredModal';
import { CategoryCreateModal } from '@/pages/admina/components/CategoryCreateModal';
import { DischargeNoteDrawer } from '@/pages/admina/components/DischargeNoteDrawer';
import { WineArchiveFormModal } from '@/pages/admina/components/WineArchiveFormModal';
import { isInThreshold } from '@/pages/admina/utils/wineFilters';
import {
  defaultFilters,
  emptyWine,
  hasActiveArchiveFilters,
  type Filters,
  type Mode,
  type WineFormState
} from '@/pages/admina/types';

export function WineAdminPage() {
  const [wines, setWines] = useState<Wine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [tableResetVersion, setTableResetVersion] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<Mode>('create');
  const [formState, setFormState] = useState<WineFormState>(emptyWine);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [managedCategories, setManagedCategories] = useState<string[]>(() =>
    loadManagedCategories()
  );
  const [supabaseCategories, setSupabaseCategories] = useState<string[]>([]);
  const [managedOrigins, setManagedOrigins] = useState<string[]>(() => loadManagedOrigins());
  const [managedProducers, setManagedProducers] = useState<string[]>(() => loadManagedProducers());
  const [managedSuppliers, setManagedSuppliers] = useState<string[]>(() => loadManagedSuppliers());
  const [supabaseSuppliers, setSupabaseSuppliers] = useState<string[]>([]);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [categoryResultHandler, setCategoryResultHandler] = useState<
    ((created: string | null) => void) | null
  >(null);
  const [originModalOpen, setOriginModalOpen] = useState(false);
  const [originResultHandler, setOriginResultHandler] = useState<
    ((created: string | null) => void) | null
  >(null);
  const [producerModalOpen, setProducerModalOpen] = useState(false);
  const [producerResultHandler, setProducerResultHandler] = useState<
    ((created: string | null) => void) | null
  >(null);
  const [supplierModalOpen, setSupplierModalOpen] = useState(false);
  const [supplierResultHandler, setSupplierResultHandler] = useState<
    ((created: string | null) => void) | null
  >(null);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [bulkEditModalOpen, setBulkEditModalOpen] = useState(false);
  const [bulkEditBusy, setBulkEditBusy] = useState(false);
  const [dischargeNoteOpen, setDischargeNoteOpen] = useState(false);
  const [hasDischargeNote, setHasDischargeNote] = useState(false);
  const deferredTerm = useDeferredValue(filters.term);
  const bulkUpdateBatchSize = 40;

  const loadWines = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const local = loadDb().inventory;
      if (local.length > 0) {
        setWines(local);
      }
      setWines(await listWines());
    } catch (err) {
      console.error('[WineAdminPage] load error', err);
      setError('Impossibile caricare i vini. Verifica connessione/Supabase.');
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshCategoryRegistry = useCallback(async () => {
    const values = await listSupabaseCategories();
    setSupabaseCategories(values);
  }, []);

  const refreshSupplierRegistry = useCallback(async () => {
    const values = await listSupabaseSuppliers();
    setSupabaseSuppliers(values);
  }, []);

  useEffect(() => {
    void loadWines();
  }, [loadWines]);

  useEffect(() => {
    void refreshCategoryRegistry();
  }, [refreshCategoryRegistry]);

  useEffect(() => {
    let alive = true;
    const syncReadyState = async () => {
      try {
        const state = await getDischargeNoteState();
        if (!alive) return;
        setHasDischargeNote(state.hasReady || state.draftItemsCount > 0);
      } catch (error) {
        console.error('[WineAdminPage] sync discharge note state failed', error);
      }
    };
    const onFocus = () => {
      void syncReadyState();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void syncReadyState();
      }
    };

    void syncReadyState();
    const poll = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      void syncReadyState();
    }, 10000);

    window.addEventListener(dischargeNoteChangedEvent, onFocus);
    window.addEventListener('focus', onFocus);
    window.addEventListener('pageshow', onFocus);
    window.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      alive = false;
      window.clearInterval(poll);
      window.removeEventListener(dischargeNoteChangedEvent, onFocus);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('pageshow', onFocus);
      window.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  useEffect(() => {
    void refreshSupplierRegistry();
  }, [refreshSupplierRegistry]);

  useEffect(() => {
    const onArchiveReset = () => {
      setManagedCategories(loadManagedCategories());
      setManagedOrigins(loadManagedOrigins());
      setManagedProducers(loadManagedProducers());
      setManagedSuppliers(loadManagedSuppliers());
      void refreshCategoryRegistry();
      void refreshSupplierRegistry();
      void loadWines();
      setFilters(defaultFilters);
      setTableResetVersion((prev) => prev + 1);
    };
    window.addEventListener(archiveResetEvent, onArchiveReset);
    return () => window.removeEventListener(archiveResetEvent, onArchiveReset);
  }, [loadWines, refreshCategoryRegistry, refreshSupplierRegistry]);

  const categories = useMemo(
    () => listCategoryOptions(wines, [...managedCategories, ...supabaseCategories]),
    [wines, managedCategories, supabaseCategories]
  );
  const origins = useMemo(() => listOriginOptions(wines, managedOrigins), [wines, managedOrigins]);
  const producers = useMemo(
    () => listProducerOptions(wines, managedProducers),
    [managedProducers, wines]
  );
  const suppliers = useMemo(
    () => listSupplierOptions(wines, [...managedSuppliers, ...supabaseSuppliers]),
    [wines, managedSuppliers, supabaseSuppliers]
  );

  const effectiveFilters = useMemo(
    () => ({ ...filters, term: deferredTerm }),
    [deferredTerm, filters]
  );
  const searchTextByWineId = useMemo(() => {
    const map = new Map<string, string>();
    for (const wine of wines) {
      map.set(
        wine.id,
        [
          wine.category,
          wine.name,
          wine.age,
          wine.producer,
          wine.origin,
          wine.supplier,
          wine.notes,
          wine.warehouse
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
      );
    }
    return map;
  }, [wines]);
  const normalizedFilterFieldsByWineId = useMemo(() => {
    const map = new Map<
      string,
      { category: string; producer: string; origin: string; supplier: string }
    >();
    for (const wine of wines) {
      map.set(wine.id, {
        category: wine.category?.toLowerCase() ?? '',
        producer: wine.producer?.toLowerCase() ?? '',
        origin: wine.origin?.toLowerCase() ?? '',
        supplier: wine.supplier?.toLowerCase() ?? ''
      });
    }
    return map;
  }, [wines]);
  const filteredWines = useMemo(() => {
    const term = effectiveFilters.term.trim().toLowerCase();
    const category = effectiveFilters.category.toLowerCase();
    const producer = effectiveFilters.producer.toLowerCase();
    const origin = effectiveFilters.origin.toLowerCase();
    const supplier = effectiveFilters.supplier.toLowerCase();
    const stock = effectiveFilters.stock;

    return wines.filter((wine) => {
      const normalized = normalizedFilterFieldsByWineId.get(wine.id);
      if (!normalized) return false;
      if (term) {
        const haystack = searchTextByWineId.get(wine.id) ?? '';
        if (!haystack.includes(term)) return false;
      }
      if (category !== 'all') {
        if (normalized.category !== category) return false;
      }
      if (producer !== 'all') {
        if (normalized.producer !== producer) return false;
      }
      if (origin !== 'all') {
        if (normalized.origin !== origin) return false;
      }
      if (supplier !== 'all') {
        if (normalized.supplier !== supplier) return false;
      }
      if (stock === 'threshold' && !isInThreshold(wine)) return false;
      if (stock === 'out' && wine.qty > 0) return false;
      return true;
    });
  }, [effectiveFilters, normalizedFilterFieldsByWineId, searchTextByWineId, wines]);
  const archiveStats = useMemo(() => {
    let thresholdCount = 0;
    let outCount = 0;
    for (const wine of wines) {
      if (isInThreshold(wine)) thresholdCount += 1;
      if (wine.qty <= 0) outCount += 1;
    }
    return {
      winesCount: wines.length,
      thresholdCount,
      outCount
    };
  }, [wines]);
  const hasActiveFilters = useMemo(() => hasActiveArchiveFilters(filters), [filters]);
  const canOpenBulkEdit = hasActiveFilters && !loading && filteredWines.length > 0;

  const handleAddCategory = useCallback(
    (rawValue: string) => {
      const result = upsertManagedCategory(rawValue, categories, managedCategories);
      if (result.changed) {
        setManagedCategories(result.managedNext);
      }
      const createdCategory = result.created;
      if (createdCategory) {
        void upsertSupabaseCategory(createdCategory);
        setSupabaseCategories((prev) => listCategoryOptions([], [...prev, createdCategory]));
      }
      return result.created;
    },
    [categories, managedCategories]
  );
  const handleAddOrigin = useCallback(
    (rawValue: string) => {
      const result = upsertManagedOrigin(rawValue, origins, managedOrigins);
      if (result.changed) setManagedOrigins(result.managedNext);
      return result.created;
    },
    [managedOrigins, origins]
  );
  const handleAddProducer = useCallback(
    (rawValue: string) => {
      const result = upsertManagedProducer(rawValue, producers, managedProducers);
      if (result.changed) setManagedProducers(result.managedNext);
      return result.created;
    },
    [managedProducers, producers]
  );
  const handleAddSupplier = useCallback(
    (rawValue: string) => {
      const result = upsertManagedSupplier(rawValue, suppliers, managedSuppliers);
      if (result.changed) {
        setManagedSuppliers(result.managedNext);
      }
      const createdSupplier = result.created;
      if (createdSupplier) {
        void upsertSupabaseSupplier(createdSupplier);
        setSupabaseSuppliers((prev) => listSupplierOptions([], [...prev, createdSupplier]));
      }
      return result.created;
    },
    [managedSuppliers, suppliers]
  );

  const handleRequestAddCategory = useCallback((onResult: (created: string | null) => void) => {
    setCategoryResultHandler(() => onResult);
    setCategoryModalOpen(true);
  }, []);
  const handleRequestAddOrigin = useCallback((onResult: (created: string | null) => void) => {
    setOriginResultHandler(() => onResult);
    setOriginModalOpen(true);
  }, []);
  const handleRequestAddProducer = useCallback((onResult: (created: string | null) => void) => {
    setProducerResultHandler(() => onResult);
    setProducerModalOpen(true);
  }, []);
  const handleRequestAddSupplier = useCallback((onResult: (created: string | null) => void) => {
    setSupplierResultHandler(() => onResult);
    setSupplierModalOpen(true);
  }, []);

  const closeCategoryModal = useCallback(() => {
    setCategoryModalOpen(false);
    setCategoryResultHandler(null);
  }, []);
  const closeOriginModal = useCallback(() => {
    setOriginModalOpen(false);
    setOriginResultHandler(null);
  }, []);
  const closeProducerModal = useCallback(() => {
    setProducerModalOpen(false);
    setProducerResultHandler(null);
  }, []);
  const closeSupplierModal = useCallback(() => {
    setSupplierModalOpen(false);
    setSupplierResultHandler(null);
  }, []);

  const confirmAddCategory = useCallback(
    (rawValue: string) => {
      const created = handleAddCategory(rawValue);
      if (categoryResultHandler) categoryResultHandler(created);
      closeCategoryModal();
    },
    [categoryResultHandler, closeCategoryModal, handleAddCategory]
  );

  const cancelAddCategory = useCallback(() => {
    if (categoryResultHandler) categoryResultHandler(null);
    closeCategoryModal();
  }, [categoryResultHandler, closeCategoryModal]);
  const confirmAddOrigin = useCallback(
    (rawValue: string) => {
      const created = handleAddOrigin(rawValue);
      if (originResultHandler) originResultHandler(created);
      closeOriginModal();
    },
    [handleAddOrigin, originResultHandler, closeOriginModal]
  );
  const cancelAddOrigin = useCallback(() => {
    if (originResultHandler) originResultHandler(null);
    closeOriginModal();
  }, [originResultHandler, closeOriginModal]);
  const confirmAddProducer = useCallback(
    (rawValue: string) => {
      const created = handleAddProducer(rawValue);
      if (producerResultHandler) producerResultHandler(created);
      closeProducerModal();
    },
    [closeProducerModal, handleAddProducer, producerResultHandler]
  );
  const cancelAddProducer = useCallback(() => {
    if (producerResultHandler) producerResultHandler(null);
    closeProducerModal();
  }, [closeProducerModal, producerResultHandler]);
  const confirmAddSupplier = useCallback(
    (rawValue: string) => {
      const created = handleAddSupplier(rawValue);
      if (supplierResultHandler) supplierResultHandler(created);
      closeSupplierModal();
    },
    [closeSupplierModal, handleAddSupplier, supplierResultHandler]
  );
  const cancelAddSupplier = useCallback(() => {
    if (supplierResultHandler) supplierResultHandler(null);
    closeSupplierModal();
  }, [closeSupplierModal, supplierResultHandler]);

  const openCreate = () => {
    setModalMode('create');
    setFormState(emptyWine);
    setModalOpen(true);
  };

  const openEdit = (wine: Wine) => {
    setModalMode('edit');
    setFormState({ ...wine, supplier: wine.supplier ?? '' });
    setModalOpen(true);
  };

  const closeForm = () => {
    setModalOpen(false);
    setFormState(emptyWine);
  };

  const handleSubmit = async (payload: WineFormState) => {
    setBusy(true);
    try {
      if (modalMode === 'create') {
        await createWine({ ...payload, id: undefined });
      } else {
        await updateWine(payload);
      }
      await loadWines();
      closeForm();
    } catch (err) {
      console.error('[WineAdminPage] submit error', err);
      setError('Operazione non riuscita. Riprova.');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setBusy(true);
    try {
      await deleteWine(deleteId);
      await loadWines();
    } catch (err) {
      console.error('[WineAdminPage] delete error', err);
      setError('Eliminazione non riuscita.');
    } finally {
      setBusy(false);
      setDeleteId(null);
    }
  };

  const handleQuickQtyUpdate = async (wine: Wine, nextQty: number) => {
    setBusy(true);
    try {
      await updateWine({
        id: wine.id,
        category: wine.category ?? '',
        name: wine.name,
        age: wine.age ?? '',
        producer: wine.producer,
        origin: wine.origin,
        supplier: wine.supplier ?? '',
        threshold: wine.threshold,
        purchasePrice: wine.purchasePrice,
        salePrice: wine.salePrice,
        vintage: wine.vintage,
        qty: nextQty,
        notes: wine.notes
      });
      await loadWines();
      return true;
    } catch (err) {
      console.error('[WineAdminPage] quick qty update error', err);
      setError('Aggiornamento quantità non riuscito.');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const handleInlineFieldsUpdate = async (
    wine: Wine,
    patch: {
      name?: string;
      age?: string;
      category?: string;
      producer?: string;
      origin?: string;
      supplier?: string;
    }
  ) => {
    setBusy(true);
    try {
      await updateWine({
        id: wine.id,
        category: patch.category ?? wine.category ?? '',
        name: patch.name ?? wine.name,
        age: patch.age ?? wine.age ?? '',
        producer: patch.producer ?? wine.producer,
        origin: patch.origin ?? wine.origin,
        supplier: patch.supplier ?? wine.supplier ?? '',
        threshold: wine.threshold,
        purchasePrice: wine.purchasePrice,
        salePrice: wine.salePrice,
        vintage: wine.vintage,
        qty: wine.qty,
        notes: wine.notes
      });
      await loadWines();
      return true;
    } catch (err) {
      console.error('[WineAdminPage] inline fields update error', err);
      setError('Aggiornamento inline non riuscito.');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const handleBulkEditConfirm = useCallback(
    async (payload: { category?: string; supplier?: string }) => {
      const nextCategory = payload.category?.trim() ?? '';
      const nextSupplier = payload.supplier?.trim() ?? '';
      if (!nextCategory && !nextSupplier) {
        setError('Seleziona almeno un campo da applicare (categoria e/o fornitore).');
        return;
      }

      const targetWines = [...filteredWines];
      if (targetWines.length === 0) {
        setBulkEditModalOpen(false);
        return;
      }

      setBulkEditBusy(true);
      setBusy(true);
      try {
        const createdCategory = nextCategory ? handleAddCategory(nextCategory) : null;
        const categoryToApply = nextCategory ? (createdCategory ?? nextCategory) : undefined;
        const createdSupplier = nextSupplier ? handleAddSupplier(nextSupplier) : null;
        const supplierToApply = nextSupplier ? (createdSupplier ?? nextSupplier) : undefined;

        for (let i = 0; i < targetWines.length; i += bulkUpdateBatchSize) {
          const chunk = targetWines.slice(i, i + bulkUpdateBatchSize);
          await Promise.all(
            chunk.map((wine) =>
              updateWine({
                id: wine.id,
                category: categoryToApply ?? wine.category ?? '',
                name: wine.name,
                age: wine.age ?? '',
                producer: wine.producer,
                origin: wine.origin,
                supplier: supplierToApply ?? wine.supplier ?? '',
                threshold: wine.threshold,
                purchasePrice: wine.purchasePrice,
                salePrice: wine.salePrice,
                vintage: wine.vintage,
                qty: wine.qty,
                notes: wine.notes
              })
            )
          );
        }

        await loadWines();
        setBulkEditModalOpen(false);
      } catch (err) {
        console.error('[WineAdminPage] bulk edit error', err);
        setError('Modifica massiva non riuscita.');
      } finally {
        setBulkEditBusy(false);
        setBusy(false);
      }
    },
    [bulkUpdateBatchSize, filteredWines, handleAddCategory, handleAddSupplier, loadWines]
  );

  return (
    <div className="container archiveDesktopContainer">
      <div className="archiveLogoTop">
        <img
          className="archiveLogoImg"
          src="/logo.png"
          alt="Enoteca Italiana"
          loading="lazy"
          decoding="async"
          width={2252}
          height={237}
        />
      </div>

      <AdminArchiveToolbar
        winesCount={archiveStats.winesCount}
        thresholdCount={archiveStats.thresholdCount}
        outCount={archiveStats.outCount}
        wines={filteredWines}
        filters={filters}
        categories={categories}
        producers={producers}
        origins={origins}
        suppliers={suppliers}
        onFiltersChange={setFilters}
        onRequestAddCategory={handleRequestAddCategory}
        onRequestAddProducer={handleRequestAddProducer}
        onRequestAddOrigin={handleRequestAddOrigin}
        onRequestAddSupplier={handleRequestAddSupplier}
        onResetFilters={() => {
          setFilters(defaultFilters);
          setTableResetVersion((prev) => prev + 1);
        }}
        onOpenCreate={openCreate}
        onOpenAi={() => setAiModalOpen(true)}
        noteReady={hasDischargeNote}
        onOpenDischargeNote={() => setDischargeNoteOpen(true)}
      />

      {error ? (
        <div className="card adminCard mt12 adminError">
          <div className="lineTitle">{error}</div>
        </div>
      ) : null}

      <AdminArchiveTable
        wines={filteredWines}
        categories={categories}
        producers={producers}
        origins={origins}
        suppliers={suppliers}
        loading={loading}
        onEdit={openEdit}
        onDelete={setDeleteId}
        onUpdateQty={handleQuickQtyUpdate}
        onUpdateInlineFields={handleInlineFieldsUpdate}
        resetVersion={tableResetVersion}
        bulkEditEnabled={canOpenBulkEdit}
        onOpenBulkEdit={() => setBulkEditModalOpen(true)}
      />

      <WineArchiveFormModal
        open={modalOpen}
        mode={modalMode}
        busy={busy}
        initial={formState}
        categories={categories}
        origins={origins}
        suppliers={suppliers}
        onRequestAddCategory={handleRequestAddCategory}
        onRequestAddOrigin={handleRequestAddOrigin}
        onRequestAddSupplier={handleRequestAddSupplier}
        onSubmit={handleSubmit}
        onCancel={closeForm}
      />
      <AiAssistantModal open={aiModalOpen} wines={wines} onClose={() => setAiModalOpen(false)} />
      <BulkEditFilteredModal
        open={bulkEditModalOpen}
        busy={busy || bulkEditBusy}
        filteredCount={filteredWines.length}
        categories={categories}
        suppliers={suppliers}
        onConfirm={handleBulkEditConfirm}
        onCancel={() => {
          if (busy || bulkEditBusy) return;
          setBulkEditModalOpen(false);
        }}
      />
      <DischargeNoteDrawer
        open={dischargeNoteOpen}
        wines={wines}
        onClose={() => setDischargeNoteOpen(false)}
      />

      <CategoryCreateModal
        open={categoryModalOpen}
        existingValues={categories}
        forceUppercase
        onCancel={cancelAddCategory}
        onConfirm={confirmAddCategory}
      />
      <CategoryCreateModal
        open={originModalOpen}
        existingValues={origins}
        forceUppercase
        title="Nuova provenienza"
        inputPlaceholder="Inserisci provenienza"
        similarTitle="Provenienze già presenti simili"
        duplicateMessage="Provenienza già esistente: se confermi, verrà riusata quella esistente."
        ariaLabel="Nuova provenienza"
        onCancel={cancelAddOrigin}
        onConfirm={confirmAddOrigin}
      />
      <CategoryCreateModal
        open={producerModalOpen}
        existingValues={producers}
        title="Nuovo produttore"
        inputPlaceholder="Inserisci produttore"
        similarTitle="Produttori già presenti simili"
        duplicateMessage="Produttore già esistente: se confermi, verrà riusato quello esistente."
        ariaLabel="Nuovo produttore"
        onCancel={cancelAddProducer}
        onConfirm={confirmAddProducer}
      />
      <CategoryCreateModal
        open={supplierModalOpen}
        existingValues={suppliers}
        title="Nuovo fornitore"
        inputPlaceholder="Inserisci fornitore"
        similarTitle="Fornitori già presenti simili"
        duplicateMessage="Fornitore già esistente: se confermi, verrà riusato quello esistente."
        ariaLabel="Nuovo fornitore"
        onCancel={cancelAddSupplier}
        onConfirm={confirmAddSupplier}
      />

      <ConfirmModal
        open={deleteId !== null}
        title="Eliminare il vino?"
        description="L'operazione aggiorna Supabase e la sync di backup."
        confirmLabel={busy ? 'Elimino…' : 'Elimina'}
        cancelLabel="Annulla"
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
