# Supabase Setup

Ultimo aggiornamento: **04/05/2026 — CEST**.

---

## Progetto attivo

- ID progetto: `aezqtgadyaxdcptwlpci`
- Organizzazione: `enoteca-italiana`
- Piano: Free tier
- Branch collegato: `enoteca-italiana/gestionale` → `main`

### Nota free tier

Vincoli operativi rilevanti del piano Free per questo progetto:

- `500 MB` database per progetto
- `1 GB` storage
- compute `Nano`
- `60` connessioni DB dirette / `200` pooler
- progetto free pausabile; è attivo un keepalive applicativo/infrastrutturale per ridurre il rischio di pausa da inattività

Soluzione implementata: keepalive doppio (hook React periodico + GitHub Actions cron ogni 3 giorni).

### Snapshot stato verificato

Audit diretto validato il `04/05/2026`:

- `wines`: `6382`
- `spirits_products`: `1684`
- `spirits_sessions`: `0`
- `spirits_session_items`: `0`

Questo snapshot è utile come riferimento iniziale per un nuovo PC o una nuova verifica.

---

## Gestione Egress (banda Supabase Free Tier)

**Limite gratuito:** 5 GB/mese di egress (tutto il traffico in uscita).

### Causa principale di egress elevato

La pagina `/admina` (Archivio vini) chiamava `listWines({ forceRemote: true })` ad ogni mount,
scaricando tutti i ~6000+ vini dal DB senza limite di frequenza. Con uso intenso in sviluppo,
questo ha causato 8.28 GB di egress nel ciclo aprile 2026 (166% del limite).

### Soluzione implementata — TTL 10 minuti

`src/data/wineRepository.ts` espone il parametro `skipTtl`:

```ts
export async function listWines(options?: {
  forceRemote?: boolean;
  skipTtl?: boolean; // bypassa TTL quando dati aggiornati sono necessari (es. import)
}): Promise<Wine[]>;
```

Comportamento:

- `forceRemote: true` (default pages): rispetta TTL 10 min — nessuna fetch se sync recente
- `skipTtl: true`: bypassa il TTL (pulsante Aggiorna manuale in HomePage)
- Prima fetch (localStorage vuoto): ignora TTL, scarica sempre da Supabase

### Regole operative per mantenere egress basso

1. Evitare navigazioni ripetute su `/admina` durante lo sviluppo attivo
2. Non usare `forceRemote: true` + `skipTtl: true` in loop o automaticamente
3. Monitorare: Dashboard Supabase → Settings → Usage (cycle corrente)
4. Se quota quasi esaurita: ridurre testing su `/admina`, il ciclo si resetta ogni mese

### Warning Security Advisor Supabase

**APPLICATO il 03/05/2026 via psql diretto** (script: `scripts/fix_security_warnings.sql`):

```sql
-- Fix search_path mutable
ALTER FUNCTION public.wines_before_write() SET search_path = public, pg_temp;
ALTER FUNCTION public.submit_discharge_session(p_session_id uuid) SET search_path = public, pg_temp;

-- Fix GRANT UPDATE mancante per ruolo anon (causava HTTP 401 su PATCH REST API)
GRANT UPDATE ON public.discharge_sessions TO anon;
GRANT UPDATE ON public.discharge_session_items TO anon;
GRANT UPDATE ON public.categories TO anon;
```

Dopo esecuzione: i warning nel Security Advisor scompaiono.

### Bug Grant UPDATE (risolto il 03/05/2026)

Le RLS policy UPDATE per `anon` esistevano su `discharge_sessions` e `discharge_session_items`
ma il GRANT a livello tabella era assente. Questo causava `error 42501 "permission denied"`
su qualsiasi PATCH via REST API con anon key. Fix: `GRANT UPDATE ... TO anon` applicato.
La RPC `submit_discharge_session` non era affetta (è `SECURITY DEFINER`, bypassa RLS).

---

## Variabili ambiente

Solo queste due chiavi vengono lette dal codice frontend:

```
VITE_SUPABASE_URL=https://aezqtgadyaxdcptwlpci.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
```

