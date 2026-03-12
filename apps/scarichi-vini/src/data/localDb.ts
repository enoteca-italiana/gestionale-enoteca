import type { Wine } from '@/domain/types';
import { mockWines } from '@/data/mockWines';

export type LocalSessionItem = {
  wineId: string;
  qty: number;
};

export type LocalSession = {
  id: string;
  createdAt: number;
  submittedAt?: number;
  userLabel?: string;
  items: LocalSessionItem[];
};

export type LocalDbState = {
  inventory: Wine[];
  history: LocalSession[];
  pending: LocalSession[];
};

const DB_KEY = 'scarichi.localDb.v1';
export const dbChangedEvent = 'scarichi:dbChanged';

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function seed(): LocalDbState {
  return {
    inventory: mockWines,
    history: [],
    pending: []
  };
}

export function loadDb(): LocalDbState {
  const parsed = safeParse<LocalDbState>(localStorage.getItem(DB_KEY));
  if (!parsed || !Array.isArray(parsed.inventory) || !Array.isArray(parsed.history) || !Array.isArray(parsed.pending)) {
    const s = seed();
    saveDb(s);
    return s;
  }
  return parsed;
}

export function saveDb(db: LocalDbState) {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
}

export function resetDb() {
  localStorage.removeItem(DB_KEY);
}

export function notifyDbChanged() {
  window.dispatchEvent(new CustomEvent(dbChangedEvent));
}

export function newId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}
