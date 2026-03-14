import { beforeEach, describe, expect, it, vi } from 'vitest';

import { loadDb, newId, resetDb } from '@/data/localDb';

describe('localDb', () => {
  beforeEach(() => {
    resetDb();
    vi.restoreAllMocks();
  });

  it('newId prefixes and returns a string', () => {
    const id = newId('wine');
    expect(id.startsWith('wine_')).toBe(true);
    expect(typeof id).toBe('string');
  });

  it('loadDb seeds empty inventory and persists when empty', () => {
    const db = loadDb();
    expect(Array.isArray(db.inventory)).toBe(true);
    expect(db.inventory.length).toBe(0);
    expect(Array.isArray(db.history)).toBe(true);

    const persisted = localStorage.getItem('scarichi.localDb.v1');
    expect(persisted).toBeTruthy();
  });

  it('clears legacy local inventory once via supabase bootstrap migration', () => {
    localStorage.setItem(
      'scarichi.localDb.v1',
      JSON.stringify({
        inventory: [{ id: 'legacy-1', name: 'Legacy' }],
        history: []
      })
    );

    const db = loadDb();
    expect(db.inventory).toEqual([]);

    const parsed = JSON.parse(localStorage.getItem('scarichi.localDb.v1') ?? '{}');
    expect(parsed.inventory).toEqual([]);
    expect(localStorage.getItem('scarichi.inventory.supabaseBootstrap.v1')).toBe('1');
  });
});