Configurazione: secret Replit `SUPABASE_URL` + `SUPABASE_ANON_KEY`. In produzione: variabili ambiente Cloudflare Pages.
Riferimento codice: `src/lib/supabase.ts` — crea il client Supabase, restituisce `null` se le variabili sono assenti (fallback localStorage puro).
Nota aggiornata `04/05/2026`: il client frontend normalizza automaticamente URL configurate con suffisso errato `/rest/v1/`, così evita path REST duplicati in locale.

---

## Schema DB — Tabelle principali

### `public.wines`

| Colonna          | Tipo                   | Note                                             |
| ---------------- | ---------------------- | ------------------------------------------------ |
| `id`             | uuid                   | PK, default `gen_random_uuid()`                  |
| `category`       | text nullable          | Initcap (trigger)                                |
| `name`           | text NOT NULL          | UPPERCASE (trigger)                              |
| `age`            | text nullable          | anno vendemmia, stringa libera                   |
| `producer`       | text NOT NULL          | Initcap (trigger)                                |
| `origin`         | text NOT NULL          | UPPERCASE (trigger)                              |
| `threshold`      | integer nullable       | CHECK: null oppure 1..99                         |
| `purchase_price` | numeric(10,2) nullable | CHECK: >= 0                                      |
| `sale_price`     | numeric(10,2) nullable | CHECK: >= 0                                      |
| `vintage`        | text nullable          | campo legacy                                     |
| `qty`            | integer NOT NULL       | CHECK: >= 0, default 0                           |
| `warehouse`      | numeric(10,2) nullable | calcolato: purchase_price × qty (trigger)        |
| `margin`         | numeric(10,2) nullable | calcolato: sale_price − purchase_price (trigger) |
| `notes`          | text nullable          |                                                  |
| `updated_at`     | timestamptz            | aggiornato automaticamente da trigger            |

### `public.discharge_sessions`

| Colonna        | Tipo                 | Note                                      |
| -------------- | -------------------- | ----------------------------------------- |
| `id`           | uuid                 | PK                                        |
| `status`       | text                 | `'pending'`, `'submitted'`, `'cancelled'` |
| `created_at`   | timestamptz          |                                           |
| `submitted_at` | timestamptz nullable | impostato da RPC                          |
| `total_qty`    | integer nullable     | somma bottiglie (calcolato da RPC)        |
| `source`       | text                 | `'web'`                                   |

### `public.discharge_session_items`

| Colonna         | Tipo          | Note                               |
| --------------- | ------------- | ---------------------------------- |
| `session_id`    | uuid          | FK → `discharge_sessions.id`       |
| `wine_id`       | uuid nullable | FK → `wines.id` ON DELETE SET NULL |
| `qty`           | integer       |                                    |
| `wine_name`     | text nullable | snapshot al momento scarico        |
| `wine_age`      | text nullable | snapshot                           |
| `wine_producer` | text nullable | snapshot                           |
| `wine_origin`   | text nullable | snapshot                           |
| `wine_category` | text nullable | snapshot                           |

Nota critica: `wine_id` è **nullable** con `ON DELETE SET NULL`. Questo garantisce che lo storico resti leggibile anche dopo cancellazione del vino dall'archivio. I campi `wine_*` contengono lo snapshot immutabile del vino al momento dello scarico.

### `public.categories`

Registry categorie gestite. RLS abilitata con policy `SELECT/INSERT/UPDATE/DELETE` per `anon`.
Valori presenti: `ROSSI` (id=1), `BIANCHI` (id=3).

### `public.origins` / `public.suppliers`

Tabelle legacy vuote (0 righe). RLS policy `DENY ALL` per anon e authenticated.
Non usate dal frontend (produttori e provenienze gestiti in localStorage).
Mantenute per compatibilità schema.

### `public.spirits_products`

Stato verificato via SQL Editor il `04/05/2026`.

