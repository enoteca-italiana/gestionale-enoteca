import type { Wine } from '@/domain/types';
import type { ArchiveCsvWineInput } from '@/data/archiveCsv';
import { supabase } from '@/lib/supabase';
import { loadDb, notifyDbChanged, saveDb, newId } from '@/data/localDb';
import { detachDischargeItemsFromWines } from '@/data/dischargeRepository';
import { syncWineUpsert, syncWineDelete } from '@/integrations/googleSheetsSync';
import { clearManagedCategories, clearSupabaseCategories } from '@/data/categoryRepository';
import { clearManagedOrigins } from '@/data/originRepository';
import { clearManagedProducers } from '@/data/producerRepository';
import { normalizeOrigin } from '@/domain/normalizeOrigin';
import {
  normalizeWineCategory,
  normalizeWineName,
  normalizeWineProducer
} from '@/domain/normalizeWineText';

type WineRow = {
  id: string;
  category?: string | null;
  name: string;
  age?: string | null;
  producer: string;
  origin: string;
  threshold?: number | null;
  purchase_price?: number | null;
  sale_price?: number | null;
  vintage?: string | null;
  qty?: number | null;
  warehouse?: number | null;
  margin?: number | null;
  notes?: string | null;
};

export type WineRegistryField = 'category' | 'producer' | 'origin';

// Keep page size aligned to common Supabase API max rows (1000)
// so pagination never stops early on capped responses.
const WINES_PAGE_SIZE = 1000;
const WINE_SELECT_COLUMNS =
  'id,category,name,age,producer,origin,threshold,purchase_price,sale_price,vintage,qty,warehouse,margin,notes';
const WINE_NAME_COLLATOR = new Intl.Collator('it', { sensitivity: 'base' });
let listWinesInFlight: Promise<Wine[]> | null = null;
let listWinesCache: Wine[] | null = null;

// Egress control: evita fetch ripetute da Supabase entro la finestra TTL.
// Il refresh remoto avviene solo se: dati assenti localmente, TTL scaduto,
// o caller passa esplicitamente skipTtl:true (es. pulsante "Aggiorna" manuale).
const REMOTE_SYNC_TTL_MS = 10 * 60 * 1000; // 10 minuti
let lastRemoteSyncAt = 0;

function randomThreshold(): number {
  return Math.floor(Math.random() * 12) + 1;
}

function normalizeThreshold(value?: number | null): number | undefined {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  const rounded = Math.round(parsed);
  if (rounded < 1) return undefined;
  return rounded;
}

function ensureThreshold(wine: Wine, fallback?: number): Wine {
  const normalized = normalizeThreshold(wine.threshold);
  if (normalized !== undefined) return { ...wine, threshold: normalized };
  const fallbackNormalized = normalizeThreshold(fallback);
  return { ...wine, threshold: fallbackNormalized ?? randomThreshold() };
}

function enrichThresholdsFromFallback(source: Wine[], fallback: Wine[]): Wine[] {
  const fallbackById = new Map(
    fallback.map((wine) => [wine.id, normalizeThreshold(wine.threshold)] as const)
  );
  return source.map((wine) => ensureThreshold(wine, fallbackById.get(wine.id)));
}

function toWine(row: WineRow): Wine {
  const purchase = typeof row.purchase_price === 'number' ? row.purchase_price : undefined;
  const sale = typeof row.sale_price === 'number' ? row.sale_price : undefined;
  const qty = Number(row.qty ?? 0);
  const margin =
    typeof row.margin === 'number'
      ? row.margin
      : purchase !== undefined && sale !== undefined
        ? sale - purchase
        : undefined;
  const warehouse =
    typeof row.warehouse === 'number'
      ? row.warehouse
      : purchase !== undefined && Number.isFinite(qty)
        ? purchase * qty
        : undefined;

  return {
    id: row.id,
    category: row.category ? normalizeWineCategory(row.category) : undefined,
    name: normalizeWineName(row.name),
    age: row.age ?? undefined,
    producer: normalizeWineProducer(row.producer),
    origin: normalizeOrigin(row.origin),
    threshold: normalizeThreshold(row.threshold),
    purchasePrice: purchase,
    salePrice: sale,
    vintage: row.vintage ?? undefined,
    qty,
    warehouse: warehouse !== undefined ? Number(warehouse.toFixed(2)) : undefined,
    margin: margin !== undefined ? Number(margin.toFixed(2)) : undefined,
    notes: row.notes ?? undefined
  };
}

