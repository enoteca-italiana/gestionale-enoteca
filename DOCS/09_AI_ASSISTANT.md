# Assistente AI Archivio

Ultimo aggiornamento: **13/03/2026 16:45 CET**.

## Scopo

Fornire in `/admina` un assistente conversazionale per analisi archivio vini (giacenze, soglie, esauriti, margini, produttori/provenienze/fornitori), senza modificare i dati.

## Accesso UI

- Pulsante AI nella toolbar archivio (destra, vicino ad `Aggiungi vino`).
- Apertura modale full-width desktop.
- Tema dark coerente con branding.

## Struttura modale

- Header: titolo `Assistente AI` con icona AI.
- Vista chat:
  - area messaggi;
  - box input domanda + pulsante `Invia`;
  - nota metrica sintetica valore magazzino.
- Vista impostazioni:
  - solo `OpenAI API key`;
  - solo selettore `Tipo agent`.
  - nessuna area chat visibile in questa vista.

## Modelli (tipo agent) disponibili

- `gpt-4.1-mini` (default)
- `gpt-4.1`
- `gpt-4o-mini`

## Persistenza locale

Chiavi localStorage:

- `scarichi.ai.openaiApiKey.v1`
- `scarichi.ai.openaiModel.v1`

## Flusso richiesta AI

1. L’utente invia una domanda.
2. Il client costruisce snapshot inventario:
   - totale vini;
   - totale quantità;
   - esauriti;
   - vini in soglia;
   - valore magazzino;
   - margine medio.
3. Viene estratto un sottoinsieme vini rilevanti rispetto al testo domanda.
4. Chiamata API `POST https://api.openai.com/v1/responses` con:
   - system prompt vincolato all’uso dei soli dati forniti;
   - contesto JSON locale;
   - cronologia chat recente.
5. Risposta resa nel pannello messaggi.

## Vincoli e sicurezza

- Nessuna chiave API hardcoded nel codice.
- Chiave inserita manualmente in UI e mantenuta in localStorage browser.
- L’assistente non scrive su Supabase.
- In caso di risposta vuota/errore rete, feedback esplicito in chat.

## Limiti attuali

- Elaborazione lato client (non server-side proxy).
- Nessuna knowledge base esterna: risponde sui dati archivio correnti.
- Nessun tool SQL automatico: solo analisi descrittiva.

## Test regressione minimi

- Apertura/chiusura modale AI.
- Toggle `Impostazioni` <-> `Assistente AI`.
- In `Impostazioni` visibili solo i 2 controlli richiesti.
- Invio domanda con/without API key.
- Nessuna regressione su filtri/CRUD archivio.
