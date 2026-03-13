import { supabase } from '@/lib/supabase';

export type DischargeStatus = 'pending' | 'submitted' | 'cancelled';

export type DischargeSessionSummary = {
  id: string;
  createdAt: number;
  submittedAt?: number;
  userLabel?: string;
  totalQty: number;
  itemsCount: number;
  status: DischargeStatus;
};

export type DischargeItemInput = {
  wineId: string;
  qty: number;
};

function requireSupabase() {
  if (!supabase) {
    throw new Error('Supabase non configurato');
  }
  return supabase;
}

type SessionRow = {
  id: string;
  created_at: string;
  submitted_at?: string | null;
  user_label?: string | null;
  total_qty?: number | null;
  status: DischargeStatus;
};

type ItemCountRow = {
  session_id: string;
};

type WineQtyRow = {
  id: string;
  qty?: number | null;
};

export async function listDischargeSessions(status: DischargeStatus): Promise<DischargeSessionSummary[]> {
  const client = requireSupabase();

  const { data: sessions, error: sessionsError } = await client
    .from('discharge_sessions')
    .select('id, created_at, submitted_at, user_label, total_qty, status')
    .eq('status', status)
    .order(status === 'submitted' ? 'submitted_at' : 'created_at', { ascending: false });

  if (sessionsError) throw sessionsError;

  const rows = (sessions ?? []) as SessionRow[];
  if (rows.length === 0) return [];

  const ids = rows.map((row) => row.id);
  const { data: items, error: itemsError } = await client
    .from('discharge_session_items')
    .select('session_id')
    .in('session_id', ids);

  if (itemsError) throw itemsError;

  const counts = new Map<string, number>();
  for (const row of (items ?? []) as ItemCountRow[]) {
    counts.set(row.session_id, (counts.get(row.session_id) ?? 0) + 1);
  }

  return rows.map((row) => ({
    id: row.id,
    createdAt: new Date(row.created_at).getTime(),
    submittedAt: row.submitted_at ? new Date(row.submitted_at).getTime() : undefined,
    userLabel: row.user_label ?? undefined,
    totalQty: Number(row.total_qty ?? 0),
    itemsCount: counts.get(row.id) ?? 0,
    status: row.status
  }));
}

export async function createDischargeSession(input: {
  userLabel?: string;
  items: DischargeItemInput[];
  source?: string;
}): Promise<string> {
  const client = requireSupabase();
  const cleanItems = input.items.filter((item) => item.qty > 0);
  if (cleanItems.length === 0) throw new Error('Sessione vuota');

  const { data: session, error: sessionError } = await client
    .from('discharge_sessions')
    .insert({
      status: 'pending',
      user_label: input.userLabel ?? null,
      source: input.source ?? 'web'
    })
    .select('id')
    .single();

  if (sessionError) throw sessionError;

  const { error: itemsError } = await client.from('discharge_session_items').insert(
    cleanItems.map((item) => ({
      session_id: session.id,
      wine_id: item.wineId,
      qty: item.qty
    }))
  );

  if (itemsError) throw itemsError;

  return session.id as string;
}

export async function submitDischargeSession(sessionId: string): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.rpc('submit_discharge_session', {
    p_session_id: sessionId
  });
  if (error) throw error;
}

export async function createAndSubmitDischargeSession(input: {
  userLabel?: string;
  items: DischargeItemInput[];
  source?: string;
  expectedQtyByWineId?: Record<string, number>;
}): Promise<string> {
  const sessionId = await createDischargeSession(input);
  await submitDischargeSession(sessionId);
  await reconcileSubmittedSessionStock(input.items, input.expectedQtyByWineId);
  return sessionId;
}

async function reconcileSubmittedSessionStock(
  items: DischargeItemInput[],
  expectedQtyByWineId?: Record<string, number>
) {
  if (!expectedQtyByWineId) return;
  const client = requireSupabase();
  const ids = [...new Set(items.filter((item) => item.qty > 0).map((item) => item.wineId))];
  if (ids.length === 0) return;

  const { data, error } = await client.from('wines').select('id, qty').in('id', ids);
  if (error) throw error;

  const rows = (data ?? []) as WineQtyRow[];
  for (const row of rows) {
    const expected = expectedQtyByWineId[row.id];
    if (!Number.isFinite(expected)) continue;
    const expectedQty = Math.max(0, Math.round(expected));
    const currentQty = Number(row.qty ?? 0);

    // Safety net: if RPC/session workflow did not propagate stock update,
    // align wine qty to the already-computed local post-session value.
    if (currentQty > expectedQty) {
      const { error: updateError } = await client
        .from('wines')
        .update({ qty: expectedQty })
        .eq('id', row.id);
      if (updateError) throw updateError;
    }
  }
}

export async function deleteDischargeSession(id: string): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.from('discharge_sessions').delete().eq('id', id);
  if (error) throw error;
}

export async function clearDischargeSessionsByStatus(status: DischargeStatus): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.from('discharge_sessions').delete().eq('status', status);
  if (error) throw error;
}
