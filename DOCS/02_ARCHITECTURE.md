# Architettura

Ultimo aggiornamento: **07/04/2026 17:12 CEST**.

## Workspace

- Root `package.json` con npm workspaces.
- App principale: `apps/scarichi-vini/`.

## Stack

- Vite + React 18
- Routing: `wouter`
- PWA: `vite-plugin-pwa`

## Routing

- `/` → `HomePage`
- `/impostazioni` → `AdminPage`
- `/admin` → `AdminPage` (alias legacy supportato)
- `/admina` → `WineAdminPage` (archivio vini, desktop-first)
- `/admina/totali` → `WineTotalsPage` (dashboard totali archivio)

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
- `src/pages/admina/WineTotalsPage.tsx`

Nota Intro:

- durante la schermata intro, la `BottomNav` non viene renderizzata.

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
- pulsante `Aggiungi vino` in prima posizione a sinistra, seguito dal campo `Cerca...`;
- box compatto statistiche (`Totale`, `Soglia`, `Esauriti`) con comportamento filtro (rimosso filtro `Tutte le giacenze`);
- pulsante reset filtri dedicato tra box statistiche e comandi a destra:
  - azzera term + select (`all`) e riporta il filtro stock su `Totale`;
  - dimensioni e allineamento coerenti agli action button della toolbar;
  - stato attivo: colore evidenziato + lampeggio quando ci sono filtri applicati.
- filtri `Cerca...`, `Categoria`, `Produttore`, `Provenienza` complementari tra loro (opzioni ridotte in base ai filtri già applicati).
- selector custom su toolbar + inline tabella con voce `+ Aggiungi ...` fissa in cima e lista opzioni scrollabile.
- indicatori: `Totale` verde, `Soglia` ambra, `Esauriti` rosso;
- pulsante `Foglio Google` verde e pulsante `Totali` ambra in ultima posizione a destra;
- `Totali` apre `/admina/totali` con:
  - filtri complementari (`Categoria`, `Produttore`, `Provenienza`);
  - card `Totale acquisto`, `Totale vendita`, `Totale margine`, `Totale magazzino`;
  - nota conteggio voci incluse nel calcolo.
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
- `src/domain/normalizeWineText.ts` (policy centralizzata casing campi vino)

Standard UI dati vino:

- riga metadati sotto al nome vino: `Produttore • Anno(se presente) • Provenienza` (`formatWineInfoLine`).
- policy casing invariabile:
  - `category`, `name`, `origin` in **uppercase**
  - `producer` in **initcap**
  - enforcement su input, CSV, repository, snapshot sessioni e render info.

### Sessioni scarico (Supabase)

- `src/data/dischargeRepository.ts`
  - query `discharge_sessions` / `discharge_session_items`
  - snapshot metadati vino su item sessione (`wine_name`, `wine_age`, `wine_producer`, `wine_origin`, `wine_category`) per mantenere lo storico leggibile anche con vino rimosso
  - submit via RPC `submit_discharge_session`
- `src/data/useDischargeSessions.ts`
  - hook admin per storico/sospesi da Supabase

### Settings runtime

- `src/app/useAppSettings.ts`
- `src/app/useOnlineStatus.ts`
- `src/app/routes.ts` (costanti route + helper condivisi `isSettingsPath`/`isArchivePath`)

## Invarianti (da rispettare)

- File funzionali lunghi: target **~300–350 righe** per nuovi moduli; i file legacy oltre soglia si modularizzano solo con patch a rischio basso.
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
