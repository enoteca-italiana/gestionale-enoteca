# Modello dati locale (localStorage)

Ultimo aggiornamento: **04/05/2026 — CEST**.

---

## Scopo

Persistenza locale per:

- inventario vini (cache sincronizzata da Supabase)
- cronologia sessioni locale (legacy — non usato nel flusso operativo attuale)
- coda sessioni offline in attesa di sync Supabase
- stato autenticazione admin
- flag PIN e impostazioni runtime

---

## Chiavi localStorage

| Chiave                                    | Tipo                    | Contenuto                                            |
| ----------------------------------------- | ----------------------- | ---------------------------------------------------- |
| `scarichi.localDb.v1`                     | JSON                    | `{ inventory: Wine[], history: LocalSession[] }`     |
| `scarichi.inventory.supabaseBootstrap.v1` | string `'1'`            | Flag migrazione one-shot: inventario legacy azzerato |
| `scarichi.dischargeQueue.v1`              | JSON                    | `PendingDischargeQueueItem[]` (coda offline FIFO)    |
| `scarichi.admin.auth`                     | JSON                    | `{ hash: string, authedUntil: number }`              |
| `scarichi.admin.pinRequiredOnStart`       | string `'true'/'false'` | Gate PIN avvio app                                   |
| `scarichi.admin.pinRequiredForSettings`   | string `'true'/'false'` | Gate PIN impostazioni                                |
| `scarichi.admin.passwordHash`             | string                  | SHA-256 Base64 password admin                        |
| `supabase_keepalive_ts`                   | string (epoch ms)       | Timestamp ultimo ping Supabase keepalive             |

Chiavi sessionStorage:

| Chiave                        | Tipo         | Contenuto                                               |
| ----------------------------- | ------------ | ------------------------------------------------------- |
| `scarichi.app.pinUnlocked.v1` | string `'1'` | PIN avvio app già verificato in questa sessione browser |

---

## File: `src/data/localDb.ts`

### Tipi

```ts
type LocalSessionItem = { wineId: string; qty: number };
type LocalSession = {
  id: string;
  createdAt: number;
  submittedAt?: number;
  items: LocalSessionItem[];
};
type LocalDbState = { inventory: Wine[]; history: LocalSession[] };
```

### Funzioni esportate

| Funzione                     | Comportamento                                                                                                                                                                                                                     |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `loadDb(): LocalDbState`     | Legge e deserializza da `scarichi.localDb.v1`. Se chiave assente o corrotta, scrive seed vuoto e ritorna. Applica migrazione one-shot: se flag `supabaseBootstrap.v1` assente, azzera `inventory` (verrà ripopolato da Supabase). |
| `saveDb(db)`                 | Serializza e scrive su `scarichi.localDb.v1`.                                                                                                                                                                                     |
| `resetDb()`                  | Rimuove la chiave `scarichi.localDb.v1`.                                                                                                                                                                                          |
| `notifyDbChanged(sourceId?)` | Emette `scarichi:dbChanged` (CustomEvent intra-tab) e messaggio su `BroadcastChannel('scarichi:dbChangedChannel')` (cross-tab). Il `sourceId` evita che il mittente riprocessi il proprio evento.                                 |
| `newId(prefix)`              | Genera ID univoco: `prefix_<epoch>_<rand16>`.                                                                                                                                                                                     |

### Costanti

- `DB_KEY = 'scarichi.localDb.v1'`
- `dbChangedEvent = 'scarichi:dbChanged'`
- `dbChangedChannel = 'scarichi:dbChangedChannel'`

---

## Hook: `src/data/useLocalDb.ts`

Espone il DB locale come stato React. Gestisce:

- lettura iniziale sincrona (`useState(() => loadDb())`)
- ascolto modifiche esterne: `dbChangedEvent` (stessa tab), `StorageEvent` (cross-tab), `BroadcastChannel` (cross-tab robusto)
- scritture coalescenti: le `commit()` ravvicinate vengono debounced di 120ms prima di `saveDb()`

### Interfaccia hook

