# Architettura

Ultimo aggiornamento: **13/03/2026 03:12 CET**.

## Workspace

- Root `package.json` con npm workspaces.
- App principale: `apps/scarichi-vini/`.

## Stack

- Vite + React 18
- Routing: `wouter`
- PWA: `vite-plugin-pwa`

## Routing

- `/` → `HomePage`
- `/admin` → `AdminPage`
- `/admina` → `WineAdminPage` (archivio vini, desktop-first)

## Moduli chiave

### UI

- `src/components/`
  - `Logo.tsx`
  - `BottomNav.tsx`
  - `ConfirmModal.tsx`
  - `Toast.tsx`

Asset logo:

- `apps/scarichi-vini/public/logo.png` (asset unico usato in UI, ottimizzato).
- `Logo.tsx` usa direttamente `logo.png`.

### Pagine

- `src/pages/HomePage.tsx`
- `src/pages/AdminPage.tsx`
- `src/pages/admina/WineAdminPage.tsx`

### Home (sessione)

- `src/pages/home/`
  - `ResultsList.tsx`
  - `SummaryList.tsx`
  - `SessionConfirmModal.tsx`
  - `useLocalSession.ts`

### Admin

- `src/pages/admin/`
  - `AdminGate.tsx`
  - `AdminLogin.tsx`
  - `AdminHome.tsx`
  - `AdminSettings.tsx`
  - `AdminHistory.tsx`
  - `AdminPending.tsx`
  - `useAdminAuth.ts`
  - `storage.ts`

### Admin archivio vini (`/admina`)

- `src/pages/admina/`
  - `WineAdminPage.tsx`
  - `types.ts`
  - `components/AdminArchiveToolbar.tsx`
  - `components/AdminArchiveTable.tsx`
  - `components/WineArchiveFormModal.tsx`

Toolbar archivio:

- filtri ottimizzati su una riga desktop;
- box compatto statistiche (`Totale`, `Soglia`, `Esauriti`) con comportamento filtro (rimosso filtro `Tutte le giacenze`);
- indicatori: `Totale` verde, `Soglia` ambra, `Esauriti` rosso;
- stato selezionato dei tre pulsanti con colori invertiti (testo bianco su sfondo colorato).
- colonna `ANNO`: se dato assente, cella vuota (senza placeholder).
- colonna `Azioni`: include icona note (gialla se presenti, grigia/disabilitata se assenti) con preview note in modale.
- ordinamento `A-Z / Z-A` su header `Categoria`, `Nome`, `Produttore`, `Provenienza`.

### Dati locali

- `src/data/localDb.ts`
- `src/data/useLocalDb.ts`
- `src/data/mockWines.ts` (seed + dataset test)
- `src/data/wineRepository.ts` (CRUD locale/Supabase con fallback schema legacy)
- `src/data/categoryRepository.ts` (lista categorie gestite + upsert controllato)
- `src/data/originRepository.ts` (lista provenienze gestite + upsert controllato)

### Sessioni scarico (Supabase)

- `src/data/dischargeRepository.ts`
  - query `discharge_sessions` / `discharge_session_items`
  - submit via RPC `submit_discharge_session`
- `src/data/useDischargeSessions.ts`
  - hook admin per storico/sospesi da Supabase

### Settings runtime

- `src/app/useAppSettings.ts`
- `src/app/useOnlineStatus.ts`

## Invarianti (da rispettare)

- File funzionali lunghi: **max ~300–350 righe**.
- Logica modulare:
  - hook per stato/azioni
  - componenti UI per rendering
- No refactor cosmetici: si cambia solo per bug o per requisiti.

## Note PWA

- `registerSW()` avviene in `src/main.tsx`.
- In dev viene eseguito `unregisterSwInDevOnce()` per evitare cache stale durante sviluppo.
- icone installazione multi-device:
  - Android/desktop: `pwa-192x192.png`, `pwa-512x512.png` + varianti `maskable`
  - Apple: `apple-touch-icon.png` + meta tag dedicati in `index.html`

## Note stato attuale

- Architettura ibrida:
  - Home/Admin settings con persistenza locale per runtime/UI.
  - `/admina` predisposta per CRUD su Supabase con fallback locale.
  - storico/sospesi admin integrati su Supabase.
- Modello vino esteso (`purchasePrice`, `salePrice`, `warehouse`, `margin`, `notes`):
  - `warehouse` e `margin` sono calcolati automaticamente.
  - `threshold` gestisce la soglia bottiglie (`Vuoto` oppure `>=1`, mai `0`).
