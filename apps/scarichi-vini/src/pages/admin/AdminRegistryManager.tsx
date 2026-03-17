import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownWideNarrow, ArrowUpNarrowWide } from 'lucide-react';
import { ConfirmModal } from '@/components/ConfirmModal';
import { loadDb } from '@/data/localDb';
import { sha256Base64 } from '@/pages/admin/crypto';
import { storageKeys } from '@/pages/admin/storage';
import {
  deleteSupabaseCategory,
  listCategoryOptions,
  listSupabaseCategories,
  loadManagedCategories,
  removeManagedCategory,
  renameManagedCategory,
  renameSupabaseCategory,
  upsertManagedCategory,
  upsertSupabaseCategory
} from '@/data/categoryRepository';
import {
  listOriginOptions,
  loadManagedOrigins,
  removeManagedOrigin,
  renameManagedOrigin,
  upsertManagedOrigin
} from '@/data/originRepository';
import {
  listProducerOptions,
  loadManagedProducers,
  removeManagedProducer,
  renameManagedProducer,
  upsertManagedProducer
} from '@/data/producerRepository';
import {
  deleteSupabaseSupplier,
  listSupplierOptions,
  listSupabaseSuppliers,
  loadManagedSuppliers,
  removeManagedSupplier,
  renameManagedSupplier,
  renameSupabaseSupplier,
  upsertManagedSupplier,
  upsertSupabaseSupplier
} from '@/data/supplierRepository';
import { normalizeOrigin } from '@/domain/normalizeOrigin';
import {
  normalizeWineCategory,
  normalizeWineProducer,
  normalizeWineSupplier
} from '@/domain/normalizeWineText';
import { listWines, renameWineRegistryValue, type WineRegistryField } from '@/data/wineRepository';
import type { Wine } from '@/domain/types';

type RegistryKind = WineRegistryField;
type RegistrySortDir = 'az' | 'za';

type DeleteTarget = {
  kind: RegistryKind;
  value: string;
} | null;

type EditingState = {
  kind: RegistryKind;
  original: string;
  draft: string;
} | null;

type CreatingState = {
  kind: RegistryKind;
  draft: string;
} | null;

type DeletePinState = {
  open: boolean;
  pin: string;
  error: string | null;
};

type RegistryManagerCacheSnapshot = {
  wines: Wine[];
  managedCategories: string[];
  managedOrigins: string[];
  managedProducers: string[];
  managedSuppliers: string[];
  supabaseCategories: string[];
  supabaseSuppliers: string[];
  updatedAt: number;
};

const LIST_RENDER_BATCH = 180;

const REGISTRY_KINDS: RegistryKind[] = ['category', 'producer', 'origin', 'supplier'];

const INITIAL_QUERY_BY_KIND: Record<RegistryKind, string> = {
  category: '',
  producer: '',
  origin: '',
  supplier: ''
};

const INITIAL_VISIBLE_BY_KIND: Record<RegistryKind, number> = {
  category: LIST_RENDER_BATCH,
  producer: LIST_RENDER_BATCH,
  origin: LIST_RENDER_BATCH,
  supplier: LIST_RENDER_BATCH
};

const INITIAL_SORT_BY_KIND: Record<RegistryKind, RegistrySortDir> = {
  category: 'az',
  producer: 'az',
  origin: 'az',
  supplier: 'az'
};

const KIND_LABEL: Record<RegistryKind, string> = {
  category: 'Categorie',
  producer: 'Produttori',
  origin: 'Provenienze',
  supplier: 'Fornitori'
};

const KIND_PLACEHOLDER: Record<RegistryKind, string> = {
  category: 'Nuova categoria',
  producer: 'Nuovo produttore',
  origin: 'Nuova provenienza',
  supplier: 'Nuovo fornitore'
};

const DELETED_REGISTRY_VALUE = '';
const REGISTRY_MANAGER_CACHE_TTL_MS = 60_000;
let registryManagerCache: RegistryManagerCacheSnapshot | null = null;

function normalizeByKind(kind: RegistryKind, value: string): string {
  if (kind === 'category') return normalizeWineCategory(value);
  if (kind === 'producer') return normalizeWineProducer(value);
  if (kind === 'origin') return normalizeOrigin(value);
  return normalizeWineSupplier(value);
}

