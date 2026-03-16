import type { Wine } from '@/domain/types';
import { normalizeWineProducer } from '@/domain/normalizeWineText';

const PRODUCER_STORAGE_KEY = 'scarichi.producers.v1';

function normalizeProducer(value: string) {
  return normalizeWineProducer(value);
}

export function loadManagedProducers(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(PRODUCER_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => (typeof item === 'string' ? normalizeProducer(item) : ''))
      .filter(Boolean);
  } catch {
    return [];
  }
}

function saveManagedProducers(producers: string[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(PRODUCER_STORAGE_KEY, JSON.stringify(producers));
}

export function clearManagedProducers() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(PRODUCER_STORAGE_KEY);
}

export function listProducerOptions(wines: Wine[], managedProducers: string[]): string[] {
  const entries: string[] = [...managedProducers];
  wines.forEach((wine) => {
    if (wine.producer?.trim()) entries.push(wine.producer.trim());
  });

  const seen = new Map<string, string>();
  entries.forEach((entry) => {
    const normalized = normalizeProducer(entry);
    if (!normalized) return;
    const key = normalized.toLowerCase();
    if (!seen.has(key)) seen.set(key, normalized);
  });

  return Array.from(seen.values()).sort((a, b) =>
    a.localeCompare(b, 'it', { sensitivity: 'base' })
  );
}

export function upsertManagedProducer(
  rawValue: string,
  existingProducers: string[],
  managedProducers: string[]
) {
  const normalized = normalizeProducer(rawValue);
  if (!normalized) {
    return { created: null as string | null, managedNext: managedProducers, changed: false };
  }

  const existing = existingProducers.find(
    (item) => item.toLowerCase() === normalized.toLowerCase()
  );
  if (existing) {
    return { created: existing, managedNext: managedProducers, changed: false };
  }

  const managedNext = [...managedProducers, normalized];
  saveManagedProducers(managedNext);
  return { created: normalized, managedNext, changed: true };
}
