# Enoteca Italiana — Gestionale Vini PWA

## Architettura

Monorepo npm workspace. App principale in `apps/scarichi-vini/`.

**Stack:** React 18 + Vite 5 + TypeScript strict + wouter (routing) + Supabase + vite-plugin-pwa

**Entry point dev server:** `npm run dev` → porta 5000

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
    data/                             — repository Supabase + localDb
      wineRepository.ts               — CRUD vini (~724 righe)
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

| Percorso        | Componente        | Descrizione                     |
|-----------------|-------------------|---------------------------------|
| `/`             | HomePage          | Schermata scarichi              |
| `/admina`       | WineAdminPage     | Archivio vini completo          |
| `/impostazioni` | AdminPage         | Impostazioni, import/export     |
| `/admin`        | → redirect legacy | Alias per /impostazioni         |

## Autenticazione

PIN SHA-256 locale (default "1909"), sessione 12h su `localStorage`.

## Supabase

- Progetto: `aezqtgadyaxdcptwlpci` (https://aezqtgadyaxdcptwlpci.supabase.co)
- Secret Replit: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`
- `vite.config.ts` espone le variabili come `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` (stripping `/rest/v1/`)
- RPC `submit_discharge_session(uuid)` presente in DB (creata manualmente)
- `SUPABASE_DB_URL`: usare URL **pooler** (`pooler.supabase.com:5432`), non la connessione diretta, perché Replit non raggiunge IPv6
- Schema documentato in `DNA/08_SUPABASE_SETUP.md`
- Offline queue: `offlineDischargeQueue.ts` + `useOfflineDischargeQueueSync.ts`
- Free tier: progetto può andare in pausa → `ERR_NAME_NOT_RESOLVED` non è un bug del codice

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
npm run test        # Vitest — 10/10 test
npm run format:check # Prettier — zero warning sui file progetto
npm run build       # Build produzione completa
```

## Download zip (limite 200 MB)

Il file `.replitignore` alla root esclude automaticamente dal "Download as zip":
`node_modules/`, `dist/`, `.git/`, `.cache/`, `.local/`, `*.tsbuildinfo`.
**Dimensione attesa: ~20 MB.** Dopo ricaricamento: premi Run — il workflow esegue `npm install && npm run dev` in automatico.

## Note di build

I chunk `vendor_excel` (938 KB) e `vendor_pdf` (422 KB) superano i 500 KB — comportamento atteso per questa tipologia di app; la PWA li precache correttamente.

## Preferenze utente

- Lingua di comunicazione: **italiano**
- Standard: enterprise-grade, codice pulito senza commenti ridondanti
- Nessun mock/placeholder: dati reali da Supabase
- Refactoring: un file alla volta, zero modifiche a logiche business/layout/UX
