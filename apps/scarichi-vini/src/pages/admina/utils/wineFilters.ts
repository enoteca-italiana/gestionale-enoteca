import type { Wine } from '@/domain/types';
import type { Filters } from '@/pages/admina/types';

export function isInThreshold(wine: Wine) {
  const qty = Number(wine.qty);
  const threshold = Number(wine.threshold);
  if (!Number.isFinite(qty) || qty <= 0) return false;
  if (!Number.isFinite(threshold) || threshold < 1) return false;
  return qty <= threshold;
}

export function matchesFilters(wine: Wine, filters: Filters) {
  const term = filters.term.trim().toLowerCase();
  if (term) {
    const haystack = [
      wine.category,
      wine.name,
      wine.age,
      wine.producer,
      wine.origin,
      wine.notes,
      wine.warehouse
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    if (!haystack.includes(term)) return false;
  }

  if (filters.category !== 'all') {
    const category = wine.category?.toLowerCase() ?? '';
    if (category !== filters.category.toLowerCase()) return false;
  }
  if (filters.producer !== 'all') {
    const producer = wine.producer?.toLowerCase() ?? '';
    if (producer !== filters.producer.toLowerCase()) return false;
  }
  if (filters.origin !== 'all') {
    const origin = wine.origin?.toLowerCase() ?? '';
    if (origin !== filters.origin.toLowerCase()) return false;
  }

  if (filters.stock === 'threshold' && !isInThreshold(wine)) return false;
  if (filters.stock === 'out' && wine.qty > 0) return false;
  return true;
}
