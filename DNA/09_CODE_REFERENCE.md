# Riferimento Codice Completo

Ultimo aggiornamento: **04/05/2026 — CEST**.

Questo documento descrive ogni modulo, ogni funzione esportata, ogni hook e ogni tipo rilevante del progetto. È la fonte di verità per chi deve capire il codice senza aprirlo.

---

## `src/domain/types.ts`

```ts
type WineId = string;

type Wine = {
  id: WineId; // UUID o wine_<ts>_<rand>
  category?: string; // Initcap, opzionale
  name: string; // UPPERCASE
  age?: string; // anno vendemmia (label UI: ANNO), stringa libera
  producer: string; // Initcap
  origin: string; // UPPERCASE
  threshold?: number; // soglia allerta (intero >= 1, undefined = nessuna)
  purchasePrice?: number;
  salePrice?: number;
  vintage?: string; // campo legacy (non più usato attivamente)
  qty: number; // intero >= 0
  warehouse?: number; // calcolato: purchasePrice × qty (2 decimali)
  margin?: number; // calcolato: salePrice − purchasePrice (2 decimali)
  notes?: string;
};

type SessionItem = {
  wineId: WineId;
  qty: number;
};
```

---

## `src/domain/normalizeWineText.ts`

| Funzione                | Firma                   | Comportamento                                    |
| ----------------------- | ----------------------- | ------------------------------------------------ |
| `normalizeWineCategory` | `(v: string) => string` | `INITCAP(LOWER(trim + collapse spazi multipli))` |
| `normalizeWineName`     | `(v: string) => string` | `UPPER(trim + collapse spazi multipli)`          |
| `normalizeWineProducer` | `(v: string) => string` | `INITCAP(LOWER(trim + collapse spazi multipli))` |

Algoritmo collapse spazi: `v.trim().replace(/\s+/g, ' ')`.

---

## `src/domain/normalizeOrigin.ts`

| Funzione          | Firma                   | Comportamento                                                                            |
| ----------------- | ----------------------- | ---------------------------------------------------------------------------------------- |
| `normalizeOrigin` | `(v: string) => string` | `UPPER(trim + collapse spazi)` — identico a normalizeWineName ma semanticamente distinto |

---

## `src/domain/formatWineInfoLine.ts`

| Funzione             | Firma                                                           | Output                                                                                   |
| -------------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `formatWineInfoLine` | `(wine: Pick<Wine, 'producer' \| 'age' \| 'origin'>) => string` | `"Produttore • Anno • Provenienza"` oppure `"Produttore • Provenienza"` se `age` assente |

Usata in `ResultsList.tsx` e `SummaryList.tsx` per la riga metadati sotto al nome vino.

---

## `src/lib/supabase.ts`

```ts
export const supabase: SupabaseClient | null;
```