```ts
const {
  inventory, // Wine[]
  history, // LocalSession[]
  setInventory, // (Wine[] | updater) => void
  clearHistory, // () => void
  hardResetAll, // () => void — rimuove chiave e ricarica seed
  refreshInventory, // (opts?: { forceRemote? }) => Promise<Wine[]>
  summary // { totalQty: number, winesCount: number }
} = useLocalDb();
```

### `commit(next)`

- Aggiorna stato React immediatamente (ottimistico)
- Pianifica `saveDb()` dopo 120ms (coalescing)
- Se il componente si smonta, `flushPending()` forza la scrittura sincrona

### `refreshInventory(opts?)`

- Deduplica richieste concorrenti: se già in-flight, restituisce la stessa Promise
- Carica `wineRepository` via dynamic import (non nel bundle iniziale)
- Chiama `listWines({ forceRemote })` dal repository
- Aggiorna `db.inventory` senza doppia scrittura se l'array è identico

### Propagazione cross-tab

- Evento `scarichi:dbChanged` → reload da localStorage
- Evento `storage` → reload se chiave `scarichi.localDb.v1` cambia
- `BroadcastChannel('scarichi:dbChangedChannel')` → reload sincrono su tutte le tab
- Il `sourceId` univoco per istanza evita loop: ogni hook ignora i propri eventi

---

## Coda offline: `src/data/offlineDischargeQueue.ts`

### Chiave

`scarichi.dischargeQueue.v1` → `PendingDischargeQueueItem[]` ordinati per `createdAt` ASC (FIFO).

### Tipo item

```ts
type PendingDischargeQueueItem = {
  id: string; // dq_<epoch>_<rand16>
  createdAt: number; // epoch ms
  source: string; // 'web'
  items: DischargeItemInput[]; // { wineId, qty }[]
  expectedQtyByWineId?: Record<string, number>; // giacenza attesa post-sessione
  attempts: number; // tentativi di invio
  lastError?: string;
  lastAttemptAt?: number;
};
```

### Funzioni esportate

| Funzione                                | Comportamento                                                                                                                                                             |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `enqueuePendingDischargeSession(input)` | Aggiunge item in coda, emette `scarichi:dischargeQueueChanged` e `scarichi:dischargeQueueStatus` (type: 'enqueued')                                                       |
| `flushPendingDischargeQueue(opts?)`     | Loop FIFO: invia ogni sessione via `createAndSubmitDischargeSession`. Deduplicato (in-flight singleton). Distingue errori recoverable (rete) da non-recoverable (logici). |
| `listPendingDischargeQueueItems()`      | Legge e restituisce la coda corrente                                                                                                                                      |
| `getPendingDischargeQueueCount()`       | Restituisce lunghezza coda                                                                                                                                                |
| `clearPendingDischargeQueue()`          | Svuota la coda                                                                                                                                                            |
| `isDischargeQueueRecoverableError(err)` | Classifica errore: recoverable se HTTP 5xx, ECONNRESET, ETIMEDOUT, 'failed to fetch', ecc.                                                                                |

### Eventi emessi

- `scarichi:dischargeQueueChanged` → `{ pendingCount: number }` — ogni modifica alla coda
- `scarichi:dischargeQueueStatus` → `DischargeQueueStatusDetail` — dettaglio operazione (enqueued/sync_started/sync_success/sync_paused/sync_error)

---

## Seed e migrazione

Seed vuoto:

```ts
{ inventory: [], history: [] }
```

Migrazione one-shot (eseguita in `loadDb()`):

- Se `scarichi.inventory.supabaseBootstrap.v1` assente: `inventory` viene azzerato e il flag viene impostato.
- Motivazione: evitare che un inventario locale legacy (pre-Supabase) rimanga in uso dopo la migrazione al backend remoto.
- Il ripopolamento avviene automaticamente via `refreshInventory()` alla prima apertura di `HomePage`.

---

## Reset

| Operazione                | Effetto                                                                                                             |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `clearHistory()`          | Azzera `history` in localDb                                                                                         |
| `hardResetAll()`          | Cancella chiave `scarichi.localDb.v1` e ricarica seed vuoto                                                         |
| Reset archivio (da admin) | Cancella `public.wines` su Supabase + svuota `listWinesCache` + chiama `clearManagedCategories/Origins/Producers()` |
