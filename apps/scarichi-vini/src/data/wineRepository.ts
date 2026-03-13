import type { Wine } from '@/domain/types';
import type { ArchiveCsvWineInput } from '@/data/archiveCsv';
import { supabase } from '@/lib/supabase';
import { loadDb, notifyDbChanged, saveDb, newId } from '@/data/localDb';
import { syncWineUpsert, syncWineDelete } from '@/integrations/googleSheetsSync';

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
    origin: row.origin,
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
    origin: wine.origin,
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
    origin: wine.origin,
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

function sortWines(wines: Wine[]): Wine[] {
  return [...wines].sort((a, b) => a.name.localeCompare(b.name, 'it', { sensitivity: 'base' }));
}

function getLocalInventory(): Wine[] {
  return loadDb().inventory;
}

function persistLocalInventory(next: Wine[]) {
  const db = loadDb();
  saveDb({ ...db, inventory: next });
  notifyDbChanged();
}

export async function listWines(): Promise<Wine[]> {
  const localInventory = getLocalInventory();

  if (supabase) {
    const { data, error } = await supabase.from('wines').select('*');
    if (error) {
      console.error('[wineRepository] Supabase list error', error);
      const localWithThresholds = enrichThresholdsFromFallback(localInventory, localInventory);
      persistLocalInventory(localWithThresholds);
      return sortWines(localWithThresholds);
    }
    const wines = enrichThresholdsFromFallback((data ?? []).map(toWine), localInventory);
    persistLocalInventory(wines);
    return sortWines(wines);
  }

  const wines = enrichThresholdsFromFallback(localInventory, localInventory);
  persistLocalInventory(wines);
  return sortWines(wines);
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
    origin: input.origin.trim(),
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