- Crea il client Supabase con `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
- Se `VITE_SUPABASE_URL` contiene per errore il suffisso `/rest/v1/`, lo rimuove prima di creare il client.
- Restituisce `null` se una delle due variabili è assente → l'app funziona in modalità solo-locale.
- Tutto il codice che usa Supabase controlla `if (supabase)` prima di chiamare.

---

## `src/app/appDomainContext.ts`

- Espone `AppDomain`, `AppDomainContextValue`, `useAppDomain()`.
- Contiene anche persistenza `localStorage` del dominio attivo (`scarichi.activeDomain.v1`).
- È stato separato da `appDomain.tsx` per eliminare warning Fast Refresh e mantenere il provider React in un file che esporta solo componenti.

---

## `src/lib/useSupabaseKeepalive.ts`

```ts
export function useSupabaseKeepalive(): void;
```

Hook React montato in `App.tsx`. Previene la pausa automatica del progetto Supabase free tier.

- Chiave localStorage: `supabase_keepalive_ts` → epoch ms ultimo ping.
- All'avvio: se `Date.now() - lastTs >= 24h` → esegue ping immediato.
- Ogni 24h: `setInterval(() => ping(), 24h)`.
- `ping()`: `supabase.from('wines').select('id').limit(1)` — silenzioso su errore, non interrompe l'app.
- Ritorna `void`, non espone stato.

---

## `src/data/localDb.ts`

| Esportazione                 | Tipo           | Descrizione                                                      |
| ---------------------------- | -------------- | ---------------------------------------------------------------- |
| `DB_KEY`                     | `const string` | `'scarichi.localDb.v1'`                                          |
| `dbChangedEvent`             | `const string` | `'scarichi:dbChanged'`                                           |
| `dbChangedChannel`           | `const string` | `'scarichi:dbChangedChannel'`                                    |
| `LocalSessionItem`           | tipo           | `{ wineId: string; qty: number }`                                |
| `LocalSession`               | tipo           | `{ id, createdAt, submittedAt?, items }`                         |
| `LocalDbState`               | tipo           | `{ inventory: Wine[]; history: LocalSession[] }`                 |
| `loadDb()`                   | funzione       | Deserializza da localStorage, applica seed + migrazione one-shot |
| `saveDb(db)`                 | funzione       | Serializza su localStorage                                       |
| `resetDb()`                  | funzione       | Rimuove la chiave localStorage                                   |
| `notifyDbChanged(sourceId?)` | funzione       | Emette CustomEvent intra-tab + BroadcastChannel cross-tab        |
| `newId(prefix)`              | funzione       | Genera `prefix_<epoch>_<rand16>`                                 |

Migrazione one-shot in `loadDb()`:

- Se `scarichi.inventory.supabaseBootstrap.v1` assente → azzera `inventory`, imposta flag.
- Motivo: elimina inventario locale pre-Supabase.

---

## `src/data/useLocalDb.ts`

```ts
export function useLocalDb(): {
  inventory: Wine[];
  history: LocalSession[];
  setInventory: (inv: Wine[] | ((prev: Wine[]) => Wine[])) => void;
  clearHistory: () => void;
  hardResetAll: () => void;
  refreshInventory: (opts?: { forceRemote?: boolean }) => Promise<Wine[]>;
  summary: { totalQty: number; winesCount: number };
};
```

Comportamenti chiave:

| Metodo                    | Comportamento                                                                                                                                                                                                                                     |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `setInventory(inv)`       | Aggiorna `db.inventory` via `commit()` con coalescing 120ms. In modalità `Spirits` non forza più lista vuota: lavora sul dominio attivo.                                                                                                          |
| `clearHistory()`          | Azzera `db.history`                                                                                                                                                                                                                               |
| `hardResetAll()`          | Cancella chiave localStorage, cancella timer pending, ricarica seed                                                                                                                                                                               |
| `refreshInventory(opts?)` | Domain-aware: carica lazy `wineRepository` o `spiritsRepository` in base al contesto, chiama `listWines()` oppure `listSpirits()`, aggiorna stato senza doppia scrittura se array identico. Deduplicato: riusa in-flight Promise se già in corso. |
| `summary`                 | Memo: `{ totalQty: sum(qty), winesCount: inventory.length }` sul dominio attivo                                                                                                                                                                   |

Propagazione cambiamenti:

- `commit()` → `setDb()` ottimistico → `saveDb()` dopo 120ms (debounced).
- Ascolto: `scarichi:dbChanged` (stessa tab), `StorageEvent` (cross-tab), `BroadcastChannel` (cross-tab).
- Anti-loop: ogni istanza ha `sourceId` univoco, ignora i propri eventi.

---

## `src/data/wineRepository.ts`

### Tipi interni

```ts
type WineRow = {
  id;
  category?;
  name;
  age?;
  producer;
  origin;
  threshold?;
  purchase_price?;
  sale_price?;
  vintage?;
  qty?;
  warehouse?;
  margin?;
  notes?;
};
type WineRegistryField = 'category' | 'producer' | 'origin';
type WineInput = {
  id?;
  category?;
  name;
  age?;
  producer;
  origin;
  threshold?;
  purchasePrice?;
  salePrice?;
  vintage?;
  qty;
  notes?;
};
```

### Funzioni esportate

| Funzione                                   | Firma                                              | Comportamento                                                                                                                              |
| ------------------------------------------ | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `listWines(opts?)`                         | `(opts?: { forceRemote? }) => Promise<Wine[]>`     | Cache-first: se cache valida e uguale a localDb → ritorna cache. Se `forceRemote=true` → fetch Supabase. Deduplicato in-flight.            |
| `createWine(input)`                        | `(input: WineInput) => Promise<Wine>`              | Normalizza input, insert Supabase (con fallback schema legacy), aggiorna cache locale, `syncWineUpsert`.                                   |
| `updateWine(input)`                        | `(input: WineInput) => Promise<Wine>`              | Normalizza input (richiede `id`), update Supabase (con fallback), aggiorna cache locale, `syncWineUpsert`.                                 |
| `deleteWine(id)`                           | `(id: string) => Promise<void>`                    | Delete Supabase, rimuove da cache locale, `syncWineDelete`.                                                                                |
| `replaceAllWines(rows)`                    | `(rows: ArchiveCsvWineInput[]) => Promise<Wine[]>` | DELETE all → INSERT bulk (schema completo o legacy). Aggiorna cache. `syncWineUpsert` per ogni vino.                                       |
| `appendWines(rows)`                        | `(rows: ArchiveCsvWineInput[]) => Promise<Wine[]>` | INSERT bulk con deduplicazione ID. Su `UNIQUE violation` → rigenera ID e riprova. Merge con inventario locale.                             |
| `updateThresholdForAllWines(raw)`          | `(raw: number) => Promise<number>`                 | UPDATE bulk `threshold` su tutti i vini. Ritorna count aggiornati.                                                                         |
| `clearWineArchive()`                       | `() => Promise<number>`                            | DELETE all wines. Se `FK violation` → `detachDischargeItemsFromWines()` poi retry. Pulisce cache registry. Emette `scarichi:archiveReset`. |
| `renameWineRegistryValue(field, from, to)` | `(field, from, to) => Promise<number>`             | UPDATE ilike su campo specifico. Aggiorna cache locale. Ritorna count aggiornati.                                                          |
| `deleteWineRegistryValue(field, value)`    | `(field, value) => Promise<number>`                | UPDATE SET `field = NULL` su tutti i vini con quel valore. Aggiorna cache locale.                                                          |

### Funzioni interne rilevanti

| Funzione                             | Comportamento                                                                                                                |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `toWine(row)`                        | Mappa WineRow → Wine. Normalizza testi, applica threshold, ricava `salePrice` da `purchasePrice * 1.3` se il dato manca.     |
| `toRowPayload(wine)`                 | Mappa Wine → payload Supabase (schema completo con `sale_price`, `warehouse`, `margin` coerenti ai campi derivati).          |
| `toLegacyPayload(wine)`              | Mappa Wine → payload schema legacy (solo campi base). Usato come fallback se schema esteso non ancora applicato.             |
| `normalizeInput(input)`              | Mappa WineInput → Wine normalizzata completa. Se `salePrice` manca la auto-genera con `+30%`, poi calcola warehouse/margin.  |
| `listAllWineRows()`                  | Fetch paginata da Supabase (1000 rows/page). Se `count` disponibile: pagine parallele. Altrimenti: sequenziale con sentinel. |
| `prepareInventory(source, fallback)` | `enrichThresholdsFromFallback` → `normalizeWineTextFields` → `sortWines`.                                                    |
| `sameInventory(prev, next)`          | Confronto campo per campo. Guard anti-write ridondanti.                                                                      |
| `persistAndCacheInventory(next)`     | `persistLocalInventory` (se cambiata) + `setListWinesCache`.                                                                 |
| `isSchemaColumnError(err)`           | True se messaggio contiene "column ... does not exist" → attiva fallback schema legacy.                                      |
| `isForeignKeyViolation(err)`         | True se code `23503` o messaggio FK.                                                                                         |
| `isUniqueViolation(err)`             | True se code `23505` o messaggio "duplicate key".                                                                            |

### Variabili modulo

| Variabile                                     | Descrizione                                                 |
| --------------------------------------------- | ----------------------------------------------------------- |
| `listWinesInFlight`                           | `Promise<Wine[]> \| null` — in-flight dedup per `listWines` |
| `listWinesCache`                              | `Wine[] \| null` — cache in memoria post-fetch              |
| `WINES_PAGE_SIZE = 1000`                      | Dimensione pagina Supabase                                  |
| `archiveResetEvent = 'scarichi:archiveReset'` | CustomEvent emesso dopo `clearWineArchive()`                |

---

## `src/data/dischargeRepository.ts`

### Tipi esportati

```ts
type DischargeStatus = 'pending' | 'submitted' | 'cancelled';

