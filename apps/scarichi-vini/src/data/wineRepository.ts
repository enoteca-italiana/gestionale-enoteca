import type { Wine } from '@/domain/types';
import type { ArchiveCsvWineInput } from '@/data/archiveCsv';
import { supabase } from '@/lib/supabase';
import { loadDb, notifyDbChanged, saveDb, newId } from '@/data/localDb';
import { detachDischargeItemsFromWines } from '@/data/dischargeRepository';
import { syncWineUpsert, syncWineDelete } from '@/integrations/googleSheetsSync';
import { normalizeOrigin } from '@/domain/normalizeOrigin';

type WineRow = {
  id: string;
  category?: string | null;
  name: string;
  age?: string | null;
  producer: string;
  origin: string;
  supplier?: string | null;
  threshold?: number | null;
  purchase_price?: number | null;
  sale_price?: number | null;
  vintage?: string | null;
  qty?: number | null;
  warehouse?: number | null;
  margin?: number | null;
  notes?: string | null;
};

const WINES_PAGE_SIZE = 2000;
const WINE_NAME_COLLATOR = new Intl.Collator('it', { sensitivity: 'base' });

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
    category: row.category ?? undefined,
    name: row.name,
    age: row.age ?? undefined,
    producer: row.producer,
    origin: normalizeOrigin(row.origin),
    supplier: row.supplier ?? undefined,
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
    category: wine.category ?? null,
    name: wine.name,
    age: wine.age ?? null,
    producer: wine.producer,
    origin: normalizeOrigin(wine.origin),
    supplier: wine.supplier ?? null,
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
    name: wine.name,
    producer: wine.producer,
    origin: normalizeOrigin(wine.origin),
    vintage: wine.vintage ?? null,
    category: wine.category ?? null,
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
  const message = String((error as { message?: unknown } | null | undefined)?.message ?? '').toLowerCase();
  return message.includes('foreign key') || message.includes('violates foreign key');
}

function isNotNullViolation(error: unknown): boolean {
  const code = String((error as { code?: unknown } | null | undefined)?.code ?? '');
  if (code === '23502') return true;
  const message = String((error as { message?: unknown } | null | undefined)?.message ?? '').toLowerCase();
  return message.includes('not-null') || message.includes('null value in column');
}

function sortWines(wines: Wine[]): Wine[] {
  return [...wines].sort((a, b) => WINE_NAME_COLLATOR.compare(a.name, b.name));
}

function normalizeOrigins(wines: Wine[]): Wine[] {
  return wines.map((wine) => ({
    ...wine,
    origin: normalizeOrigin(wine.origin)
  }));
}

function getLocalInventory(): Wine[] {
  return loadDb().inventory;
}

function persistLocalInventory(next: Wine[]) {
  const db = loadDb();
  saveDb({ ...db, inventory: next });
  notifyDbChanged();
}

async function listAllWineRows(): Promise<WineRow[]> {
  if (!supabase) return [];

  const rows: WineRow[] = [];
  let from = 0;

  while (true) {
    const to = from + WINES_PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from('wines')
      .select('*')
      .order('id', { ascending: true })
      .range(from, to);

    if (error) throw error;

    const page = (data ?? []) as WineRow[];
    if (page.length === 0) break;

    rows.push(...page);
    if (page.length < WINES_PAGE_SIZE) break;
    from += WINES_PAGE_SIZE;
  }

  return rows;
}

export async function listWines(): Promise<Wine[]> {
  const localInventory = getLocalInventory();

  if (supabase) {
    try {
      const data = await listAllWineRows();
      const wines = enrichThresholdsFromFallback((data ?? []).map(toWine), localInventory);
      const normalized = normalizeOrigins(wines);
      persistLocalInventory(normalized);
      return sortWines(normalized);
    } catch (error) {
      console.error('[wineRepository] Supabase list error', error);
      const localWithThresholds = enrichThresholdsFromFallback(localInventory, localInventory);
      const normalizedLocal = normalizeOrigins(localWithThresholds);
      persistLocalInventory(normalizedLocal);
      return sortWines(normalizedLocal);
    }
  }

  const wines = enrichThresholdsFromFallback(localInventory, localInventory);
  const normalized = normalizeOrigins(wines);
  persistLocalInventory(normalized);
  return sortWines(normalized);
}

export type WineInput = {
  id?: string;
  category?: string;
  name: string;
  age?: string;
  producer: string;
  origin: string;
  supplier?: string;
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
    category: input.category?.trim() || undefined,
    name: input.name.trim(),
    age: input.age?.trim() || undefined,
    producer: input.producer.trim(),
    origin: normalizeOrigin(input.origin),
    supplier: input.supplier?.trim() || undefined,
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
  persistLocalInventory(next);
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
  persistLocalInventory(next);
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
  persistLocalInventory(next);
  await syncWineDelete(id);
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
      supplier: row.supplier ?? '',
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

    if (normalized.length > 0) {
      const { data, error } = await supabase.from('wines').insert(normalized.map(toRowPayload)).select('*');

      if (error && isSchemaColumnError(error)) {
        const legacy = await supabase
          .from('wines')
          .insert(normalized.map(toLegacyPayload))
          .select('*');
        if (legacy.error) {
          console.error('[wineRepository] Supabase replace legacy error', legacy.error);
          throw legacy.error;
        }
        persisted = (legacy.data ?? []).map(toWine);
      } else if (error) {
        console.error('[wineRepository] Supabase replace insert error', error);
        throw error;
      } else {
        persisted = (data ?? []).map(toWine);
      }
    } else {
      persisted = [];
    }
  }

  const sorted = sortWines(persisted);
  persistLocalInventory(sorted);

  for (const wine of sorted) {
    await syncWineUpsert(wine);
  }

  return sorted;
}

export async function updateThresholdForAllWines(rawThreshold: number): Promise<number> {
  const threshold = normalizeThreshold(rawThreshold);
  if (threshold === undefined) {
    throw new Error('Valore soglia non valido');
  }

  const current = getLocalInventory();
  if (current.length === 0) return 0;

  if (supabase) {
    const { error } = await supabase
      .from('wines')
      .update({ threshold })
      .not('id', 'is', null);
    if (error && !isSchemaColumnError(error)) {
      console.error('[wineRepository] Supabase bulk threshold update error', error);
      throw error;
    }
  }

  const updated = sortWines(current.map((wine) => ({ ...wine, threshold })));
  persistLocalInventory(updated);

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

  persistLocalInventory([]);
  return deletedCount;
}