function toRowPayload(wine: Wine) {
  const computedMargin =
    wine.purchasePrice !== undefined && wine.salePrice !== undefined
      ? Number((wine.salePrice - wine.purchasePrice).toFixed(2))
      : null;
  const computedWarehouse =
    wine.purchasePrice !== undefined
      ? Number((wine.purchasePrice * Math.max(0, Math.round(wine.qty))).toFixed(2))
      : null;

  return {
    id: wine.id,
    category: wine.category ? normalizeWineCategory(wine.category) : null,
    name: normalizeWineName(wine.name),
    age: wine.age ?? null,
    producer: normalizeWineProducer(wine.producer),
    origin: normalizeOrigin(wine.origin),
    threshold: normalizeThreshold(wine.threshold) ?? null,
    purchase_price: wine.purchasePrice ?? null,
    sale_price: wine.salePrice ?? null,
    vintage: wine.vintage ?? null,
    qty: wine.qty,
    warehouse: computedWarehouse,
    margin: computedMargin,
    notes: wine.notes ?? null
  };
}

function toLegacyPayload(wine: Wine) {
  return {
    id: wine.id,
    name: normalizeWineName(wine.name),
    producer: normalizeWineProducer(wine.producer),
    origin: normalizeOrigin(wine.origin),
    vintage: wine.vintage ?? null,
    category: wine.category ? normalizeWineCategory(wine.category) : null,
    qty: wine.qty
  };
}

function isSchemaColumnError(error: unknown): boolean {
  const message = String(
    (error as { message?: unknown } | null | undefined)?.message ?? ''
  ).toLowerCase();
  return message.includes('column') && message.includes('does not exist');
}

function isForeignKeyViolation(error: unknown): boolean {
  const code = String((error as { code?: unknown } | null | undefined)?.code ?? '');
  if (code === '23503') return true;
  const message = String(
    (error as { message?: unknown } | null | undefined)?.message ?? ''
  ).toLowerCase();
  return message.includes('foreign key') || message.includes('violates foreign key');
}

function isNotNullViolation(error: unknown): boolean {
  const code = String((error as { code?: unknown } | null | undefined)?.code ?? '');
  if (code === '23502') return true;
  const message = String(
    (error as { message?: unknown } | null | undefined)?.message ?? ''
  ).toLowerCase();
  return message.includes('not-null') || message.includes('null value in column');
}

function isUniqueViolation(error: unknown): boolean {
  const code = String((error as { code?: unknown } | null | undefined)?.code ?? '');
  if (code === '23505') return true;
  const message = String(
    (error as { message?: unknown } | null | undefined)?.message ?? ''
  ).toLowerCase();
  return message.includes('duplicate key') || message.includes('unique constraint');
}

function sortWines(wines: Wine[]): Wine[] {
  return [...wines].sort((a, b) => WINE_NAME_COLLATOR.compare(a.name, b.name));
}

function normalizeWineTextFields(wines: Wine[]): Wine[] {
  return wines.map((wine) => ({
    ...wine,
    category: wine.category ? normalizeWineCategory(wine.category) : undefined,
    name: normalizeWineName(wine.name),
    producer: normalizeWineProducer(wine.producer),
    origin: normalizeOrigin(wine.origin)
  }));
}

function normalizeRegistryValue(field: WineRegistryField, rawValue: string): string {
  if (field === 'category') return normalizeWineCategory(rawValue);
  if (field === 'producer') return normalizeWineProducer(rawValue);
  return normalizeOrigin(rawValue);
}

function readWineFieldValue(wine: Wine, field: WineRegistryField): string {
  if (field === 'category') return wine.category ?? '';
  if (field === 'producer') return wine.producer ?? '';
  return wine.origin ?? '';
}