function readFieldByKind(wine: Wine, kind: RegistryKind): string {
  if (kind === 'category') return wine.category ?? '';
  if (kind === 'producer') return wine.producer ?? '';
  if (kind === 'origin') return wine.origin ?? '';
  return wine.supplier ?? '';
}

export function AdminRegistryManager() {
  const [wines, setWines] = useState<Wine[]>([]);
  const [managedCategories, setManagedCategories] = useState<string[]>([]);
  const [managedOrigins, setManagedOrigins] = useState<string[]>([]);
  const [managedProducers, setManagedProducers] = useState<string[]>([]);
  const [managedSuppliers, setManagedSuppliers] = useState<string[]>([]);
  const [supabaseCategories, setSupabaseCategories] = useState<string[]>([]);
  const [supabaseSuppliers, setSupabaseSuppliers] = useState<string[]>([]);
  const [activeKind, setActiveKind] = useState<RegistryKind | null>(null);
  const [queryByKind, setQueryByKind] =
    useState<Record<RegistryKind, string>>(INITIAL_QUERY_BY_KIND);
  const [visibleByKind, setVisibleByKind] =
    useState<Record<RegistryKind, number>>(INITIAL_VISIBLE_BY_KIND);
  const [sortByKind, setSortByKind] =
    useState<Record<RegistryKind, RegistrySortDir>>(INITIAL_SORT_BY_KIND);
  const [editing, setEditing] = useState<EditingState>(null);
  const [renameConfirmOpen, setRenameConfirmOpen] = useState(false);
  const [creating, setCreating] = useState<CreatingState>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);
  const [deletePin, setDeletePin] = useState<DeletePinState>({
    open: false,
    pin: '',
    error: null
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const applyRegistrySnapshot = useCallback((snapshot: RegistryManagerCacheSnapshot) => {
    setWines(snapshot.wines);
    setManagedCategories(snapshot.managedCategories);
    setManagedOrigins(snapshot.managedOrigins);
    setManagedProducers(snapshot.managedProducers);
    setManagedSuppliers(snapshot.managedSuppliers);
    setSupabaseCategories(snapshot.supabaseCategories);
    setSupabaseSuppliers(snapshot.supabaseSuppliers);
  }, []);

  const loadManagedRegistries = useCallback(() => {
    return {
      managedCategories: loadManagedCategories(),
      managedOrigins: loadManagedOrigins(),
      managedProducers: loadManagedProducers(),
      managedSuppliers: loadManagedSuppliers()
    };
  }, []);

  const refreshRegistries = useCallback(async () => {
    const nextManaged = loadManagedRegistries();
    setManagedCategories(nextManaged.managedCategories);
    setManagedOrigins(nextManaged.managedOrigins);
    setManagedProducers(nextManaged.managedProducers);
    setManagedSuppliers(nextManaged.managedSuppliers);
    const [nextSupabaseCategories, nextSupabaseSuppliers] = await Promise.all([
      listSupabaseCategories(),
      listSupabaseSuppliers()
    ]);
    setSupabaseCategories(nextSupabaseCategories);
    setSupabaseSuppliers(nextSupabaseSuppliers);
    return {
      ...nextManaged,
      supabaseCategories: nextSupabaseCategories,
      supabaseSuppliers: nextSupabaseSuppliers
    };
  }, [loadManagedRegistries]);

  const refreshPageData = useCallback(async () => {
    setError(null);
    const now = Date.now();
    const localInventory = loadDb().inventory;
    const localManaged = loadManagedRegistries();
    const hasWarmLocalData =
      localInventory.length > 0 ||
      localManaged.managedCategories.length > 0 ||
      localManaged.managedOrigins.length > 0 ||
      localManaged.managedProducers.length > 0 ||
      localManaged.managedSuppliers.length > 0;

    const hasFreshCache =
      registryManagerCache !== null &&
      now - registryManagerCache.updatedAt <= REGISTRY_MANAGER_CACHE_TTL_MS;

    if (hasFreshCache && registryManagerCache) {
      applyRegistrySnapshot(registryManagerCache);
      setLoading(false);
    } else {
      setWines(localInventory);
      setManagedCategories(localManaged.managedCategories);
      setManagedOrigins(localManaged.managedOrigins);
      setManagedProducers(localManaged.managedProducers);
      setManagedSuppliers(localManaged.managedSuppliers);
      if (hasWarmLocalData) {
        setLoading(false);
      }
    }

    try {
      const [remoteRegistries, remoteWines] = await Promise.all([refreshRegistries(), listWines()]);
      setWines(remoteWines);
      registryManagerCache = {
        wines: remoteWines,
        managedCategories: remoteRegistries.managedCategories,
        managedOrigins: remoteRegistries.managedOrigins,
        managedProducers: remoteRegistries.managedProducers,
        managedSuppliers: remoteRegistries.managedSuppliers,
        supabaseCategories: remoteRegistries.supabaseCategories,
        supabaseSuppliers: remoteRegistries.supabaseSuppliers,
        updatedAt: Date.now()
      };
    } catch (err) {
      console.error('[AdminRegistryManager] refresh failed', err);
      if (!hasWarmLocalData) {
        setError('Impossibile caricare i dati. Riprova.');
      }
    } finally {
      setLoading(false);
    }
  }, [applyRegistrySnapshot, loadManagedRegistries, refreshRegistries]);

  useEffect(() => {
    void refreshPageData();
  }, [refreshPageData]);

  useEffect(() => {
    if (
      wines.length === 0 &&
      managedCategories.length === 0 &&
      managedOrigins.length === 0 &&
      managedProducers.length === 0 &&
      managedSuppliers.length === 0 &&
      supabaseCategories.length === 0 &&
      supabaseSuppliers.length === 0
    ) {
      return;
    }
    registryManagerCache = {
      wines,
      managedCategories,
      managedOrigins,
      managedProducers,
      managedSuppliers,
      supabaseCategories,
      supabaseSuppliers,
      updatedAt: Date.now()
    };
  }, [
    wines,
    managedCategories,
    managedOrigins,
    managedProducers,
    managedSuppliers,
    supabaseCategories,
    supabaseSuppliers
  ]);

  const categories = useMemo(
    () => listCategoryOptions(wines, [...managedCategories, ...supabaseCategories]),
    [managedCategories, supabaseCategories, wines]
  );
  const producers = useMemo(
    () => listProducerOptions(wines, managedProducers),
    [managedProducers, wines]
  );
  const origins = useMemo(() => listOriginOptions(wines, managedOrigins), [managedOrigins, wines]);
  const suppliers = useMemo(
    () => listSupplierOptions(wines, [...managedSuppliers, ...supabaseSuppliers]),
    [managedSuppliers, supabaseSuppliers, wines]
  );

  const optionsByKind = useMemo(
    () =>
      ({
        category: categories,
        producer: producers,
        origin: origins,
        supplier: suppliers
      }) satisfies Record<RegistryKind, string[]>,
    [categories, origins, producers, suppliers]
  );

  const usageByKind = useMemo(() => {
    const output: Record<RegistryKind, Map<string, number>> = {
      category: new Map(),
      producer: new Map(),
      origin: new Map(),
      supplier: new Map()
    };
    for (const wine of wines) {
      for (const kind of REGISTRY_KINDS) {
        const normalized = normalizeByKind(kind, readFieldByKind(wine, kind));
        if (!normalized) continue;
        const key = normalized.toLowerCase();
        output[kind].set(key, (output[kind].get(key) ?? 0) + 1);
      }
    }
    return output;
  }, [wines]);

  const getUsageCount = useCallback(
    (kind: RegistryKind, value: string) => {
      const normalized = normalizeByKind(kind, value);
      if (!normalized) return 0;
      return usageByKind[kind].get(normalized.toLowerCase()) ?? 0;
    },
    [usageByKind]
  );

  const activeQuery = useDeferredValue(activeKind ? queryByKind[activeKind] : '');
  const activeValues = useMemo(() => {
    if (!activeKind) return [];
    const query = activeQuery.trim().toLowerCase();
    const source = optionsByKind[activeKind];
    if (!query) return source;
    return source.filter((value) => value.toLowerCase().includes(query));
  }, [activeKind, activeQuery, optionsByKind]);

  const activeSortedValues = useMemo(() => {
    if (!activeKind) return [];
    if (sortByKind[activeKind] === 'az') return activeValues;
    return [...activeValues].reverse();
  }, [activeKind, activeValues, sortByKind]);

  const activeVisibleCount = activeKind ? visibleByKind[activeKind] : 0;
  const renderedValues = useMemo(
    () => activeSortedValues.slice(0, activeVisibleCount),
    [activeSortedValues, activeVisibleCount]
  );
  const hasMoreRows = renderedValues.length < activeSortedValues.length;

  useEffect(() => {
    if (!activeKind || !hasMoreRows) return;
    const target = loadMoreRef.current;
    if (!target) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        setVisibleByKind((prev) => ({
          ...prev,
          [activeKind]: prev[activeKind] + LIST_RENDER_BATCH
        }));
      },
      { rootMargin: '180px 0px' }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [activeKind, hasMoreRows, renderedValues.length, activeSortedValues.length]);

  const openKindDetail = (kind: RegistryKind) => {
    setEditing(null);
    setRenameConfirmOpen(false);
    setCreating(null);
    setDeleteTarget(null);
    setDeletePin({ open: false, pin: '', error: null });
    setError(null);
    setActiveKind(kind);
    setVisibleByKind((prev) => ({
      ...prev,
      [kind]: LIST_RENDER_BATCH
    }));
  };

  const closeKindDetail = () => {
    setEditing(null);
    setRenameConfirmOpen(false);
    setCreating(null);
    setDeleteTarget(null);
    setDeletePin({ open: false, pin: '', error: null });
    setError(null);
    setActiveKind(null);
  };

  const toggleVoiceSort = useCallback(() => {
    if (!activeKind) return;
    setSortByKind((prev) => ({
      ...prev,
      [activeKind]: prev[activeKind] === 'az' ? 'za' : 'az'
    }));
    setVisibleByKind((prev) => ({ ...prev, [activeKind]: LIST_RENDER_BATCH }));
  }, [activeKind]);

  const startCreate = useCallback((kind: RegistryKind) => {
    setEditing(null);
    setError(null);
    setCreating({ kind, draft: '' });
  }, []);

  const saveCreate = useCallback(async () => {
    if (!creating || actionBusy) return;
    const kind = creating.kind;
    const normalized = normalizeByKind(kind, creating.draft);
    if (!normalized) {
      setError('Inserisci un valore valido.');
      return;
    }

    const alreadyExists = optionsByKind[kind].some(
      (entry) => normalizeByKind(kind, entry).toLowerCase() === normalized.toLowerCase()
    );
    if (alreadyExists) {
      setError('Voce già presente.');
      return;
    }

    setActionBusy(true);
    setError(null);
    try {
      if (kind === 'category') {
        upsertManagedCategory(normalized, optionsByKind.category, loadManagedCategories());
        await upsertSupabaseCategory(normalized);
      } else if (kind === 'producer') {
        upsertManagedProducer(normalized, optionsByKind.producer, loadManagedProducers());
      } else if (kind === 'origin') {
        upsertManagedOrigin(normalized, optionsByKind.origin, loadManagedOrigins());
      } else {
        upsertManagedSupplier(normalized, optionsByKind.supplier, loadManagedSuppliers());
        await upsertSupabaseSupplier(normalized);
      }
      await refreshRegistries();
      setCreating(null);
      setQueryByKind((prev) => ({ ...prev, [kind]: '' }));
      setVisibleByKind((prev) => ({ ...prev, [kind]: LIST_RENDER_BATCH }));
    } catch (err) {
      console.error('[AdminRegistryManager] saveCreate failed', err);
      setError('Inserimento non riuscito. Riprova.');
    } finally {
      setActionBusy(false);
    }
  }, [actionBusy, creating, optionsByKind, refreshRegistries]);

  const saveRename = useCallback(async () => {
    if (!editing || actionBusy) return;

    const normalizedOriginal = normalizeByKind(editing.kind, editing.original);
    const normalizedDraft = normalizeByKind(editing.kind, editing.draft);
    if (!normalizedDraft) {
      setError('Inserisci un valore valido.');
      return;
    }
    if (normalizedOriginal.toLowerCase() === normalizedDraft.toLowerCase()) {
      setRenameConfirmOpen(false);
      setEditing(null);
      return;
    }

    setActionBusy(true);
    setError(null);
    try {
      await renameWineRegistryValue(editing.kind, normalizedOriginal, normalizedDraft);

      if (editing.kind === 'category') {
        renameManagedCategory(normalizedOriginal, normalizedDraft, loadManagedCategories());
        await renameSupabaseCategory(normalizedOriginal, normalizedDraft);
      } else if (editing.kind === 'producer') {
        renameManagedProducer(normalizedOriginal, normalizedDraft, loadManagedProducers());
      } else if (editing.kind === 'origin') {
        renameManagedOrigin(normalizedOriginal, normalizedDraft, loadManagedOrigins());
      } else {
        renameManagedSupplier(normalizedOriginal, normalizedDraft, loadManagedSuppliers());
        await renameSupabaseSupplier(normalizedOriginal, normalizedDraft);
      }

      await refreshRegistries();
      setWines(loadDb().inventory);
      setRenameConfirmOpen(false);
      setEditing(null);
    } catch (err) {
      console.error('[AdminRegistryManager] saveRename failed', err);
      setError('Modifica non riuscita. Riprova.');
    } finally {
      setActionBusy(false);
    }
  }, [actionBusy, editing, refreshRegistries]);

  const requestRenameConfirm = useCallback(() => {
    if (!editing || actionBusy) return;
    const normalizedDraft = normalizeByKind(editing.kind, editing.draft);
    if (!normalizedDraft) {
      setError('Inserisci un valore valido.');
      return;
    }
    setRenameConfirmOpen(true);
  }, [actionBusy, editing]);

  const requestDelete = useCallback(
    (kind: RegistryKind, value: string) => {
      if (actionBusy) return;
      setEditing(null);
      setCreating(null);
      setDeletePin({ open: false, pin: '', error: null });
      setDeleteTarget({ kind, value });
    },
    [actionBusy]
  );

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget || actionBusy) return;
    setActionBusy(true);
    setError(null);
    try {
      const normalizedDeleteValue = normalizeByKind(deleteTarget.kind, deleteTarget.value);
      const normalizedZeroValue = normalizeByKind(deleteTarget.kind, DELETED_REGISTRY_VALUE);
      if (
        normalizedDeleteValue &&
        normalizedDeleteValue.toLowerCase() !== normalizedZeroValue.toLowerCase()
      ) {
        await renameWineRegistryValue(
          deleteTarget.kind,
          normalizedDeleteValue,
          DELETED_REGISTRY_VALUE
        );
      }

      if (deleteTarget.kind === 'category') {
        removeManagedCategory(deleteTarget.value, loadManagedCategories());
        await deleteSupabaseCategory(deleteTarget.value);
      } else if (deleteTarget.kind === 'producer') {
        removeManagedProducer(deleteTarget.value, loadManagedProducers());
      } else if (deleteTarget.kind === 'origin') {
        removeManagedOrigin(deleteTarget.value, loadManagedOrigins());
      } else {
        removeManagedSupplier(deleteTarget.value, loadManagedSuppliers());
        await deleteSupabaseSupplier(deleteTarget.value);
      }

      await refreshRegistries();
      setWines(loadDb().inventory);
      setDeleteTarget(null);
      setDeletePin({ open: false, pin: '', error: null });
      if (creating && creating.kind === deleteTarget.kind) {
        setCreating(null);
      }
    } catch (err) {
      console.error('[AdminRegistryManager] confirmDelete failed', err);
      setError('Eliminazione non riuscita. Riprova.');
    } finally {
      setActionBusy(false);
    }
  }, [actionBusy, creating, deleteTarget, refreshRegistries]);

  const confirmDeleteWithPin = useCallback(async () => {
    if (!deleteTarget || actionBusy) return;
    setDeletePin((prev) => ({ ...prev, error: null }));
    const storedHash = localStorage.getItem(storageKeys.adminPasswordHash);
    if (!storedHash) {
      setDeletePin((prev) => ({ ...prev, error: 'PIN admin non disponibile' }));
      return;
    }
    const pinHash = await sha256Base64(deletePin.pin.trim());
    if (pinHash !== storedHash) {
      setDeletePin((prev) => ({ ...prev, error: 'PIN non corretto' }));
      return;
    }
    await confirmDelete();
  }, [actionBusy, confirmDelete, deletePin.pin, deleteTarget]);

  return (
    <div
      className={`adminRegistrySection${!activeKind ? ' adminRegistrySectionHub' : ''}${
        activeKind ? ' adminRegistrySectionDetail' : ''
      }`}
    >
      <div className="title centered mt12">
        {activeKind ? KIND_LABEL[activeKind] : 'Gestione voci filtri'}
      </div>

      {error ? <div className="errorText centered mt10">{error}</div> : null}

      {loading ? (
        <div className="card mt12 centered">
          <div className="subtle">Caricamento...</div>
        </div>
      ) : activeKind ? (
        <div className="card adminRegistryDetailCard mt12">
          <div className="adminRegistryDetailBar">
            <button
              className="button buttonAuto adminRegistryBackButton"
              type="button"
              onClick={closeKindDetail}
            >
              Torna ai filtri
            </button>
            <button
              className="button buttonAuto"
              type="button"
              disabled={actionBusy}
              onClick={() => startCreate(activeKind)}
            >
              Nuova voce
            </button>
          </div>

          <div className="mt10">
            <input
              className="input adminRegistrySearchInput"
              value={queryByKind[activeKind]}
              placeholder="Cerca..."
              onChange={(event) => {
                const next = event.target.value;
                setQueryByKind((prev) => ({ ...prev, [activeKind]: next }));
                setVisibleByKind((prev) => ({ ...prev, [activeKind]: LIST_RENDER_BATCH }));
              }}
            />
          </div>

          {creating?.kind === activeKind ? (
            <div className="adminRegistryCreateBar mt10">
              <input
                className="input adminRegistrySearchInput"
                value={creating.draft}
                placeholder={KIND_PLACEHOLDER[activeKind]}
                onChange={(event) =>
                  setCreating((prev) => (prev ? { ...prev, draft: event.target.value } : prev))
                }
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') return;
                  event.preventDefault();
                  void saveCreate();
                }}
                autoFocus
              />
              <button
                className="adminRegistryActionButton adminRegistryActionButtonSave"
                type="button"
                disabled={actionBusy}
                onClick={() => {
                  void saveCreate();
                }}
              >
                Aggiungi
              </button>
              <button
                className="adminRegistryActionButton"
                type="button"
                disabled={actionBusy}
                onClick={() => setCreating(null)}
              >
                Annulla
              </button>
            </div>
          ) : null}

          <div className="adminRegistryTableWrap mt10">
            <div className="adminRegistryTableHead">
              <div className="adminRegistryVoiceHeader">
                <div className="archiveSortableHeaderCell">
                  <span>Voce</span>
                  <button
                    className="archiveSortButton"
                    type="button"
                    onClick={toggleVoiceSort}
                    aria-label={
                      activeKind && sortByKind[activeKind] === 'az'
                        ? 'Ordina da Z a A'
                        : 'Ordina da A a Z'
                    }
                    title={
                      activeKind && sortByKind[activeKind] === 'za' ? 'Ordine Z-A' : 'Ordine A-Z'
                    }
                  >
                    {activeKind && sortByKind[activeKind] === 'za' ? (
                      <ArrowUpNarrowWide size={14} strokeWidth={2.2} />
                    ) : (
                      <ArrowDownWideNarrow size={14} strokeWidth={2.2} />
                    )}
                  </button>
                </div>
              </div>
              <div>Utilizzo</div>
              <div>Azioni</div>
            </div>

            <div className="adminRegistryTableBody">
              {renderedValues.length === 0 ? (
                <div className="subtle centered adminRegistryEmpty">Nessuna voce</div>
              ) : (
                renderedValues.map((value) => {
                  const usageCount = getUsageCount(activeKind, value);
                  return (
                    <div key={`${activeKind}_${value}`} className="adminRegistryTableRow">
                      <div className="adminRegistryCellValue">
                        <div className="adminRegistryValue">{value}</div>
                      </div>
                      <div className="adminRegistryCellUsage">{usageCount} vini</div>
                      <div className="adminRegistryCellActions">
                        <button
                          className="adminRegistryActionButton"
                          type="button"
                          disabled={actionBusy}
                          onClick={() => {
                            setRenameConfirmOpen(false);
                            setEditing({
                              kind: activeKind,
                              original: value,
                              draft: value
                            });
                          }}
                        >
                          Modifica
                        </button>
                        <button
                          className="adminRegistryActionButton adminRegistryActionButtonDanger"
                          type="button"
                          disabled={actionBusy}
                          onClick={() => requestDelete(activeKind, value)}
                        >
                          Elimina
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
              {hasMoreRows ? (
                <div ref={loadMoreRef} className="adminRegistryLoadMoreSentinel" />
              ) : null}
            </div>
          </div>
        </div>
      ) : (
        <div className="list mt12">
          {REGISTRY_KINDS.map((kind) => (
            <button
              key={kind}
              className="button adminHomeAction"
              type="button"
              onClick={() => openKindDetail(kind)}
            >
              {KIND_LABEL[kind]}
            </button>
          ))}
        </div>
      )}

      <ConfirmModal
        open={Boolean(editing)}
        title="Modifica voce"
        cardClassName="adminRegistryEditModalCard"
        description={
          editing ? (
            <div className="adminRegistryEditModalContent">
              <div className="errorText centered">
                La modifica verrà applicata a tutti i vini associati!
              </div>
              <input
                className="input adminRegistrySearchInput mt10"
                value={editing.draft}
                placeholder={KIND_PLACEHOLDER[editing.kind]}
                onChange={(event) => {
                  const next = event.target.value;
                  setEditing((prev) => (prev ? { ...prev, draft: next } : prev));
                }}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') return;
                  event.preventDefault();
                  requestRenameConfirm();
                }}
                autoFocus
              />
            </div>
          ) : undefined
        }
        confirmLabel={actionBusy ? 'Salvataggio...' : 'Conferma'}
        cancelLabel="Annulla"
        onConfirm={requestRenameConfirm}
        onCancel={() => {
          if (actionBusy) return;
          setRenameConfirmOpen(false);
          setEditing(null);
        }}
      />

      <ConfirmModal
        open={Boolean(editing) && renameConfirmOpen}
        title="Confermare modifica?"
        description={
          editing ? (
            <div className="subtle centered">
              La modifica della voce verrà applicata a tutti i vini associati.
            </div>
          ) : undefined
        }
        confirmLabel={actionBusy ? 'Salvataggio...' : 'Sì, conferma'}
        cancelLabel="Annulla"
        onConfirm={() => {
          void saveRename();
        }}
        onCancel={() => {
          if (actionBusy) return;
          setRenameConfirmOpen(false);
        }}
      />

      <ConfirmModal
        open={Boolean(deleteTarget) && !deletePin.open}
        title="ATTENZIONE!"
        cardClassName="adminRegistryDeleteWarningCard"
        description={
          deleteTarget ? (
            <div className="adminRegistryDeleteWarningText">
              <div>Stai eliminando la voce dell&apos;archivio!</div>
              <div className="mt6 adminRegistryDeleteWarningBody">
                Eliminando la voce, i vini resteranno in archivio,
                <br />
                ma il valore del campo verrà impostato vuoto (-).
              </div>
            </div>
          ) : undefined
        }
        confirmLabel="Continua"
        cancelLabel="Annulla"
        onConfirm={() => {
          if (actionBusy) return;
          setDeletePin({ open: true, pin: '', error: null });
        }}
        onCancel={() => {
          if (actionBusy) return;
          setDeleteTarget(null);
        }}
      />

      {deleteTarget && deletePin.open ? (
        <div className="modalOverlay" role="dialog" aria-modal="true">
          <div className="modalCard adminRegistryDeletePinCard">
            <div className="modalTitle centered">Conferma eliminazione con PIN</div>
            <div className="modalDescription centered">
              Inserisci il PIN admin per confermare l&apos;eliminazione della voce{' '}
              <strong>{deleteTarget.value}</strong>.
            </div>
            <input
              className="input mt12 centered"
              type="password"
              inputMode="numeric"
              placeholder="Inserisci PIN admin"
              value={deletePin.pin}
              onChange={(event) =>
                setDeletePin((prev) => ({ ...prev, pin: event.target.value, error: null }))
              }
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return;
                event.preventDefault();
                void confirmDeleteWithPin();
              }}
            />
            {deletePin.error ? (
              <div className="errorText centered mt10">{deletePin.error}</div>
            ) : null}
            <div className="modalActions">
              <button
                className="button"
                type="button"
                disabled={actionBusy || deletePin.pin.trim().length === 0}
                onClick={() => {
                  void confirmDeleteWithPin();
                }}
              >
                {actionBusy ? 'Eliminazione...' : 'Conferma eliminazione'}
              </button>
              <button
                className="button buttonSecondary buttonCancel"
                type="button"
                disabled={actionBusy}
                onClick={() => setDeletePin({ open: false, pin: '', error: null })}
              >
                Annulla
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
