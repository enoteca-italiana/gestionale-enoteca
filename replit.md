# Enoteca Italiana — Gestionale Vini PWA

## Architettura

Monorepo npm workspace. App principale in `apps/scarichi-vini/`.

**Stack:** React 18 + Vite 5 + TypeScript strict + wouter (routing) + Supabase + vite-plugin-pwa

**Entry point dev server:** `npm run dev` → porta 5001

## Struttura directory

```
apps/scarichi-vini/
  src/
    pages/
      HomePage.tsx                    — solo JSX (~196 righe)
      home/                           — moduli pagina scarichi
        useHomePage.ts                — tutto stato + 9 useEffect + handler + computed
        useLocalSession.ts            — logica sessione scarichi
        useStockEditor.ts             — logica editor stock
        ResultsList.tsx
        SessionConfirmModal.tsx
        StockEditorModal.tsx
        SummaryList.tsx
      admin/                          — impostazioni (route /impostazioni)
        AdminSettings.tsx             — solo JSX (~326 righe)
        useAdminSettings.ts           — tutto stato + handler settings
        AdminHistory.tsx              — solo JSX (~345 righe)
        useAdminHistory.ts            — stato + handler storico sessioni
        historyUtils.ts               — funzioni date/format pure (riusabili)
        AdminRegistryManager.tsx      — solo JSX (~324 righe)
        useRegistryManager.ts         — stato + handler gestione voci filtri
        storage.ts                    — chiavi localStorage
        crypto.ts                     — sha256Base64
        settings/                     — modal estratti da AdminSettings
          PasswordModal.tsx
          PinRequestModal.tsx
          ThresholdModal.tsx
          ResetModal.tsx
          ImportModal.tsx
          ExportModal.tsx
      admina/                         — archivio vini (route /admina)
        WineAdminPage.tsx             — solo JSX (~180 righe)
        useWineAdminPage.ts           — tutto stato + handler + computed vini
        types.ts                      — Filters, WineFormState, Mode, defaultFilters
        components/
          AdminArchiveTable.tsx       — tabella inline-editable (~708 righe)
          useArchiveInlineEdit.ts     — logica editing inline 7 campi
          ArchiveTableHeader.tsx      — thead sortabile
          archiveTableUtils.ts        — costanti, tipi, funzioni pure
          InlineStickyAddSelect.tsx   — dropdown con "aggiungi voce"
          AdminArchiveToolbar.tsx
          BulkEditFilteredModal.tsx
          CategoryCreateModal.tsx
          WineArchiveFormModal.tsx
        utils/
          wineFilters.ts
          archiveExport.ts
    app/
      routes.ts                       — costanti route + helper isSettingsPath/isArchivePath
      events.ts                       — costanti nomi eventi custom e chiavi sessionStorage condivise
    data/                             — repository Supabase + localDb
      wineRepository.ts               — CRUD vini (~824 righe)
      dischargeRepository.ts          — CRUD scarichi (~492 righe)
      categoryRepository.ts
      originRepository.ts
      producerRepository.ts
      localDb.ts
      offlineDischargeQueue.ts
      archiveCsv.ts
    domain/                           — tipi e logica di dominio
    styles/                           — CSS modulare
    lib/supabase.ts                   — client Supabase
  public/                             — PWA assets (icone, manifest)
  vite.config.ts
  tsconfig.json
  .env.local                          — variabili ambiente (non committate)
```

## Routing

| Percorso        | Componente        | Descrizione                 |
| --------------- | ----------------- | --------------------------- |
| `/`             | HomePage          | Schermata scarichi          |
| `/admina`       | WineAdminPage     | Archivio vini completo      |
| `/impostazioni` | AdminPage         | Impostazioni, import/export |
| `/admin`        | → redirect legacy | Alias per /impostazioni     |

## Autenticazione

PIN SHA-256 locale (default "1909"), sessione 12h su `localStorage`.

## Supabase

