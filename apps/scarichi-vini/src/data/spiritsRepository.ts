import type { Wine } from '@/domain/types';
import type { ArchiveCsvWineInput } from '@/data/archiveCsv';
import { supabase } from '@/lib/supabase';
import { newId } from '@/data/localDb';
import {
  normalizeWineCategory,
  normalizeWineName,
  normalizeWineProducer
} from '@/domain/normalizeWineText';

type SpiritsRow = {
  id?: string | null;
  category?: string | null;
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

function toSpirit(row: SpiritsRow, index: number): Wine {
  const nameRaw = row.name ?? row.nome ?? '';
  const producerRaw = row.producer ?? row.produttore ?? '';
  const purchasePrice = toNumber(row.purchase_price ?? row.acquisto);
  const salePrice = toNumber(row.sale_price ?? row.vendita);
  const qty = toQty(row.qty ?? row.quantita_magazzino);
  const margin =
    purchasePrice !== undefined && salePrice !== undefined
      ? Number((salePrice - purchasePrice).toFixed(2))
      : undefined;
  const warehouse =
    purchasePrice !== undefined ? Number((purchasePrice * qty).toFixed(2)) : undefined;

  return {
    id: row.id?.trim() ? row.id.trim() : `spirit-${index + 1}`,
    category: row.category ? normalizeWineCategory(row.category) : undefined,
    name: normalizeWineName(nameRaw || `SPIRIT ${index + 1}`),
    producer: normalizeWineProducer(producerRaw || 'N/D'),
    origin: '',
    qty,
    purchasePrice,
    salePrice,
    margin,
    warehouse
  };
}

function toSpiritInput(row: ArchiveCsvWineInput, fallbackId?: string): Partial<Wine> {
  const candidateId = row.id?.trim();
  return {
    id: candidateId || fallbackId || newId('spirit'),
    category: row.category ? normalizeWineCategory(row.category) : undefined,
    name: normalizeWineName(row.name),
    producer: normalizeWineProducer(row.producer),
    purchasePrice: row.purchasePrice,
    salePrice: row.salePrice,
    qty: Number.isFinite(row.qty) ? Math.max(0, Math.round(row.qty)) : 0
  };
}

function toEnglishPayload(input: Partial<Wine> & { id?: string }) {
  return {
    id: input.id,
    category: input.category ? normalizeWineCategory(input.category) : null,
    name: normalizeWineName(input.name ?? ''),
    producer: normalizeWineProducer(input.producer ?? ''),
    purchase_price: input.purchasePrice ?? null,
    sale_price: input.salePrice ?? null,
    qty: Number.isFinite(input.qty) ? Math.max(0, Math.round(input.qty as number)) : 0
  };
}

function toItalianPayload(input: Partial<Wine> & { id?: string }) {
  return {
    id: input.id,
    category: input.category ? normalizeWineCategory(input.category) : null,
    nome: normalizeWineName(input.name ?? ''),
    produttore: normalizeWineProducer(input.producer ?? ''),
    acquisto: input.purchasePrice ?? null,
    vendita: input.salePrice ?? null,
    quantita_magazzino: Number.isFinite(input.qty) ? Math.max(0, Math.round(input.qty as number)) : 0
  };
}

function sortSpirits(items: Wine[]): Wine[] {
  return [...items].sort((a, b) => SPIRITS_NAME_COLLATOR.compare(a.name, b.name));
}

async function insertSpiritsToSupabase(input: Partial<Wine>[]): Promise<Wine[]> {
  if (input.length === 0) return [];
  if (!supabase) throw new Error('Supabase non configurato');

  const englishPayload = input.map((spirit) => toEnglishPayload(spirit));
  const first = await supabase.from(SPIRITS_TABLE).insert(englishPayload).select('*');
  if (first.error && isSchemaColumnError(first.error)) {
    const italianPayload = input.map((spirit) => toItalianPayload(spirit));
    const legacy = await supabase.from(SPIRITS_TABLE).insert(italianPayload).select('*');
    if (legacy.error) throw legacy.error;
    const legacyRows = (legacy.data ?? []) as SpiritsRow[];
    return sortSpirits(legacyRows.map((row, index) => toSpirit(row, index)));
  }
  if (first.error) throw first.error;
  const rows = (first.data ?? []) as SpiritsRow[];
  return sortSpirits(rows.map((row, index) => toSpirit(row, index)));
}

export async function listSpirits(): Promise<Wine[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from(SPIRITS_TABLE).select('*');
  if (error) {
    console.error('[spiritsRepository] listSpirits error', error);
    return [];
  }
  const rows = (data ?? []) as SpiritsRow[];
  return sortSpirits(rows.map(toSpirit));
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

  return toSpirit(createdRow ?? { ...englishPayload, id }, 0);
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

  return toSpirit(updatedRow ?? { ...englishPayload, id: input.id }, 0);
}

export async function deleteSpirit(id: string): Promise<void> {
  if (!supabase) throw new Error('Supabase non configurato');
  const { error } = await supabase.from(SPIRITS_TABLE).delete().eq('id', id);
  if (error) throw error;
}

export async function clearSpiritsArchive(): Promise<number> {
  if (!supabase) throw new Error('Supabase non configurato');
  const before = await listSpirits();
  const { error } = await supabase.from(SPIRITS_TABLE).delete().not('id', 'is', null);
  if (error) throw error;
  return before.length;
}

export async function replaceAllSpirits(inputRows: ArchiveCsvWineInput[]): Promise<Wine[]> {
  if (!supabase) throw new Error('Supabase non configurato');

  const normalized = inputRows.map((row) => toSpiritInput(row));
  const { error: deleteError } = await supabase.from(SPIRITS_TABLE).delete().not('id', 'is', null);
  if (deleteError) throw deleteError;

  return insertSpiritsToSupabase(normalized);
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

  return sortSpirits([...current, ...inserted]);
}
