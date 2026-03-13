import { useEffect, useMemo, useRef, useState } from 'react';
import type { Wine } from '@/domain/types';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
};

const STORAGE_API_KEY = 'scarichi.ai.openaiApiKey.v1';
const STORAGE_MODEL = 'scarichi.ai.openaiModel.v1';
const DEFAULT_MODEL = 'gpt-4.1-mini';
const AGENT_MODELS = [
  { value: 'gpt-4.1-mini', label: 'GPT-4.1 mini' },
  { value: 'gpt-4.1', label: 'GPT-4.1' },
  { value: 'gpt-4o-mini', label: 'GPT-4o mini' }
] as const;

function formatMoney(value?: number) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return `${value.toFixed(2).replace('.', ',')}€`;
}

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
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(STORAGE_API_KEY) ?? '');
  const [model, setModel] = useState(() => {
    const savedModel = (localStorage.getItem(STORAGE_MODEL) ?? DEFAULT_MODEL).trim();
    return AGENT_MODELS.some((option) => option.value === savedModel) ? savedModel : DEFAULT_MODEL;
  });
  const [showSettings, setShowSettings] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const snapshot = useMemo(() => buildInventorySnapshot(wines), [wines]);

  useEffect(() => {
    if (!open) return;
    setTimeout(() => inputRef.current?.focus(), 80);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setShowSettings(false);
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
    localStorage.setItem(STORAGE_API_KEY, apiKey.trim());
    localStorage.setItem(STORAGE_MODEL, model || DEFAULT_MODEL);
  }, [apiKey, model]);

  const send = async () => {
    const question = prompt.trim();
    if (!question || busy) return;
    if (!apiKey.trim()) {
      setError('Inserisci una chiave API OpenAI valida nelle impostazioni AI.');
      setShowSettings(true);
      return;
    }

    setError(null);
    const nextUserMessage: ChatMessage = {
      id: `${Date.now()}_u`,
      role: 'user',
      text: question
    };
    setMessages((prev) => [...prev, nextUserMessage]);
    setPrompt('');
    setBusy(true);

    try {
      const relevantWines = pickRelevantWines(wines, question).map((wine) => ({
        name: wine.name,
        category: wine.category ?? '',
        producer: wine.producer,
        origin: wine.origin,
        supplier: wine.supplier ?? '',
        qty: wine.qty,
        threshold: wine.threshold ?? null,
        purchase: wine.purchasePrice ?? null,
        sale: wine.salePrice ?? null,
        notes: wine.notes ?? ''
      }));

      const systemPrompt = [
        'Sei l’assistente AI interno di Enoteca Italiana.',
        'Rispondi in italiano, tono professionale e sintetico.',
        'Usa solo i dati forniti nel contesto; se mancano dati dichiaralo chiaramente.',
        'Non inventare numeri.'
      ].join(' ');

      const contextPayload = {
        snapshot: {
          totalWines: snapshot.total,
          totalQty: snapshot.qtyTotal,
          outOfStock: snapshot.out,
          thresholdCount: snapshot.threshold,
          stockValueEuro: snapshot.stockValue,
          avgMarginEuro: snapshot.marginAvg
        },
        relevantWines,
        note: 'Dati filtrati per pertinenza rispetto alla domanda utente.'
      };

      const history = [...messages, nextUserMessage].slice(-12).map((message) => ({
        role: message.role,
        content: [{ type: 'input_text', text: message.text }]
      }));

      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey.trim()}`
        },
        body: JSON.stringify({
          model: model || DEFAULT_MODEL,
          input: [
            { role: 'system', content: [{ type: 'input_text', text: systemPrompt }] },
            {
              role: 'system',
              content: [{ type: 'input_text', text: `Contesto JSON:\n${JSON.stringify(contextPayload)}` }]
            },
            ...history
          ]
        })
      });

      if (!response.ok) {
        const detail = await response.text();
        throw new Error(`Richiesta AI fallita (${response.status}). ${detail.slice(0, 180)}`);
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
      setError(message);
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
        </div>

        {showSettings ? (
          <div className="archiveAiSettings">
            <input
              className="input archiveAiSettingsInput"
              type="password"
              placeholder="OpenAI API key (sk-...)"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
            />
            <select
              className="input archiveAiSettingsInput"
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
        ) : null}

        {!showSettings ? (
          <>
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
                  placeholder="Scrivi una domanda sull’archivio vini..."
                  value={prompt}
                  rows={2}
                  onChange={(event) => setPrompt(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter' || event.shiftKey) return;
                    event.preventDefault();
                    void send();
                  }}
                />
                <button
                  className="button buttonAuto archiveAiInlineSendButton"
                  type="button"
                  disabled={busy}
                  onClick={() => void send()}
                >
                  {busy ? 'Invio…' : 'Invia'}
                </button>
              </div>
            </div>

            {error ? <div className="errorText mt8">{error}</div> : null}

            <div className="archiveAiFooterHint">
              Le risposte usano i dati archivio correnti. Valore magazzino stimato: {formatMoney(snapshot.stockValue)}.
            </div>
          </>
        ) : null}
        <div className="archiveAiBottomActions">
          <button
            className="button buttonSecondary buttonAuto archiveAiHeaderButton"
            type="button"
            onClick={() => setShowSettings((prev) => !prev)}
          >
            {showSettings ? (
              <span className="archiveAiToggleSettingsContent">
                <img className="archiveAiToggleSettingsIcon" src="/icons%20ai.png" alt="" aria-hidden="true" />
                Torna ad Assistente AI
              </span>
            ) : (
              'Impostazioni'
            )}
          </button>
          <button className="button buttonSecondary buttonAuto archiveAiHeaderButton" type="button" onClick={onClose}>
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
}