- Progetto: `aezqtgadyaxdcptwlpci` (https://aezqtgadyaxdcptwlpci.supabase.co)
- Secret Replit: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`
- `vite.config.ts` espone le variabili come `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` (stripping `/rest/v1/`); accetta anche `VITE_SUPABASE_*` come fallback per Cloudflare Pages
- RPC `submit_discharge_session(uuid)` presente in DB (SECURITY DEFINER, search_path fixato 03/05/2026)
- `SUPABASE_DB_URL`: connessione diretta `db.*.supabase.co:5432` — funziona da Replit via psql
- Schema documentato in `DNA/08_SUPABASE_SETUP.md`
- Offline queue: `offlineDischargeQueue.ts` + `useOfflineDischargeQueueSync.ts`
- Free tier: progetto può andare in pausa → `ERR_NAME_NOT_RESOLVED` non è un bug del codice
- Secret Replit aggiornati l'11/05/2026: `SUPABASE_ANON_KEY`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL` tutti allineati al progetto `aezqtgadyaxdcptwlpci`.

## Pattern di refactoring consolidato

Ogni componente lungo viene diviso in:

1. **Hook** (`use<NomeComponente>.ts`) — tutto lo stato, i computed e gli handler
2. **Componente** (`<NomeComponente>.tsx`) — solo il JSX, usa l'hook
3. **Utils** (opzionale) — funzioni pure riusabili senza React

Hook già estratti (NON modificare la logica interna):

- `useHomePage.ts` — stato + 9 useEffect + computed + handler pagina scarichi
- `useWineAdminPage.ts` — stato + handler archivio vini
- `useArchiveInlineEdit.ts` — editing inline tabella archivio
- `useAdminSettings.ts` — stato + handler impostazioni
- `useAdminHistory.ts` — stato + handler storico sessioni
- `useRegistryManager.ts` — stato + handler gestione voci filtri

## Quality gate

Tutti i gate devono passare prima di ogni merge/deploy:

```bash
npm run typecheck   # TypeScript strict — zero errori
npm run lint        # ESLint --max-warnings 0
npm run test        # Vitest — 14/14 test
npm run format:check # Prettier — zero warning sui file progetto
npm run build       # Build produzione completa
```

## Download zip (limite 200 MB)

Il file `.replitignore` alla root esclude automaticamente dal "Download as zip":
`node_modules/`, `dist/`, `.git/`, `.cache/`, `.local/`, `*.tsbuildinfo`.
**Dimensione attesa: ~20 MB.** Dopo ricaricamento: premi Run — il workflow esegue `npm install && npm run dev` in automatico.

## Note di build

I chunk `vendor_excel` (938 KB) e `vendor_pdf` (422 KB) superano i 500 KB — comportamento atteso per questa tipologia di app; la PWA li precache correttamente.

## Navigazione admin sub-sezioni

`AdminGate` emette `ADMIN_SECTION_CHANGE_EVENT` (`scarichi:adminSectionChange`) via `CustomEvent` ogni volta che `section` cambia.
`App.tsx` ascolta l'evento e traccia `adminSection` → passa `adminInSubSection` a `BottomNav`.
Costanti centralizzate in `src/app/events.ts` (import da tutti i consumer).

Logica tab sinistra navbar (mobile):

| Stato                                     | Tab sinistra                                           |
| ----------------------------------------- | ------------------------------------------------------ |
| Pagina qualsiasi (Home, Archivio, ecc.)   | `Settings` ⚙️ + testo "Impostazioni" → `/impostazioni` |
| Home impostazioni (`!adminInSubSection`)  | nascosto — solo `Home` centrato                        |
| Sotto-sezione admin (`adminInSubSection`) | `CircleArrowLeft` button → `OPEN_ADMIN_HOME_EVENT`     |

CSS: `.navbarInnerCentered` (flex, justify-content: center) applicata quando `settingsHomeOnly=true`.

## Riepilogo Conferma Scarico

Card Riepilogo (`SummaryList`): nome vino completamente visibile su più righe — nessuno scroll orizzontale.
Override CSS su `.summaryItemButton .lineTitle`: `white-space: normal; overflow: visible; overflow-wrap: break-word`.
`.summaryDock .list`: `overflow-x: hidden`.

## Sync bidirezionale Sheet ↔ Supabase ↔ App (11/05/2026)

Architettura sync completa, debounced, con loop guard:

| Direzione        | Meccanismo                                                       | Latenza    |
| ---------------- | ---------------------------------------------------------------- | ---------- |
| App → Supabase   | Scrittura diretta REST                                           | Istantanea |
| Supabase → App   | `useRealtimeSync` (websocket Realtime)                           | ~2 sec     |
| Sheet → Supabase | `onSheetEdit_` flag + `processPendingSync_` timer                | ~1 min     |
| Supabase → Sheet | DB trigger webhook → `doPost` flag + `processPendingPull_` timer | ~1 min     |

**File coinvolti:**

- `apps/scarichi-vini/src/data/useRealtimeSync.ts` — hook React con subscribe a `postgres_changes` su `wines` / `spirits_products`. Cleanup safe via `client = supabase` capture nell'effect. Log warn solo su `CHANNEL_ERROR` / `TIMED_OUT`.
- `apps/scarichi-vini/src/data/wineRepository.ts` — esporta `invalidateWinesCache()`.
- `apps/scarichi-vini/src/data/spiritsRepository.ts` — esporta `invalidateSpiritsCacheAndSync()`.
- `apps/scarichi-vini/src/pages/home/useHomePage.ts` — chiama `useRealtimeSync(domain, refreshOnRemoteChange)` con debounce 2s.
- `scripts/google-apps-script/enoteca_sync.gs` — Apps Script con: `DEBOUNCE_MS=10s`, `MUTE_MS=45s`, due timer ogni 1 min (push/pull), `doPost` solo flag (no lock), loop guard via `MUTE_PUSH_KEY` / `MUTE_PULL_KEY`.

**Pattern loop guard Apps Script:**

- Prima di un push, viene scritto `MUTE_PULL_KEY = now`. I webhook che arrivano da Supabase entro 45s vengono ignorati da `doPost` (rispondono `muted:true`).
- Prima di un pull, viene scritto `MUTE_PUSH_KEY = now`. Le modifiche al Sheet entro 45s vengono ignorate da `onSheetEdit_`.
- Le modifiche multiple in serie coalescono in 1 sola sync (debounce 10s sul flag pending).

**Delete bidirezionale (11/05/2026):**

- Sheet → DB push: dopo l'upsert, recupera tutti gli ID presenti nel DB, calcola il diff con gli ID del foglio, cancella (hard delete) le righe assenti dal foglio via `DELETE ?id=in.(...)`.
- DB → Sheet pull: già completo — `clearDataKeepHeader_` + riscrittura totale; righe eliminate dal DB non riappaiono nel foglio.
- Funzioni aggiunte: `supabaseDeleteMissing_`, `supabaseSelectIds_`, `supabaseDelete_`.

**Latenza minima ineliminabile (limite Apps Script):**

| Direzione                 | Latenza minima | Latenza massima |
| ------------------------- | -------------- | --------------- |
| App → Supabase            | istantanea     | istantanea      |
| Supabase → App (Realtime) | ~2 s           | ~2 s            |
| Sheet → Supabase          | ~10 s          | ~70 s           |
| Supabase → Sheet          | ~10 s          | ~70 s           |

I timer di Apps Script non possono scendere sotto 1 minuto — è un limite della piattaforma.

**Stabilità:**

- Eliminata la cascata di errori `doPost` (prima: lock 30s × N webhook = timeout multipli).
- Realtime subscription verificata: `status: SUBSCRIBED` in console al mount.
- Quality gate verde: typecheck, lint, test 14/14, format, build.

## Ultimo deploy GitHub

Push via API del **03/05/2026** — 10 file sincronizzati su `enoteca-italiana/gestionale` branch `main`.
`deploy.sh` aggiornato: calcola diff `remote_SHA..HEAD` invece di `HEAD~1..HEAD`.

## Preferenze utente

- Lingua di comunicazione: **italiano**
- Standard: enterprise-grade, codice pulito senza commenti ridondanti
- Nessun mock/placeholder: dati reali da Supabase
- Refactoring: un file alla volta, zero modifiche a logiche business/layout/UX