type DischargeSessionSummary = {
  id: string;
  createdAt: number;
  submittedAt?: number;
  totalQty: number;
  itemsCount: number;
  status: DischargeStatus;
};

type DischargeItemInput = { wineId: string; qty: number };

type DischargeSessionItemDetail = {
  sessionId;
  sessionStatus;
  createdAt;
  submittedAt?;
  wineId;
  wineName;
  age?;
  producer?;
  origin?;
  category?;
  qty;
};

type SubmittedHistoryRetention = 'all' | '7d' | '30d' | '3m' | '12m' | '18m' | '2y' | '3y';
```

### Funzioni esportate

| Funzione                                        | Comportamento                                                                                                                  |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `listDischargeSessions(status, opts?)`          | Lista sessioni per status. Limit default 300, cap 2000. Include count items inline.                                            |
| `listAllDischargeSessions(status, opts?)`       | Paginata FIFO, maxRows 50k.                                                                                                    |
| `createDischargeSession(input)`                 | Insert `discharge_sessions` + snapshot items in `discharge_session_items`. Fallback schema legacy se colonne snapshot assenti. |
| `submitDischargeSession(sessionId)`             | RPC `submit_discharge_session(p_session_id)` → aggiorna giacenze + status.                                                     |
| `createAndSubmitDischargeSession(input)`        | `createDischargeSession` + `submitDischargeSession` + `reconcileSubmittedSessionStock`.                                        |
| `clearDischargeSessionsByStatus(status)`        | DELETE tutte le sessioni con dato status.                                                                                      |
| `clearSubmittedHistoryByRetention(retention)`   | DELETE sessioni submitted più vecchie del periodo scelto. `'all'` = tutte.                                                     |
| `detachDischargeItemsFromWines()`               | UPDATE `discharge_session_items.wine_id = NULL` su tutti i record. Usato prima di `clearWineArchive()` se FK violation.        |
| `listSubmittedDischargeItemsForAi(limit?)`      | Items sessioni submitted per AI. Usa snapshot se disponibili, fallback a join `wines`.                                         |
| `listAllSubmittedDischargeItemsForAi(opts?)`    | Paginata, max 50k.                                                                                                             |
| `listSubmittedDischargeSessionItems(sessionId)` | Items di una singola sessione, ordinati per `qty DESC, wineName ASC`.                                                          |

### `reconcileSubmittedSessionStock(items, expectedQtyByWineId?)`

Safety net post-submit: se la RPC non ha aggiornato correttamente le giacenze, allinea `wines.qty` al valore atteso calcolato localmente. Usato solo se `expectedQtyByWineId` è fornito.

### Schema SELECT

```
SESSION_ITEMS_SELECT_WITH_SNAPSHOT:
  session_id, wine_id, qty,
  wine_name, wine_age, wine_producer, wine_origin, wine_category,
  discharge_sessions!inner(status, created_at, submitted_at),
  wines(name, age, producer, origin, category)

