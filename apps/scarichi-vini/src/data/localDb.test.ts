import { beforeEach, describe, expect, it, vi } from 'vitest';

import { dbChangedEvent, loadDb, newId, notifyDbChanged, resetDb } from '@/data/localDb';

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

  it('emits dbChanged custom event when notifyDbChanged is called', () => {
    const listener = vi.fn();
    window.addEventListener(dbChangedEvent, listener as EventListener);
    notifyDbChanged('unit-test');
    window.removeEventListener(dbChangedEvent, listener as EventListener);

    expect(listener).toHaveBeenCalledTimes(1);
    const event = listener.mock.calls[0]?.[0] as CustomEvent<{ sourceId?: string }>;
    expect(event.detail?.sourceId).toBe('unit-test');
  });

  it('broadcasts dbChanged through BroadcastChannel when available', () => {
    const postMessage = vi.fn();
    const close = vi.fn();
    const BroadcastChannelMock = vi.fn(() => ({
      postMessage,
      close
    }));

    vi.stubGlobal('BroadcastChannel', BroadcastChannelMock);
    notifyDbChanged('channel-source');
    vi.unstubAllGlobals();

    expect(BroadcastChannelMock).toHaveBeenCalledWith('scarichi:dbChangedChannel');
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ sourceId: 'channel-source' })
    );
    expect(close).toHaveBeenCalledTimes(1);
  });
});