function writeWineFieldValue(wine: Wine, field: WineRegistryField, value: string): Wine {
  if (field === 'category') return { ...wine, category: value || undefined };
  if (field === 'producer') return { ...wine, producer: value };
  return { ...wine, origin: value };
}

function escapeLikePattern(value: string): string {
  return value.replace(/[%_\\]/g, '\\$&');
}

function getLocalInventory(): Wine[] {
  return loadDb().inventory;
}

function sameWine(a: Wine, b: Wine): boolean {
  return (
    a.id === b.id &&
    a.category === b.category &&
    a.name === b.name &&
    a.age === b.age &&
    a.producer === b.producer &&
    a.origin === b.origin &&
    a.threshold === b.threshold &&
    a.purchasePrice === b.purchasePrice &&
    a.salePrice === b.salePrice &&
    a.vintage === b.vintage &&
    a.qty === b.qty &&
    a.warehouse === b.warehouse &&
    a.margin === b.margin &&
    a.notes === b.notes
  );
}

function sameInventory(prev: Wine[], next: Wine[]): boolean {
  if (prev === next) return true;
  if (prev.length !== next.length) return false;
  for (let i = 0; i < prev.length; i += 1) {
    if (!sameWine(prev[i], next[i])) return false;
  }
  return true;
}

function persistLocalInventory(next: Wine[]) {
  const db = loadDb();
  if (sameInventory(db.inventory, next)) return;
  saveDb({ ...db, inventory: next });
  notifyDbChanged();
}

function setListWinesCache(wines: Wine[]) {
  listWinesCache = wines;
}

function prepareInventory(source: Wine[], fallback: Wine[]): Wine[] {
  const wines = enrichThresholdsFromFallback(source, fallback);
  const normalized = normalizeWineTextFields(wines);
  return sortWines(normalized);
}

function persistAndCacheInventory(next: Wine[]) {
  persistLocalInventory(next);
  setListWinesCache(next);
}

async function fetchAndPersistRemoteWines(localInventory: Wine[]): Promise<Wine[]> {
  if (!supabase) {
    const prepared = prepareInventory(localInventory, localInventory);
    persistAndCacheInventory(prepared);
    return prepared;
  }

  try {
    const data = await listAllWineRows();
    const prepared = prepareInventory((data ?? []).map(toWine), localInventory);
    persistAndCacheInventory(prepared);
    lastRemoteSyncAt = Date.now();
    return prepared;
  } catch (error) {
    console.error('[wineRepository] Supabase list error', error);
    const prepared = prepareInventory(localInventory, localInventory);
    persistAndCacheInventory(prepared);
    return prepared;
  }
}

export const archiveResetEvent = 'scarichi:archiveReset';

async function listAllWineRows(): Promise<WineRow[]> {
  const client = supabase;
  if (!client) return [];

  const { data, error, count } = await client
    .from('wines')
    .select(WINE_SELECT_COLUMNS, { count: 'exact' })
    .order('id', { ascending: true })
    .range(0, WINES_PAGE_SIZE - 1);

  if (error) throw error;

  const firstPage = (data ?? []) as WineRow[];
  const exactCount = typeof count === 'number' ? count : null;

  if (firstPage.length === 0) return [];

  if (exactCount === null) {
    const rows: WineRow[] = [...firstPage];
    if (firstPage.length < WINES_PAGE_SIZE) return rows;

    let from = WINES_PAGE_SIZE;
    while (true) {
      const to = from + WINES_PAGE_SIZE - 1;
      const { data: pageData, error: pageError } = await client
        .from('wines')
        .select(WINE_SELECT_COLUMNS)
        .order('id', { ascending: true })
        .range(from, to);
      if (pageError) throw pageError;
      const page = (pageData ?? []) as WineRow[];
      if (page.length === 0) break;
      rows.push(...page);
      if (page.length < WINES_PAGE_SIZE) break;
      from += WINES_PAGE_SIZE;
    }
    return rows;
  }

  if (exactCount <= firstPage.length) {
    return firstPage;
  }

  const ranges: Array<{ from: number; to: number }> = [];
  for (let from = WINES_PAGE_SIZE; from < exactCount; from += WINES_PAGE_SIZE) {
    ranges.push({
      from,
      to: Math.min(from + WINES_PAGE_SIZE - 1, exactCount - 1)
    });
  }

  const pages = await Promise.all(
    ranges.map(async ({ from, to }) => {
      const { data: pageData, error: pageError } = await client
        .from('wines')
        .select(WINE_SELECT_COLUMNS)
        .order('id', { ascending: true })
        .range(from, to);
      if (pageError) throw pageError;
      return (pageData ?? []) as WineRow[];
    })
  );

  return [...firstPage, ...pages.flat()];
}

