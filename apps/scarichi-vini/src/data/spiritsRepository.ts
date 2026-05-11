import type { Wine } from '@/domain/types';
import type { ArchiveCsvWineInput } from '@/data/archiveCsv';
import { supabase } from '@/lib/supabase';
import { newId } from '@/data/localDb';
import { syncSpiritDelete, syncSpiritUpsert } from '@/integrations/googleSheetsSync';
import { deriveMarginValue, deriveSalePrice, deriveWarehouseValue } from '@/domain/pricing';
import {
  normalizeWineCategory,
  normalizeWineName,
  normalizeWineProducer
} from '@/domain/normalizeWineText';

type SpiritsRow = {
  id?: string | null;
  category?: string | null;
  threshold?: number | string | null;
  soglia?: number | string | null;
  nome?: string | null;
  name?: string | null;
  producer?: string | null;
  produttore?: string | null;
  purchase_price?: number | string | null;
  acquisto?: number | string | null;
  sale_price?: number | string | null;
  vendita?: number | string | null;
  qty?: number | string | null;
  quantita_magazzino?: number | string | null;
};

const SPIRITS_TABLE = 'spirits_products';
const SPIRITS_NAME_COLLATOR = new Intl.Collator('it', { sensitivity: 'base' });
const SPIRITS_PAGE_SIZE = 1000;
const SPIRITS_WRITE_CHUNK_SIZE = 500;

function isSchemaColumnError(error: unknown): boolean {
  const message = String(
    (error as { message?: unknown } | null | undefined)?.message ?? ''
  ).toLowerCase();
  return message.includes('column') && message.includes('does not exist');
}

