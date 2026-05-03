# Supabase Setup

Ultimo aggiornamento: **02/05/2026 — CEST**.

---

## Progetto attivo

- ID progetto: `ndrgcfyoiyychjukhrno`
- Organizzazione: `enoteca-italiana`
- Piano: Free tier
- Branch collegato: `enoteca-italiana/gestionale` → `main`

### Nota free tier

Il progetto viene messo in **pausa automatica** dopo 7 giorni senza attività.
Soluzione implementata: keepalive doppio (hook React ogni 24h + GitHub Actions cron ogni 3 giorni).
Se l'app mostra `ERR_NAME_NOT_RESOLVED`: riattivare manualmente dal dashboard Supabase.

---

## Variabili ambiente

Solo queste due chiavi vengono lette dal codice frontend:

```
VITE_SUPABASE_URL=https://ndrgcfyoiyychjukhrno.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
```

File: `apps/scarichi-vini/.env.local` (non committato).
Riferimento codice: `src/lib/supabase.ts` — crea il client Supabase, restituisce `null` se le variabili sono assenti (fallback localStorage puro).

---

## Schema DB — Tabelle principali

### `public.wines`

| Colonna | Tipo | Note |
|---|---|---|
| `id` | uuid | PK, default `gen_random_uuid()` |
| `category` | text nullable | UPPERCASE (trigger) |
| `name` | text NOT NULL | UPPERCASE (trigger) |
| `age` | text nullable | anno vendemmia, stringa libera |
| `producer` | text NOT NULL | Initcap (trigger) |
| `origin` | text NOT NULL | UPPERCASE (trigger) |
| `threshold` | integer nullable | CHECK: null oppure 1..99 |
| `purchase_price` | numeric(10,2) nullable | CHECK: >= 0 |
| `sale_price` | numeric(10,2) nullable | CHECK: >= 0 |
| `vintage` | text nullable | campo legacy |
| `qty` | integer NOT NULL | CHECK: >= 0, default 0 |
| `warehouse` | numeric(10,2) nullable | calcolato: purchase_price × qty (trigger) |
| `margin` | numeric(10,2) nullable | calcolato: sale_price − purchase_price (trigger) |
| `notes` | text nullable | |
| `updated_at` | timestamptz | aggiornato automaticamente da trigger |

### `public.discharge_sessions`

| Colonna | Tipo | Note |
|---|---|---|
| `id` | uuid | PK |
| `status` | text | `'pending'`, `'submitted'`, `'cancelled'` |
| `created_at` | timestamptz | |
| `submitted_at` | timestamptz nullable | impostato da RPC |
| `total_qty` | integer nullable | somma bottiglie (calcolato da RPC) |
| `source` | text | `'web'` |

### `public.discharge_session_items`

| Colonna | Tipo | Note |
|---|---|---|
| `session_id` | uuid | FK → `discharge_sessions.id` |
| `wine_id` | uuid nullable | FK → `wines.id` ON DELETE SET NULL |
| `qty` | integer | |
| `wine_name` | text nullable | snapshot al momento scarico |
| `wine_age` | text nullable | snapshot |
| `wine_producer` | text nullable | snapshot |
| `wine_origin` | text nullable | snapshot |
| `wine_category` | text nullable | snapshot |

Nota critica: `wine_id` è **nullable** con `ON DELETE SET NULL`. Questo garantisce che lo storico resti leggibile anche dopo cancellazione del vino dall'archivio. I campi `wine_*` contengono lo snapshot immutabile del vino al momento dello scarico.

### `public.categories`

Registry categorie gestite. RLS abilitata con policy `SELECT/INSERT/DELETE` per `anon`.

### `public.producers` / `public.origins`

Registry produttori e provenienze. Gestiti principalmente in cache locale frontend.

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

- Normalizza `name`, `category`, `origin` → `UPPER(TRIM(...))`
- Normalizza `producer` → `INITCAP(LOWER(TRIM(...)))`
- Calcola `warehouse = purchase_price * qty`
- Calcola `margin = sale_price - purchase_price`
- Aggiorna `updated_at = now()`

---

## RLS (Row Level Security)

| Tabella | RLS | Policy anon |
|---|---|---|
| `public.wines` | Abilitata | SELECT, INSERT, UPDATE, DELETE |
| `public.discharge_sessions` | Abilitata | SELECT, INSERT, UPDATE |
| `public.discharge_session_items` | Abilitata | SELECT, INSERT |
| `public.categories` | Abilitata | SELECT, INSERT, DELETE |
| `public.origins` | Abilitata | Deny-policy (chiusa) |
| `public.categories_backup_20260313` | Abilitata | Deny-policy (chiusa) |

Security advisor: `0 errors, 0 warnings, 0 info` (stato al 25/03/2026).

---

## Indici

Indici B-Tree su campi filtro principali: `category`, `producer`, `origin`, `qty`, `threshold`.
Indice funzionale su `lower(name)` per ricerche case-insensitive.

Script cleanup indici duplicati: `scripts/sql/supabase_enterprise_index_cleanup.sql`

---

## Script SQL operativi (versionati)

| File | Descrizione |
|---|---|
| `scripts/sql/supabase_enterprise_index_cleanup.sql` | Rimuove indici duplicati su session items, esegue ANALYZE |
| `scripts/sql/supabase_text_casing_policy.sql` | Trigger normalizzazione campi + retroattivo su wines |

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
