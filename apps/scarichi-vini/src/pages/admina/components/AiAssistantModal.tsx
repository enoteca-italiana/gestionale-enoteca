import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Wine } from '@/domain/types';
import {
  listAllDischargeSessions,
  listAllSubmittedDischargeItemsForAi,
  type DischargeSessionItemDetail,
  type DischargeSessionSummary
} from '@/data/dischargeRepository';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  pdfExportEligible?: boolean;
};

const STORAGE_MODEL = 'scarichi.ai.openaiModel.v1';
const DEFAULT_MODEL = 'gpt-4.1-mini';
const ENV_MODEL = (import.meta.env.VITE_OPENAI_MODEL as string | undefined)?.trim() ?? '';
const AI_API_ENDPOINT = '/api/ai';
const AGENT_MODELS = [
  { value: 'gpt-4.1-mini', label: 'GPT-4.1 mini' },
  { value: 'gpt-4.1', label: 'GPT-4.1' }
] as const;
const WELCOME_MESSAGE = 'Salve, in cosa posso esserti utile?';
const AI_SESSIONS_CACHE_TTL_MS = 5 * 60 * 1000;

let aiSessionsCache: {
  at: number;
  submittedSessions: DischargeSessionSummary[];
  submittedItems: DischargeSessionItemDetail[];
} | null = null;

function buildInventorySnapshot(wines: Wine[]) {
  const total = wines.length;
  const out = wines.filter((wine) => wine.qty <= 0).length;
  const threshold = wines.filter(
    (wine) => typeof wine.threshold === 'number' && wine.threshold > 0 && wine.qty <= wine.threshold
  ).length;
  const qtyTotal = wines.reduce((sum, wine) => sum + Math.max(0, wine.qty), 0);
  const stockValue = wines.reduce(
    (sum, wine) =>
      sum +
      (typeof wine.purchasePrice === 'number' ? wine.purchasePrice * Math.max(0, wine.qty) : 0),
    0
  );
  const marginAvg =
    wines.length > 0
      ? wines.reduce((sum, wine) => sum + ((wine.salePrice ?? 0) - (wine.purchasePrice ?? 0)), 0) /
        wines.length
      : 0;

  return {
    total,
    out,
    threshold,
    qtyTotal,
    stockValue: Number(stockValue.toFixed(2)),
    marginAvg: Number(marginAvg.toFixed(2))
  };
}