SESSION_ITEMS_SELECT_LEGACY:
  session_id, wine_id, qty,
  discharge_sessions!inner(status, created_at, submitted_at),
  wines(name, age, producer, origin, category)
```

Strategia: prova prima WITH_SNAPSHOT, su `isSchemaColumnError` usa LEGACY.

---

## `src/data/useDischargeSessions.ts`

```ts
export function useDischargeSessions(): {
  submitted: DischargeSessionSummary[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
};
```

- Carica solo su mount della sezione `history` (on-demand, non al caricamento admin).
- Cache in-memory con TTL breve per riaperture ravvicinate.
- Mostra stato `loading` durante fetch per evitare rendering vuoto.

---

## `src/data/offlineDischargeQueue.ts`

Vedi sezione dettagliata in `03_LOCAL_STORAGE_MODEL.md`.

Funzioni principali:

| Funzione                                | Firma                                                                     |
| --------------------------------------- | ------------------------------------------------------------------------- |
| `enqueuePendingDischargeSession(input)` | `({ items, expectedQtyByWineId?, source? }) => PendingDischargeQueueItem` |
| `flushPendingDischargeQueue(opts?)`     | `({ reason? }) => Promise<FlushDischargeQueueSummary>`                    |
| `listPendingDischargeQueueItems()`      | `() => PendingDischargeQueueItem[]`                                       |
| `getPendingDischargeQueueCount()`       | `() => number`                                                            |
| `clearPendingDischargeQueue()`          | `() => void`                                                              |
| `isDischargeQueueRecoverableError(err)` | `(err: unknown) => boolean`                                               |

---

## `src/data/archiveCsv.ts`

### Colonne CSV (ordine standard export)

`ID ; Categoria ; Nome ; Anno ; Produttore ; Provenienza ; Soglia ; Acquisto ; Vendita ; Quantita ; Note`

### Alias header riconosciuti (case-insensitive, accenti rimossi)

`id, categoria/category, nome/name, anno/age, produttore/producer, provenienza/origine/origin, soglia/threshold, acquisto/prezzoacquisto/purchaseprice, vendita/prezzovendita/saleprice, quantita/qta/qty, note/notes`

### Funzioni esportate

| Funzione                 | Firma                                    | Comportamento                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------ | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `buildArchiveCsv(wines)` | `(wines: Wine[]) => string`              | CSV con separatore `;`, escape RFC 4180, normalizzazione campi, encoding UTF-8.                                                                                                                                                                                                                                                                                 |
| `parseArchiveCsv(raw)`   | `(raw: string) => ArchiveCsvWineInput[]` | Auto-detect separatore (`;` o `,`). Parser manuale RFC 4180 (gestisce quoted fields, escape `""`, CRLF). Rimozione BOM `\uFEFF`. Normalizzazione campi. Validazione: richiede le colonne `name` e `producer`; celle testuali vuote accettate dal parser. I repository sostituiscono con `N/D` solo i campi obbligatori DB vuoti prima della scrittura Supabase. |

### `parseLooseNumber(raw)`

Parser numerico flessibile per celle CSV:

- Rimuove `€` e spazi
- Gestisce virgola/punto come separatore decimale o migliaia
- Esempio: `"1.234,56"` → `1234.56`, `"12,50"` → `12.50`

---

## `src/data/categoryRepository.ts`

Gestisce il registry categorie in-memory + Supabase.

| Funzione                      | Comportamento                                                               |
| ----------------------------- | --------------------------------------------------------------------------- |
| `listManagedCategories()`     | Restituisce lista categorie (cache locale → Supabase)                       |
| `ensureManagedCategory(name)` | Crea la categoria su Supabase se non esiste (upsert). Normalizza uppercase. |
| `clearManagedCategories()`    | Svuota cache locale                                                         |
| `clearSupabaseCategories()`   | DELETE tutte le categorie su Supabase (usato in reset archivio)             |

---

## `src/data/producerRepository.ts` / `src/data/originRepository.ts`

Struttura analoga a `categoryRepository` ma solo cache locale (no Supabase).

| Funzione                                            | Comportamento                                 |
| --------------------------------------------------- | --------------------------------------------- |
| `listManagedProducers()` / `listManagedOrigins()`   | Lista da cache locale (derivata da inventory) |
| `clearManagedProducers()` / `clearManagedOrigins()` | Svuota cache                                  |

---

## `src/app/routes.ts`

```ts
export const APP_ROUTES = {
  HOME: '/',
  ARCHIVE: '/admina',
  SETTINGS: '/impostazioni',
  SETTINGS_LEGACY: '/admin'
};

export function isSettingsPath(path: string): boolean;
// true se path === '/impostazioni' || path === '/admin'

export function isArchivePath(path: string): boolean;
// true se path === '/admina'
```

---

## `src/app/useOfflineDischargeQueueSync.ts`

```ts
export function useOfflineDischargeQueueSync(): void;
```

Hook montato in `App.tsx`. Attiva `flushPendingDischargeQueue()` su:

- mount (startup)
- `window 'online'`
- `window 'focus'`
- `window 'pageshow'`
- `document 'visibilitychange'` (quando tab torna visibile)
- `scarichi:dischargeQueueChanged` (nuova sessione in coda)

Gestisce feedback utente: toast "tornato online" e toast errore sync non-recoverable.

---

## `src/app/useOnlineStatus.ts`

```ts
export function useOnlineStatus(): boolean;
```

- Stato iniziale: `navigator.onLine`
- Aggiornato su eventi `online` / `offline`

---

## `src/app/useDebouncedValue.ts`

```ts
export function useDebouncedValue<T>(value: T, delay: number): T;
```

Hook generico debounce. Usato in `WineAdminPage` per il campo ricerca archivio.

---

## `src/pages/admin/crypto.ts`

```ts
export async function sha256Base64(input: string): Promise<string>;
```

- Usa `window.crypto.subtle.digest('SHA-256', ...)`.
- Converte il buffer in stringa Base64.
- Usata per: hash password admin, hash PIN avvio app e PIN impostazioni.

---

## `src/pages/home/StartSessionDomainModal.tsx`

Modale Home usato prima di aprire una nuova sessione di scarico.

- propone scelta esplicita `Vini` / `Spirits`;
- applica una resa visiva coerente con i due domini;
- `HomePage` nasconde lo switch dominio durante la sessione attiva, così il contesto non cambia mentre si scarica.

---

## `src/pages/admin/storage.ts`

```ts
export const storageKeys = {
  adminPasswordHash: 'scarichi.admin.passwordHash',
  appPinRequiredOnStart: 'scarichi.admin.pinRequiredOnStart',
  appPinRequiredForSettings: 'scarichi.admin.pinRequiredForSettings'
  // ... altre chiavi admin
};

export const settingsChangedEvent = 'scarichi:settingsChanged';

export function getBool(key: string, defaultValue: boolean): boolean;
export function setBool(key: string, value: boolean): void;
// setBool emette settingsChangedEvent con { key } nel detail
```

`settingsChangedEvent` è ascoltato in `App.tsx` per aggiornare in tempo reale i flag PIN senza refresh.

---

## `src/pages/admin/useAdminAuth.ts`

```ts
export function useAdminAuth(): {
  authed: boolean;
  error: string | null;
  busy: boolean;
  login: (password: string) => Promise<void>;
  logout: () => void;
};
```

- Hash SHA-256 della password confrontato con `scarichi.admin.passwordHash`.
- Sessione valida 12h (`authedUntil` in localStorage).
- Default password hash: `sha256Base64('1909')`.

---

## `src/pages/admina/WineAdminPage.tsx`

Orchestratore pagina archivio vini (~264 righe — solo JSX). Tutta la logica è in `useWineAdminPage.ts` (~645 righe).

Stato gestito (in `useWineAdminPage.ts`):

- `wines: Wine[]` — inventario caricato
- `filterState: FilterState` — term, category, producer, origin, stockFilter
- `sortState: SortState` — campo, direzione
- `visibleRows: number` — rendering progressivo (TABLE_RENDER_BATCH)
- `modalState` — quale modale è aperto e su quale vino

Comportamento caricamento:

1. Hydration immediata da localStorage (warm start)
2. Sync Supabase in background (`listWines({ forceRemote: true })`)
3. Lista `useDeferredValue` sul termine ricerca per non bloccare l'input

Filtri complementari:

- `filteredWines` = wines filtrate per tutti i criteri attivi
- Le opzioni dei selector categoria/produttore/provenienza si restringono in base ai filtri già applicati

---

## `src/pages/admina/components/AdminArchiveTable.tsx`

Tabella inline-editable (~713 righe).

Comportamenti chiave:

- Rendering progressivo: `sortedWines.slice(0, Math.max(TABLE_RENDER_BATCH, visibleRows))`
- `TABLE_RENDER_BATCH` = costante in `archiveTableUtils.ts`
- Pulsante "Carica altre righe" per caricare il batch successivo
- Header sticky con ordinamento A-Z/Z-A per colonna
- Inline editing su tutte le celle (salvataggio immediato su blur/enter)
- Click destro → modale modifica massiva (su filtri attivi)
- Colonna `ANNO`: cella vuota se `age` assente (non `-` o `N/D`)
- Colonna `Azioni`: icona note (gialla se `notes` presente, grigia disabilitata se assente), edit, delete

---

## `src/pages/admina/utils/archiveExport.ts`

Export archivio: tutte le librerie sono **lazy-loaded** (dynamic import al momento dell'uso).

| Funzione               | Libreria                           | Comportamento                                                              |
| ---------------------- | ---------------------------------- | -------------------------------------------------------------------------- |
| `exportToExcel(wines)` | `exceljs` (lazy)                   | Genera XLSX con header stilizzati, colonne formattate, download automatico |
| `exportToPdf(wines)`   | `jspdf` + `jspdf-autotable` (lazy) | PDF con logo in alto, tabella vini, numerazione pagine `1/N`               |
| `exportToCsv(wines)`   | nessuna (sync)                     | Usa `buildArchiveCsv` + download Blob                                      |

---

## `src/integrations/googleSheetsSync.ts`

Integrazione opzionale Google Sheets via webhook.

```ts
export async function syncWineUpsert(wine: Wine): Promise<void>;
export async function syncWineDelete(wineId: string): Promise<void>;
export async function syncSpiritUpsert(spirit: Wine): Promise<void>;
export async function syncSpiritDelete(spiritId: string): Promise<void>;
```

- Invio silenzioso: errori loggati ma non propagati all'utente.
- Usato in `createWine`, `updateWine`, `deleteWine`, `replaceAllWines`, `appendWines`.
- Usato anche in `createSpirit`, `updateSpirit`, `deleteSpirit`, `replaceAllSpirits`, `appendSpirits`, `updateThresholdForAllSpirits`.
- Non parte del flusso critico: fallimento non blocca l'operazione principale.
- Nel repository il file resta placeholder non bloccante; in produzione la sync primaria verso Google è oggi attivata dai trigger DB `trg_wines_notify_google_sheets` e `trg_spirits_notify_google_sheets`.

Nota audit 11/05/2026:

- lato Supabase -> Google Sheet risultano presenti URL Web App `/exec`, secret, trigger e funzioni webhook coerenti;
- lato Google Sheet -> Supabase non c'e' automatismo installato: Apps Script mostra `0 attivatori`, quindi i comandi `syncWinesFromSheetToSupabase` e `syncSpiritsFromSheetToSupabase` partono solo manualmente dal menu;
- i CSV esportati dal foglio non includono `__ID__`, quindi non sono adatti a sync bidirezionale automatica sicura senza prima popolare ID stabili;
- i duplicati naturali impediscono di usare `NOME + PRODUTTORE` come chiave affidabile.

---

## `src/components/BottomNav.tsx`

Props:

```ts
{
  currentPath: string;
  hidden: boolean;
}
```

- `hidden = true` durante intro e gate PIN.
- Voci: `Home (/)`, `Archivio (/admina)`, `Impostazioni (/impostazioni)`.
- Click su voce durante sessione attiva con items → intercetta e apre modale abbandono sessione (gestita da `HomePage`).
- `touch-action: manipulation` per tap immediato (nessun ritardo 300ms).

---

## `src/components/Toast.tsx`

```ts
type ToastProps = { message: string; type?: 'success' | 'error' | 'info'; onClose: () => void };
```

- Posizionato `fixed`, `bottom: 86px` (sopra la navbar).
- `will-change: transform` + `translateZ(0)` per layer GPU.
- Auto-dismiss configurabile.

---

## `src/components/ConfirmModal.tsx`

Modale generica riutilizzabile. Props:

```ts
{ title: string; description?: string; confirmLabel?: string; cancelLabel?: string; onConfirm: () => void; onCancel: () => void; busy?: boolean }
```

---

## CSS — Architettura

4 file distinti, importati in barrel da `styles/styles.css`:

| File             | Contenuto                                                                              |
| ---------------- | -------------------------------------------------------------------------------------- |
| `base.css`       | Variabili CSS (`:root`), reset, layout `.container`, intro animazione, `.navbar` fixed |
| `components.css` | `.button`, `.card`, `.navNavItem`, animazioni pulse, spinner                           |
| `archive.css`    | Tabella archivio, toolbar filtri, modali archivio, inline select                       |
| `misc.css`       | Modali generici, toast, `.summaryDock`, impostazioni admin, registry manager           |

Variabili CSS principali:

```css
--brand: #7c164a /* viola enoteca */ --ink: #111827 /* testo principale */ --muted: #6b7280
  /* testo secondario */ --bg: #fdfaf2 /* sfondo caldo */ --surface: #fffdf8 /* sfondo card */
  --border: #e5e7eb /* bordi */;
```

Override dominio:

```css
body[data-domain='spirits'] {
  --bg: #d6eaf4; /* azzurro naturale per l'intera sezione Spirits */
}
```

Nota dominio Spirits:

- `spiritsRepository` supporta anche `threshold` in lettura, scrittura, import e update massivo;
- il tab Google `Spirits` attualmente è strutturato come mirror ridotto con colonne `NOME`, `PRODUTTORE`, `ACQUISTO`, `VENDITA`, `Q.tà`, `MAGAZZINO`;
- i campi app `category` e `threshold` restano gestiti in Supabase/UI e non sono esposti nel tab Google ridotto mostrato in produzione;
- lato repository `Spirits`, se `sale_price/vendita` manca ma `purchase_price/acquisto` è presente, `salePrice` viene derivata automaticamente con regola `+30%`;
- lato DB è verificata la presenza del trigger `trg_spirits_notify_google_sheets` con funzione `integration.notify_google_sheets_spirits()`;
- lato Google Apps Script il flusso corretto è distinto: `syncSpiritsFromSheetToSupabase` per caricare il foglio nel DB, `syncSpiritsFromSupabaseToSheet` per riscrivere il foglio a partire dal DB;
- il sorgente Apps Script è versionato nel repo in `scripts/google-apps-script/enoteca_sync.gs`;
- i vecchi trigger installabili Apps Script (`syncFromSheetToSupabase`, `syncFromSupabaseToSheet`) sono stati rimossi perché riferiti a funzioni legacy non più presenti nel nuovo script.
- al 11/05/2026 non risultano trigger installabili Apps Script attivi; prima di rendere automatica la sync Sheet -> DB va introdotto un trigger controllato e idempotente.
- se `spirits_products` è stato creato prima dell’introduzione delle soglie, va eseguito `scripts/sql/2026-05-04_spirits_threshold_enable.sql`.

---

## GitHub Actions

### `.github/workflows/supabase-keepalive.yml`

- **Trigger**: cron `0 6 */3 * *` (ogni 3 giorni alle 06:00 UTC)
- **Scopo**: mantiene attivo il progetto Supabase free tier anche senza accessi app
- **Funzionamento**: HTTP GET all'endpoint Supabase con query SELECT
- **Indipendente dall'app**: funziona anche se l'app non viene mai aperta per settimane
