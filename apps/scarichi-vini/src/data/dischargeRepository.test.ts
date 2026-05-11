import { beforeEach, describe, expect, it, vi } from 'vitest';

const supabaseMock = vi.hoisted(() => ({
  rowsByTable: {} as Record<string, unknown[]>,
  from: vi.fn()
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: supabaseMock.from
  }
}));

function makeQuery(table: string) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    order: vi.fn(() => query),
    limit: vi.fn(() =>
      Promise.resolve({
        data: supabaseMock.rowsByTable[table] ?? [],
        error: null
      })
    )
  };
  return query;
}

describe('dischargeRepository session summaries', () => {
  beforeEach(() => {
    vi.resetModules();
    supabaseMock.rowsByTable = {};
    supabaseMock.from.mockImplementation((table: string) => makeQuery(table));
  });

  it('counts wine session items from discharge_session_items', async () => {
    supabaseMock.rowsByTable.discharge_sessions = [
      {
        id: 'wine-session-1',
        created_at: '2026-05-04T10:00:00.000Z',
        submitted_at: '2026-05-04T10:05:00.000Z',
        total_qty: 7,
        status: 'submitted',
        discharge_session_items: [{ count: 3 }],
        spirits_session_items: [{ count: 99 }]
      }
    ];

    const { listDischargeSessionsByDomain } = await import('@/data/dischargeRepository');
    const rows = await listDischargeSessionsByDomain('wine', 'submitted');

    expect(rows[0]?.itemsCount).toBe(3);
  });

  it('counts spirits session items from spirits_session_items', async () => {
    supabaseMock.rowsByTable.spirits_sessions = [
      {
        id: 'spirits-session-1',
        created_at: '2026-05-04T10:00:00.000Z',
        submitted_at: '2026-05-04T10:05:00.000Z',
        total_qty: 5,
        status: 'submitted',
        discharge_session_items: [{ count: 99 }],
        spirits_session_items: [{ count: 2 }]
      }
    ];

    const { listDischargeSessionsByDomain } = await import('@/data/dischargeRepository');
    const rows = await listDischargeSessionsByDomain('spirits', 'submitted');

    expect(rows[0]?.itemsCount).toBe(2);
  });
});
