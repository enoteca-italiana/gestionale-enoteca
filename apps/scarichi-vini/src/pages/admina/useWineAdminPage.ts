import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import type { Wine } from '@/domain/types';
import type { AppDomain } from '@/app/appDomainContext';
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
import { archiveResetEvent } from '@/data/wineRepository';
import { isInThreshold } from '@/pages/admina/utils/wineFilters';
import {
  defaultFilters,
  emptyWine,
  hasActiveArchiveFilters,
  sanitizeFiltersForSpirits,
  type Filters,
  type Mode,
  type WineFormState
} from '@/pages/admina/types';

const BULK_UPDATE_BATCH_SIZE = 40;

type DomainRepository = {
  list: () => Promise<Wine[]>;
  create: (payload: WineFormState) => Promise<unknown>;
  update: (payload: WineFormState & { id: string }) => Promise<unknown>;
  deleteOne: (id: string) => Promise<unknown>;
};

let wineRepositoryPromise: Promise<typeof import('@/data/wineRepository')> | null = null;
let spiritsRepositoryPromise: Promise<typeof import('@/data/spiritsRepository')> | null = null;

async function loadDomainRepository(domain: AppDomain): Promise<DomainRepository> {
  if (domain === 'wine') {
    wineRepositoryPromise ??= import('@/data/wineRepository');
    const mod = await wineRepositoryPromise;
    return {
      list: () => mod.listWines({ forceRemote: true }),
      create: (payload) => mod.createWine({ ...payload, id: undefined }),
      update: (payload) => mod.updateWine(payload),
      deleteOne: (id) => mod.deleteWine(id)
    };
  }
  spiritsRepositoryPromise ??= import('@/data/spiritsRepository');
  const mod = await spiritsRepositoryPromise;
  return {
    list: () => mod.listSpirits(),
    create: (payload) => mod.createSpirit({ ...payload, id: undefined }),
    update: (payload) => mod.updateSpirit(payload),
    deleteOne: (id) => mod.deleteSpirit(id)
  };
}

