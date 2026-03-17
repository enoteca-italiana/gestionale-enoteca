import type { Wine } from '@/domain/types';
import { supabase } from '@/lib/supabase';
import { normalizeWineSupplier } from '@/domain/normalizeWineText';

const SUPPLIER_STORAGE_KEY = 'scarichi.suppliers.v1';

function normalizeSupplier(value: string) {
  return normalizeWineSupplier(value);
}

function isSchemaColumnError(error: unknown): boolean {
  const message = String(
    (error as { message?: unknown } | null | undefined)?.message ?? ''
  ).toLowerCase();
  return message.includes('column') && message.includes('does not exist');
}

export function loadManagedSuppliers(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(SUPPLIER_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => (typeof item === 'string' ? normalizeSupplier(item) : ''))
      .filter(Boolean);
  } catch {
    return [];
  }
}

function saveManagedSuppliers(suppliers: string[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(SUPPLIER_STORAGE_KEY, JSON.stringify(suppliers));
}

function uniqueSortedSuppliers(entries: string[]) {
  const seen = new Map<string, string>();
  for (const entry of entries) {
    const normalized = normalizeSupplier(entry);
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (!seen.has(key)) seen.set(key, normalized);
  }
  return Array.from(seen.values()).sort((a, b) =>
    a.localeCompare(b, 'it', { sensitivity: 'base' })
  );
}

export function clearManagedSuppliers() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(SUPPLIER_STORAGE_KEY);
}

export function listSupplierOptions(wines: Wine[], managedSuppliers: string[]): string[] {
  const entries: string[] = [...managedSuppliers];
  wines.forEach((wine) => {
    if (wine.supplier?.trim()) entries.push(wine.supplier.trim());
  });

  const seen = new Map<string, string>();
  entries.forEach((entry) => {
    const normalized = normalizeSupplier(entry);
    if (!normalized) return;
    const key = normalized.toLowerCase();
    if (!seen.has(key)) seen.set(key, normalized);
  });

  return Array.from(seen.values()).sort((a, b) =>
    a.localeCompare(b, 'it', { sensitivity: 'base' })
  );
}

export function upsertManagedSupplier(
  rawValue: string,
  existingSuppliers: string[],
  managedSuppliers: string[]
) {
  const normalized = normalizeSupplier(rawValue);
  if (!normalized) {
    return { created: null as string | null, managedNext: managedSuppliers, changed: false };
  }

  const existing = existingSuppliers.find(
    (item) => item.toLowerCase() === normalized.toLowerCase()
  );
  if (existing) {
    return { created: existing, managedNext: managedSuppliers, changed: false };
  }

  const managedNext = [...managedSuppliers, normalized];
  saveManagedSuppliers(managedNext);
  return { created: normalized, managedNext, changed: true };
}

export function renameManagedSupplier(rawFrom: string, rawTo: string, managedSuppliers: string[]) {
  const from = normalizeSupplier(rawFrom);
  const to = normalizeSupplier(rawTo);
  if (!from || !to) {
    return { managedNext: managedSuppliers, changed: false };
  }

  const nextEntries = managedSuppliers.map((item) =>
    item.toLowerCase() === from.toLowerCase() ? to : item
  );
  const managedNext = uniqueSortedSuppliers(nextEntries);
  const changed =
    managedNext.length !== managedSuppliers.length ||
    managedNext.some((item, index) => item !== managedSuppliers[index]);
  if (changed) {
    saveManagedSuppliers(managedNext);
  }
  return { managedNext, changed };
}

export function removeManagedSupplier(rawValue: string, managedSuppliers: string[]) {
  const value = normalizeSupplier(rawValue);
  if (!value) {
    return { managedNext: managedSuppliers, changed: false };
  }
  const managedNext = managedSuppliers.filter((item) => item.toLowerCase() !== value.toLowerCase());
  const changed = managedNext.length !== managedSuppliers.length;
  if (changed) {
    saveManagedSuppliers(managedNext);
  }
  return { managedNext, changed };
}

type SupplierRow = {
  name?: string | null;
};

export async function listSupabaseSuppliers(): Promise<string[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('suppliers')
    .select('name')
    .order('name', { ascending: true });
  if (error) {
    if (!isSchemaColumnError(error)) {
      console.error('[supplierRepository] listSupabaseSuppliers error', error);
    }
    return [];
  }

  const seen = new Map<string, string>();
  for (const row of (data ?? []) as SupplierRow[]) {
    const normalized = normalizeSupplier(row.name ?? '');
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (!seen.has(key)) seen.set(key, normalized);
  }
  return Array.from(seen.values()).sort((a, b) =>
    a.localeCompare(b, 'it', { sensitivity: 'base' })
  );
}

export async function upsertSupabaseSupplier(rawValue: string): Promise<void> {
  if (!supabase) return;
  const normalized = normalizeSupplier(rawValue);
  if (!normalized) return;

  const { data: existing, error: existingError } = await supabase
    .from('suppliers')
    .select('id')
    .ilike('name', normalized)
    .limit(1);

  if (existingError) {
    if (!isSchemaColumnError(existingError)) {
      console.error('[supplierRepository] lookup supplier error', existingError);
    }
    return;
  }

  if (existing && existing.length > 0) return;

  const { error: insertError } = await supabase.from('suppliers').insert({ name: normalized });
  if (insertError) {
    const code = (insertError as { code?: string } | null)?.code;
    if (code === '23505') return;
    if (!isSchemaColumnError(insertError)) {
      console.error('[supplierRepository] insert supplier error', insertError);
    }
  }
}

export async function renameSupabaseSupplier(rawFrom: string, rawTo: string): Promise<void> {
  if (!supabase) return;
  const from = normalizeSupplier(rawFrom);
  const to = normalizeSupplier(rawTo);
  if (!from || !to) return;
  if (from.toLowerCase() === to.toLowerCase()) return;

  await upsertSupabaseSupplier(to);
  const { error } = await supabase.from('suppliers').delete().eq('name', from);
  if (error) {
    if (!isSchemaColumnError(error)) {
      console.error('[supplierRepository] renameSupabaseSupplier error', error);
    }
  }
}

export async function deleteSupabaseSupplier(rawValue: string): Promise<void> {
  if (!supabase) return;
  const normalized = normalizeSupplier(rawValue);
  if (!normalized) return;
  const { error } = await supabase.from('suppliers').delete().eq('name', normalized);
  if (error) {
    if (!isSchemaColumnError(error)) {
      console.error('[supplierRepository] deleteSupabaseSupplier error', error);
    }
  }
}

export async function clearSupabaseSuppliers(): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('suppliers').delete().not('id', 'is', null);
  if (error) {
    if (!isSchemaColumnError(error)) {
      console.error('[supplierRepository] clearSupabaseSuppliers error', error);
    }
  }
}