function pickRelevantWines(
  wines: Wine[],
  query: string,
  searchTextByWineId: Map<string, string>
): Wine[] {
  const normalized = query
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
  if (!normalized) return wines.slice(0, 30);

  const tokens = normalized.split(/\s+/).filter((token) => token.length > 1);
  if (tokens.length === 0) return wines.slice(0, 30);

  const scored = wines
    .map((wine) => {
      const haystack = searchTextByWineId.get(wine.id) ?? '';

      let score = 0;
      for (const token of tokens) {
        if (haystack.includes(token)) score += 1;
      }
      return { wine, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, 60).map((item) => item.wine);
}

type AnalyticWine = {
  name: string;
  category: string;
  producer: string;
  origin: string;
  supplier: string;
  qty: number;
  threshold: number | null;
  purchase: number | null;
  sale: number | null;
  margin: number;
  stockValue: number;
  notes: string;
};

function toAnalyticWine(wine: Wine): AnalyticWine {
  const purchase = typeof wine.purchasePrice === 'number' ? wine.purchasePrice : null;
  const sale = typeof wine.salePrice === 'number' ? wine.salePrice : null;
  const qty = Math.max(0, Number(wine.qty) || 0);
  const margin = sale !== null && purchase !== null ? Number((sale - purchase).toFixed(2)) : 0;
  const stockValue = purchase !== null ? Number((purchase * qty).toFixed(2)) : 0;

  return {
    name: wine.name,
    category: (wine.category ?? '').trim(),
    producer: wine.producer,
    origin: wine.origin,
    supplier: (wine.supplier ?? '').trim(),
    qty,
    threshold: typeof wine.threshold === 'number' ? wine.threshold : null,
    purchase,
    sale,
    margin,
    stockValue,
    notes: (wine.notes ?? '').trim()
  };
}

function aggregateBy(
  items: AnalyticWine[],
  field: 'category' | 'producer' | 'origin' | 'supplier'
) {
  const map = new Map<
    string,
    { label: string; wines: number; qty: number; stockValue: number; marginAvg: number }
  >();

  for (const item of items) {
    const label = (item[field] || '—').trim() || '—';
    const current = map.get(label) ?? { label, wines: 0, qty: 0, stockValue: 0, marginAvg: 0 };
    current.wines += 1;
    current.qty += item.qty;
    current.stockValue += item.stockValue;
    current.marginAvg += item.margin;
    map.set(label, current);
  }

  return Array.from(map.values())
    .map((entry) => ({
      ...entry,
      stockValue: Number(entry.stockValue.toFixed(2)),
      marginAvg: Number((entry.marginAvg / Math.max(1, entry.wines)).toFixed(2))
    }))
    .sort((a, b) => b.wines - a.wines)
    .slice(0, 30);
}

type InventoryAnalytics = {
  all: AnalyticWine[];
  leaderboards: {
    topMargins: AnalyticWine[];
    lowestMargins: AnalyticWine[];
    topStockValue: AnalyticWine[];
    lowestQty: AnalyticWine[];
    outOfStock: AnalyticWine[];
    inThreshold: AnalyticWine[];
  };
  breakdowns: {
    byCategory: ReturnType<typeof aggregateBy>;
    byProducer: ReturnType<typeof aggregateBy>;
    byOrigin: ReturnType<typeof aggregateBy>;
    bySupplier: ReturnType<typeof aggregateBy>;
  };
};

type WineRecencyRow = {
  wineId: string;
  wineName: string;
  producer: string;
  origin: string;
  category: string;
  supplier: string;
  currentQty: number;
  totalDischargedQty: number;
  dischargeEvents: number;
  lastDischargeAt: number | null;
  daysSinceLastDischarge: number | null;
};

type ProducerAnalyticsRow = {
  producer: string;
  winesCount: number;
  qtyCurrent: number;
  qtyDischargedTotal: number;
  neverDischargedCount: number;
  underThresholdOrOutCount: number;
  underThresholdOrOutPct: number;
  neverDischargedPct: number;
};

type DataQualityContext = {
  counts: {
    missingWineName: number;
    qtyNonPositive: number;
    duplicatedSessionWinePairs: number;
    dateIncoherent: number;
    futureDated: number;
  };
  samples: {
    qtyNonPositive: Array<{ sessionId: string; wineId: string; wineName: string; qty: number }>;
    duplicatedSessionWinePairs: Array<{
      sessionId: string;
      wineId: string;
      wineName: string;
      rowsCount: number;
      qtyTotal: number;
    }>;
    dateIncoherent: Array<{
      sessionId: string;
      wineId: string;
      createdAt?: number;
      submittedAt?: number;
    }>;
    futureDated: Array<{ sessionId: string; wineId: string; submittedAt?: number }>;
  };
  consistency: {
    hasQtyNonPositive: boolean;
    hasDuplicatedSessionWinePairs: boolean;
    hasDateIncoherent: boolean;
    hasFutureDated: boolean;
  };
};

type DecisionBucketRow = {
  wineId: string;
  wineName: string;
  producer: string;
  qty: number;
  threshold: number | null;
  dischargeEvents: number;
  daysSinceLastDischarge: number | null;
  reason: string;
};

function buildInventoryAnalytics(wines: Wine[]): InventoryAnalytics {
  const all = wines.map(toAnalyticWine);
  const byMarginDesc = [...all].sort((a, b) => b.margin - a.margin);
  const byMarginAsc = [...all].sort((a, b) => a.margin - b.margin);
  const byStockValueDesc = [...all].sort((a, b) => b.stockValue - a.stockValue);
  const byQtyAsc = [...all].sort((a, b) => a.qty - b.qty);

  const outOfStock = all.filter((wine) => wine.qty <= 0);
  const inThreshold = all.filter(
    (wine) =>
      typeof wine.threshold === 'number' &&
      wine.threshold > 0 &&
      wine.qty > 0 &&
      wine.qty <= wine.threshold
  );

  return {
    all,
    leaderboards: {
      topMargins: byMarginDesc.slice(0, 20),
      lowestMargins: byMarginAsc.slice(0, 20),
      topStockValue: byStockValueDesc.slice(0, 20),
      lowestQty: byQtyAsc.slice(0, 20),
      outOfStock: outOfStock.slice(0, 100),
      inThreshold: inThreshold.slice(0, 100)
    },
    breakdowns: {
      byCategory: aggregateBy(all, 'category'),
      byProducer: aggregateBy(all, 'producer'),
      byOrigin: aggregateBy(all, 'origin'),
      bySupplier: aggregateBy(all, 'supplier')
    }
  };
}

function buildAiContext(
  snapshot: ReturnType<typeof buildInventorySnapshot>,
  analytics: InventoryAnalytics,
  relevantWines: AnalyticWine[],
  recency: ReturnType<typeof buildRecencyContext>
) {
  const { leaderboards, breakdowns } = analytics;

  return {
    snapshot: {
      totalWines: snapshot.total,
      totalQty: snapshot.qtyTotal,
      outOfStock: snapshot.out,
      thresholdCount: snapshot.threshold,
      stockValueEuro: snapshot.stockValue,
      avgMarginEuro: snapshot.marginAvg
    },
    leaderboards,
    breakdowns,
    recency,
    relevantWines,
    note: 'Le classifiche usano tutto l’archivio caricato in questa pagina. I relevantWines servono solo per dettaglio domanda.'
  };
}

function buildRecencyContext(wines: Wine[], submittedItems: DischargeSessionItemDetail[]) {
  const aggregateByWineId = new Map<
    string,
    { lastDischargeAt: number | null; totalDischargedQty: number; dischargeEvents: number }
  >();
  for (const item of submittedItems) {
    const submittedAt = item.submittedAt ?? item.createdAt;
    const current = aggregateByWineId.get(item.wineId) ?? {
      lastDischargeAt: null,
      totalDischargedQty: 0,
      dischargeEvents: 0
    };
    current.totalDischargedQty += Math.max(0, item.qty);
    current.dischargeEvents += 1;
    if (!current.lastDischargeAt || submittedAt > current.lastDischargeAt) {
      current.lastDischargeAt = submittedAt;
    }
    aggregateByWineId.set(item.wineId, current);
  }

  const now = Date.now();
  const recencyRows: WineRecencyRow[] = wines.map((wine) => {
    const agg = aggregateByWineId.get(wine.id);
    const lastDischargeAt = agg?.lastDischargeAt ?? null;
    const daysSinceLastDischarge = (() => {
      if (lastDischargeAt === null) return null;
      const days = Math.floor((now - lastDischargeAt) / (1000 * 60 * 60 * 24));
      return Math.max(0, days);
    })();
    return {
      wineId: wine.id,
      wineName: wine.name,
      producer: wine.producer,
      origin: wine.origin,
      category: wine.category ?? '',
      supplier: wine.supplier ?? '',
      currentQty: Math.max(0, wine.qty),
      totalDischargedQty: agg?.totalDischargedQty ?? 0,
      dischargeEvents: agg?.dischargeEvents ?? 0,
      lastDischargeAt,
      daysSinceLastDischarge
    };
  });

  const neverDischarged = recencyRows.filter((row) => row.lastDischargeAt === null);
  const over3m = recencyRows.filter((row) => (row.daysSinceLastDischarge ?? 0) >= 90);
  const over6m = recencyRows.filter((row) => (row.daysSinceLastDischarge ?? 0) >= 180);
  const over12m = recencyRows.filter((row) => (row.daysSinceLastDischarge ?? 0) >= 365);
  const byStaleness = [...recencyRows].sort((a, b) => {
    const aDays = a.daysSinceLastDischarge ?? Number.POSITIVE_INFINITY;
    const bDays = b.daysSinceLastDischarge ?? Number.POSITIVE_INFINITY;
    return bDays - aDays;
  });

  return {
    summary: {
      winesTotal: recencyRows.length,
      neverDischarged: neverDischarged.length,
      over3m: over3m.length,
      over6m: over6m.length,
      over12m: over12m.length
    },
    oldestOrNever: byStaleness.slice(0, 300),
    neverDischarged: neverDischarged.slice(0, 300),
    over6m: over6m.slice(0, 300),
    over12m: over12m.slice(0, 300)
  };
}

function buildProducerContext(
  wines: Wine[],
  submittedItems: DischargeSessionItemDetail[],
  recency: ReturnType<typeof buildRecencyContext>
) {
  const wineById = new Map<string, Wine>();
  for (const wine of wines) wineById.set(wine.id, wine);

  const dischargedByProducer = new Map<string, number>();
  for (const item of submittedItems) {
    const fromInventory = item.wineId ? wineById.get(item.wineId) : undefined;
    const producer = (fromInventory?.producer || item.producer || '').trim() || '—';
    dischargedByProducer.set(
      producer,
      (dischargedByProducer.get(producer) ?? 0) + Math.max(0, item.qty)
    );
  }

  const neverByWineId = new Set(recency.neverDischarged.map((row) => row.wineId));
  const rowsByProducer = new Map<string, ProducerAnalyticsRow>();
  for (const wine of wines) {
    const producer = (wine.producer || '').trim() || '—';
    const current = rowsByProducer.get(producer) ?? {
      producer,
      winesCount: 0,
      qtyCurrent: 0,
      qtyDischargedTotal: dischargedByProducer.get(producer) ?? 0,
      neverDischargedCount: 0,
      underThresholdOrOutCount: 0,
      underThresholdOrOutPct: 0,
      neverDischargedPct: 0
    };

    current.winesCount += 1;
    current.qtyCurrent += Math.max(0, Number(wine.qty) || 0);
    if (neverByWineId.has(wine.id)) current.neverDischargedCount += 1;

    const threshold = Number(wine.threshold);
    const qty = Number(wine.qty);
    const isOut = qty <= 0;
    const isUnderThreshold =
      Number.isFinite(qty) &&
      qty > 0 &&
      Number.isFinite(threshold) &&
      threshold > 0 &&
      qty <= threshold;
    if (isOut || isUnderThreshold) current.underThresholdOrOutCount += 1;

    rowsByProducer.set(producer, current);
  }

  const rows = Array.from(rowsByProducer.values()).map((row) => {
    const winesCount = Math.max(1, row.winesCount);
    return {
      ...row,
      qtyCurrent: Number(row.qtyCurrent.toFixed(2)),
      underThresholdOrOutPct: Number(
        ((row.underThresholdOrOutCount / winesCount) * 100).toFixed(2)
      ),
      neverDischargedPct: Number(((row.neverDischargedCount / winesCount) * 100).toFixed(2))
    };
  });

  rows.sort((a, b) => b.winesCount - a.winesCount || b.qtyCurrent - a.qtyCurrent);
  return {
    rows,
    topByWines: rows.slice(0, 30),
    topCritical: [...rows]
      .sort(
        (a, b) =>
          b.underThresholdOrOutPct - a.underThresholdOrOutPct ||
          b.neverDischargedPct - a.neverDischargedPct
      )
      .slice(0, 30)
  };
}

function buildDataQualityContext(submittedItems: DischargeSessionItemDetail[]): DataQualityContext {
  const now = Date.now();
  const qtyNonPositive = submittedItems
    .filter((item) => item.qty <= 0)
    .map((item) => ({
      sessionId: item.sessionId,
      wineId: item.wineId,
      wineName: item.wineName,
      qty: item.qty
    }));

  const missingWineName = submittedItems.filter((item) => item.wineName.trim().length === 0).length;

  const duplicatePairsMap = new Map<
    string,
    { sessionId: string; wineId: string; wineName: string; rowsCount: number; qtyTotal: number }
  >();
  for (const item of submittedItems) {
    const key = `${item.sessionId}::${item.wineId}`;
    const current = duplicatePairsMap.get(key) ?? {
      sessionId: item.sessionId,
      wineId: item.wineId,
      wineName: item.wineName,
      rowsCount: 0,
      qtyTotal: 0
    };
    current.rowsCount += 1;
    current.qtyTotal += Math.max(0, item.qty);
    duplicatePairsMap.set(key, current);
  }

  const duplicatedSessionWinePairs = Array.from(duplicatePairsMap.values())
    .filter((row) => row.rowsCount > 1)
    .sort((a, b) => b.rowsCount - a.rowsCount || b.qtyTotal - a.qtyTotal);

  const dateIncoherent = submittedItems
    .filter(
      (item) =>
        typeof item.submittedAt === 'number' &&
        Number.isFinite(item.submittedAt) &&
        Number.isFinite(item.createdAt) &&
        item.submittedAt < item.createdAt
    )
    .map((item) => ({
      sessionId: item.sessionId,
      wineId: item.wineId,
      createdAt: item.createdAt,
      submittedAt: item.submittedAt
    }));

  const futureDated = submittedItems
    .filter(
      (item) =>
        typeof item.submittedAt === 'number' &&
        Number.isFinite(item.submittedAt) &&
        item.submittedAt > now
    )
    .map((item) => ({
      sessionId: item.sessionId,
      wineId: item.wineId,
      submittedAt: item.submittedAt
    }));

  return {
    counts: {
      missingWineName,
      qtyNonPositive: qtyNonPositive.length,
      duplicatedSessionWinePairs: duplicatedSessionWinePairs.length,
      dateIncoherent: dateIncoherent.length,
      futureDated: futureDated.length
    },
    samples: {
      qtyNonPositive: qtyNonPositive.slice(0, 40),
      duplicatedSessionWinePairs: duplicatedSessionWinePairs.slice(0, 40),
      dateIncoherent: dateIncoherent.slice(0, 40),
      futureDated: futureDated.slice(0, 40)
    },
    consistency: {
      hasQtyNonPositive: qtyNonPositive.length > 0,
      hasDuplicatedSessionWinePairs: duplicatedSessionWinePairs.length > 0,
      hasDateIncoherent: dateIncoherent.length > 0,
      hasFutureDated: futureDated.length > 0
    }
  };
}

function buildSessionOutlierContext(submittedSessions: DischargeSessionSummary[]) {
  if (submittedSessions.length === 0) {
    return {
      summary: { sessionsCount: 0, avgTotalQty: 0, stdDevTotalQty: 0, outliersCount: 0 },
      outliers: [] as Array<{
        sessionId: string;
        totalQty: number;
        submittedAt?: number;
        zScore: number;
      }>
    };
  }

  const values = submittedSessions.map((session) => Math.max(0, Number(session.totalQty) || 0));
  const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance =
    values.reduce((sum, value) => sum + (value - avg) * (value - avg), 0) /
    Math.max(1, values.length);
  const stdDev = Math.sqrt(Math.max(0, variance));
  const threshold = avg + 2 * stdDev;

  const outliers = submittedSessions
    .filter((session) => session.totalQty > threshold && session.totalQty > avg * 1.8)
    .map((session) => ({
      sessionId: session.id,
      totalQty: session.totalQty,
      submittedAt: session.submittedAt,
      zScore: stdDev > 0 ? Number(((session.totalQty - avg) / stdDev).toFixed(2)) : 0
    }))
    .sort((a, b) => b.totalQty - a.totalQty)
    .slice(0, 60);

  return {
    summary: {
      sessionsCount: submittedSessions.length,
      avgTotalQty: Number(avg.toFixed(2)),
      stdDevTotalQty: Number(stdDev.toFixed(2)),
      outliersCount: outliers.length
    },
    outliers
  };
}

function buildReorderDecisionContext(wines: Wine[], submittedItems: DischargeSessionItemDetail[]) {
  const aggregateByWineId = new Map<
    string,
    { lastDischargeAt: number | null; dischargeEvents: number }
  >();
  for (const item of submittedItems) {
    const submittedAt = item.submittedAt ?? item.createdAt;
    const current = aggregateByWineId.get(item.wineId) ?? {
      lastDischargeAt: null,
      dischargeEvents: 0
    };
    current.dischargeEvents += 1;
    if (!current.lastDischargeAt || submittedAt > current.lastDischargeAt) {
      current.lastDischargeAt = submittedAt;
    }
    aggregateByWineId.set(item.wineId, current);
  }

  const now = Date.now();
  const reorder: DecisionBucketRow[] = [];
  const freeze: DecisionBucketRow[] = [];
  const borderline: DecisionBucketRow[] = [];

  for (const wine of wines) {
    const qty = Math.max(0, Number(wine.qty) || 0);
    const thresholdRaw = Number(wine.threshold);
    const threshold = Number.isFinite(thresholdRaw) && thresholdRaw > 0 ? thresholdRaw : null;
    const agg = aggregateByWineId.get(wine.id);
    const dischargeEvents = agg?.dischargeEvents ?? 0;
    const daysSinceLastDischarge =
      agg?.lastDischargeAt !== null && agg?.lastDischargeAt !== undefined
        ? Math.max(0, Math.floor((now - agg.lastDischargeAt) / (1000 * 60 * 60 * 24)))
        : null;

    const isReorder =
      (qty === 0 || (threshold !== null && qty <= threshold)) &&
      dischargeEvents > 0 &&
      daysSinceLastDischarge !== null &&
      daysSinceLastDischarge <= 180;
    const isFreeze =
      dischargeEvents === 0 || (daysSinceLastDischarge !== null && daysSinceLastDischarge > 365);

    const row: DecisionBucketRow = {
      wineId: wine.id,
      wineName: wine.name,
      producer: wine.producer,
      qty,
      threshold,
      dischargeEvents,
      daysSinceLastDischarge,
      reason: ''
    };

    if (isReorder) {
      row.reason = qty === 0 ? 'esaurito con domanda recente' : 'sotto soglia con domanda recente';
      reorder.push(row);
      continue;
    }
    if (isFreeze) {
      row.reason = dischargeEvents === 0 ? 'mai scaricato' : 'fermo da oltre 12 mesi';
      freeze.push(row);
      continue;
    }
    row.reason = 'caso intermedio da monitorare';
    borderline.push(row);
  }

  reorder.sort((a, b) => {
    const aOut = a.qty === 0 ? 1 : 0;
    const bOut = b.qty === 0 ? 1 : 0;
    if (bOut !== aOut) return bOut - aOut;
    const aGap = a.threshold !== null ? a.threshold - a.qty : -9999;
    const bGap = b.threshold !== null ? b.threshold - b.qty : -9999;
    if (bGap !== aGap) return bGap - aGap;
    return (a.daysSinceLastDischarge ?? 9999) - (b.daysSinceLastDischarge ?? 9999);
  });

  freeze.sort((a, b) => {
    const aNever = a.dischargeEvents === 0 ? 1 : 0;
    const bNever = b.dischargeEvents === 0 ? 1 : 0;
    if (bNever !== aNever) return bNever - aNever;
    return (b.daysSinceLastDischarge ?? 9999) - (a.daysSinceLastDischarge ?? 9999);
  });

  borderline.sort((a, b) => {
    const aDays = a.daysSinceLastDischarge ?? 0;
    const bDays = b.daysSinceLastDischarge ?? 0;
    if (bDays !== aDays) return bDays - aDays;
    return a.qty - b.qty;
  });

  return {
    rules: {
      reorder:
        '(qty = 0 OR (threshold > 0 AND qty <= threshold)) AND dischargeEvents > 0 AND daysSinceLastDischarge <= 180',
      freeze: 'dischargeEvents = 0 OR daysSinceLastDischarge > 365',
      borderline: 'all records not in reorder/freeze'
    },
    counts: {
      reorder: reorder.length,
      freeze: freeze.length,
      borderline: borderline.length
    },
    reorder: reorder.slice(0, 300),
    freeze: freeze.slice(0, 300),
    borderline: borderline.slice(0, 300)
  };
}

function buildSessionsContext(
  submittedSessions: DischargeSessionSummary[],
  submittedItems: DischargeSessionItemDetail[]
) {
  const topDischargedMap = new Map<
    string,
    {
      wineId: string;
      wineName: string;
      qtyTotal: number;
      sessions: number;
      producer?: string;
      origin?: string;
      category?: string;
      supplier?: string;
    }
  >();

  for (const item of submittedItems) {
    const current = topDischargedMap.get(item.wineId) ?? {
      wineId: item.wineId,
      wineName: item.wineName,
      qtyTotal: 0,
      sessions: 0,
      producer: item.producer,
      origin: item.origin,
      category: item.category,
      supplier: item.supplier
    };
    current.qtyTotal += item.qty;
    current.sessions += 1;
    topDischargedMap.set(item.wineId, current);
  }

  const totalSubmittedQty = submittedSessions.reduce((sum, s) => sum + Math.max(0, s.totalQty), 0);
  return {
    summary: {
      submittedSessions: submittedSessions.length,
      totalSubmittedQty,
      lastSubmittedAt: submittedSessions[0]?.submittedAt ?? null
    },
    recentSubmittedSessions: submittedSessions.slice(0, 30),
    topDischargedWines: Array.from(topDischargedMap.values())
      .sort((a, b) => b.qtyTotal - a.qtyTotal)
      .slice(0, 30)
  };
}

function buildConversationTranscript(messages: ChatMessage[], currentQuestion: string): string {
  const relevant = [
    ...messages,
    { id: 'current', role: 'user' as const, text: currentQuestion }
  ].slice(-14);
  return relevant
    .map((message) => `${message.role === 'user' ? 'Utente' : 'Assistente'}: ${message.text}`)
    .join('\n');
}

function responseToText(data: unknown): string {
  const asRecord = data as Record<string, unknown> | null;
  const outputText = typeof asRecord?.output_text === 'string' ? asRecord.output_text : '';
  if (outputText.trim()) return outputText.trim();

  const output = Array.isArray(asRecord?.output) ? asRecord.output : [];
  for (const item of output) {
    const entry = item as Record<string, unknown>;
    const content = Array.isArray(entry.content) ? entry.content : [];
    for (const block of content) {
      const chunk = block as Record<string, unknown>;
      const text = typeof chunk.text === 'string' ? chunk.text : '';
      if (text.trim()) return text.trim();
    }
  }
  return '';
}

function readStorage(key: string): string {
  try {
    return localStorage.getItem(key) ?? '';
  } catch {
    return '';
  }
}

function writeStorage(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

async function readApiError(response: Response): Promise<string> {
  const payload = await response.text();
  if (!payload) return `Richiesta AI fallita (${response.status}).`;

  try {
    const parsed = JSON.parse(payload) as {
      error?: { message?: string };
    };
    const message = parsed.error?.message?.trim();
    if (message) return `Richiesta AI fallita (${response.status}). ${message}`;
  } catch {
    // Fallback to raw text below.
  }

  return `Richiesta AI fallita (${response.status}). ${payload.slice(0, 180)}`;
}

function buildAiExportFileBaseName() {
  const now = new Date();
  const day = new Intl.DateTimeFormat('it-IT', { day: '2-digit' }).format(now);
  const month = new Intl.DateTimeFormat('it-IT', { month: '2-digit' }).format(now);
  const year = new Intl.DateTimeFormat('it-IT', { year: 'numeric' }).format(now);
  const hours = new Intl.DateTimeFormat('it-IT', { hour: '2-digit', hour12: false }).format(now);
  const minutes = new Intl.DateTimeFormat('it-IT', { minute: '2-digit' }).format(now);
  return `assistente_ai_${day}-${month}-${year}_${hours}-${minutes}`;
}

function parseTextToRows(text: string): { rows: string[][]; isTableLike: boolean } {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const tableRows: string[][] = [];
  for (const line of lines) {
    if (!line.includes('|')) continue;
    const parts = line
      .split('|')
      .map((cell) => cell.trim())
      .filter((cell) => cell.length > 0);
    if (parts.length >= 2) tableRows.push(parts);
  }

  const validTableRows = tableRows.filter((row) => !row.every((cell) => /^-+$/.test(cell)));
  if (validTableRows.length >= 2) {
    const targetLen = Math.max(...validTableRows.map((row) => row.length));
    return {
      isTableLike: true,
      rows: validTableRows.map((row) => {
        const next = row.slice(0, targetLen);
        while (next.length < targetLen) next.push('');
        return next;
      })
    };
  }

  return {
    isTableLike: false,
    rows: [['contenuto'], ...lines.map((line) => [line])]
  };
}

function isExplicitReportRequest(question: string): boolean {
  return /\b(report|riepilogo|analisi|sintesi|diagnosi|kpi|tabella|esporta|export|pdf)\b/i.test(
    question
  );
}

function readAiSessionsCache() {
  if (!aiSessionsCache) return null;
  if (Date.now() - aiSessionsCache.at > AI_SESSIONS_CACHE_TTL_MS) return null;
  return aiSessionsCache;
}

function writeAiSessionsCache(payload: {
  submittedSessions: DischargeSessionSummary[];
  submittedItems: DischargeSessionItemDetail[];
}) {
  aiSessionsCache = { at: Date.now(), ...payload };
}

export function AiAssistantModal({
  open,
  wines,
  onClose
}: {
  open: boolean;
  wines: Wine[];
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [submittedSessions, setSubmittedSessions] = useState<DischargeSessionSummary[]>([]);
  const [submittedItems, setSubmittedItems] = useState<DischargeSessionItemDetail[]>([]);
  const [sessionsLoaded, setSessionsLoaded] = useState(false);
  const [model, setModel] = useState(() => {
    const savedModel = (readStorage(STORAGE_MODEL) || ENV_MODEL || DEFAULT_MODEL).trim();
    return AGENT_MODELS.some((option) => option.value === savedModel) ? savedModel : DEFAULT_MODEL;
  });
  const listRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const snapshot = useMemo(() => buildInventorySnapshot(wines), [wines]);
  const searchTextByWineId = useMemo(() => {
    const map = new Map<string, string>();
    for (const wine of wines) {
      map.set(
        wine.id,
        [
          wine.name,
          wine.category ?? '',
          wine.producer,
          wine.origin,
          wine.supplier ?? '',
          wine.notes ?? ''
        ]
          .join(' ')
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
      );
    }
    return map;
  }, [wines]);
  const analytics = useMemo(() => buildInventoryAnalytics(wines), [wines]);

  const loadSessionsData = useCallback(async (options?: { force?: boolean }) => {
    const force = options?.force ?? false;
    if (!force) {
      const cached = readAiSessionsCache();
      if (cached) {
        setSubmittedSessions(cached.submittedSessions);
        setSubmittedItems(cached.submittedItems);
        setSessionsLoaded(true);
        return cached;
      }
    }
    try {
      const [submitted, items] = await Promise.all([
        listAllDischargeSessions('submitted'),
        listAllSubmittedDischargeItemsForAi()
      ]);
      setSubmittedSessions(submitted);
      setSubmittedItems(items);
      setSessionsLoaded(true);
      const payload = {
        submittedSessions: submitted,
        submittedItems: items
      };
      writeAiSessionsCache(payload);
      return payload;
    } catch {
      setSubmittedSessions([]);
      setSubmittedItems([]);
      setSessionsLoaded(false);
      return null;
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setMessages([
      {
        id: `${Date.now()}_welcome`,
        role: 'assistant',
        text: WELCOME_MESSAGE
      }
    ]);
    setPrompt('');
    setBusy(false);
    setTimeout(() => inputRef.current?.focus(), 80);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    void loadSessionsData();
  }, [loadSessionsData, open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [busy, onClose, open]);

  useEffect(() => {
    if (!open) return;
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, open]);

  useEffect(() => {
    writeStorage(STORAGE_MODEL, model || DEFAULT_MODEL);
  }, [model]);

  const exportAssistantPdf = async (sourceText: string) => {
    if (!sourceText.trim()) {
      setMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}_exp_pdf`,
          role: 'assistant',
          text: 'Nessuna risposta assistente da esportare.'
        }
      ]);
      return;
    }
    try {
      setExporting(true);
      const parsed = parseTextToRows(sourceText);
      const [{ jsPDF }, { default: autoTable }] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable')
      ]);
      const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      const loadLogoDataUrl = async (): Promise<{
        dataUrl: string;
        width: number;
        height: number;
      } | null> => {
        try {
          const response = await fetch('/logo.png');
          if (!response.ok) return null;
          const blob = await response.blob();
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result ?? ''));
            reader.onerror = () => reject(new Error('logo read failed'));
            reader.readAsDataURL(blob);
          });
          const dimensions = await new Promise<{ width: number; height: number }>(
            (resolve, reject) => {
              const img = new Image();
              img.onload = () =>
                resolve({ width: img.naturalWidth || 1, height: img.naturalHeight || 1 });
              img.onerror = () => reject(new Error('logo size read failed'));
              img.src = dataUrl;
            }
          );
          return { dataUrl, ...dimensions };
        } catch {
          return null;
        }
      };

      const logo = await loadLogoDataUrl();
      const maxLogoWidth = 180;
      const maxLogoHeight = 42;
      const logoScale = logo
        ? Math.min(maxLogoWidth / logo.width, maxLogoHeight / logo.height, 1)
        : 1;
      const logoWidth = logo ? Number((logo.width * logoScale).toFixed(2)) : 0;
      const logoHeight = logo ? Number((logo.height * logoScale).toFixed(2)) : 0;
      const logoX = logo ? Number(((pageWidth - logoWidth) / 2).toFixed(2)) : 0;
      const logoY = 16;
      const tableStartY = logo ? logoY + logoHeight + 12 : 48;

      const withHeader = logo
        ? {
            didDrawPage: () => {
              doc.addImage(logo.dataUrl, 'PNG', logoX, logoY, logoWidth, logoHeight);
            }
          }
        : {};

      if (parsed.isTableLike) {
        autoTable(doc, {
          head: [parsed.rows[0]],
          body: parsed.rows.slice(1),
          startY: tableStartY,
          styles: { fontSize: 9, cellPadding: 4, textColor: [31, 41, 55] },
          headStyles: { fillColor: [237, 243, 234], textColor: [75, 85, 99] },
          margin: { left: 24, right: 24 },
          ...withHeader
        });
      } else {
        autoTable(doc, {
          head: [['contenuto']],
          body: parsed.rows.slice(1),
          startY: tableStartY,
          styles: { fontSize: 9, cellPadding: 4, textColor: [31, 41, 55] },
          headStyles: { fillColor: [237, 243, 234], textColor: [75, 85, 99] },
          margin: { left: 24, right: 24 },
          ...withHeader
        });
      }

      const totalPages = doc.getNumberOfPages();
      for (let page = 1; page <= totalPages; page += 1) {
        doc.setPage(page);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(107, 114, 128);
        doc.setFontSize(8);
        doc.text(`${page}/${totalPages}`, pageWidth / 2, pageHeight - 12, { align: 'center' });
      }

      doc.save(`${buildAiExportFileBaseName()}.pdf`);
    } finally {
      setExporting(false);
    }
  };

  const send = async () => {
    const question = prompt.trim();
    if (!question || busy) return;
    const reportRequested = isExplicitReportRequest(question);

    const nextUserMessage: ChatMessage = {
      id: `${Date.now()}_u`,
      role: 'user',
      text: question
    };
    setMessages((prev) => [...prev, nextUserMessage]);
    setPrompt('');
    setBusy(true);

    try {
      let effectiveSessions = submittedSessions;
      let effectiveItems = submittedItems;
      let effectiveSessionsLoaded = sessionsLoaded;
      if (!effectiveSessionsLoaded || effectiveItems.length === 0) {
        const loaded = await loadSessionsData({ force: true });
        if (loaded) {
          effectiveSessions = loaded.submittedSessions;
          effectiveItems = loaded.submittedItems;
          effectiveSessionsLoaded = true;
        } else {
          effectiveSessionsLoaded = false;
        }
      }
      const systemPrompt = [
        'Sei l’assistente AI interno di Enoteca Italiana.',
        'Rispondi in italiano, tono professionale e sintetico.',
        'Usa SEMPRE sia i dati app (contesto JSON) sia il web quando la richiesta lo richiede.',
        'Se i dati app bastano per rispondere con precisione, usa prima i dati app e usa il web solo come integrazione.',
        'Modalità rigorosa obbligatoria: non inventare numeri, non stimare, non usare approssimazioni.',
        'Se un dato non è nel contesto, scrivi esattamente: non disponibile nel contesto.',
        'Mantieni coerenza interna tra conteggi ed esempi.',
        'Non divulgare mai dati riservati del contesto app durante eventuali ricerche web.',
        'Per il web usa query generiche e non includere valori sensibili del contesto app.',
        'Se mancano dati dichiaralo chiaramente.',
        'Non inventare numeri.',
        'Per richieste di classifica (top/bottom margini, quantità, valore magazzino) usa SEMPRE i leaderboards globali.',
        'Usa sempre il blocco inventory.recency per domande su vini non scaricati da 3/6/12 mesi o mai scaricati.',
        'Regola obbligatoria per richieste di riordino: nella lista "da riordinare subito" inserisci SOLO vini esauriti o sotto soglia che NON siano "mai scaricati" e che abbiano evidenza di domanda storica (dischargeEvents > 0, preferenza per eventi recenti/frequenti).',
        'I vini "mai scaricati" NON possono essere proposti come "da riordinare subito": inseriscili in "non riordinare ora" oppure "da valutare".',
        'Per richieste con blocchi riordino/congelare/borderline usa PRIORITARIAMENTE inventory.decision (calcolo già fatto con regole rigide).',
        'Non mostrare mai righe escluse dentro un blocco: ogni riga deve rispettare la regola del blocco.',
        'Se un blocco non ha record conformi, scrivi esattamente: nessun vino conforme.',
        'Per borderline usa solo il set residuo inventory.decision.borderline e non lasciare mai il blocco senza verifica.',
        'I giorni dall’ultimo scarico non possono essere negativi: se il dato sorgente è futuro, considera 0 giorni e segnala anomalia data futura nei controlli qualità.',
        'Per analisi per produttore usa il blocco inventory.byProducer.',
        'Per audit qualità dati usa il blocco sessions.dataQuality.',
        'Per outlier sessione usa il blocco sessions.outliers.',
        'Usa anche il blocco sessions per risposte su storico, andamenti temporali e vini più scaricati.'
      ].join(' ');
      const relevantWines = pickRelevantWines(wines, question, searchTextByWineId).map(
        toAnalyticWine
      );
      const effectiveSessionsContext = buildSessionsContext(effectiveSessions, effectiveItems);
      const recency = buildRecencyContext(wines, effectiveItems);
      const producerContext = buildProducerContext(wines, effectiveItems, recency);
      const dataQuality = buildDataQualityContext(effectiveItems);
      const outlierContext = buildSessionOutlierContext(effectiveSessions);
      const decisionContext = buildReorderDecisionContext(wines, effectiveItems);

      const contextPayload = {
        inventory: {
          ...buildAiContext(snapshot, analytics, relevantWines, recency),
          byProducer: producerContext,
          decision: decisionContext
        },
        sessions: {
          ...effectiveSessionsContext,
          dataQuality,
          outliers: outlierContext
        },
        meta: {
          sessionsLoaded: effectiveSessionsLoaded,
          loadedSubmittedSessions: effectiveSessions.length,
          loadedSubmittedItems: effectiveItems.length
        }
      };

      const payloadText = [
        `Contesto app JSON:\n${JSON.stringify(contextPayload)}`,
        `Cronologia chat:\n${buildConversationTranscript(messages, question)}`,
        `Domanda attuale:\n${question}`
      ].join('\n\n');

      const response = await fetch(AI_API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: model || DEFAULT_MODEL,
          instructions: systemPrompt,
          tools: [{ type: 'web_search_preview' }],
          tool_choice: 'auto',
          input: [
            {
              role: 'user',
              content: [{ type: 'input_text', text: payloadText }]
            }
          ]
        })
      });

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      const data = (await response.json()) as unknown;
      const reply = responseToText(data);
      if (!reply) {
        throw new Error('Risposta AI vuota. Riprova.');
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}_a`,
          role: 'assistant',
          text: reply,
          pdfExportEligible: reportRequested
        }
      ]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Errore AI imprevisto.';
      setMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}_e`,
          role: 'assistant',
          text: `Errore: ${message}`
        }
      ]);
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <div className="modalOverlay" role="dialog" aria-modal="true" aria-label="Assistente AI">
      <div className="modalCard archiveAiModalCard">
        <div className="archiveAiModalHeader">
          <div className="archiveAiModalTitleWrap">
            <div className="archiveAiModalTitleRow">
              <img
                className="archiveAiModalTitleIcon"
                src="/icons%20ai.png"
                alt=""
                aria-hidden="true"
              />
              <div className="archiveAiModalTitle">Assistente AI</div>
            </div>
          </div>
          <button
            className="archiveAiCloseButton"
            type="button"
            onClick={onClose}
            aria-label="Chiudi assistente AI"
          >
            ×
          </button>
        </div>

        <div className="archiveAiChatPanel">
          <div className="archiveAiMessages" ref={listRef}>
            {messages.map((message) => (
              <div
                key={message.id}
                className={`archiveAiMessage ${message.role === 'user' ? 'archiveAiMessageUser' : 'archiveAiMessageAssistant'}`}
              >
                <div className="archiveAiMessageRole">
                  {message.role === 'user' ? 'Tu' : 'Assistente'}
                </div>
                <div className="archiveAiMessageText">{message.text}</div>
                {message.role === 'assistant' && message.pdfExportEligible ? (
                  <button
                    className="archiveAiMessageExportPdfButton"
                    type="button"
                    onClick={() => void exportAssistantPdf(message.text)}
                    disabled={busy || exporting}
                    aria-label="Esporta questo report in PDF"
                  >
                    {exporting ? 'Esportazione PDF…' : 'Esporta PDF'}
                  </button>
                ) : null}
              </div>
            ))}
            {busy ? (
              <div className="archiveAiMessage archiveAiMessageAssistant">
                <div className="archiveAiMessageRole">Assistente</div>
                <div className="archiveAiMessageText">Elaborazione in corso…</div>
              </div>
            ) : null}
          </div>

          <div className="archiveAiComposer">
            <textarea
              ref={inputRef}
              className="input archiveAiPromptTextarea"
              placeholder="Scrivi una domanda, posso leggere tutti i dati dell'archivio.."
              value={prompt}
              rows={2}
              onChange={(event) => setPrompt(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' || event.shiftKey) return;
                event.preventDefault();
                void send();
              }}
            />
            <select
              className="input archiveAiInlineModelSelect"
              value={model}
              onChange={(event) => setModel(event.target.value)}
            >
              {AGENT_MODELS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="archiveAiModalBrand" aria-hidden="true">
          <img className="archiveAiModalBrandLogo" src="/logo%20inverso.png" alt="" />
        </div>
      </div>
    </div>
  );
}
