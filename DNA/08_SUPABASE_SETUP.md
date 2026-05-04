# Supabase Setup

Ultimo aggiornamento: **04/05/2026 — CEST**.

---

## Progetto attivo

- ID progetto: `aezqtgadyaxdcptwlpci`
- Organizzazione: `enoteca-italiana`
- Piano: Free tier
- Branch collegato: `enoteca-italiana/gestionale` → `main`

### Nota free tier

Il progetto viene messo in **pausa automatica** dopo 7 giorni senza attività.
Soluzione implementata: keepalive doppio (hook React ogni 24h + GitHub Actions cron ogni 3 giorni).
Se l'app mostra `ERR_NAME_NOT_RESOLVED`: riattivare manualmente dal dashboard Supabase.

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

---

## RPC

### `submit_discharge_session(p_session_id uuid)`

Procedura atomica eseguita alla conferma sessione:

1. Verifica che la sessione esista e sia `pending`
2. Aggiorna `wines.qty` sottraendo le quantità degli item
3. Imposta `status = 'submitted'`, `submitted_at = now()`, `total_qty = sum(items.qty)`
4. Risultato: la sessione è definitivamente inviata

---

## Trigger DB

### `BEFORE INSERT OR UPDATE` su `public.wines`

- Normalizza `name`, `origin` → `UPPER(TRIM(...))`
- Normalizza `category`, `producer` → `INITCAP(LOWER(TRIM(...)))`
- Calcola `warehouse = purchase_price * qty`
- Calcola `margin = sale_price - purchase_price`
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

Security advisor: `search_path` fix applicato il 03/05/2026 via psql. Grant UPDATE corretti.

---

## Trigger DB

### `AFTER INSERT OR UPDATE OR DELETE` su `public.wines` — Google Sheets

Funzione: `integration.notify_google_sheets_wines()`. Invia una notifica HTTP POST a un webhook
Google Apps Script configurato in `integration.runtime_config`:

- `google_sheets_webhook_url`: URL dello script GAS (configurato)
- `google_sheets_webhook_secret`: segreto per autenticare la richiesta (configurato)

Se l'URL è vuoto, emette un WARNING e continua senza errore (fail-safe).

---

## Indici

Indici B-Tree su campi filtro principali: `category`, `producer`, `origin`, `qty`, `threshold`.
Indice funzionale su `lower(name)` per ricerche case-insensitive.
Indici compositi su `discharge_sessions(status, created_at DESC)` e `(status, submitted_at DESC)`.

Dimensione totale DB (pubblico): ~3.4 MB — di cui `wines` ~3.2 MB (dati + indici).

Script cleanup indici duplicati: `scripts/sql/supabase_enterprise_index_cleanup.sql`

---

## Script SQL operativi (versionati)

| File                                                | Descrizione                                               |
| --------------------------------------------------- | --------------------------------------------------------- |
| `scripts/sql/supabase_enterprise_index_cleanup.sql` | Rimuove indici duplicati su session items, esegue ANALYZE |
| `scripts/sql/supabase_text_casing_policy.sql`       | Trigger normalizzazione campi + retroattivo su wines      |

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
