import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Wine } from '@/domain/types';
import { ConfirmModal } from '@/components/ConfirmModal';
import {
  listCategoryOptions,
  loadManagedCategories,
  upsertManagedCategory
} from '@/data/categoryRepository';
import { listOriginOptions, loadManagedOrigins, upsertManagedOrigin } from '@/data/originRepository';
import { createWine, deleteWine, listWines, updateWine } from '@/data/wineRepository';
import { AdminArchiveToolbar } from '@/pages/admina/components/AdminArchiveToolbar';
import { AdminArchiveTable } from '@/pages/admina/components/AdminArchiveTable';
import { CategoryCreateModal } from '@/pages/admina/components/CategoryCreateModal';
import { WineArchiveFormModal } from '@/pages/admina/components/WineArchiveFormModal';
import {
  defaultFilters,
  emptyWine,
  type Filters,
  type Mode,
  type WineFormState
} from '@/pages/admina/types';

function isInThreshold(wine: Wine) {
  const qty = Number(wine.qty);
  const threshold = Number(wine.threshold);
  if (!Number.isFinite(qty) || qty <= 0) return false;
  if (!Number.isFinite(threshold) || threshold < 1) return false;
  return qty <= threshold;
}

function matchesFilters(wine: Wine, filters: Filters) {
  const term = filters.term.trim().toLowerCase();
  if (term) {
    const haystack = [
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
      .toLowerCase();
    if (!haystack.includes(term)) return false;
  }

  if (filters.category !== 'all') {
    const category = wine.category?.toLowerCase() ?? '';
    if (category !== filters.category.toLowerCase()) return false;
  }

  if (filters.stock === 'threshold' && !isInThreshold(wine)) return false;
  if (filters.stock === 'out' && wine.qty > 0) return false;
  return true;
}

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
  const [managedOrigins, setManagedOrigins] = useState<string[]>(() => loadManagedOrigins());
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [categoryResultHandler, setCategoryResultHandler] =
    useState<((created: string | null) => void) | null>(null);
  const [originModalOpen, setOriginModalOpen] = useState(false);
  const [originResultHandler, setOriginResultHandler] =
    useState<((created: string | null) => void) | null>(null);

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

  const categories = useMemo(
    () => listCategoryOptions(wines, managedCategories),
    [wines, managedCategories]
  );
  const origins = useMemo(() => listOriginOptions(wines, managedOrigins), [wines, managedOrigins]);

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
      if (result.changed) setManagedCategories(result.managedNext);
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

  const handleRequestAddCategory = useCallback((onResult: (created: string | null) => void) => {
    setCategoryResultHandler(() => onResult);
    setCategoryModalOpen(true);
  }, []);
  const handleRequestAddOrigin = useCallback((onResult: (created: string | null) => void) => {
    setOriginResultHandler(() => onResult);
    setOriginModalOpen(true);
  }, []);

  const closeCategoryModal = useCallback(() => {
    setCategoryModalOpen(false);
    setCategoryResultHandler(null);
  }, []);
  const closeOriginModal = useCallback(() => {
    setOriginModalOpen(false);
    setOriginResultHandler(null);
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

  return (
    <div className="container archiveDesktopContainer">
      <div className="archiveLogoTop">
        <img
          className="archiveLogoImg"
          src="/logo.png"
          alt="Enoteca Italiana"
          loading="lazy"
          decoding="async"
          width={1024}
          height={240}
        />
      </div>

      <AdminArchiveToolbar
        winesCount={wines.length}
        thresholdCount={wines.filter((w) => isInThreshold(w)).length}
        outCount={wines.filter((w) => w.qty <= 0).length}
        filters={filters}
        categories={categories}
        onFiltersChange={setFilters}
        onRequestAddCategory={handleRequestAddCategory}
        onOpenCreate={openCreate}
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
      />

      <WineArchiveFormModal
        open={modalOpen}
        mode={modalMode}
        busy={busy}
        initial={formState}
        categories={categories}
        origins={origins}
        onRequestAddCategory={handleRequestAddCategory}
        onRequestAddOrigin={handleRequestAddOrigin}
        onSubmit={handleSubmit}
        onCancel={closeForm}
      />

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
