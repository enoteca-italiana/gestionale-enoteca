import { supabase } from '@/lib/supabase';
import { normalizeOrigin } from '@/domain/normalizeOrigin';

export type DischargeStatus = 'pending' | 'submitted' | 'cancelled';

export type DischargeSessionSummary = {
  id: string;
  createdAt: number;
  submittedAt?: number;
  totalQty: number;
  itemsCount: number;
  status: DischargeStatus;
};

export type DischargeItemInput = {
  wineId: string;
  qty: number;
};

export type DischargeSessionItemDetail = {
  sessionId: string;
  sessionStatus: DischargeStatus;
  createdAt: number;
  submittedAt?: number;
  wineId: string;
  wineName: string;
  age?: string;
  producer?: string;
  origin?: string;
  category?: string;
  supplier?: string;
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
  total_qty?: number | null;
  status: DischargeStatus;
  discharge_session_items?: Array<{ count: number | null }> | null;
};

type SessionItemRow = {
  session_id: string;
  qty: number | null;
  wine_id: string;
  discharge_sessions:
    | {
        status: DischargeStatus;
        created_at: string;
        submitted_at?: string | null;
      }
    | Array<{
        status: DischargeStatus;
        created_at: string;
        submitted_at?: string | null;
      }>
    | null;
  wines:
    | {
        name?: string | null;
        age?: string | null;
        producer?: string | null;
        origin?: string | null;
        category?: string | null;
        supplier?: string | null;
      }
    | Array<{
        name?: string | null;
        age?: string | null;
        producer?: string | null;
        origin?: string | null;
        category?: string | null;
        supplier?: string | null;
      }>
    | null;
};

type WineQtyRow = {
  id: string;
  qty?: number | null;
};

export async function listDischargeSessions(
  status: DischargeStatus,
  options?: { limit?: number }
): Promise<DischargeSessionSummary[]> {
  const client = requireSupabase();
  const limit = Math.max(1, Math.min(options?.limit ?? 300, 2000));

  const { data: sessions, error: sessionsError } = await client
    .from('discharge_sessions')
    .select('id, created_at, submitted_at, total_qty, status, discharge_session_items(count)')
    .eq('status', status)
    .order(status === 'submitted' ? 'submitted_at' : 'created_at', { ascending: false })
    .limit(limit);

  if (sessionsError) throw sessionsError;

  const rows = (sessions ?? []) as SessionRow[];
  if (rows.length === 0) return [];

  return rows.map((row) => ({
    id: row.id,
    createdAt: new Date(row.created_at).getTime(),
    submittedAt: row.submitted_at ? new Date(row.submitted_at).getTime() : undefined,
    totalQty: Number(row.total_qty ?? 0),
    itemsCount: Number(row.discharge_session_items?.[0]?.count ?? 0),
    status: row.status
  }));
}

export async function createDischargeSession(input: {
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

export async function clearDischargeSessionsByStatus(status: DischargeStatus): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.from('discharge_sessions').delete().eq('status', status);
  if (error) throw error;
}

export async function listSubmittedDischargeItemsForAi(limit = 500): Promise<DischargeSessionItemDetail[]> {
  const client = requireSupabase();

  const { data, error } = await client
    .from('discharge_session_items')
    .select(
      'session_id, wine_id, qty, discharge_sessions!inner(status, created_at, submitted_at), wines(name, age, producer, origin, category, supplier)'
    )
    .eq('discharge_sessions.status', 'submitted')
    .order('submitted_at', { foreignTable: 'discharge_sessions', ascending: false })
    .limit(Math.max(1, Math.min(limit, 2000)));

  if (error) throw error;

  return ((data ?? []) as SessionItemRow[]).map((row) => {
    const session = Array.isArray(row.discharge_sessions) ? row.discharge_sessions[0] : row.discharge_sessions;
    const wine = Array.isArray(row.wines) ? row.wines[0] : row.wines;

    return {
      sessionId: row.session_id,
      sessionStatus: session?.status ?? 'submitted',
      createdAt: session?.created_at ? new Date(session.created_at).getTime() : Date.now(),
      submittedAt: session?.submitted_at ? new Date(session.submitted_at).getTime() : undefined,
      wineId: row.wine_id,
      wineName: wine?.name?.trim() || row.wine_id,
      age: wine?.age ?? undefined,
      producer: wine?.producer ?? undefined,
      origin: wine?.origin ? normalizeOrigin(wine.origin) : undefined,
      category: wine?.category ?? undefined,
      supplier: wine?.supplier ?? undefined,
      qty: Math.max(0, Number(row.qty ?? 0))
    };
  });
}

export async function listSubmittedDischargeSessionItems(
  sessionId: string
): Promise<DischargeSessionItemDetail[]> {
  const client = requireSupabase();

  const { data, error } = await client
    .from('discharge_session_items')
    .select(
      'session_id, wine_id, qty, discharge_sessions!inner(status, created_at, submitted_at), wines(name, age, producer, origin, category, supplier)'
    )
    .eq('session_id', sessionId)
    .eq('discharge_sessions.status', 'submitted');

  if (error) throw error;

  const rows = ((data ?? []) as SessionItemRow[]).map((row) => {
    const session = Array.isArray(row.discharge_sessions) ? row.discharge_sessions[0] : row.discharge_sessions;
    const wine = Array.isArray(row.wines) ? row.wines[0] : row.wines;

    return {
      sessionId: row.session_id,
      sessionStatus: session?.status ?? 'submitted',
      createdAt: session?.created_at ? new Date(session.created_at).getTime() : Date.now(),
      submittedAt: session?.submitted_at ? new Date(session.submitted_at).getTime() : undefined,
      wineId: row.wine_id,
      wineName: wine?.name?.trim() || row.wine_id,
      age: wine?.age ?? undefined,
      producer: wine?.producer ?? undefined,
      origin: wine?.origin ? normalizeOrigin(wine.origin) : undefined,
      category: wine?.category ?? undefined,
      supplier: wine?.supplier ?? undefined,
      qty: Math.max(0, Number(row.qty ?? 0))
    } satisfies DischargeSessionItemDetail;
  });

  rows.sort((a, b) => b.qty - a.qty || a.wineName.localeCompare(b.wineName, 'it-IT'));
  return rows;
}
