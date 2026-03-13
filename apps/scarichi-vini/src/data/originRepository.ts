import type { Wine } from '@/domain/types';

const ORIGIN_STORAGE_KEY = 'scarichi.origins.v1';

function normalizeOrigin(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

export function loadManagedOrigins(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(ORIGIN_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => (typeof item === 'string' ? normalizeOrigin(item) : ''))
      .filter(Boolean);
  } catch {
    return [];
  }
}

function saveManagedOrigins(origins: string[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(ORIGIN_STORAGE_KEY, JSON.stringify(origins));
}

export function listOriginOptions(wines: Wine[], managedOrigins: string[]): string[] {
  const entries: string[] = [...managedOrigins];
  wines.forEach((wine) => {
    if (wine.origin?.trim()) entries.push(wine.origin.trim());
  });

  const seen = new Map<string, string>();
  entries.forEach((entry) => {
    const normalized = normalizeOrigin(entry);
    if (!normalized) return;
    const key = normalized.toLowerCase();
    if (!seen.has(key)) seen.set(key, normalized);
  });

  return Array.from(seen.values()).sort((a, b) =>
    a.localeCompare(b, 'it', { sensitivity: 'base' })
  );
}

export function upsertManagedOrigin(rawValue: string, existingOrigins: string[], managedOrigins: string[]) {
  const normalized = normalizeOrigin(rawValue);
  if (!normalized) {
    return { created: null as string | null, managedNext: managedOrigins, changed: false };
  }

  const existing = existingOrigins.find((item) => item.toLowerCase() === normalized.toLowerCase());
  if (existing) {
    return { created: existing, managedNext: managedOrigins, changed: false };
  }

  const managedNext = [...managedOrigins, normalized];
  saveManagedOrigins(managedNext);
  return { created: normalized, managedNext, changed: true };
}
