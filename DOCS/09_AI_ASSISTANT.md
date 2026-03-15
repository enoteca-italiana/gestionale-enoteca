# Assistente AI Archivio

Ultimo aggiornamento: **15/03/2026 23:05 CET**.

## Scopo

Fornire in `/admina` una chat AI unica per analisi dei dati archivio vini e sessioni storiche, senza scrivere dati nel database.

## UI attuale

- Pulsante AI in toolbar archivio.
- Modale chat dark con:
  - titolo `Assistente AI`;
  - chiusura con pulsante `X` in alto a destra;
  - lista messaggi verticale classica (utente/assistente);
  - composer in basso con:
    - campo domanda (invio con tasto `Enter`)
    - selettore modello
  - logo brand in basso al centro.

Nota: non esiste più una vista impostazioni separata nel modale, né pulsante `Invia`/`Chiudi`.

## Configurazione API key (stabile)

Percorso consigliato:

- variabile ambiente `VITE_OPENAI_API_KEY` in `.env.local`.
- modello default opzionale: `VITE_OPENAI_MODEL`.

Esempio:

```env
VITE_OPENAI_API_KEY=sk-...
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
   - breakdown per categoria/produttore/provenienza/fornitore;
   - sessioni `submitted`/`pending` e item storico.
3. Chiamata `POST /v1/responses` con:
   - `instructions` con vincoli di sicurezza;
   - input unico con contesto JSON + cronologia conversazione + domanda corrente;
   - tool web abilitato (`web+app`).
4. Risposta renderizzata in chat.

## Sicurezza

- Nessuna scrittura su Supabase dalla chat AI.
- Prompt di sistema con vincoli anti-divulgazione dati interni nelle ricerche web.
- Nessuna chiave hardcoded nel codice.

## Verifica rapida

1. Apri `/admina` e modale AI.
2. Fai domanda su dati interni (es. top margini).
3. Fai domanda che richiede web (es. vini piemontesi esterni).
4. Verifica che la conversazione resti nella stessa chat.
