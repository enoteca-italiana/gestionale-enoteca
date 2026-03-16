import { supabase } from '@/lib/supabase';
import { normalizeOrigin } from '@/domain/normalizeOrigin';
import {
  normalizeWineCategory,
  normalizeWineName,
  normalizeWineProducer,
  normalizeWineSupplier
} from '@/domain/normalizeWineText';

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

const SESSION_ITEMS_SELECT_WITH_SNAPSHOT =
  'session_id, wine_id, qty, wine_name, wine_age, wine_producer, wine_origin, wine_category, wine_supplier, discharge_sessions!inner(status, created_at, submitted_at), wines(name, age, producer, origin, category, supplier)';
const SESSION_ITEMS_SELECT_LEGACY =
  'session_id, wine_id, qty, discharge_sessions!inner(status, created_at, submitted_at), wines(name, age, producer, origin, category, supplier)';
const DEFAULT_PAGE_SIZE = 1000;
const MAX_PAGE_SIZE = 1000;
const DEFAULT_MAX_ROWS = 50_000;

function requireSupabase() {
  if (!supabase) {
    throw new Error('Supabase non configurato');
  }
  return supabase;
}

function isSchemaColumnError(error: unknown): boolean {
  const message = String(
    (error as { message?: unknown } | null | undefined)?.message ?? ''
  ).toLowerCase();
  return message.includes('column') && message.includes('does not exist');
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
  wine_id: string | null;
  wine_name?: string | null;
  wine_age?: string | null;
  wine_producer?: string | null;
  wine_origin?: string | null;
  wine_category?: string | null;
  wine_supplier?: string | null;
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

type WineSnapshotRow = {
  id: string;
  name?: string | null;
  age?: string | null;
  producer?: string | null;
  origin?: string | null;
  category?: string | null;
  supplier?: string | null;
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

export async function listAllDischargeSessions(
  status: DischargeStatus,
  options?: { pageSize?: number; maxRows?: number }
): Promise<DischargeSessionSummary[]> {
  const client = requireSupabase();
  const pageSize = Math.max(1, Math.min(options?.pageSize ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE));
  const maxRows = Math.max(1, Math.min(options?.maxRows ?? DEFAULT_MAX_ROWS, DEFAULT_MAX_ROWS));
  const rows: DischargeSessionSummary[] = [];
  let from = 0;

  while (rows.length < maxRows) {
    const to = from + pageSize - 1;
    const { data: sessions, error } = await client
      .from('discharge_sessions')
      .select('id, created_at, submitted_at, total_qty, status, discharge_session_items(count)')
      .eq('status', status)
      .order(status === 'submitted' ? 'submitted_at' : 'created_at', { ascending: false })
      .range(from, to);
    if (error) throw error;

    const page = (sessions ?? []) as SessionRow[];
    if (page.length === 0) break;

    rows.push(
      ...page.map((row) => ({
        id: row.id,
        createdAt: new Date(row.created_at).getTime(),
        submittedAt: row.submitted_at ? new Date(row.submitted_at).getTime() : undefined,
        totalQty: Number(row.total_qty ?? 0),
        itemsCount: Number(row.discharge_session_items?.[0]?.count ?? 0),
        status: row.status
      }))
    );
    if (page.length < pageSize) break;
    from += pageSize;
  }

  return rows.slice(0, maxRows);
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

  const wineIds = [...new Set(cleanItems.map((item) => item.wineId))];
  let snapshotsById = new Map<string, WineSnapshotRow>();
  if (wineIds.length > 0) {
    const { data: snapshotRows, error: snapshotError } = await client
      .from('wines')
      .select('id, name, age, producer, origin, category, supplier')
      .in('id', wineIds);
    if (snapshotError) throw snapshotError;
    snapshotsById = new Map((snapshotRows ?? []).map((row) => [row.id, row] as const));
  }

  const rowsWithSnapshot = cleanItems.map((item) => {
    const snap = snapshotsById.get(item.wineId);
    return {
      session_id: session.id,
      wine_id: item.wineId,
      qty: item.qty,
      wine_name: snap?.name ? normalizeWineName(snap.name) : null,
      wine_age: snap?.age ?? null,
      wine_producer: snap?.producer ? normalizeWineProducer(snap.producer) : null,
      wine_origin: snap?.origin ? normalizeOrigin(snap.origin) : null,
      wine_category: snap?.category ? normalizeWineCategory(snap.category) : null,
      wine_supplier: snap?.supplier ? normalizeWineSupplier(snap.supplier) : null
    };
  });

  const { error: itemsError } = await client
    .from('discharge_session_items')
    .insert(rowsWithSnapshot);
  if (itemsError && isSchemaColumnError(itemsError)) {
    const { error: legacyItemsError } = await client.from('discharge_session_items').insert(
      cleanItems.map((item) => ({
        session_id: session.id,
        wine_id: item.wineId,
        qty: item.qty
      }))
    );
    if (legacyItemsError) throw legacyItemsError;
  } else if (itemsError) {
    throw itemsError;
  }

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

export type SubmittedHistoryRetention = 'all' | '7d' | '30d' | '3m' | '12m' | '18m' | '2y' | '3y';

function computeRetentionCutoffIso(retention: Exclude<SubmittedHistoryRetention, 'all'>): string {
  const now = new Date();
  const cutoff = new Date(now);
  if (retention === '7d') cutoff.setDate(cutoff.getDate() - 7);
  if (retention === '30d') cutoff.setDate(cutoff.getDate() - 30);
  if (retention === '3m') cutoff.setMonth(cutoff.getMonth() - 3);
  if (retention === '12m') cutoff.setMonth(cutoff.getMonth() - 12);
  if (retention === '18m') cutoff.setMonth(cutoff.getMonth() - 18);
  if (retention === '2y') cutoff.setFullYear(cutoff.getFullYear() - 2);
  if (retention === '3y') cutoff.setFullYear(cutoff.getFullYear() - 3);
  return cutoff.toISOString();
}

export async function clearSubmittedHistoryByRetention(
  retention: SubmittedHistoryRetention
): Promise<void> {
  const client = requireSupabase();
  if (retention === 'all') {
    await clearDischargeSessionsByStatus('submitted');
    return;
  }

  const cutoffIso = computeRetentionCutoffIso(retention);
  const { error } = await client
    .from('discharge_sessions')
    .delete()
    .eq('status', 'submitted')
    .lt('submitted_at', cutoffIso);
  if (error) throw error;
}

export async function detachDischargeItemsFromWines(): Promise<void> {
  const client = requireSupabase();
  const { error } = await client
    .from('discharge_session_items')
    .update({ wine_id: null })
    .not('wine_id', 'is', null);
  if (error) throw error;
}

function mapSessionItemRow(row: SessionItemRow): DischargeSessionItemDetail {
  const session = Array.isArray(row.discharge_sessions)
    ? row.discharge_sessions[0]
    : row.discharge_sessions;
  const wine = Array.isArray(row.wines) ? row.wines[0] : row.wines;
  const fallbackWineId = row.wine_id ?? 'vino-rimosso';

  return {
    sessionId: row.session_id,
    sessionStatus: session?.status ?? 'submitted',
    createdAt: session?.created_at ? new Date(session.created_at).getTime() : Date.now(),
    submittedAt: session?.submitted_at ? new Date(session.submitted_at).getTime() : undefined,
    wineId: fallbackWineId,
    wineName: row.wine_name?.trim()
      ? normalizeWineName(row.wine_name)
      : wine?.name?.trim()
        ? normalizeWineName(wine.name)
        : fallbackWineId,
    age: row.wine_age ?? wine?.age ?? undefined,
    producer: row.wine_producer
      ? normalizeWineProducer(row.wine_producer)
      : wine?.producer
        ? normalizeWineProducer(wine.producer)
        : undefined,
    origin: row.wine_origin
      ? normalizeOrigin(row.wine_origin)
      : wine?.origin
        ? normalizeOrigin(wine.origin)
        : undefined,
    category: row.wine_category
      ? normalizeWineCategory(row.wine_category)
      : wine?.category
        ? normalizeWineCategory(wine.category)
        : undefined,
    supplier: row.wine_supplier
      ? normalizeWineSupplier(row.wine_supplier)
      : wine?.supplier
        ? normalizeWineSupplier(wine.supplier)
        : undefined,
    qty: Math.max(0, Number(row.qty ?? 0))
  };
}

export async function listSubmittedDischargeItemsForAi(
  limit = 500
): Promise<DischargeSessionItemDetail[]> {
  const client = requireSupabase();

  const baseQuery = client
    .from('discharge_session_items')
    .select(SESSION_ITEMS_SELECT_WITH_SNAPSHOT)
    .eq('discharge_sessions.status', 'submitted')
    .order('submitted_at', { foreignTable: 'discharge_sessions', ascending: false })
    .limit(Math.max(1, Math.min(limit, 2000)));
  const first = await baseQuery;
  let data = (first.data ?? null) as SessionItemRow[] | null;
  let error = first.error;
  if (first.error && isSchemaColumnError(first.error)) {
    const legacy = await client
      .from('discharge_session_items')
      .select(SESSION_ITEMS_SELECT_LEGACY)
      .eq('discharge_sessions.status', 'submitted')
      .order('submitted_at', { foreignTable: 'discharge_sessions', ascending: false })
      .limit(Math.max(1, Math.min(limit, 2000)));
    data = (legacy.data ?? null) as SessionItemRow[] | null;
    error = legacy.error;
  }

  if (error) throw error;

  return ((data ?? []) as SessionItemRow[]).map(mapSessionItemRow);
}

export async function listAllSubmittedDischargeItemsForAi(options?: {
  pageSize?: number;
  maxRows?: number;
}): Promise<DischargeSessionItemDetail[]> {
  const client = requireSupabase();
  const pageSize = Math.max(1, Math.min(options?.pageSize ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE));
  const maxRows = Math.max(1, Math.min(options?.maxRows ?? DEFAULT_MAX_ROWS, DEFAULT_MAX_ROWS));
  const rows: DischargeSessionItemDetail[] = [];
  let useLegacy = false;
  let from = 0;

  while (rows.length < maxRows) {
    const to = from + pageSize - 1;
    const result = useLegacy
      ? await client
          .from('discharge_session_items')
          .select(SESSION_ITEMS_SELECT_LEGACY)
          .eq('discharge_sessions.status', 'submitted')
          .order('submitted_at', { foreignTable: 'discharge_sessions', ascending: false })
          .range(from, to)
      : await client
          .from('discharge_session_items')
          .select(SESSION_ITEMS_SELECT_WITH_SNAPSHOT)
          .eq('discharge_sessions.status', 'submitted')
          .order('submitted_at', { foreignTable: 'discharge_sessions', ascending: false })
          .range(from, to);
    if (result.error && isSchemaColumnError(result.error) && !useLegacy) {
      useLegacy = true;
      continue;
    }
    if (result.error) throw result.error;

    const page = (result.data ?? []) as SessionItemRow[];
    if (page.length === 0) break;
    rows.push(...page.map(mapSessionItemRow));
    if (page.length < pageSize) break;
    from += pageSize;
  }

  return rows.slice(0, maxRows);
}

export async function listSubmittedDischargeSessionItems(
  sessionId: string
): Promise<DischargeSessionItemDetail[]> {
  const client = requireSupabase();

  const baseQuery = client
    .from('discharge_session_items')
    .select(SESSION_ITEMS_SELECT_WITH_SNAPSHOT)
    .eq('session_id', sessionId)
    .eq('discharge_sessions.status', 'submitted');
  const first = await baseQuery;
  let data = (first.data ?? null) as SessionItemRow[] | null;
  let error = first.error;
  if (first.error && isSchemaColumnError(first.error)) {
    const legacy = await client
      .from('discharge_session_items')
      .select(SESSION_ITEMS_SELECT_LEGACY)
      .eq('session_id', sessionId)
      .eq('discharge_sessions.status', 'submitted');
    data = (legacy.data ?? null) as SessionItemRow[] | null;
    error = legacy.error;
  }

  if (error) throw error;

  const rows = ((data ?? []) as SessionItemRow[]).map((row) => mapSessionItemRow(row));

  rows.sort((a, b) => b.qty - a.qty || a.wineName.localeCompare(b.wineName, 'it-IT'));
  return rows;
}
