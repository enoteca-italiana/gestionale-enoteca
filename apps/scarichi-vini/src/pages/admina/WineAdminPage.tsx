import { Suspense, lazy, useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
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
  listProducerOptions,
  loadManagedProducers,
  upsertManagedProducer
} from '@/data/producerRepository';
import { loadDb } from '@/data/localDb';
import {
  archiveResetEvent,
  createWine,
  deleteWine,
  listWines,
  updateWine
} from '@/data/wineRepository';
import { AdminArchiveToolbar } from '@/pages/admina/components/AdminArchiveToolbar';
import { AdminArchiveTable } from '@/pages/admina/components/AdminArchiveTable';
import { BulkEditFilteredModal } from '@/pages/admina/components/BulkEditFilteredModal';
import { CategoryCreateModal } from '@/pages/admina/components/CategoryCreateModal';
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

const AiAssistantModal = lazy(() =>
  import('@/pages/admina/components/AiAssistantModal').then((m) => ({
    default: m.AiAssistantModal
  }))
);

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
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [bulkEditModalOpen, setBulkEditModalOpen] = useState(false);
  const [bulkEditBusy, setBulkEditBusy] = useState(false);
  const deferredTerm = useDeferredValue(filters.term);
  const bulkUpdateBatchSize = 40;

  const loadWines = useCallback(async () => {
    setError(null);
    const local = loadDb().inventory;
    const hasLocalData = local.length > 0;
    if (hasLocalData) {
      setWines(local);
      setLoading(false);
    } else {
      setLoading(true);
    }
    try {
      // Keep local warm start for instant UI, but always sync authoritative remote data.
      setWines(await listWines({ forceRemote: true }));
    } catch (err) {
      console.error('[WineAdminPage] load error', err);
      if (!hasLocalData) {
        setError('Impossibile caricare i vini. Verifica connessione/Supabase.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshCategoryRegistry = useCallback(async () => {
    const values = await listSupabaseCategories();
    setSupabaseCategories(values);
  }, []);

  useEffect(() => {
    void loadWines();
  }, [loadWines]);

  useEffect(() => {
    void refreshCategoryRegistry();
  }, [refreshCategoryRegistry]);

  useEffect(() => {
    const onArchiveReset = () => {
      setManagedCategories(loadManagedCategories());
      setManagedOrigins(loadManagedOrigins());
      setManagedProducers(loadManagedProducers());
      void refreshCategoryRegistry();
      void loadWines();
      setFilters(defaultFilters);
      setTableResetVersion((prev) => prev + 1);
    };
    window.addEventListener(archiveResetEvent, onArchiveReset);
    return () => window.removeEventListener(archiveResetEvent, onArchiveReset);
  }, [loadWines, refreshCategoryRegistry]);

  const allCategories = useMemo(
    () => listCategoryOptions(wines, [...managedCategories, ...supabaseCategories]),
    [wines, managedCategories, supabaseCategories]
  );
  const allOrigins = useMemo(() => listOriginOptions(wines, managedOrigins), [wines, managedOrigins]);
  const allProducers = useMemo(
    () => listProducerOptions(wines, managedProducers),
    [managedProducers, wines]
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
    const map = new Map<string, { category: string; producer: string; origin: string }>();
    for (const wine of wines) {
      map.set(wine.id, {
        category: wine.category?.toLowerCase() ?? '',
        producer: wine.producer?.toLowerCase() ?? '',
        origin: wine.origin?.toLowerCase() ?? ''
      });
    }
    return map;
  }, [wines]);
  const filteredWines = useMemo(() => {
    const term = effectiveFilters.term.trim().toLowerCase();
    const category = effectiveFilters.category.toLowerCase();
    const producer = effectiveFilters.producer.toLowerCase();
    const origin = effectiveFilters.origin.toLowerCase();
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
      const result = upsertManagedCategory(rawValue, allCategories, managedCategories);
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
    [allCategories, managedCategories]
  );
  const handleAddOrigin = useCallback(
    (rawValue: string) => {
      const result = upsertManagedOrigin(rawValue, allOrigins, managedOrigins);
      if (result.changed) setManagedOrigins(result.managedNext);
      return result.created;
    },
    [allOrigins, managedOrigins]
  );
  const handleAddProducer = useCallback(
    (rawValue: string) => {
      const result = upsertManagedProducer(rawValue, allProducers, managedProducers);
      if (result.changed) setManagedProducers(result.managedNext);
      return result.created;
    },
    [allProducers, managedProducers]
  );

  const hasMatchingCategory = useCallback(
    (wine: Wine) => {
      const term = filters.term.trim().toLowerCase();
      if (term) {
        const haystack = searchTextByWineId.get(wine.id) ?? '';
        if (!haystack.includes(term)) return false;
      }
      if (filters.producer !== 'all') {
        if ((wine.producer ?? '').toLowerCase() !== filters.producer.toLowerCase()) return false;
      }
      if (filters.origin !== 'all') {
        if ((wine.origin ?? '').toLowerCase() !== filters.origin.toLowerCase()) return false;
      }
      return true;
    },
    [filters.origin, filters.producer, filters.term, searchTextByWineId]
  );

  const hasMatchingProducer = useCallback(
    (wine: Wine) => {
      const term = filters.term.trim().toLowerCase();
      if (term) {
        const haystack = searchTextByWineId.get(wine.id) ?? '';
        if (!haystack.includes(term)) return false;
      }
      if (filters.category !== 'all') {
        if ((wine.category ?? '').toLowerCase() !== filters.category.toLowerCase()) return false;
      }
      if (filters.origin !== 'all') {
        if ((wine.origin ?? '').toLowerCase() !== filters.origin.toLowerCase()) return false;
      }
      return true;
    },
    [filters.category, filters.origin, filters.term, searchTextByWineId]
  );

  const hasMatchingOrigin = useCallback(
    (wine: Wine) => {
      const term = filters.term.trim().toLowerCase();
      if (term) {
        const haystack = searchTextByWineId.get(wine.id) ?? '';
        if (!haystack.includes(term)) return false;
      }
      if (filters.category !== 'all') {
        if ((wine.category ?? '').toLowerCase() !== filters.category.toLowerCase()) return false;
      }
      if (filters.producer !== 'all') {
        if ((wine.producer ?? '').toLowerCase() !== filters.producer.toLowerCase()) return false;
      }
      return true;
    },
    [filters.category, filters.producer, filters.term, searchTextByWineId]
  );

  const categories = useMemo(() => {
    const scoped = listCategoryOptions(wines.filter(hasMatchingCategory), []);
    const selected = filters.category;
    if (selected !== 'all' && !scoped.some((value) => value.toLowerCase() === selected.toLowerCase())) {
      return listCategoryOptions([], [...scoped, selected]);
    }
    return scoped;
  }, [filters.category, hasMatchingCategory, wines]);

  const producers = useMemo(() => {
    const scoped = listProducerOptions(wines.filter(hasMatchingProducer), []);
    const selected = filters.producer;
    if (selected !== 'all' && !scoped.some((value) => value.toLowerCase() === selected.toLowerCase())) {
      return listProducerOptions([], [...scoped, selected]);
    }
    return scoped;
  }, [filters.producer, hasMatchingProducer, wines]);

  const origins = useMemo(() => {
    const scoped = listOriginOptions(wines.filter(hasMatchingOrigin), []);
    const selected = filters.origin;
    if (selected !== 'all' && !scoped.some((value) => value.toLowerCase() === selected.toLowerCase())) {
      return listOriginOptions([], [...scoped, selected]);
    }
    return scoped;
  }, [filters.origin, hasMatchingOrigin, wines]);
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
  const openCreate = () => {
    setModalMode('create');
    setFormState(emptyWine);
    setModalOpen(true);
  };

  const openEdit = (wine: Wine) => {
    setModalMode('edit');
    setFormState({ ...wine });
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
      setWines(loadDb().inventory);
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
      setWines(loadDb().inventory);
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
        threshold: wine.threshold,
        purchasePrice: wine.purchasePrice,
        salePrice: wine.salePrice,
        vintage: wine.vintage,
        qty: nextQty,
        notes: wine.notes
      });
      setWines(loadDb().inventory);
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
        threshold: wine.threshold,
        purchasePrice: wine.purchasePrice,
        salePrice: wine.salePrice,
        vintage: wine.vintage,
        qty: wine.qty,
        notes: wine.notes
      });
      setWines(loadDb().inventory);
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
    async (payload: { category?: string }) => {
      const nextCategory = payload.category?.trim() ?? '';
      if (!nextCategory) {
        setError('Seleziona almeno un campo da applicare (categoria).');
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

        setWines(loadDb().inventory);
        setBulkEditModalOpen(false);
      } catch (err) {
        console.error('[WineAdminPage] bulk edit error', err);
        setError('Modifica massiva non riuscita.');
      } finally {
        setBulkEditBusy(false);
        setBusy(false);
      }
    },
    [bulkUpdateBatchSize, filteredWines, handleAddCategory]
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
        onFiltersChange={setFilters}
        onRequestAddCategory={handleRequestAddCategory}
        onRequestAddProducer={handleRequestAddProducer}
        onRequestAddOrigin={handleRequestAddOrigin}
        onResetFilters={() => {
          setFilters(defaultFilters);
          setTableResetVersion((prev) => prev + 1);
        }}
        onOpenCreate={openCreate}
        onOpenAi={() => setAiModalOpen(true)}
      />

      {error ? (
        <div className="card adminCard mt12 adminError">
          <div className="lineTitle">{error}</div>
        </div>
      ) : null}

      <AdminArchiveTable
        wines={filteredWines}
        categories={allCategories}
        producers={allProducers}
        origins={allOrigins}
        loading={loading}
        onEdit={openEdit}
        onDelete={setDeleteId}
        onUpdateQty={handleQuickQtyUpdate}
        onUpdateInlineFields={handleInlineFieldsUpdate}
        onRequestAddCategory={handleRequestAddCategory}
        onRequestAddProducer={handleRequestAddProducer}
        onRequestAddOrigin={handleRequestAddOrigin}
        resetVersion={tableResetVersion}
        bulkEditEnabled={canOpenBulkEdit}
        onOpenBulkEdit={() => setBulkEditModalOpen(true)}
      />

      <WineArchiveFormModal
        open={modalOpen}
        mode={modalMode}
        busy={busy}
        initial={formState}
        categories={allCategories}
        origins={allOrigins}
        onRequestAddCategory={handleRequestAddCategory}
        onRequestAddOrigin={handleRequestAddOrigin}
        onSubmit={handleSubmit}
        onCancel={closeForm}
      />
      {aiModalOpen ? (
        <Suspense fallback={null}>
          <AiAssistantModal
            open={aiModalOpen}
            wines={wines}
            onClose={() => setAiModalOpen(false)}
          />
        </Suspense>
      ) : null}
      <BulkEditFilteredModal
        open={bulkEditModalOpen}
        busy={busy || bulkEditBusy}
        filteredCount={filteredWines.length}
        categories={allCategories}
        onConfirm={handleBulkEditConfirm}
        onCancel={() => {
          if (busy || bulkEditBusy) return;
          setBulkEditModalOpen(false);
        }}
      />
      <CategoryCreateModal
        open={categoryModalOpen}
        existingValues={allCategories}
        forceUppercase
        onCancel={cancelAddCategory}
        onConfirm={confirmAddCategory}
      />
      <CategoryCreateModal
        open={originModalOpen}
        existingValues={allOrigins}
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
        existingValues={allProducers}
        title="Nuovo produttore"
        inputPlaceholder="Inserisci produttore"
        similarTitle="Produttori già presenti simili"
        duplicateMessage="Produttore già esistente: se confermi, verrà riusato quello esistente."
        ariaLabel="Nuovo produttore"
        onCancel={cancelAddProducer}
        onConfirm={confirmAddProducer}
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