export function useWineAdminPage(domain: AppDomain = 'wine') {
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
  const [bulkEditModalOpen, setBulkEditModalOpen] = useState(false);
  const [bulkEditBusy, setBulkEditBusy] = useState(false);
  const deferredTerm = useDeferredValue(filters.term);

  const loadWines = useCallback(async () => {
    setError(null);
    const local = domain === 'wine' ? loadDb().inventory : [];
    const hasLocalData = local.length > 0;
    if (hasLocalData) {
      setWines(local);
      setLoading(false);
    } else {
      setLoading(true);
    }
    try {
      const repo = await loadDomainRepository(domain);
      setWines(await repo.list());
    } catch (err) {
      console.error('[WineAdminPage] load error', err);
      if (!hasLocalData) {
        setError('Impossibile caricare i vini. Verifica connessione/Supabase.');
      }
    } finally {
      setLoading(false);
    }
  }, [domain]);

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
    if (domain === 'wine') return;
    setFilters((prev) => sanitizeFiltersForSpirits(prev));
  }, [domain]);

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
  const allOrigins = useMemo(
    () => listOriginOptions(wines, managedOrigins),
    [wines, managedOrigins]
  );
  const allProducers = useMemo(
    () => listProducerOptions(wines, managedProducers),
    [managedProducers, wines]
  );
  const effectiveFilters = useMemo(() => {
    const next = { ...filters, term: deferredTerm };
    return domain === 'wine' ? next : sanitizeFiltersForSpirits(next);
  }, [deferredTerm, domain, filters]);
  const searchTextByWineId = useMemo(() => {
    const map = new Map<string, string>();
    for (const wine of wines) {
      map.set(
        wine.id,
        [wine.category, wine.name, wine.age, wine.producer, wine.origin, wine.notes, wine.warehouse]
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
    return { winesCount: wines.length, thresholdCount, outCount };
  }, [wines]);

  const hasActiveFilters = useMemo(() => hasActiveArchiveFilters(filters), [filters]);
  const canOpenBulkEdit = hasActiveFilters && !loading && filteredWines.length > 0;

  const handleAddCategory = useCallback(
    (rawValue: string) => {
      const result = upsertManagedCategory(rawValue, allCategories, managedCategories);
      if (result.changed) setManagedCategories(result.managedNext);
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
    if (
      selected !== 'all' &&
      !scoped.some((value) => value.toLowerCase() === selected.toLowerCase())
    ) {
      return listCategoryOptions([], [...scoped, selected]);
    }
    return scoped;
  }, [filters.category, hasMatchingCategory, wines]);
  const producers = useMemo(() => {
    const scoped = listProducerOptions(wines.filter(hasMatchingProducer), []);
    const selected = filters.producer;
    if (
      selected !== 'all' &&
      !scoped.some((value) => value.toLowerCase() === selected.toLowerCase())
    ) {
      return listProducerOptions([], [...scoped, selected]);
    }
    return scoped;
  }, [filters.producer, hasMatchingProducer, wines]);
  const origins = useMemo(() => {
    const scoped = listOriginOptions(wines.filter(hasMatchingOrigin), []);
    const selected = filters.origin;
    if (
      selected !== 'all' &&
      !scoped.some((value) => value.toLowerCase() === selected.toLowerCase())
    ) {
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
    setFormState(domain === 'wine' ? emptyWine : { ...emptyWine, origin: '' });
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
        const repo = await loadDomainRepository(domain);
        await repo.create(payload);
      } else {
        if (!payload.id) throw new Error('Missing id for update');
        const repo = await loadDomainRepository(domain);
        await repo.update(payload as WineFormState & { id: string });
      }
      const repo = await loadDomainRepository(domain);
      setWines(await repo.list());
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
      const repo = await loadDomainRepository(domain);
      await repo.deleteOne(deleteId);
      setWines(await repo.list());
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
      const repo = await loadDomainRepository(domain);
      await repo.update({
        id: wine.id,
        category: wine.category ?? '',
        name: wine.name,
        age: wine.age ?? '',
        producer: wine.producer,
        origin: wine.origin,
        threshold: wine.threshold,
        purchasePrice: wine.purchasePrice,
        salePrice: wine.salePrice,
        qty: nextQty,
        notes: wine.notes
      });
      setWines(await repo.list());
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
      purchasePrice?: number;
    }
  ) => {
    setBusy(true);
    try {
      const nextPurchasePrice = Object.prototype.hasOwnProperty.call(patch, 'purchasePrice')
        ? patch.purchasePrice
        : wine.purchasePrice;
      const repo = await loadDomainRepository(domain);
      await repo.update({
        id: wine.id,
        category: patch.category ?? wine.category ?? '',
        name: patch.name ?? wine.name,
        age: patch.age ?? wine.age ?? '',
        producer: patch.producer ?? wine.producer,
        origin: patch.origin ?? wine.origin,
        threshold: wine.threshold,
        purchasePrice: nextPurchasePrice,
        salePrice: wine.salePrice,
        qty: wine.qty,
        notes: wine.notes
      });
      setWines(await repo.list());
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
        for (let i = 0; i < targetWines.length; i += BULK_UPDATE_BATCH_SIZE) {
          const chunk = targetWines.slice(i, i + BULK_UPDATE_BATCH_SIZE);
          await Promise.all(
            chunk.map((wine) =>
              (async () => {
                const repo = await loadDomainRepository(domain);
                return repo.update({
                  id: wine.id,
                  category: categoryToApply ?? wine.category ?? '',
                  name: wine.name,
                  age: wine.age ?? '',
                  producer: wine.producer,
                  origin: wine.origin,
                  threshold: wine.threshold,
                  purchasePrice: wine.purchasePrice,
                  salePrice: wine.salePrice,
                  qty: wine.qty,
                  notes: wine.notes
                });
              })()
            )
          );
        }
        const repo = await loadDomainRepository(domain);
        setWines(await repo.list());
        setBulkEditModalOpen(false);
      } catch (err) {
        console.error('[WineAdminPage] bulk edit error', err);
        setError('Modifica massiva non riuscita.');
      } finally {
        setBulkEditBusy(false);
        setBusy(false);
      }
    },
    [domain, filteredWines, handleAddCategory]
  );

  const resetFilters = () => {
    setFilters(defaultFilters);
    setTableResetVersion((prev) => prev + 1);
  };

  return {
    wines,
    loading,
    error,
    filters,
    setFilters,
    tableResetVersion,
    modalOpen,
    modalMode,
    formState,
    deleteId,
    setDeleteId,
    busy,
    bulkEditModalOpen,
    setBulkEditModalOpen,
    bulkEditBusy,
    categoryModalOpen,
    originModalOpen,
    producerModalOpen,
    allCategories,
    allOrigins,
    allProducers,
    filteredWines,
    archiveStats,
    canOpenBulkEdit,
    categories,
    producers,
    origins,
    handleRequestAddCategory,
    handleRequestAddOrigin,
    handleRequestAddProducer,
    confirmAddCategory,
    cancelAddCategory,
    confirmAddOrigin,
    cancelAddOrigin,
    confirmAddProducer,
    cancelAddProducer,
    openCreate,
    openEdit,
    closeForm,
    handleSubmit,
    handleDelete,
    handleQuickQtyUpdate,
    handleInlineFieldsUpdate,
    handleBulkEditConfirm,
    resetFilters
  };
}
