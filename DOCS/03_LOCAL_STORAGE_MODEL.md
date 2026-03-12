# Modello dati locale (localStorage)

## Obiettivo

Simulare l’app completa senza Supabase/Sheets:

- inventario vini
- storico sessioni inviate
- coda sessioni sospese (offline)

## Struttura DB

File: `apps/scarichi-vini/src/data/localDb.ts`

Chiave storage:

- `scarichi.localDb.v1`

Tipo:

- `inventory`: lista `Wine`
- `history`: lista `LocalSession` (solo inviate)
- `pending`: lista `LocalSession` (in coda)

### Sessione

- `id`: string (generata con `newId()`)
- `createdAt`: epoch ms
- `submittedAt` (opzionale): epoch ms
- `userLabel` (opzionale): string
- `items`: `{ wineId, qty }[]`

## Persistenza e sincronizzazione

Hook: `apps/scarichi-vini/src/data/useLocalDb.ts`

- `commit()`:
  - calcola next state
  - `saveDb()` su localStorage
  - emette evento custom `scarichi:dbChanged` via `notifyDbChanged()`

Motivo:

- aggiornare più hook nella stessa tab senza refresh.

Eventi:

- `scarichi:dbChanged` (intra-tab)
- `storage` (cross-tab)

## Seed inventario

Se `inventory` è vuoto, Home esegue seed da `mockWines`.

## Reset

- reset storico: `clearHistory()`
- reset sospesi: `clearPending()`
- reset totale: `hardResetAll()` (rimuove key e ricarica seed)
