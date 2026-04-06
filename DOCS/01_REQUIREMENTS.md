# Requisiti (baseline) — Scarichi Vini

Ultimo aggiornamento: **07/04/2026 00:25 CEST**.

## Scopo

- L’app serve a gestire **scarichi** di bottiglie durante il servizio.
- Non gestisce carichi o aggiornamenti inventario da UI.

## UX / UI

- Mobile web app installabile come **PWA**.
- Installazione supportata su Android, iOS e desktop (Chrome/Safari).
- UX touch-first, veloce e chiara.
- Intro iniziale **2.5s** con **logo** e comparsa graduale.
- Navbar in basso con sole voci:
  - `Home`
  - `Archivio`
- Area impostazioni admin disponibile su route dedicata `/impostazioni` (compatibile anche su `/admin`, protetta da password).

## Modello operativo: sessione di scarico

- L’utente deve lavorare dentro una **sessione**.
- Flusso:
  1. avvia sessione
  2. ricerca per nome
  3. scarica con bottoni rapidi `-1`, `-2`, `-3`
  4. riepilogo con correzioni `+1`, `-1`, `elimina`
  5. conferma finale (modale)

## Ricerca vini

- Ricerca testuale per **nome**.
- Risultati mostrano:
  - nome
  - produttore
  - annata (se presente)
  - provenienza
- Quantità visibile.
- Vini con quantità `0`:
  - restano visibili
  - non scaricabili
- In Home, a sessione chiusa (lista consultiva), click/tap sulla card vino apre modale `Giacenza`:
  - modifica solo quantità (`0..999`) con selector a scroll;
  - conferma in due step (`Conferma` + modale di conferma finale);
  - salvataggio allineato locale + Supabase.

## Vincoli quantità

- Mai andare sotto zero.

## Offline (modalità locale)

- L’app deve aprirsi offline (PWA/app shell).
- La conferma sessione richiede connessione online attiva (submit su Supabase).

## Admin

- Area protetta da password.
- Password iniziale: `1909`.
- Password modificabile.
- Archivio vini su route `/admina` (CRUD tabellare desktop-first).
- Toolbar filtri archivio su una sola riga desktop con box compatto statistiche (`Totale`, `Soglia`, `Esauriti`) e pulsante `Aggiungi vino` (filtro `Tutte le giacenze` rimosso).
- Ordine toolbar archivio: `Aggiungi vino` in prima posizione a sinistra, poi `Cerca...`, poi filtri e comandi.
- In archivio, q.tà `0` resta evidenziata in rosso acceso.
- In archivio, campo `ANNO` vuoto quando il valore non è presente.
- In archivio, le note sono consultabili da icona in colonna `Azioni` (non più come colonna dedicata).
- Categoria, produttore e provenienza selezionabili da liste gestite (no input libero), con opzione `+ Aggiungi ...` sempre visibile in cima ai selector (toolbar + inline tabella).
- I filtri archivio sono complementari tra loro:
  - `Cerca...`, `Categoria`, `Produttore`, `Provenienza` restringono reciprocamente i risultati/opzioni disponibili.
- Pulsante reset filtri:
  - quando sono presenti filtri attivi cambia colore e lampeggia;
  - dopo reset torna allo stato normale.
- Policy testo campi vino (obbligatoria, anche da CSV):
  - `Categoria`, `Nome`, `Provenienza` sempre in **MAIUSCOLO**.
- `Produttore` sempre con **iniziale maiuscola**.
- Settings (toggle):
  - associazione nome utente (predisposizione / future)
- Storico Admin:
  - mostra solo sessioni inviate correttamente da Supabase
  - reset storico con **doppia conferma**
- Sessioni sospese:
  - rimosse dal flusso operativo e dalla UI admin.
- Reset archivio:
  - cancella archivio vini su Supabase con **doppia conferma** + PIN
  - storico sessioni preservato

## Fuori scope (baseline)

- Login utente operativo.
- Carichi da app.
- Modifica quantità inventario da admin.
- Supabase / Google Sheets (in modalità locale).
