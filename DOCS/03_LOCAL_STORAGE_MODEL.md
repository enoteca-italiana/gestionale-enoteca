# Modello dati locale (localStorage)

Ultimo aggiornamento: **16/03/2026 23:18 CET**.

## Obiettivo

Simulare l’app completa senza Supabase/Sheets:

- inventario vini
- settings/runtime locale

## Struttura DB

File: `apps/scarichi-vini/src/data/localDb.ts`

Chiave storage:

- `scarichi.localDb.v1`

Tipo:

- `inventory`: lista `Wine`
- `history`: legacy locale (non usato nel flusso operativo attuale)

Campi `Wine` rilevanti nello stato attuale:

- `category`
- `name`
- `age` (label UI: `ANNO`)
- `producer`
- `origin`
- `purchasePrice`
- `salePrice`
- `qty`
- `notes`
- `warehouse` (calcolato: `purchasePrice × qty`)
- `margin` (calcolato: `salePrice - purchasePrice`)

### Sessione

- `id`: string (generata con `newId()`)
- `createdAt`: epoch ms
- `submittedAt` (opzionale): epoch ms
- `items`: `{ wineId, qty }[]`

Nota:

- nel flusso operativo aggiornato, storico/sospesi admin sono letti da Supabase (`discharge_sessions`), non da localStorage.

## Persistenza e sincronizzazione

Hook: `apps/scarichi-vini/src/data/useLocalDb.ts`

- `commit()`:
  - calcola next state
  - `saveDb()` su localStorage (coalescing scritture ravvicinate)
  - emette evento custom `scarichi:dbChanged` via `notifyDbChanged()`
- `refreshInventory()`:
  - deduplica refresh concorrenti (riusa promise in-flight)
  - sincronizza inventory da repository e riallinea localStorage

Motivo:

- aggiornare più hook nella stessa tab senza refresh.
- propagare update affidabili anche tra tab/browser window.

Eventi:

- `scarichi:dbChanged` (intra-tab)
- `storage` (cross-tab)
- `BroadcastChannel` (`scarichi:dbChangedChannel`) per sync cross-tab più robusto

## Seed inventario

- Seed locale minimale:
  - `inventory: []`
  - `history: []`
- In `loadDb()` è presente una migrazione one-shot (`scarichi.inventory.supabaseBootstrap.v1`) che azzera eventuale inventario locale legacy; il popolamento operativo avviene dal repository vini (Supabase/local fallback).

## Reset

- reset storico: `clearHistory()`
- reset totale: `hardResetAll()` (rimuove key e ricarica seed)
