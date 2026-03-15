import type { Wine } from '@/domain/types';

export type LocalSessionItem = {
  wineId: string;
  qty: number;
};

export type LocalSession = {
  id: string;
  createdAt: number;
  submittedAt?: number;
  items: LocalSessionItem[];
};

export type LocalDbState = {
  inventory: Wine[];
  history: LocalSession[];
};

const DB_KEY = 'scarichi.localDb.v1';
const SUPABASE_BOOTSTRAP_FLAG = 'scarichi.inventory.supabaseBootstrap.v1';
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
    inventory: [],
    history: []
  };
}

export function loadDb(): LocalDbState {
  const parsed = safeParse<LocalDbState>(localStorage.getItem(DB_KEY));
  if (
    !parsed ||
    !Array.isArray(parsed.inventory) ||
    !Array.isArray(parsed.history)
  ) {
    const s = seed();
    saveDb(s);
    return s;
  }
  // One-shot migration: remove legacy local seeded inventory.
  // Home page will repopulate from Supabase via refreshInventory().
  if (!localStorage.getItem(SUPABASE_BOOTSTRAP_FLAG)) {
    const migrated = { ...parsed, inventory: [] };
    saveDb(migrated);
    localStorage.setItem(SUPABASE_BOOTSTRAP_FLAG, '1');
    return migrated;
  }
  return parsed;
}

export function saveDb(db: LocalDbState) {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
}

export function resetDb() {
  localStorage.removeItem(DB_KEY);
}

export function notifyDbChanged(sourceId?: string) {
  window.dispatchEvent(new CustomEvent(dbChangedEvent, { detail: { sourceId } }));
}

export function newId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}
