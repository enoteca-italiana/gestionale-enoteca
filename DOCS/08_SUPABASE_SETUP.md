# Supabase Setup

Ultimo aggiornamento: **13/03/2026 03:12 CET**.

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

## Integrazione frontend completata

- Home conferma sessione:
  - crea sessione + items su Supabase
  - invoca RPC `submit_discharge_session`
- Admin sessioni:
  - storico letto da `discharge_sessions.status = 'submitted'`
  - sospesi letti da `discharge_sessions.status = 'pending'`
  - reset/elimina agiscono direttamente su Supabase

## Variabili ambiente usate dall'app

Lato frontend (uniche lette dal codice):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Riferimento codice:

- `apps/scarichi-vini/src/lib/supabase.ts`

## File script SQL operativo

File consigliato per esecuzione uno-a-uno in SQL Editor:

- `sql_subase_copia.sql`

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

## Verifica finale attesa

Query check principale:

- `total_wines = 20`
- `out_of_stock = 1`
- `in_threshold = 6`
- `threshold_empty = 0`

## Sicurezza (obbligatorio)

Dopo i test, ruotare:

- `SUPABASE_SERVICE_ROLE_KEY`
- password DB
- consigliato anche `VITE_SUPABASE_ANON_KEY`

Non committare mai chiavi segrete nel repository.
