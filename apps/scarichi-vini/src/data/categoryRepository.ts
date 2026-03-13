import type { Wine } from '@/domain/types';

const CATEGORY_STORAGE_KEY = 'scarichi.categories.v1';
const DEFAULT_CATEGORIES = ['Italiani', 'Stranieri'];

function normalizeCategoryName(value: string) {
  return value.trim().replace(/\s+/g, ' ');
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

export function listCategoryOptions(wines: Wine[], managedCategories: string[]): string[] {
  const entries: string[] = [...DEFAULT_CATEGORIES, ...managedCategories];
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

export function upsertManagedCategory(rawValue: string, existingCategories: string[], managed: string[]) {
  const normalized = normalizeCategoryName(rawValue);
  if (!normalized) {
    return { created: null as string | null, managedNext: managed, changed: false };
  }

  const existing = existingCategories.find((item) => item.toLowerCase() === normalized.toLowerCase());
  if (existing) {
    return { created: existing, managedNext: managed, changed: false };
  }

  const managedNext = [...managed, normalized];
  saveManagedCategories(managedNext);
  return { created: normalized, managedNext, changed: true };
}