export async function listWines(options?: {
  forceRemote?: boolean;
  skipTtl?: boolean;
}): Promise<Wine[]> {
  const forceRemote = options?.forceRemote === true;
  const skipTtl = options?.skipTtl === true;
  const localInventory = getLocalInventory();

  if (!forceRemote) {
    if (listWinesCache && sameInventory(localInventory, listWinesCache)) {
      return listWinesCache;
    }

    if (localInventory.length > 0) {
      const preparedLocal = prepareInventory(localInventory, localInventory);
      persistAndCacheInventory(preparedLocal);
      return preparedLocal;
    }
  }

  // forceRemote=true: rispetta TTL se i dati locali esistono e la sync è recente.
  // skipTtl=true bypassa il TTL (usato da pulsante "Aggiorna" manuale).
  if (forceRemote && !skipTtl && localInventory.length > 0) {
    const msSinceLastSync = Date.now() - lastRemoteSyncAt;
    if (msSinceLastSync < REMOTE_SYNC_TTL_MS) {
      if (listWinesCache) return listWinesCache;
      const preparedLocal = prepareInventory(localInventory, localInventory);
      persistAndCacheInventory(preparedLocal);
      return preparedLocal;
    }
  }

  if (listWinesInFlight) return listWinesInFlight;
  listWinesInFlight = fetchAndPersistRemoteWines(localInventory);

  try {
    return await listWinesInFlight;
  } finally {
    listWinesInFlight = null;
  }
}

export type WineInput = {
  id?: string;
  category?: string;
  name: string;
  age?: string;
  producer: string;
  origin: string;
  threshold?: number;
  purchasePrice?: number;
  salePrice?: number;
  vintage?: string;
  qty: number;
  notes?: string;
};

function normalizeInput(input: WineInput): Wine {
  const purchasePrice = Number(input.purchasePrice);
  const salePrice = Number(input.salePrice);
  const qty = Number.isFinite(input.qty) ? Math.max(0, Math.round(input.qty)) : 0;
  const threshold = normalizeThreshold(input.threshold);
  const hasPurchase = Number.isFinite(purchasePrice);
  const hasSale = Number.isFinite(salePrice);
  const margin =
    hasPurchase && hasSale ? Number((salePrice - purchasePrice).toFixed(2)) : undefined;
  const warehouse = hasPurchase ? Number((purchasePrice * qty).toFixed(2)) : undefined;

  return {
    id: input.id ?? newId('wine'),
    category: input.category?.trim() ? normalizeWineCategory(input.category) : undefined,
    name: normalizeWineName(input.name),
    age: input.age?.trim() || undefined,
    producer: normalizeWineProducer(input.producer),
    origin: normalizeOrigin(input.origin),
    threshold,
    purchasePrice: hasPurchase ? purchasePrice : undefined,
    salePrice: hasSale ? salePrice : undefined,
    vintage: input.vintage?.trim() || undefined,
    qty,
    warehouse,
    margin,
    notes: input.notes?.trim() || undefined
  };
}

