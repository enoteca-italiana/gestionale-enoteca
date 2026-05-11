import type { DischargeItemInput } from '@/data/dischargeRepository';
import type { AppDomain } from '@/app/appDomainContext';

const DISCHARGE_QUEUE_STORAGE_KEY = 'scarichi.dischargeQueue.v1';
export const dischargeQueueChangedEvent = 'scarichi:dischargeQueueChanged';
export const dischargeQueueStatusEvent = 'scarichi:dischargeQueueStatus';

type PendingDischargeQueueRaw = {
  id?: unknown;
  createdAt?: unknown;
  source?: unknown;
  items?: unknown;
  expectedQtyByWineId?: unknown;
  attempts?: unknown;
  lastError?: unknown;
  lastAttemptAt?: unknown;
  domain?: unknown;
};

export type PendingDischargeQueueItem = {
  id: string;
  createdAt: number;
  source: string;
  items: DischargeItemInput[];
  expectedQtyByWineId?: Record<string, number>;
  attempts: number;
  lastError?: string;
  lastAttemptAt?: number;
  domain: AppDomain;
};

export type DischargeQueueStatusDetail =
  | {
      type: 'enqueued';
      pendingCount: number;
      itemId: string;
    }
  | {
      type: 'sync_started';
      pendingCount: number;
      reason: string;
    }
  | {
      type: 'sync_success';
      processed: number;
      remaining: number;
    }
  | {
      type: 'sync_paused';
      processed: number;
      remaining: number;
      reason: string;
      message?: string;
    }
  | {
      type: 'sync_error';
      processed: number;
      remaining: number;
      message: string;
    };

export type FlushDischargeQueueSummary = {
  processed: number;
  remaining: number;
  status: 'noop' | 'done' | 'paused' | 'error';
  reason?: string;
  message?: string;
};

let flushQueuePromise: Promise<FlushDischargeQueueSummary> | null = null;

function nowTs() {
  return Date.now();
}

