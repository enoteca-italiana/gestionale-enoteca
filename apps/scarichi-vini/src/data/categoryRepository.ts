import type { Wine } from '@/domain/types';
import { supabase } from '@/lib/supabase';
import { normalizeWineCategory } from '@/domain/normalizeWineText';

const CATEGORY_STORAGE_KEY = 'scarichi.categories.v1';

function normalizeCategoryName(value: string) {
  return normalizeWineCategory(value);
}

function isSchemaColumnError(error: unknown): boolean {
  const message = String(
    (error as { message?: unknown } | null | undefined)?.message ?? ''
  ).toLowerCase();
  return message.includes('column') && message.includes('does not exist');
}

export function loadManagedCategories(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(CATEGORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => (typeof item === 'string' ? normalizeCategoryName(item) : ''))
      .filter(Boolean);
  } catch {
    return [];
  }
}

function saveManagedCategories(categories: string[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(CATEGORY_STORAGE_KEY, JSON.stringify(categories));
}

export function clearManagedCategories() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(CATEGORY_STORAGE_KEY);
}

export function listCategoryOptions(wines: Wine[], managedCategories: string[]): string[] {
  const entries: string[] = [...managedCategories];
  wines.forEach((wine) => {
    if (wine.category?.trim()) entries.push(wine.category.trim());
  });

  const seen = new Map<string, string>();
  entries.forEach((entry) => {
    const normalized = normalizeCategoryName(entry);
    if (!normalized) return;
    const key = normalized.toLowerCase();
    if (!seen.has(key)) seen.set(key, normalized);
  });

  return Array.from(seen.values()).sort((a, b) =>
    a.localeCompare(b, 'it', { sensitivity: 'base' })
  );
}

export function upsertManagedCategory(
  rawValue: string,
  existingCategories: string[],
  managed: string[]
) {
  const normalized = normalizeCategoryName(rawValue);
  if (!normalized) {
    return { created: null as string | null, managedNext: managed, changed: false };
  }

  const existing = existingCategories.find(
    (item) => item.toLowerCase() === normalized.toLowerCase()
  );
  if (existing) {
    return { created: existing, managedNext: managed, changed: false };
  }

  const managedNext = [...managed, normalized];
  saveManagedCategories(managedNext);
  return { created: normalized, managedNext, changed: true };
}

type CategoryRow = {
  name?: string | null;
};

export async function listSupabaseCategories(): Promise<string[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('categories')
    .select('name')
    .order('name', { ascending: true });
  if (error) {
    if (!isSchemaColumnError(error)) {
      console.error('[categoryRepository] listSupabaseCategories error', error);
    }
    return [];
  }

  const seen = new Map<string, string>();
  for (const row of (data ?? []) as CategoryRow[]) {
    const normalized = normalizeCategoryName(row.name ?? '');
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (!seen.has(key)) seen.set(key, normalized);
  }
  return Array.from(seen.values()).sort((a, b) =>
    a.localeCompare(b, 'it', { sensitivity: 'base' })
  );
}

export async function upsertSupabaseCategory(rawValue: string): Promise<void> {
  if (!supabase) return;
  const normalized = normalizeCategoryName(rawValue);
  if (!normalized) return;

  const { data: existing, error: existingError } = await supabase
    .from('categories')
    .select('id')
    .ilike('name', normalized)
    .limit(1);

  if (existingError) {
    if (!isSchemaColumnError(existingError)) {
      console.error('[categoryRepository] lookup category error', existingError);
    }
    return;
  }

  if (existing && existing.length > 0) return;

  const { error: insertError } = await supabase.from('categories').insert({ name: normalized });
  if (insertError) {
    const code = (insertError as { code?: string } | null)?.code;
    if (code === '23505') return;
    if (!isSchemaColumnError(insertError)) {
      console.error('[categoryRepository] insert category error', insertError);
    }
  }
}

export async function clearSupabaseCategories(): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('categories').delete().not('id', 'is', null);
  if (error) {
    if (!isSchemaColumnError(error)) {
      console.error('[categoryRepository] clearSupabaseCategories error', error);
    }
  }
}
