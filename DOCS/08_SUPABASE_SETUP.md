# Supabase Setup

Ultimo aggiornamento: **16/03/2026 15:12 CET**.

## Stato attuale

Setup Supabase eseguito con successo su progetto `ndrgcfyoiyychjukhrno`.

Conferme principali:

- tabella `public.wines` creata e allineata al codice frontend.
- vincoli business attivi (`qty >= 0`, `threshold null or 1..99`, prezzi non negativi).
- trigger attivo per normalizzazione/calcoli (`warehouse`, `margin`, `updated_at`).
- RLS attivo con policy CRUD per `anon` e `authenticated`.
- privilegi tabella corretti: solo `SELECT`, `INSERT`, `UPDATE`, `DELETE`.
- indici principali presenti (`name`, `category`, `producer`, `origin`, `qty`).
- seed caricato: `20` vini.
- routine RPC presente: `submit_discharge_session`.
- tabelle sessioni presenti:
  - `public.discharge_sessions`
  - `public.discharge_session_items`
- modulo Nota Scarico presente:
  - tabelle:
    - `public.discharge_notes`
    - `public.discharge_note_items`
  - RPC:
    - `save_discharge_note_draft`
    - `confirm_discharge_note_draft`
    - `start_ready_discharge_note`
    - `complete_in_progress_discharge_note`
    - `get_discharge_note_state`

## Integrazione frontend completata

- Home conferma sessione:
  - crea sessione + items su Supabase
  - invoca RPC `submit_discharge_session`
- Admin sessioni:
  - storico letto da `discharge_sessions.status = 'submitted'`
  - sospesi letti da `discharge_sessions.status = 'pending'`
  - reset/elimina agiscono direttamente su Supabase
- Nota Scarico:
  - archivio salva bozza su RPC `save_discharge_note_draft`
  - conferma bozza su RPC `confirm_discharge_note_draft`
  - Home avvia nota pronta con RPC `start_ready_discharge_note`
  - submit sessione chiude nota con RPC `complete_in_progress_discharge_note`
  - stato UI archivio/home letto da RPC `get_discharge_note_state`

## Variabili ambiente usate dall'app

Lato frontend (uniche lette dal codice):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Riferimento codice:

- `apps/scarichi-vini/src/lib/supabase.ts`

## Script SQL operativi

Stato repository:

- è presente script SQL versionato per cleanup performance indici:
  - `scripts/sql/supabase_enterprise_index_cleanup.sql`
- gli altri script operativi restano disponibili via SQL Editor/chat operativa.

Script Nota Scarico (operativi in SQL Editor):

1. `SCRIPT 1` schema + RLS (`discharge_notes`, `discharge_note_items`)
2. `SCRIPT 2` RPC (`save/confirm/start/complete/get_state`)

Ordine esecuzione:

1. `SCRIPT 01` create table
2. `SCRIPT 02` add missing columns
3. `SCRIPT 03` constraints
4. `SCRIPT 04A` trigger function
5. `SCRIPT 04B` trigger attach
6. `SCRIPT 05` backfill + normalizzazione
7. `SCRIPT 06A` enable RLS
8. `SCRIPT 06B` policies + grants
9. `SCRIPT 07` indexes
10. `SCRIPT 08` seed upsert
11. `SCRIPT 09A/09B` check finale

### Migrazione Fornitore (nuova)

Per attivare il nuovo campo `Fornitore` lato archivio vini:

1. eseguire in SQL Editor lo script migrazione `supplier` concordato in chat/procedura operativa;
2. verificare presenza colonna `public.wines.supplier`;
3. verificare tabella `public.suppliers` popolata con i valori distinti già presenti.

### Migrazione indipendenza storico/archivio (nuova)

Per abilitare `Reset archivio` senza perdere/stressare lo storico sessioni:

1. eseguire in SQL Editor lo script migrazione indipendenza storico/archivio concordato in chat/procedura operativa;
2. verificare su `public.discharge_session_items`:
   - colonne snapshot presenti (`wine_name`, `wine_age`, `wine_producer`, `wine_origin`, `wine_category`, `wine_supplier`);
   - `wine_id` nullable (`YES`);
   - FK `discharge_session_items_wine_id_fkey` con `ON DELETE SET NULL`.

## Verifica finale attesa

Query check principale:

- `total_wines = 20`
- `out_of_stock = 1`
- `in_threshold = 6`
- `threshold_empty = 0`

## Performance DB (dataset grandi)

Per migliorare tempi di filtro/ordinamento lato app con migliaia di record, applicare in SQL Editor:

- indici B-Tree sui campi filtro principali (`category`, `producer`, `origin`, `supplier`, `qty`, `threshold`);
- indice funzionale su `lower(name)` per ricerche case-insensitive;
- opzionale: `pg_trgm` + GIN su `name` per ricerche testuali parziali più rapide.

### Cleanup indici duplicati (raccomandato)

Con dataset ampi e molte scritture, evitare indici duplicati sulle stesse colonne.

Script pronto:

- `scripts/sql/supabase_enterprise_index_cleanup.sql`

Effetti:

- rimuove indici duplicati su `discharge_session_items(session_id)`, `discharge_session_items(wine_id)`, `wines(supplier)`;
- preserva gli indici univoci e quelli realmente usati;
- esegue `ANALYZE` finale per riallineare planner statistiche.

## Sicurezza (obbligatorio)

Dopo i test, ruotare:

- `SUPABASE_SERVICE_ROLE_KEY`
- password DB
- consigliato anche `VITE_SUPABASE_ANON_KEY`

Non committare mai chiavi segrete nel repository.