function newQueueItemId() {
  return `dq_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function sanitizeItems(input: unknown): DischargeItemInput[] {
  if (!Array.isArray(input)) return [];
  const output: DischargeItemInput[] = [];
  for (const raw of input) {
    const wineId = String((raw as { wineId?: unknown } | null | undefined)?.wineId ?? '').trim();
    const qtyRaw = Number((raw as { qty?: unknown } | null | undefined)?.qty ?? 0);
    const qty = Number.isFinite(qtyRaw) ? Math.max(1, Math.round(qtyRaw)) : 0;
    if (!wineId || qty <= 0) continue;
    output.push({ wineId, qty });
  }
  return output;
}

function sanitizeExpectedQtyByWineId(input: unknown): Record<string, number> | undefined {
  if (!input || typeof input !== 'object') return undefined;
  const output: Record<string, number> = {};
  for (const [wineId, qtyRaw] of Object.entries(input as Record<string, unknown>)) {
    const key = wineId.trim();
    if (!key) continue;
    const qty = Number(qtyRaw);
    if (!Number.isFinite(qty)) continue;
    output[key] = Math.max(0, Math.round(qty));
  }
  return Object.keys(output).length > 0 ? output : undefined;
}

function toQueueItem(raw: PendingDischargeQueueRaw): PendingDischargeQueueItem | null {
  const id = String(raw.id ?? '').trim();
  const createdAt = Number(raw.createdAt ?? 0);
  const sourceRaw = String(raw.source ?? 'web').trim();
  const source = sourceRaw.length > 0 ? sourceRaw : 'web';
  const items = sanitizeItems(raw.items);
  if (!id || !Number.isFinite(createdAt) || createdAt <= 0 || items.length === 0) return null;

  const attemptsRaw = Number(raw.attempts ?? 0);
  const attempts = Number.isFinite(attemptsRaw) ? Math.max(0, Math.round(attemptsRaw)) : 0;
  const lastAttemptAtRaw = Number(raw.lastAttemptAt ?? 0);
  const lastAttemptAt =
    Number.isFinite(lastAttemptAtRaw) && lastAttemptAtRaw > 0
      ? Math.round(lastAttemptAtRaw)
      : undefined;
  const lastErrorRaw = String(raw.lastError ?? '').trim();
  const domainRaw = String(raw.domain ?? 'wine')
    .trim()
    .toLowerCase();
  const domain: AppDomain = domainRaw === 'spirits' ? 'spirits' : 'wine';

  return {
    id,
    createdAt: Math.round(createdAt),
    source,
    items,
    expectedQtyByWineId: sanitizeExpectedQtyByWineId(raw.expectedQtyByWineId),
    attempts,
    lastError: lastErrorRaw || undefined,
    lastAttemptAt,
    domain
  };
}

function readQueue(): PendingDischargeQueueItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(DISCHARGE_QUEUE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry) => toQueueItem(entry as PendingDischargeQueueRaw))
      .filter((entry): entry is PendingDischargeQueueItem => Boolean(entry))
      .sort((a, b) => a.createdAt - b.createdAt);
  } catch {
    return [];
  }
}

function emitQueueChanged(pendingCount: number) {
  window.dispatchEvent(
    new CustomEvent<{ pendingCount: number }>(dischargeQueueChangedEvent, {
      detail: { pendingCount }
    })
  );
}

function emitQueueStatus(detail: DischargeQueueStatusDetail) {
  window.dispatchEvent(
    new CustomEvent<DischargeQueueStatusDetail>(dischargeQueueStatusEvent, {
      detail
    })
  );
}

function writeQueue(items: PendingDischargeQueueItem[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(DISCHARGE_QUEUE_STORAGE_KEY, JSON.stringify(items));
  emitQueueChanged(items.length);
}

function getErrorMessage(error: unknown): string {
  const message = String((error as { message?: unknown } | null | undefined)?.message ?? '').trim();
  if (message) return message;
  return 'Errore sconosciuto';
}

export function isDischargeQueueRecoverableError(error: unknown): boolean {
  const status = Number((error as { status?: unknown } | null | undefined)?.status ?? NaN);
  if (Number.isFinite(status) && status >= 500) return true;

  const code = String((error as { code?: unknown } | null | undefined)?.code ?? '').toUpperCase();
  if (code === 'ECONNRESET' || code === 'ETIMEDOUT' || code === 'ENOTFOUND') return true;

  const message = getErrorMessage(error).toLowerCase();
  if (!message) return false;
  return (
    message.includes('network') ||
    message.includes('failed to fetch') ||
    message.includes('load failed') ||
    message.includes('fetch')
  );
}

function removeQueueItemById(
  queue: PendingDischargeQueueItem[],
  itemId: string
): PendingDischargeQueueItem[] {
  return queue.filter((item) => item.id !== itemId);
}

function markQueueItemAttemptById(
  queue: PendingDischargeQueueItem[],
  itemId: string,
  message: string
): PendingDischargeQueueItem[] {
  let updated = false;
  return queue.map((item) => {
    if (updated || item.id !== itemId) return item;
    updated = true;
    return {
      ...item,
      attempts: item.attempts + 1,
      lastError: message,
      lastAttemptAt: nowTs()
    };
  });
}

export function listPendingDischargeQueueItems() {
  return readQueue();
}

export function getPendingDischargeQueueCount() {
  return readQueue().length;
}

export function clearPendingDischargeQueue() {
  writeQueue([]);
}

export function enqueuePendingDischargeSession(input: {
  items: DischargeItemInput[];
  expectedQtyByWineId?: Record<string, number>;
  source?: string;
  domain?: AppDomain;
}): PendingDischargeQueueItem {
  const items = sanitizeItems(input.items);
  if (items.length === 0) {
    throw new Error('Sessione non valida: nessun item da mettere in coda');
  }
  const item: PendingDischargeQueueItem = {
    id: newQueueItemId(),
    createdAt: nowTs(),
    source: input.source?.trim() || 'web',
    items,
    expectedQtyByWineId: sanitizeExpectedQtyByWineId(input.expectedQtyByWineId),
    attempts: 0,
    domain: input.domain ?? 'wine'
  };
  const queue = readQueue();
  const next = [...queue, item].sort((a, b) => a.createdAt - b.createdAt);
  writeQueue(next);
  emitQueueStatus({
    type: 'enqueued',
    pendingCount: next.length,
    itemId: item.id
  });
  return item;
}

export async function flushPendingDischargeQueue(options?: {
  reason?: 'startup' | 'online' | 'focus' | 'pageshow' | 'visibility' | 'queue_changed' | 'manual';
}): Promise<FlushDischargeQueueSummary> {
  if (flushQueuePromise) return flushQueuePromise;

  const run = async (): Promise<FlushDischargeQueueSummary> => {
    const initialQueue = readQueue();
    if (initialQueue.length === 0) {
      return { processed: 0, remaining: 0, status: 'noop' };
    }
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return {
        processed: 0,
        remaining: initialQueue.length,
        status: 'paused',
        reason: 'offline'
      };
    }

    const reason = options?.reason ?? 'manual';
    emitQueueStatus({ type: 'sync_started', pendingCount: initialQueue.length, reason });

    const dischargeRepository = await import('@/data/dischargeRepository');

    let processed = 0;
    while (true) {
      const queue = readQueue();
      if (queue.length === 0) {
        emitQueueStatus({ type: 'sync_success', processed, remaining: 0 });
        return { processed, remaining: 0, status: 'done' };
      }
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        emitQueueStatus({
          type: 'sync_paused',
          processed,
          remaining: queue.length,
          reason: 'offline'
        });
        return { processed, remaining: queue.length, status: 'paused', reason: 'offline' };
      }

      const head = queue[0];
      try {
        if (head.domain === 'spirits') {
          await dischargeRepository.createAndSubmitSpiritsDischargeSession({
            items: head.items.map((item) => ({ spiritId: item.wineId, qty: item.qty })),
            source: head.source
          });
        } else {
          await dischargeRepository.createAndSubmitDischargeSession({
            items: head.items,
            source: head.source,
            expectedQtyByWineId: head.expectedQtyByWineId
          });
        }
        const queueAfterSuccess = removeQueueItemById(readQueue(), head.id);
        writeQueue(queueAfterSuccess);
        processed += 1;
      } catch (error) {
        const message = getErrorMessage(error);
        const queueWithAttempt = markQueueItemAttemptById(readQueue(), head.id, message);
        writeQueue(queueWithAttempt);
        const recoverable = isDischargeQueueRecoverableError(error);
        if (recoverable) {
          emitQueueStatus({
            type: 'sync_paused',
            processed,
            remaining: queueWithAttempt.length,
            reason: 'network',
            message
          });
          return {
            processed,
            remaining: queueWithAttempt.length,
            status: 'paused',
            reason: 'network',
            message
          };
        }
        emitQueueStatus({
          type: 'sync_error',
          processed,
          remaining: queueWithAttempt.length,
          message
        });
        return {
          processed,
          remaining: queueWithAttempt.length,
          status: 'error',
          reason: 'non_recoverable',
          message
        };
      }
    }
  };

  flushQueuePromise = run();
  try {
    return await flushQueuePromise;
  } finally {
    flushQueuePromise = null;
  }
}