export async function createWine(input: WineInput): Promise<Wine> {
  let wine = normalizeInput({ ...input, id: undefined });

  if (supabase) {
    const { data, error } = await supabase
      .from('wines')
      .insert(toRowPayload(wine))
      .select()
      .single();
    if (error && isSchemaColumnError(error)) {
      const legacy = await supabase.from('wines').insert(toLegacyPayload(wine)).select().single();
      if (legacy.error) {
        console.error('[wineRepository] Supabase create legacy error', legacy.error);
        throw legacy.error;
      }
      wine = toWine(legacy.data);
    } else if (error) {
      console.error('[wineRepository] Supabase create error', error);
      throw error;
    } else {
      wine = toWine(data);
    }
  }

  const next = sortWines([...getLocalInventory().filter((w) => w.id !== wine.id), wine]);
  persistAndCacheInventory(next);
  await syncWineUpsert(wine);
  return wine;
}

export async function updateWine(input: WineInput): Promise<Wine> {
  if (!input.id) throw new Error('Missing wine id');
  let wine = normalizeInput(input);

  if (supabase) {
    const { data, error } = await supabase
      .from('wines')
      .update(toRowPayload(wine))
      .eq('id', wine.id)
      .select()
      .single();
    if (error && isSchemaColumnError(error)) {
      const legacy = await supabase
        .from('wines')
        .update(toLegacyPayload(wine))
        .eq('id', wine.id)
        .select()
        .single();
      if (legacy.error) {
        console.error('[wineRepository] Supabase update legacy error', legacy.error);
        throw legacy.error;
      }
      wine = toWine(legacy.data);
    } else if (error) {
      console.error('[wineRepository] Supabase update error', error);
      throw error;
    } else {
      wine = toWine(data);
    }
  }

  const next = sortWines([...getLocalInventory().filter((w) => w.id !== wine.id), wine]);
  persistAndCacheInventory(next);
  await syncWineUpsert(wine);
  return wine;
}

export async function deleteWine(id: string): Promise<void> {
  if (supabase) {
    const { error } = await supabase.from('wines').delete().eq('id', id);
    if (error) {
      console.error('[wineRepository] Supabase delete error', error);
      throw error;
    }
  }

  const next = getLocalInventory().filter((w) => w.id !== id);
  persistAndCacheInventory(next);
  await syncWineDelete(id);
}

async function insertWinesToSupabase(input: Wine[]): Promise<Wine[]> {
  if (!supabase || input.length === 0) return input;

  const { data, error } = await supabase.from('wines').insert(input.map(toRowPayload)).select('*');

  if (error && isSchemaColumnError(error)) {
    const legacy = await supabase.from('wines').insert(input.map(toLegacyPayload)).select('*');
    if (legacy.error) {
      console.error('[wineRepository] Supabase insert legacy error', legacy.error);
      throw legacy.error;
    }
    return (legacy.data ?? []).map(toWine);
  }

  if (error) {
    console.error('[wineRepository] Supabase insert error', error);
    throw error;
  }

  return (data ?? []).map(toWine);
}

export async function replaceAllWines(inputRows: ArchiveCsvWineInput[]): Promise<Wine[]> {
  const normalized = inputRows.map((row) =>
    normalizeInput({
      id: row.id?.trim() || undefined,
      category: row.category,
      name: row.name,
      age: row.age,
      producer: row.producer,
      origin: row.origin,
      threshold: row.threshold,
      purchasePrice: row.purchasePrice,
      salePrice: row.salePrice,
      qty: row.qty,
      notes: row.notes
    })
  );

  let persisted = normalized;

  if (supabase) {
    const { error: deleteError } = await supabase.from('wines').delete().not('id', 'is', null);
    if (deleteError) {
      console.error('[wineRepository] Supabase replace delete error', deleteError);
      throw deleteError;
    }

    persisted = await insertWinesToSupabase(normalized);
  }

  const sorted = sortWines(persisted);
  persistAndCacheInventory(sorted);

  for (const wine of sorted) {
    await syncWineUpsert(wine);
  }

  return sorted;
}

