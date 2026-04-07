# Text Casing Policy (obbligatoria)

Ultimo aggiornamento: **07/04/2026 16:04 CEST**.

## Regole vincolanti

Queste regole valgono sempre in tutta l'app (input, import CSV, visualizzazione, informazioni, export, script SQL):

1. `categoria`, `nome`, `provenienza`:
   - sempre in **MAIUSCOLO**.
2. `produttore`:
   - sempre con **iniziale maiuscola** (stile `Initcap`).

## Punti di enforcement nel codice

- `src/domain/normalizeWineText.ts`
  - normalizzazione centralizzata:
    - `normalizeWineCategory`
    - `normalizeWineName`
    - `normalizeWineProducer`
- `src/domain/normalizeOrigin.ts`
  - provenienza sempre uppercase.
- `src/data/wineRepository.ts`
  - normalizzazione in lettura/scrittura (`toWine`, `normalizeInput`, payload Supabase/legacy, import massivo).
- `src/data/archiveCsv.ts`
  - normalizzazione durante `parseArchiveCsv` e durante export CSV.
- `src/data/categoryRepository.ts`
  - categorie gestite sempre uppercase.
- `src/pages/admin/AdminRegistryManager.tsx`
  - enforcement live in creazione/modifica registry:
    - `category` uppercase,
    - `producer` initial uppercase,
    - `origin` uppercase;
  - rendering valori registry allineato alla stessa policy.
- `src/data/dischargeRepository.ts`
  - snapshot sessioni (`wine_name`, `wine_category`, `wine_producer`, `wine_origin`) coerenti con policy.
- `src/domain/formatWineInfoLine.ts`
  - riga informativa sempre renderizzata con policy corretta.

## Supabase / SQL Editor

Script versionato:

- `scripts/sql/supabase_text_casing_policy.sql`

Cosa fa:

- applica trigger `BEFORE INSERT/UPDATE` su `wines`;
- normalizza retroattivamente i record in `wines`;
- applica trigger coerenti anche su registry (`categories`, `origins`, `producers`) se presenti.

## Regola operativa per script SQL futuri

Quando vengono preparati script SQL di insert/update manuali, usare sempre questa convenzione:

- `UPPER(...)` per `categoria`, `nome`, `provenienza`;
- `INITCAP(LOWER(...))` per `produttore`;
- `TRIM + collapse spazi` prima della trasformazione.

In caso di dubbi, fare riferimento a questo file e allo script SQL versionato sopra.

Template SQL (insert manuale su `public.wines`):

```sql
insert into public.wines (
  category, name, producer, origin, qty
) values (
  upper(regexp_replace(trim(:category), '\s+', ' ', 'g')),
  upper(regexp_replace(trim(:name), '\s+', ' ', 'g')),
  initcap(lower(regexp_replace(trim(:producer), '\s+', ' ', 'g'))),
  upper(regexp_replace(trim(:origin), '\s+', ' ', 'g')),
  :qty
);
```

## Google Sheet / Apps Script (sync bidirezionale)

Per evitare conflitti di casing tra app e foglio condiviso:

- in `syncFromSheetToSupabase` normalizzare sempre prima dell'upsert:
  - `NOME` => uppercase;
  - `PROVENIENZA` => uppercase;
  - `PRODUTTORE` => initial uppercase.
- dopo normalizzazione, riscrivere i valori nel foglio così l'utente vede subito il formato corretto.
