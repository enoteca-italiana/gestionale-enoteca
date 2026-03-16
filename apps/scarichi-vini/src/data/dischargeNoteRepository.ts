import type { SessionItem } from '@/domain/types';
import { supabase } from '@/lib/supabase';
import { notifyDischargeNoteChanged } from '@/data/dischargeNote';

export type DischargeNoteState = {
  hasDraft: boolean;
  draftItemsCount: number;
  hasReady: boolean;
  hasInProgress: boolean;
};

type DischargeNoteRow = {
  id: string;
  status: 'draft' | 'ready' | 'in_progress' | 'completed' | 'cancelled';
  updated_at?: string | null;
};

type DischargeNoteItemRow = {
  wine_id?: string | null;
  qty?: number | null;
};

function requireSupabase() {
  if (!supabase) throw new Error('Supabase non configurato per Nota Scarico');
  return supabase;
}

function sanitizeItems(input: unknown): SessionItem[] {
  if (!Array.isArray(input)) return [];
  const out: SessionItem[] = [];
  for (const raw of input) {
    const wineId = String((raw as { wineId?: unknown } | null | undefined)?.wineId ?? '').trim();
    const qtyRaw = Number((raw as { qty?: unknown } | null | undefined)?.qty ?? 0);
    const qty = Number.isFinite(qtyRaw) ? Math.max(1, Math.min(99, Math.round(qtyRaw))) : 0;
    if (!wineId || qty <= 0) continue;
    out.push({ wineId, qty });
  }
  return out;
}

async function listNoteItems(noteId: string): Promise<SessionItem[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('discharge_note_items')
    .select('wine_id, qty')
    .eq('note_id', noteId)
    .order('id', { ascending: true });
  if (error) throw error;

  return ((data ?? []) as DischargeNoteItemRow[])
    .map((row) => ({
      wineId: String(row.wine_id ?? '').trim(),
      qty: Number(row.qty ?? 0)
    }))
    .filter((row) => row.wineId.length > 0 && row.qty > 0)
    .map((row) => ({ wineId: row.wineId, qty: Math.max(1, Math.min(99, Math.round(row.qty)))}));
}

export async function getDischargeNoteState(): Promise<DischargeNoteState> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('get_discharge_note_state');
  if (error) throw error;

  const row = (data ?? {}) as {
    hasDraft?: unknown;
    draftItemsCount?: unknown;
    hasReady?: unknown;
    hasInProgress?: unknown;
  };

  return {
    hasDraft: Boolean(row.hasDraft),
    draftItemsCount: Math.max(0, Number(row.draftItemsCount ?? 0) || 0),
    hasReady: Boolean(row.hasReady),
    hasInProgress: Boolean(row.hasInProgress)
  };
}

export async function loadDraftDischargeNote(): Promise<{ items: SessionItem[]; updatedAt: number } | null> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('discharge_notes')
    .select('id, status, updated_at')
    .eq('status', 'draft')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;

  const note = data as DischargeNoteRow | null;
  if (!note?.id) return null;

  const items = await listNoteItems(note.id);
  return {
    items,
    updatedAt: note.updated_at ? new Date(note.updated_at).getTime() : Date.now()
  };
}

export async function saveDischargeNoteDraft(items: SessionItem[]): Promise<void> {
  const client = requireSupabase();
  const cleanItems = sanitizeItems(items);

  const payload = cleanItems.map((item) => ({ wineId: item.wineId, qty: item.qty }));
  const { error } = await client.rpc('save_discharge_note_draft', {
    p_items: payload
  });
  if (error) throw error;
  notifyDischargeNoteChanged();
}

export async function confirmDischargeNoteDraft(): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.rpc('confirm_discharge_note_draft');
  if (error) throw error;
  notifyDischargeNoteChanged();
}

export async function getReadyDischargeNoteItems(): Promise<SessionItem[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('discharge_notes')
    .select('id, status')
    .eq('status', 'ready')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;

  const note = data as Pick<DischargeNoteRow, 'id'> | null;
  if (!note?.id) return [];
  return listNoteItems(note.id);
}

export async function startReadyDischargeNoteItems(): Promise<SessionItem[]> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('start_ready_discharge_note');
  if (error) throw error;

  const payload = data as { items?: unknown } | null;
  const rawItems = Array.isArray(payload?.items) ? payload?.items : [];
  const items = sanitizeItems(rawItems.map((it) => ({
    wineId: (it as { wineId?: unknown } | null | undefined)?.wineId,
    qty: (it as { qty?: unknown } | null | undefined)?.qty
  })));
  notifyDischargeNoteChanged();
  return items;
}

export async function completeInProgressDischargeNote(): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.rpc('complete_in_progress_discharge_note', {
    p_note_id: null
  });
  if (error) throw error;
  notifyDischargeNoteChanged();
}
