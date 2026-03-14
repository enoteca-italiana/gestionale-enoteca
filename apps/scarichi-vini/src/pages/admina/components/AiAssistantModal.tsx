import { useEffect, useMemo, useRef, useState } from 'react';
import type { Wine } from '@/domain/types';
import { extractApiKey } from '@/pages/admina/components/aiAssistantKey';
import {
  listDischargeSessions,
  listSubmittedDischargeItemsForAi,
  type DischargeSessionItemDetail,
  type DischargeSessionSummary
} from '@/data/dischargeRepository';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
};

const STORAGE_MODEL = 'scarichi.ai.openaiModel.v1';
const DEFAULT_MODEL = 'gpt-4.1-mini';
const ENV_API_KEY = extractApiKey((import.meta.env.VITE_OPENAI_API_KEY as string | undefined) ?? '');
const ENV_MODEL = (import.meta.env.VITE_OPENAI_MODEL as string | undefined)?.trim() ?? '';
const AGENT_MODELS = [
  { value: 'gpt-4.1-mini', label: 'GPT-4.1 mini' },
  { value: 'gpt-4.1', label: 'GPT-4.1' }
] as const;
const WELCOME_MESSAGE = 'Salve, in cosa posso esserti utile?';

function buildInventorySnapshot(wines: Wine[]) {
  const total = wines.length;
  const out = wines.filter((wine) => wine.qty <= 0).length;
  const threshold = wines.filter(
    (wine) => typeof wine.threshold === 'number' && wine.threshold > 0 && wine.qty <= wine.threshold
  ).length;
  const qtyTotal = wines.reduce((sum, wine) => sum + Math.max(0, wine.qty), 0);
  const stockValue = wines.reduce(
    (sum, wine) => sum + (typeof wine.purchasePrice === 'number' ? wine.purchasePrice * Math.max(0, wine.qty) : 0),
    0
  );
  const marginAvg =
    wines.length > 0
      ? wines.reduce((sum, wine) => sum + ((wine.salePrice ?? 0) - (wine.purchasePrice ?? 0)), 0) / wines.length
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

function pickRelevantWines(wines: Wine[], query: string): Wine[] {
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
      const haystack = [
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
        .replace(/[\u0300-\u036f]/g, '');

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

function aggregateBy(items: AnalyticWine[], field: 'category' | 'producer' | 'origin' | 'supplier') {
  const map = new Map<string, { label: string; wines: number; qty: number; stockValue: number; marginAvg: number }>();

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

function buildAiContext(wines: Wine[], question: string, snapshot: ReturnType<typeof buildInventorySnapshot>) {
  const all = wines.map(toAnalyticWine);
  const relevantWines = pickRelevantWines(wines, question).map(toAnalyticWine);

  const byMarginDesc = [...all].sort((a, b) => b.margin - a.margin);
  const byMarginAsc = [...all].sort((a, b) => a.margin - b.margin);
  const byStockValueDesc = [...all].sort((a, b) => b.stockValue - a.stockValue);
  const byQtyAsc = [...all].sort((a, b) => a.qty - b.qty);

  const outOfStock = all.filter((wine) => wine.qty <= 0);
  const inThreshold = all.filter(
    (wine) => typeof wine.threshold === 'number' && wine.threshold > 0 && wine.qty > 0 && wine.qty <= wine.threshold
  );

  return {
    snapshot: {
      totalWines: snapshot.total,
      totalQty: snapshot.qtyTotal,
      outOfStock: snapshot.out,
      thresholdCount: snapshot.threshold,
      stockValueEuro: snapshot.stockValue,
      avgMarginEuro: snapshot.marginAvg
    },
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
    },
    relevantWines,
    note:
      'Le classifiche usano tutto l’archivio caricato in questa pagina. I relevantWines servono solo per dettaglio domanda.'
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
  const relevant = [...messages, { id: 'current', role: 'user' as const, text: currentQuestion }].slice(-14);
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
  const effectiveApiKey = ENV_API_KEY;

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
    let cancelled = false;

    async function loadSessionsData() {
      try {
        const [submitted, items] = await Promise.all([
          listDischargeSessions('submitted'),
          listSubmittedDischargeItemsForAi(1200)
        ]);
        if (cancelled) return;
        setSubmittedSessions(submitted);
        setSubmittedItems(items);
        setSessionsLoaded(true);
      } catch {
        if (cancelled) return;
        setSubmittedSessions([]);
        setSubmittedItems([]);
        setSessionsLoaded(false);
      }
    }

    void loadSessionsData();
    return () => {
      cancelled = true;
    };
  }, [open]);

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

  const send = async () => {
    const question = prompt.trim();
    if (!question || busy) return;
    if (!effectiveApiKey) {
      setMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}_cfg`,
          role: 'assistant',
          text: 'API key non configurata. Imposta VITE_OPENAI_API_KEY nelle variabili ambiente.'
        }
      ]);
      return;
    }
    const safeApiKey = extractApiKey(effectiveApiKey);

    const nextUserMessage: ChatMessage = {
      id: `${Date.now()}_u`,
      role: 'user',
      text: question
    };
    setMessages((prev) => [...prev, nextUserMessage]);
    setPrompt('');
    setBusy(true);

    try {
      const systemPrompt = [
        'Sei l’assistente AI interno di Enoteca Italiana.',
        'Rispondi in italiano, tono professionale e sintetico.',
        'Usa SEMPRE sia i dati app (contesto JSON) sia il web quando la richiesta lo richiede.',
        'Se i dati app bastano per rispondere con precisione, usa prima i dati app e usa il web solo come integrazione.',
        'Non divulgare mai dati riservati del contesto app durante eventuali ricerche web.',
        'Per il web usa query generiche e non includere valori sensibili del contesto app.',
        'Se mancano dati dichiaralo chiaramente.',
        'Non inventare numeri.',
        'Per richieste di classifica (top/bottom margini, quantità, valore magazzino) usa SEMPRE i leaderboards globali.',
        'Usa anche il blocco sessions per risposte su storico, andamenti temporali e vini più scaricati.'
      ].join(' ');

      const contextPayload = {
        inventory: buildAiContext(wines, question, snapshot),
        sessions: buildSessionsContext(submittedSessions, submittedItems),
        meta: {
          sessionsLoaded
        }
      };

      const payloadText = [
        `Contesto app JSON:\n${JSON.stringify(contextPayload)}`,
        `Cronologia chat:\n${buildConversationTranscript(messages, question)}`,
        `Domanda attuale:\n${question}`
      ].join('\n\n');

      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${safeApiKey}`
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
          text: reply
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
              <img className="archiveAiModalTitleIcon" src="/icons%20ai.png" alt="" aria-hidden="true" />
              <div className="archiveAiModalTitle">Assistente AI</div>
            </div>
          </div>
          <button className="archiveAiCloseButton" type="button" onClick={onClose} aria-label="Chiudi assistente AI">
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
                <div className="archiveAiMessageRole">{message.role === 'user' ? 'Tu' : 'Assistente'}</div>
                <div className="archiveAiMessageText">{message.text}</div>
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
            <select className="input archiveAiInlineModelSelect" value={model} onChange={(event) => setModel(event.target.value)}>
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