| Colonna          | Tipo                 | Note                                             |
| ---------------- | -------------------- | ------------------------------------------------ |
| `id`             | uuid                 | PK, default `gen_random_uuid()`                  |
| `category`       | text nullable        | Initcap (trigger)                                |
| `name`           | text NOT NULL        | UPPERCASE (trigger)                              |
| `producer`       | text NOT NULL        | Initcap (trigger)                                |
| `purchase_price` | numeric nullable     | CHECK: >= 0                                      |
| `sale_price`     | numeric nullable     | CHECK: >= 0                                      |
| `qty`            | integer NOT NULL     | CHECK: >= 0, default 0                           |
| `warehouse`      | numeric nullable     | calcolato: purchase_price × qty (trigger)        |
| `margin`         | numeric nullable     | calcolato: sale_price − purchase_price (trigger) |
| `updated_at`     | timestamptz NOT NULL | aggiornato automaticamente da trigger            |
| `threshold`      | integer nullable     | presente e verificato in produzione              |

### `public.spirits_sessions`

| Colonna        | Tipo                 | Note                                      |
| -------------- | -------------------- | ----------------------------------------- |
| `id`           | uuid                 | PK                                        |
| `status`       | text                 | `'pending'`, `'submitted'`, `'cancelled'` |
| `created_at`   | timestamptz          |                                           |
| `submitted_at` | timestamptz nullable | impostato da RPC                          |
| `total_qty`    | integer nullable     | somma bottiglie (calcolato da RPC)        |
| `source`       | text                 | default `'web'`                           |

### `public.spirits_session_items`

| Colonna           | Tipo          | Note                        |
| ----------------- | ------------- | --------------------------- |
| `id`              | uuid          | PK                          |
| `session_id`      | uuid          | FK → `spirits_sessions.id`  |
| `spirit_id`       | uuid nullable | FK → `spirits_products.id`  |
| `qty`             | integer       | CHECK: > 0                  |
| `spirit_name`     | text nullable | snapshot al momento scarico |
| `spirit_producer` | text nullable | snapshot                    |
| `spirit_category` | text nullable | snapshot                    |

---

## RPC

### `submit_discharge_session(p_session_id uuid)`

Procedura atomica eseguita alla conferma sessione:

1. Verifica che la sessione esista e sia `pending`
2. Aggiorna `wines.qty` sottraendo le quantità degli item
3. Imposta `status = 'submitted'`, `submitted_at = now()`, `total_qty = sum(items.qty)`
4. Risultato: la sessione è definitivamente inviata

### `submit_spirits_session(p_session_id uuid)`

Stato verificato via SQL Editor il `04/05/2026`.

1. Verifica che la sessione Spirits esista e sia `pending`
2. Blocca il submit se lo stock andrebbe in negativo
3. Aggiorna `spirits_products.qty` sottraendo le quantità degli item
4. Imposta `status = 'submitted'`, `submitted_at = now()`, `total_qty = sum(items.qty)`

---

## Trigger DB

### `BEFORE INSERT OR UPDATE` su `public.wines`

- Normalizza `name`, `origin` → `UPPER(TRIM(...))`
- Normalizza `category`, `producer` → `INITCAP(LOWER(TRIM(...)))`
- Calcola `warehouse = purchase_price * qty`
- Calcola `margin = sale_price - purchase_price`
- Non forza ancora `sale_price = purchase_price * 1.3`: questa regola è oggi garantita lato app/repository, non ancora dal trigger DB
- Aggiorna `updated_at = now()`

### `BEFORE INSERT OR UPDATE` su `public.spirits_products`

- Normalizza `name` → `UPPER(TRIM(...))`
- Normalizza `category`, `producer` → `INITCAP(LOWER(TRIM(...)))`
- Calcola `warehouse = purchase_price * qty`
- Calcola `margin = sale_price - purchase_price`
- Non forza ancora `sale_price = purchase_price * 1.3`: questa regola è oggi garantita lato app/repository, non ancora dal trigger DB
- Aggiorna `updated_at = now()`

---

## RLS (Row Level Security)