export async function appendWines(inputRows: ArchiveCsvWineInput[]): Promise<Wine[]> {
  const current = getLocalInventory();
  const usedIds = new Set(current.map((wine) => wine.id));

  const normalized = inputRows.map((row) => {
    const candidateId = row.id?.trim();
    const safeId = candidateId && !usedIds.has(candidateId) ? candidateId : undefined;
    const wine = normalizeInput({
      id: safeId,
      category: row.category,
      name: row.name,
      age: row.age,
      producer: row.producer,
      origin: row.origin,
      threshold: row.threshold,
      purchasePrice: row.purchasePrice,
      salePrice: row.salePrice,
      qty: row.qty,
      notes: row.notes
    });
    usedIds.add(wine.id);
    return wine;
  });

  let inserted = normalized;

  if (supabase) {
    try {
      inserted = await insertWinesToSupabase(normalized);
    } catch (error) {
      if (!isUniqueViolation(error)) {
        throw error;
      }

      const retried = normalized.map((wine) => normalizeInput({ ...wine, id: undefined }));
      inserted = await insertWinesToSupabase(retried);
    }
  }

  const merged = sortWines([...current, ...inserted]);
  persistAndCacheInventory(merged);

  for (const wine of inserted) {
    await syncWineUpsert(wine);
  }

  return merged;
}

export async function updateThresholdForAllWines(rawThreshold: number): Promise<number> {
  const threshold = normalizeThreshold(rawThreshold);
  if (threshold === undefined) {
    throw new Error('Valore soglia non valido');
  }

  const current = getLocalInventory();
  if (current.length === 0) return 0;

  if (supabase) {
    const { error } = await supabase.from('wines').update({ threshold }).not('id', 'is', null);
    if (error && !isSchemaColumnError(error)) {
      console.error('[wineRepository] Supabase bulk threshold update error', error);
      throw error;
    }
  }

  const updated = sortWines(current.map((wine) => ({ ...wine, threshold })));
  persistAndCacheInventory(updated);

  for (const wine of updated) {
    await syncWineUpsert(wine);
  }

  return updated.length;
}

export async function clearWineArchive(): Promise<number> {
  const deletedCount = getLocalInventory().length;

  if (supabase) {
    let { error } = await supabase.from('wines').delete().not('id', 'is', null);

    if (error && isForeignKeyViolation(error)) {
      try {
        await detachDischargeItemsFromWines();
      } catch (detachError) {
        console.error('[wineRepository] detachDischargeItemsFromWines failed', detachError);
        if (isNotNullViolation(detachError) || isForeignKeyViolation(detachError)) {
          throw new Error(
            'Reset archivio bloccato dal vincolo DB. Esegui prima la migrazione SQL per rendere indipendente lo storico sessioni (FK wine_id -> ON DELETE SET NULL).'
          );
        }
        throw detachError;
      }

      const retry = await supabase.from('wines').delete().not('id', 'is', null);
      error = retry.error;
    }

    if (error) {
      console.error('[wineRepository] Supabase clear archive error', error);
      throw error;
    }
  }

  clearManagedCategories();
  clearManagedOrigins();
  clearManagedProducers();

  if (supabase) {
    await clearSupabaseCategories();
  }

  persistAndCacheInventory([]);
  window.dispatchEvent(new CustomEvent(archiveResetEvent));
  return deletedCount;
}

export async function renameWineRegistryValue(
  field: WineRegistryField,
  rawFrom: string,
  rawTo: string
): Promise<number> {
  const from = normalizeRegistryValue(field, rawFrom);
  const to = normalizeRegistryValue(field, rawTo);
  if (!from) return 0;
  if (from.toLowerCase() === to.toLowerCase()) return 0;

  if (supabase) {
    const pattern = escapeLikePattern(from);
    const { error } = await supabase
      .from('wines')
      .update({ [field]: to })
      .ilike(field, pattern);
    if (error) {
      console.error('[wineRepository] renameWineRegistryValue error', error);
      throw error;
    }
  }

  const current = getLocalInventory();
  let changed = 0;
  const next = current.map((wine) => {
    const currentValue = normalizeRegistryValue(field, readWineFieldValue(wine, field));
    if (!currentValue) return wine;
    if (currentValue.toLowerCase() !== from.toLowerCase()) return wine;
    changed += 1;
    return writeWineFieldValue(wine, field, to);
  });

  if (changed > 0) {
    persistAndCacheInventory(sortWines(next));
  }
  return changed;
}
