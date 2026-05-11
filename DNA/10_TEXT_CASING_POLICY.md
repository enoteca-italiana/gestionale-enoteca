# Text Casing Policy (obbligatoria)

Ultimo aggiornamento: **04/05/2026 — CEST**.

---

## Regole vincolanti

Queste regole valgono **sempre** in tutta l'app: input utente, import CSV, visualizzazione, export, script SQL, snapshot sessioni.

| Campo                  | Regola                                           | Esempio             |
| ---------------------- | ------------------------------------------------ | ------------------- |
| `categoria`            | **Initcap** (prima lettera maiuscola per parola) | `Rossi Fermi`       |
| `name` / `provenienza` | **UPPERCASE**                                    | `BAROLO`, `PIEMONT` |
| `produttore`           | **Initcap** (prima lettera maiuscola per parola) | `Giacomo Conterno`  |

---

## Punti di enforcement nel codice

### `src/domain/normalizeWineText.ts`

Funzioni centralizzate, usate ovunque:

| Funzione                   | Comportamento                           |
| -------------------------- | --------------------------------------- |
| `normalizeWineCategory(v)` | `INITCAP(LOWER(trim + collapse spazi))` |
| `normalizeWineName(v)`     | `UPPER(trim + collapse spazi)`          |
| `normalizeWineProducer(v)` | `INITCAP(LOWER(trim + collapse spazi))` |

### `src/domain/normalizeOrigin.ts`

- `normalizeOrigin(v)` → `UPPER(trim + collapse spazi)` per il campo provenienza.

### `src/data/wineRepository.ts`

- `toWine(row)` — normalizza in lettura da Supabase (row → Wine).
- `normalizeInput(input)` — normalizza in scrittura prima di insert/update.
- `toRowPayload(wine)` — normalizza nel payload Supabase per insert/update.
- `toLegacyPayload(wine)` — normalizza nel payload schema legacy.
- `normalizeWineTextFields(wines[])` — normalizzazione bulk (es. post-import).
- `normalizeRegistryValue(field, value)` — per rename categorie/produttori/provenienze.

### `src/data/archiveCsv.ts`

- `parseArchiveCsv(raw)` — normalizza tutti i campi durante il parse del CSV importato.
- `buildArchiveCsv(wines[])` — normalizza in export.

### `src/data/categoryRepository.ts`

- Le categorie vengono sempre salvate in Initcap.

### `src/data/dischargeRepository.ts`

- `createDischargeSession()` — snapshot campi vino normalizzati:
  - `wine_name` → `normalizeWineName`
  - `wine_producer` → `normalizeWineProducer`
  - `wine_origin` → `normalizeOrigin`
  - `wine_category` → `normalizeWineCategory`

### `src/domain/formatWineInfoLine.ts`

- Riga informativa renderizzata sempre con dati già normalizzati.
- Formato: `Produttore • Anno • Provenienza` (anno omesso se assente).

---

## Enforcement lato DB (Supabase)

Trigger `BEFORE INSERT OR UPDATE` su `public.wines`:

```sql
NEW.name     = upper(regexp_replace(trim(NEW.name),     '\s+', ' ', 'g'));
NEW.category = initcap(lower(regexp_replace(trim(NEW.category), '\s+', ' ', 'g')));
NEW.origin   = upper(regexp_replace(trim(NEW.origin),   '\s+', ' ', 'g'));
NEW.producer = initcap(lower(regexp_replace(trim(NEW.producer), '\s+', ' ', 'g')));
```

Script SQL versionato: `scripts/sql/supabase_text_casing_policy.sql`

---

## Template SQL per insert manuali

```sql
INSERT INTO public.wines (category, name, producer, origin, qty)
VALUES (
  initcap(lower(regexp_replace(trim(:category), '\s+', ' ', 'g'))),
  upper(regexp_replace(trim(:name),     '\s+', ' ', 'g')),
  initcap(lower(regexp_replace(trim(:producer), '\s+', ' ', 'g'))),
  upper(regexp_replace(trim(:origin),   '\s+', ' ', 'g')),
  :qty
);
```

---

## Regola operativa per script SQL futuri

Qualsiasi script SQL di insert/update su `wines` deve usare:

- `INITCAP(LOWER(TRIM(...)))` per `category`, `producer`
- `UPPER(TRIM(...))` per `name`, `origin`
- `regexp_replace(... '\s+', ' ', 'g')` per collassare spazi multipli

In caso di dubbi, il trigger DB corregge comunque — ma è preferibile inviare dati già normalizzati.
