# Supabase Setup

Ultimo aggiornamento: **07/04/2026 15:35 CEST**.

## Stato attuale

Setup Supabase eseguito con successo su progetto `aezqtgadyaxdcptwlpci`.

## Rebuild da zero (nuovo)

In caso di rigenerazione completa Supabase su nuovo PC/account:

1. usare account GitHub corretto `enoteca-italiana`;
2. creare nuovo progetto Supabase (org `enoteca-italiana`);
3. collegare GitHub Integration al repo `enoteca-italiana/gestionale` (branch `main`);
4. rieseguire setup SQL completo (ordine script sotto);
5. aggiornare variabili app frontend (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`);
6. aggiornare Script Properties Google Apps Script (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `WEBHOOK_SECRET`, `SHEET_NAME`);
7. rieseguire test bidirezionale App <-> Supabase <-> Google Sheet.

Riferimento operativo completo:

- `Refactoring supabase.md` (root progetto)

## Security hardening (25/03/2026)

Risoluzione completa alert Security Advisor su ambiente production:

- stato finale advisor: `0 errors`, `0 warnings`, `0 info`.
- alert critico risolto: `RLS Disabled in Public` su:
  - `public.categories`
  - `public.categories_backup_20260313`
  - `public.origins`

Decisioni applicate in base al codice runtime reale:

- `public.categories`:
  - usate dal frontend con chiave anon per flussi registry admin;
  - RLS abilitata;
  - grants/policy ridotti a minimo necessario per `anon`:
    - `SELECT`, `INSERT`, `DELETE`
  - negati `UPDATE`, `TRUNCATE`, `REFERENCES`, `TRIGGER` e ogni accesso `authenticated` non necessario.
- `public.origins`:
  - non interrogata runtime via Supabase dal frontend corrente;
  - mantenuta chiusa al pubblico con RLS abilitata.
- `public.categories_backup_20260313`:
  - trattata come tabella backup non runtime;
  - mantenuta chiusa al pubblico con RLS abilitata.

Hardening aggiuntivo eseguito:

- risolti warning `Function Search Path Mutable` impostando `search_path` esplicito sulle funzioni segnalate;
- estensione `pg_trgm` spostata da `public` a schema `extensions`;
- policy `RLS Policy Always True` sostituite con policy esplicite a ruolo (`auth.role() = 'anon'`) sulle tabelle applicative coinvolte;
- per tabelle volutamente chiuse (`origins`, `categories_backup_20260313`) aggiunte deny-policy esplicite per eliminare l'info `RLS Enabled No Policy`.

Conferme principali:

- tabella `public.wines` creata e allineata al codice frontend.
- vincoli business attivi (`qty >= 0`, `threshold null or 1..99`, prezzi non negativi).
- trigger attivo per normalizzazione/calcoli (`warehouse`, `margin`, `updated_at`).
- RLS attivo sulle tabelle applicative con policy allineate ai percorsi runtime reali.
- privilegi tabella/policy allineati con principio di minimo privilegio (least privilege).
- indici principali presenti (`name`, `category`, `producer`, `origin`, `qty`).
- seed SQL (`SCRIPT 08`) disponibile ma opzionale.
  - nel riallineamento del 07/04/2026 è stato **saltato** per preservare dataset reale già presente su Foglio/App.
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
- Nota Scarico:
  - modulo runtime rimosso dal frontend (`/` e `/admina`);
  - eventuali tabelle/RPC legacy `discharge_notes*` possono restare presenti a DB senza essere usate dal codice corrente.

## Variabili ambiente usate dall'app

Lato frontend (uniche lette dal codice):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Valori correnti:

- `VITE_SUPABASE_URL=https://aezqtgadyaxdcptwlpci.supabase.co`
- `VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlenF0Z2FkeWF4ZGNwdHdscGNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1NTE3MzYsImV4cCI6MjA5MTEyNzczNn0.XHygA3zVLT10OICJMsKJ8EmVK1-VUkIop9jFG4aZciQ`

Riferimento codice:

- `apps/scarichi-vini/src/lib/supabase.ts`

## Script SQL operativi

Stato repository:

- è presente script SQL versionato per cleanup performance indici:
  - `scripts/sql/supabase_enterprise_index_cleanup.sql`
- è presente script SQL versionato per policy casing campi vino:
  - `scripts/sql/supabase_text_casing_policy.sql`
- gli altri script operativi restano disponibili via SQL Editor/chat operativa.

### Webhook Supabase -> Google Sheets (nuovo)

Sul database è previsto trigger dedicato su `public.wines`:

- `trg_wines_notify_google_sheets`
  - `AFTER INSERT OR UPDATE OR DELETE`
  - funzione `integration.notify_google_sheets_wines()`

Questo trigger invia evento verso Apps Script Web App per refresh del foglio.
Script SQL completo e checklist nel file:

- `Refactoring supabase.md`

Stato verifica operativa (07/04/2026):

- trigger `trg_wines_before_write` presente;
- trigger `trg_wines_notify_google_sheets` presente;
- colonne snapshot sessioni verificate su `public.discharge_session_items`:
  - `wine_name`, `wine_age`, `wine_producer`, `wine_origin`, `wine_category`;
  - `wine_id` nullable `YES`.

Policy SQL obbligatoria su insert/update record vino:

- `category`, `name`, `origin` => `UPPER(...)`
- `producer` => `INITCAP(LOWER(...))`
- sempre con `TRIM` + normalizzazione spazi.

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

### Migrazione rimozione Fornitore (nuova)

Stato runtime attuale: il campo `fornitore/supplier` non è più usato dall'applicazione.

- il frontend non legge/scrive più `public.wines.supplier`;
- i registry frontend sono limitati a `categories`, `producers`, `origins`.

Nota: eventuali colonne/tabelle legacy (`public.wines.supplier`, `public.suppliers`) possono restare presenti a DB senza impatto runtime.

### Migrazione indipendenza storico/archivio (nuova)

Per abilitare `Reset archivio` senza perdere/stressare lo storico sessioni:

1. eseguire in SQL Editor lo script migrazione indipendenza storico/archivio concordato in chat/procedura operativa;
2. verificare su `public.discharge_session_items`:
   - colonne snapshot presenti (`wine_name`, `wine_age`, `wine_producer`, `wine_origin`, `wine_category`);
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

- indici B-Tree sui campi filtro principali (`category`, `producer`, `origin`, `qty`, `threshold`);
- indice funzionale su `lower(name)` per ricerche case-insensitive;
- opzionale: `pg_trgm` + GIN su `name` per ricerche testuali parziali più rapide.

### Cleanup indici duplicati (raccomandato)

Con dataset ampi e molte scritture, evitare indici duplicati sulle stesse colonne.

Script pronto:

- `scripts/sql/supabase_enterprise_index_cleanup.sql`

Effetti:

- rimuove indici duplicati su `discharge_session_items(session_id)`, `discharge_session_items(wine_id)`.
- preserva gli indici univoci e quelli realmente usati;
- esegue `ANALYZE` finale per riallineare planner statistiche.

## Sicurezza (obbligatorio)

Dopo i test, ruotare:

- `SUPABASE_SERVICE_ROLE_KEY`
- password DB
- consigliato anche `VITE_SUPABASE_ANON_KEY`

Non committare mai chiavi segrete nel repository.

## Nota integrazione GitHub/Supabase (operativa)

Se in Supabase `Settings -> Integrations` il repository non compare:

1. verificare installazione GitHub App `Supabase` su account/org corretto;
2. in GitHub App impostare `Only select repositories` e selezionare `enoteca-italiana/gestionale`;
3. salvare su GitHub e poi refresh forzato pagina Supabase Integrations;
4. in caso di redirect OAuth bloccato su “Completing GitHub Authorization...”, completare prima save permessi GitHub e poi ricaricare Supabase.
