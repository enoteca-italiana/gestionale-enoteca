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

  it('loadDb seeds and persists when empty', () => {
    const db = loadDb();
    expect(Array.isArray(db.inventory)).toBe(true);
    expect(db.inventory.length).toBeGreaterThan(0);
    expect(Array.isArray(db.history)).toBe(true);
    expect(Array.isArray(db.pending)).toBe(true);

    const persisted = localStorage.getItem('scarichi.localDb.v1');
    expect(persisted).toBeTruthy();
  });
});