function isUniqueViolation(error: unknown): boolean {
  const code = String((error as { code?: unknown } | null | undefined)?.code ?? '');
  if (code === '23505') return true;
  const message = String(
    (error as { message?: unknown } | null | undefined)?.message ?? ''
  ).toLowerCase();
  return message.includes('duplicate key') || message.includes('unique');
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function toNumber(value: unknown): number | undefined {
  const parsed =
    typeof value === 'string'
      ? Number(value.replace(',', '.').trim())
      : typeof value === 'number'
        ? value
        : Number.NaN;
  if (!Number.isFinite(parsed)) return undefined;
  return parsed;
}

function toQty(value: unknown): number {
  const qty = toNumber(value);
  if (!Number.isFinite(qty)) return 0;
  return Math.max(0, Math.round(qty as number));
}

function normalizeThreshold(value: unknown): number | undefined {
  const parsed = toNumber(value);
  if (!Number.isFinite(parsed)) return undefined;
  const rounded = Math.round(parsed as number);
  if (rounded < 1) return undefined;
  return Math.min(99, rounded);
}

function toSpirit(row: SpiritsRow, index: number): Wine {
  const nameRaw = row.name ?? row.nome ?? '';
  const producerRaw = row.producer ?? row.produttore ?? '';
  const purchasePrice = toNumber(row.purchase_price ?? row.acquisto);
  const salePrice = toNumber(row.sale_price ?? row.vendita) ?? deriveSalePrice(purchasePrice);
  const qty = toQty(row.qty ?? row.quantita_magazzino);
  const threshold = normalizeThreshold(row.threshold ?? row.soglia);
  const margin = deriveMarginValue(purchasePrice, salePrice);
  const warehouse = deriveWarehouseValue(purchasePrice, qty);

  return {
    id: row.id?.trim() ? row.id.trim() : `spirit-${index + 1}`,
    category: row.category ? normalizeWineCategory(row.category) : undefined,
    name: normalizeWineName(nameRaw),
    producer: normalizeWineProducer(producerRaw),
    origin: '',
    threshold,
    qty,
    purchasePrice,
    salePrice,
    margin,
    warehouse
  };
}

function toSpiritInput(row: ArchiveCsvWineInput, fallbackId?: string): Partial<Wine> {
  const candidateId = row.id?.trim();
  const purchasePrice = row.purchasePrice;
  const salePrice =
    typeof row.salePrice === 'number' ? row.salePrice : deriveSalePrice(purchasePrice);
  return {
    id: candidateId || fallbackId || newId('spirit'),
    category: row.category ? normalizeWineCategory(row.category) : undefined,
    name: normalizeWineName(row.name),
    producer: normalizeWineProducer(row.producer),
    threshold: normalizeThreshold(row.threshold),
    purchasePrice,
    salePrice,
    qty: Number.isFinite(row.qty) ? Math.max(0, Math.round(row.qty)) : 0
  };
}

function toEnglishPayload(input: Partial<Wine> & { id?: string }) {
  const salePrice = input.salePrice ?? deriveSalePrice(input.purchasePrice);
  return {
    id: input.id,
    category: input.category ? normalizeWineCategory(input.category) : null,
    name: normalizeWineName(input.name ?? ''),
    producer: normalizeWineProducer(input.producer ?? ''),
    threshold: normalizeThreshold(input.threshold) ?? null,
    purchase_price: input.purchasePrice ?? null,
    sale_price: salePrice ?? null,
    qty: Number.isFinite(input.qty) ? Math.max(0, Math.round(input.qty as number)) : 0
  };
}

function toItalianPayload(input: Partial<Wine> & { id?: string }) {
  const salePrice = input.salePrice ?? deriveSalePrice(input.purchasePrice);
  return {
    id: input.id,
    category: input.category ? normalizeWineCategory(input.category) : null,
    nome: normalizeWineName(input.name ?? ''),
    produttore: normalizeWineProducer(input.producer ?? ''),
    soglia: normalizeThreshold(input.threshold) ?? null,
    acquisto: input.purchasePrice ?? null,
    vendita: salePrice ?? null,
    quantita_magazzino: Number.isFinite(input.qty)
      ? Math.max(0, Math.round(input.qty as number))
      : 0
  };
}

function sortSpirits(items: Wine[]): Wine[] {
  return [...items].sort((a, b) => SPIRITS_NAME_COLLATOR.compare(a.name, b.name));
}

async function writeSpiritsToSupabase(
  input: Partial<Wine>[],
  mode: 'insert' | 'upsert'
): Promise<Wine[]> {
  if (input.length === 0) return [];
  if (!supabase) throw new Error('Supabase non configurato');

  const inserted: Wine[] = [];

  for (const chunk of chunkArray(input, SPIRITS_WRITE_CHUNK_SIZE)) {
    const englishPayload = chunk.map((spirit) => toEnglishPayload(spirit));
    const first =
      mode === 'upsert'
        ? await supabase
            .from(SPIRITS_TABLE)
            .upsert(englishPayload, { onConflict: 'id' })
            .select('*')
        : await supabase.from(SPIRITS_TABLE).insert(englishPayload).select('*');

    if (first.error && isSchemaColumnError(first.error)) {
      const italianPayload = chunk.map((spirit) => toItalianPayload(spirit));
      const legacy =
        mode === 'upsert'
          ? await supabase
              .from(SPIRITS_TABLE)
              .upsert(italianPayload, { onConflict: 'id' })
              .select('*')
          : await supabase.from(SPIRITS_TABLE).insert(italianPayload).select('*');
      if (legacy.error) throw legacy.error;
      const legacyRows = (legacy.data ?? []) as SpiritsRow[];
      inserted.push(...legacyRows.map((row, index) => toSpirit(row, index)));
      continue;
    }

    if (first.error) throw first.error;
    const rows = (first.data ?? []) as SpiritsRow[];
    inserted.push(...rows.map((row, index) => toSpirit(row, index)));
  }

  return sortSpirits(inserted);
}

async function insertSpiritsToSupabase(input: Partial<Wine>[]): Promise<Wine[]> {
  return writeSpiritsToSupabase(input, 'insert');
}

async function upsertSpiritsToSupabase(input: Partial<Wine>[]): Promise<Wine[]> {
  return writeSpiritsToSupabase(input, 'upsert');
}

async function deleteSpiritsByIds(ids: string[]): Promise<void> {
  if (!supabase || ids.length === 0) return;

  for (const chunk of chunkArray(ids, SPIRITS_WRITE_CHUNK_SIZE)) {
    const { error } = await supabase.from(SPIRITS_TABLE).delete().in('id', chunk);
    if (error) throw error;
  }
}

export async function listSpirits(): Promise<Wine[]> {
  if (!supabase) return [];
  try {
    const rows = await listAllSpiritRows();
    return sortSpirits(rows.map(toSpirit));
  } catch (error) {
    console.error('[spiritsRepository] listSpirits error', error);
    return [];
  }
}

async function listAllSpiritRows(): Promise<SpiritsRow[]> {
  if (!supabase) return [];

  const rows: SpiritsRow[] = [];
  let from = 0;

  while (true) {
    const to = from + SPIRITS_PAGE_SIZE - 1;
    const { data, error } = await supabase.from(SPIRITS_TABLE).select('*').range(from, to);
    if (error) throw error;

    const page = (data ?? []) as SpiritsRow[];
    rows.push(...page);

    if (page.length < SPIRITS_PAGE_SIZE) break;
    from += SPIRITS_PAGE_SIZE;
  }

  return rows;
}

export async function createSpirit(input: Partial<Wine>): Promise<Wine> {
  if (!supabase) throw new Error('Supabase non configurato');
  const id = input.id?.trim() || newId('spirit');
  const englishPayload = toEnglishPayload({ ...input, id });

  let createdRow: SpiritsRow | null = null;
  const first = await supabase.from(SPIRITS_TABLE).insert(englishPayload).select('*').single();
  if (first.error && isSchemaColumnError(first.error)) {
    const legacy = await supabase
      .from(SPIRITS_TABLE)
      .insert(toItalianPayload({ ...input, id }))
      .select('*')
      .single();
    if (legacy.error) throw legacy.error;
    createdRow = legacy.data as SpiritsRow;
  } else if (first.error) {
    throw first.error;
  } else {
    createdRow = first.data as SpiritsRow;
  }

  const created = toSpirit(createdRow ?? { ...englishPayload, id }, 0);
  await syncSpiritUpsert(created);
  return created;
}

export async function updateSpirit(input: Partial<Wine> & { id: string }): Promise<Wine> {
  if (!supabase) throw new Error('Supabase non configurato');
  if (!input.id) throw new Error('Missing spirit id');

  const englishPayload = toEnglishPayload(input);
  let updatedRow: SpiritsRow | null = null;
  const first = await supabase
    .from(SPIRITS_TABLE)
    .update(englishPayload)
    .eq('id', input.id)
    .select('*')
    .single();
  if (first.error && isSchemaColumnError(first.error)) {
    const legacy = await supabase
      .from(SPIRITS_TABLE)
      .update(toItalianPayload(input))
      .eq('id', input.id)
      .select('*')
      .single();
    if (legacy.error) throw legacy.error;
    updatedRow = legacy.data as SpiritsRow;
  } else if (first.error) {
    throw first.error;
  } else {
    updatedRow = first.data as SpiritsRow;
  }

  const updated = toSpirit(updatedRow ?? { ...englishPayload, id: input.id }, 0);
  await syncSpiritUpsert(updated);
  return updated;
}

export async function deleteSpirit(id: string): Promise<void> {
  if (!supabase) throw new Error('Supabase non configurato');
  const { error } = await supabase.from(SPIRITS_TABLE).delete().eq('id', id);
  if (error) throw error;
  await syncSpiritDelete(id);
}

export async function clearSpiritsArchive(): Promise<number> {
  if (!supabase) throw new Error('Supabase non configurato');
  const before = await listSpirits();
  const { error } = await supabase.from(SPIRITS_TABLE).delete().not('id', 'is', null);
  if (error) throw error;
  return before.length;
}

export async function updateThresholdForAllSpirits(rawThreshold: number): Promise<number> {
  if (!supabase) throw new Error('Supabase non configurato');
  const threshold = normalizeThreshold(rawThreshold);
  if (threshold === undefined) throw new Error('Valore soglia non valido');

  const current = await listSpirits();
  if (current.length === 0) return 0;

  const { error } = await supabase.from(SPIRITS_TABLE).update({ threshold }).not('id', 'is', null);

  if (error && !isSchemaColumnError(error)) throw error;
  if (error && isSchemaColumnError(error)) {
    throw new Error(
      'Schema Spirits senza colonna soglia. Esegui la migrazione SQL per abilitare le soglie su spirits_products.'
    );
  }

  const updated = sortSpirits(current.map((spirit) => ({ ...spirit, threshold })));
  for (const spirit of updated) {
    await syncSpiritUpsert(spirit);
  }

  return updated.length;
}

export async function replaceAllSpirits(inputRows: ArchiveCsvWineInput[]): Promise<Wine[]> {
  if (!supabase) throw new Error('Supabase non configurato');

  const current = await listSpirits();
  const previousIds = current.map((spirit) => spirit.id);
  const normalized = inputRows.map((row) => toSpiritInput(row));
  const inserted = await upsertSpiritsToSupabase(normalized);
  const nextIds = new Set(inserted.map((spirit) => spirit.id));
  const staleIds = previousIds.filter((id) => !nextIds.has(id));
  await deleteSpiritsByIds(staleIds);
  for (const spirit of inserted) {
    await syncSpiritUpsert(spirit);
  }
  return inserted;
}

export async function appendSpirits(inputRows: ArchiveCsvWineInput[]): Promise<Wine[]> {
  if (!supabase) throw new Error('Supabase non configurato');

  const current = await listSpirits();
  const usedIds = new Set(current.map((item) => item.id));
  const normalized = inputRows.map((row) => {
    const candidateId = row.id?.trim();
    const safeId = candidateId && !usedIds.has(candidateId) ? candidateId : undefined;
    const spirit = toSpiritInput(row, safeId);
    if (spirit.id) usedIds.add(spirit.id);
    return spirit;
  });

  let inserted: Wine[] = [];
  try {
    inserted = await insertSpiritsToSupabase(normalized);
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const retried = normalized.map((item) => ({ ...item, id: newId('spirit') }));
    inserted = await insertSpiritsToSupabase(retried);
  }

  for (const spirit of inserted) {
    await syncSpiritUpsert(spirit);
  }

  return sortSpirits([...current, ...inserted]);
}