| Tabella                          | RLS       | Grant anon                      | Note                        |
| -------------------------------- | --------- | ------------------------------- | --------------------------- |
| `public.wines`                   | Abilitata | SELECT, INSERT, UPDATE, DELETE  |                             |
| `public.discharge_sessions`      | Abilitata | SELECT, INSERT, UPDATE, DELETE  | UPDATE grant aggiunto 03/05 |
| `public.discharge_session_items` | Abilitata | SELECT, INSERT, UPDATE, DELETE  | UPDATE grant aggiunto 03/05 |
| `public.categories`              | Abilitata | SELECT, INSERT, UPDATE, DELETE  | UPDATE grant aggiunto 03/05 |
| `public.origins`                 | Abilitata | Deny ALL (chiusa, legacy vuota) |                             |
| `public.suppliers`               | Abilitata | Deny ALL (chiusa, legacy vuota) |                             |
| `public.spirits_products`        | Abilitata | SELECT, INSERT, UPDATE, DELETE  | verificata 04/05            |
| `public.spirits_sessions`        | Abilitata | SELECT, INSERT, UPDATE, DELETE  | verificata 04/05            |
| `public.spirits_session_items`   | Abilitata | SELECT, INSERT, UPDATE, DELETE  | verificata 04/05            |

Security advisor: `search_path` fix applicato il 03/05/2026 via psql. Grant UPDATE corretti.

---

## Trigger DB

### `AFTER INSERT OR UPDATE OR DELETE` su `public.wines` — Google Sheets

Funzione: `integration.notify_google_sheets_wines()`. Invia una notifica HTTP POST a un webhook
Google Apps Script configurato in `integration.runtime_config`:

- `google_sheets_webhook_url`: URL dello script GAS (configurato)
- `google_sheets_webhook_secret`: segreto per autenticare la richiesta (configurato)

Se l'URL è vuoto, emette un WARNING e continua senza errore (fail-safe).

### `AFTER INSERT OR UPDATE OR DELETE` su `public.spirits_products` — Google Sheets

Stato verificato/applicato il `04/05/2026`.

Funzione: `integration.notify_google_sheets_spirits()`.

Trigger attivo:

- `trg_spirits_notify_google_sheets`

Config condivisa in `integration.runtime_config`:

- `google_sheets_webhook_url`: presente
- `google_sheets_webhook_secret`: presente

Nota:

- lato Supabase il webhook Spirits è attivo;
- lato Google Apps Script è ora presente uno script unico che distingue `wines` da `spirits_products`;
- sorgente versionato nel repo: `scripts/google-apps-script/enoteca_sync.gs`.

Regola operativa importante:

- `syncWinesFromSheetToSupabase` / `syncSpiritsFromSheetToSupabase` = foglio -> database
- `syncWinesFromSupabaseToSheet` / `syncSpiritsFromSupabaseToSheet` = database -> foglio

I vecchi trigger installabili Apps Script (`syncFromSheetToSupabase`, `syncFromSupabaseToSheet`) sono stati rimossi perché legacy e non compatibili con lo script attuale.

### Audit sync Google del 11/05/2026

Verifiche SQL eseguite in sola lettura:

- `integration.runtime_config.google_sheets_webhook_url` presente, lunghezza 114, URL Web App valido con suffisso `/exec`;
- `integration.runtime_config.google_sheets_webhook_secret` presente, lunghezza 29;
- trigger DB presenti e abilitati:
  - `public.wines` -> `trg_wines_notify_google_sheets` -> `integration.notify_google_sheets_wines`;
  - `public.spirits_products` -> `trg_spirits_notify_google_sheets` -> `integration.notify_google_sheets_spirits`;
- le funzioni `notify_google_sheets_*` inviano payload JSON con `source`, `table`, `op`, `id`, `secret`, `timestamp`, coerente con `doPost(e)` di Apps Script;
- ultimo `updated_at` rilevato: `wines` 04/05/2026 12:24 UTC, `spirits_products` 04/05/2026 14:44 UTC. Questo indica che le modifiche fatte solo sul foglio Google non stavano arrivando a Supabase.

Stato Apps Script osservato:

- schermata "Attivatori" con `0 attivatori`;
- quindi il verso automatico Google Sheet -> Supabase non e' attivo;
- il verso Google Sheet -> Supabase e' disponibile solo tramite menu manuale (`Push ... da Foglio`).

Audit CSV esportati dal foglio:

- `Listino Ufficiale enoteca - Vini (1).csv`: 7234 righe dati, nessuna colonna `__ID__`, 72 righe con campi critici vuoti, 27 duplicati naturali;
- `Listino Ufficiale enoteca - Spirits (2).csv`: 1692 righe dati, nessuna colonna `__ID__`, 6 righe con nome/produttore vuoto, 6 duplicati naturali.

