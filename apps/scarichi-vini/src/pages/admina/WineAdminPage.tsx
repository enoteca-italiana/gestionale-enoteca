import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Wine } from '@/domain/types';
import { ConfirmModal } from '@/components/ConfirmModal';
import {
  listCategoryOptions,
  listSupabaseCategories,
  loadManagedCategories,
  upsertSupabaseCategory,
  upsertManagedCategory
} from '@/data/categoryRepository';
import { listOriginOptions, loadManagedOrigins, upsertManagedOrigin } from '@/data/originRepository';
import {
  listSupplierOptions,
  listSupabaseSuppliers,
  loadManagedSuppliers,
  upsertSupabaseSupplier,
  upsertManagedSupplier
} from '@/data/supplierRepository';
import { createWine, deleteWine, listWines, updateWine } from '@/data/wineRepository';
import { AdminArchiveToolbar } from '@/pages/admina/components/AdminArchiveToolbar';
import { AdminArchiveTable } from '@/pages/admina/components/AdminArchiveTable';
import { AiAssistantModal } from '@/pages/admina/components/AiAssistantModal';
import { CategoryCreateModal } from '@/pages/admina/components/CategoryCreateModal';
import { WineArchiveFormModal } from '@/pages/admina/components/WineArchiveFormModal';
import { isInThreshold, matchesFilters } from '@/pages/admina/utils/wineFilters';
import {
  defaultFilters,
  emptyWine,
  type Filters,
  type Mode,
  type WineFormState
} from '@/pages/admina/types';

export function WineAdminPage() {
  const [wines, setWines] = useState<Wine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<Mode>('create');
  const [formState, setFormState] = useState<WineFormState>(emptyWine);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [managedCategories, setManagedCategories] = useState<string[]>(() => loadManagedCategories());
  const [supabaseCategories, setSupabaseCategories] = useState<string[]>([]);
  const [managedOrigins, setManagedOrigins] = useState<string[]>(() => loadManagedOrigins());
  const [managedSuppliers, setManagedSuppliers] = useState<string[]>(() => loadManagedSuppliers());
  const [supabaseSuppliers, setSupabaseSuppliers] = useState<string[]>([]);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [categoryResultHandler, setCategoryResultHandler] =
    useState<((created: string | null) => void) | null>(null);
  const [originModalOpen, setOriginModalOpen] = useState(false);
  const [originResultHandler, setOriginResultHandler] =
    useState<((created: string | null) => void) | null>(null);
  const [supplierModalOpen, setSupplierModalOpen] = useState(false);
  const [supplierResultHandler, setSupplierResultHandler] =
    useState<((created: string | null) => void) | null>(null);
  const [aiModalOpen, setAiModalOpen] = useState(false);

  const loadWines = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setWines(await listWines());
    } catch (err) {
      console.error('[WineAdminPage] load error', err);
      setError('Impossibile caricare i vini. Verifica connessione/Supabase.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadWines();
  }, [loadWines]);

  useEffect(() => {
    let alive = true;
    const loadCategoryRegistry = async () => {
      const values = await listSupabaseCategories();
      if (!alive) return;
      setSupabaseCategories(values);
    };
    void loadCategoryRegistry();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    const loadSupplierRegistry = async () => {
      const values = await listSupabaseSuppliers();
      if (!alive) return;
      setSupabaseSuppliers(values);
    };
    void loadSupplierRegistry();
    return () => {
      alive = false;
    };
  }, []);

  const categories = useMemo(
    () => listCategoryOptions(wines, [...managedCategories, ...supabaseCategories]),
    [wines, managedCategories, supabaseCategories]
  );
  const origins = useMemo(() => listOriginOptions(wines, managedOrigins), [wines, managedOrigins]);
  const producers = useMemo(() => {
    const unique = new Map<string, string>();
    for (const wine of wines) {
      const value = wine.producer?.trim() ?? '';
      if (!value) continue;
      const key = value.toLowerCase();
      if (!unique.has(key)) unique.set(key, value);
    }
    return Array.from(unique.values()).sort((a, b) =>
      a.localeCompare(b, 'it', { sensitivity: 'base' })
    );
  }, [wines]);
  const suppliers = useMemo(
    () => listSupplierOptions(wines, [...managedSuppliers, ...supabaseSuppliers]),
    [wines, managedSuppliers, supabaseSuppliers]
  );

  const filteredWines = useMemo(
    () => wines.filter((w) => matchesFilters(w, filters)),
    [wines, filters]
  );

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2400);
  };

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
        showToast('Vino aggiunto');
      } else {
        await updateWine(payload);
        showToast('Vino aggiornato');
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
      showToast('Vino eliminato');
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
      showToast('Q.tà aggiornata');
      return true;
    } catch (err) {
      console.error('[WineAdminPage] quick qty update error', err);
      setError('Aggiornamento quantità non riuscito.');
      return false;
    } finally {
      setBusy(false);
    }
  };

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
        winesCount={wines.length}
        thresholdCount={wines.filter((w) => isInThreshold(w)).length}
        outCount={wines.filter((w) => w.qty <= 0).length}
        wines={filteredWines}
        filters={filters}
        categories={categories}
        producers={producers}
        origins={origins}
        suppliers={suppliers}
        onFiltersChange={setFilters}
        onResetFilters={() => setFilters(defaultFilters)}
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
        loading={loading}
        onEdit={openEdit}
        onDelete={setDeleteId}
        onUpdateQty={handleQuickQtyUpdate}
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

      <CategoryCreateModal
        open={categoryModalOpen}
        existingValues={categories}
        onCancel={cancelAddCategory}
        onConfirm={confirmAddCategory}
      />
      <CategoryCreateModal
        open={originModalOpen}
        existingValues={origins}
        title="Nuova provenienza"
        inputPlaceholder="Inserisci provenienza"
        similarTitle="Provenienze già presenti simili"
        duplicateMessage="Provenienza già esistente: se confermi, verrà riusata quella esistente."
        ariaLabel="Nuova provenienza"
        onCancel={cancelAddOrigin}
        onConfirm={confirmAddOrigin}
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

      {toast ? (
        <div className="mt12">
          <div className="toastInline">{toast}</div>
        </div>
      ) : null}
    </div>
  );
}
