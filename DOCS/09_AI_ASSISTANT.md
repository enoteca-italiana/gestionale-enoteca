# Assistente AI Archivio

Ultimo aggiornamento: **07/04/2026 00:25 CEST**.

## Scopo

Fornire in `/admina` una chat AI unica per analisi dei dati archivio vini e sessioni storiche, senza scrivere dati nel database.

## UI attuale

- Pulsante AI in toolbar archivio.
- Modale chat dark con:
  - titolo `Assistente AI`;
  - chiusura con pulsante `X` in alto a destra;
  - lista messaggi verticale classica (utente/assistente);
  - pulsante `Esporta PDF` visibile solo sui messaggi assistente generati da richieste esplicite di report/export;
  - composer in basso con:
    - campo domanda (invio con tasto `Enter`)
    - selettore modello
  - logo brand in basso al centro.

Nota: non esiste più una vista impostazioni separata nel modale, né pulsante `Invia`/`Chiudi`.

## Export report PDF (nuovo)

- Formato supportato: **solo PDF**.
- Il pulsante di export non è fisso nella testata: compare direttamente nel messaggio AI quando la domanda contiene intento esplicito di report/export (`report`, `analisi`, `riepilogo`, `diagnosi`, `kpi`, `tabella`, `esporta`, `export`, `pdf`).
- L’export usa il contenuto del singolo messaggio:
  - se tabellare (righe con `|`) genera una tabella PDF;
  - altrimenti esporta testo formattato.
- Il PDF include sempre il logo Enoteca Italiana in alto, con proporzioni originali preservate.
- Il PDF include in footer la numerazione pagine in piccolo (`1/3`, `2/3`, ...).

## Configurazione API key (stabile)

Percorso consigliato:

- secret server-side `OPENAI_API_KEY` (Cloudflare Pages Functions).
- modello default server-side opzionale: `OPENAI_MODEL`.
- modello UI opzionale: `VITE_OPENAI_MODEL`.
- `VITE_OPENAI_API_KEY` non deve essere usata (chiave non esposta nel frontend).

Esempio:

```env
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4.1-mini
VITE_OPENAI_MODEL=gpt-4.1-mini
```

## Modelli disponibili in UI

- `gpt-4.1-mini`
- `gpt-4.1`

## Flusso tecnico

1. L’utente invia la domanda.
2. Il client costruisce contesto completo:
   - snapshot inventario;
   - leaderboard margini/giacenze/valore;
   - breakdown per categoria/produttore/provenienza;
   - sessioni `submitted` e item storico caricati con paginazione completa;
   - blocco recency per analisi temporale per vino:
     - `neverDischarged`
     - `over3m`
     - `over6m`
     - `over12m`
     - `oldestOrNever`.
3. Chiamata `POST /api/ai` (Cloudflare Function) con:
   - secret OpenAI gestito lato server, non esposto nel client;
   - validazione payload/model lato backend;
   - proxy verso `POST /v1/responses`.
4. Lato Function, invio a OpenAI `POST /v1/responses` con:
   - `instructions` con vincoli di sicurezza;
   - input unico con contesto JSON + cronologia conversazione + domanda corrente;
   - tool web abilitato (`web+app`).
5. Risposta renderizzata in chat.

## Copertura dati (enterprise)

- Le sessioni storiche usate dall’AI non sono più limitate a piccoli batch fissi:
  - `discharge_sessions` caricate a pagine;
  - `discharge_session_items` caricate a pagine;
  - cache TTL in memoria per ridurre round-trip ripetuti durante la stessa sessione utente.
- Il payload AI include metadati di carico:
  - `meta.loadedSubmittedSessions`
  - `meta.loadedSubmittedItems`
  - `meta.sessionsLoaded`.

## Strict Analytics Mode (nuovo)

Per ridurre risposte contraddittorie o stimate, il prompt di sistema impone:

- nessuna stima/applicazione euristica non supportata;
- se il dato manca: output esplicito `non disponibile nel contesto`;
- coerenza interna tra conteggi ed esempi.

Blocchi contesto aggiunti:

- `inventory.byProducer`
  - metriche aggregate per produttore (vini, qty attuale, qty scaricata storico, % mai scaricati, % sotto soglia/esauriti).
- `sessions.dataQuality`
  - conteggi + esempi deterministici per:
    - `missingWineName`
    - `qtyNonPositive`
    - `duplicatedSessionWinePairs`
    - `dateIncoherent`
- `sessions.outliers`
  - sintesi statistica sessioni e lista outlier (`avg`, `stdDev`, `zScore`).

## Sicurezza

- Nessuna scrittura su Supabase dalla chat AI.
- Nessuna API key OpenAI nel bundle frontend.
- Prompt di sistema con vincoli anti-divulgazione dati interni nelle ricerche web.
- Secret OpenAI gestito solo in environment server-side.

## Verifica rapida

1. Apri `/admina` e modale AI.
2. Fai domanda su dati interni (es. top margini).
3. Fai domanda che richiede web (es. vini piemontesi esterni).
4. Verifica che la conversazione resti nella stessa chat.