Conclusione tecnica:

- per una sync bidirezionale sicura serve una colonna `__ID__` stabile su entrambi i tab;
- non usare `nome + produttore` come chiave primaria: i duplicati naturali rendono questa chiave non affidabile;
- con ~9000 record e Supabase Free, evitare full sync automatici frequenti: preferire dirty-row/snapshot mirato e full sync manuale controllato.

---

## Indici

Indici B-Tree su campi filtro principali: `category`, `producer`, `origin`, `qty`, `threshold`.
Indice funzionale su `lower(name)` per ricerche case-insensitive.
Indici compositi su `discharge_sessions(status, created_at DESC)` e `(status, submitted_at DESC)`.

Per `spirits_products` sono verificati:

- `idx_spirits_products_category`
- `idx_spirits_products_producer`
- `idx_spirits_products_qty`
- `idx_spirits_products_threshold`
- `idx_spirits_products_name_lower`

Per `spirits_sessions` / `spirits_session_items` sono verificati:

- `idx_spirits_sessions_status_created`
- `idx_spirits_sessions_status_submitted`
- `idx_spirits_session_items_session`
- `idx_spirits_session_items_spirit`

Dimensione totale DB (pubblico): ~3.4 MB — di cui `wines` ~3.2 MB (dati + indici).

Script cleanup indici duplicati: `scripts/sql/supabase_enterprise_index_cleanup.sql`

---

## Script SQL operativi (versionati)

| File                                                  | Descrizione                                                                                                                        |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `scripts/sql/supabase_enterprise_index_cleanup.sql`   | Rimuove indici duplicati su session items, esegue ANALYZE                                                                          |
| `scripts/sql/supabase_text_casing_policy.sql`         | Trigger normalizzazione campi + retroattivo su wines                                                                               |
| `scripts/sql/2026-05-04_spirits_domain_setup.sql`     | Setup tabelle Spirits (`spirits_products`, `spirits_sessions`, `spirits_session_items`) + RPC `submit_spirits_session` + RLS/GRANT |
| `scripts/sql/2026-05-04_spirits_threshold_enable.sql` | Migrazione incrementale: aggiunge `threshold` a `spirits_products` + CHECK + indice                                                |

---

## Ordine setup da zero

Se si rigenera il progetto Supabase su nuovo account:

1. `SCRIPT 01` — create table `wines`
2. `SCRIPT 02` — add missing columns
3. `SCRIPT 03` — constraints (qty >= 0, threshold, prezzi)
4. `SCRIPT 04A` — trigger function (normalizzazione + calcoli)
5. `SCRIPT 04B` — trigger attach (BEFORE INSERT OR UPDATE)
6. `SCRIPT 05` — backfill + normalizzazione retroattiva
7. `SCRIPT 06A` — enable RLS su tutte le tabelle
8. `SCRIPT 06B` — policies + grants anon
9. `SCRIPT 07` — indexes
10. `SCRIPT 08` — seed upsert (vini iniziali)
11. `SCRIPT 09A/09B` — check finale (conteggi attesi)
12. Migrazione indipendenza storico: `wine_id` nullable + FK `ON DELETE SET NULL`
13. `supabase_text_casing_policy.sql` — trigger casing + normalizzazione retroattiva

---

## Verifica finale

```sql
SELECT
  count(*) as total_wines,
  count(*) filter (where qty = 0) as out_of_stock,
  count(*) filter (where threshold is not null and qty <= threshold) as in_threshold
FROM public.wines;
```

Valori attesi post-seed: `total_wines = 20`.

---

## Integrazione GitHub/Supabase

Se il repository non compare in `Settings → Integrations`:

1. Installare GitHub App `Supabase` sull'organizzazione `enoteca-italiana`
2. Impostare `Only select repositories` → selezionare `enoteca-italiana/gestionale`
3. Salvare su GitHub, poi refresh forzato pagina Supabase Integrations

---

## Sicurezza

- Non committare mai `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` o password DB nel repository.
- Ruotare `SUPABASE_SERVICE_ROLE_KEY` e password DB dopo operazioni manuali.
- Campo `supplier/fornitore`: colonna legacy a DB, non letta né scritta dal frontend corrente.
