# Architettura

Ultimo aggiornamento: **04/05/2026 — CEST**.

---

## Workspace

Monorepo npm workspaces. Root `package.json` coordina i workspace.

- App principale: `apps/scarichi-vini/`
- Package name: `@enoteca/scarichi-vini`

---

## Stack

| Layer   | Tecnologia                                                  |
| ------- | ----------------------------------------------------------- |
| UI      | React 18 + TypeScript strict                                |
| Build   | Vite 5                                                      |
| Routing | wouter                                                      |
| PWA     | vite-plugin-pwa (Workbox)                                   |
| Backend | Supabase (PostgreSQL + PostgREST + RPC)                     |
| CSS     | CSS Modules-style (classi globali per file), zero framework |
| Test    | Vitest                                                      |
| Linting | ESLint + Prettier                                           |

---

## Routing

| Percorso        | Componente      | Descrizione                     |
| --------------- | --------------- | ------------------------------- |
| `/`             | `HomePage`      | Schermata principale scarichi   |
| `/admina`       | `WineAdminPage` | Archivio vini desktop-first     |
| `/impostazioni` | `AdminPage`     | Impostazioni admin              |
| `/admin`        | `AdminPage`     | Alias legacy di `/impostazioni` |

Tutte le route sono lazy-loaded via `React.lazy()` in `App.tsx`.

Costanti route in `src/app/routes.ts`:

- `APP_ROUTES.HOME = '/'`
- `APP_ROUTES.ARCHIVE = '/admina'`
- `APP_ROUTES.SETTINGS = '/impostazioni'`
- `APP_ROUTES.SETTINGS_LEGACY = '/admin'`
- Helper: `isSettingsPath(path)` → true se `/impostazioni` o `/admin`
- Helper: `isArchivePath(path)` → true se `/admina`

---

## Entry point

### `src/main.tsx`

- Monta `<App />` su `#root`
- Registra il Service Worker PWA via `registerSW()` da `virtual:pwa-register`
- In dev: esegue `unregisterSwInDevOnce()` per evitare cache stale

### `src/App.tsx`

Componente root. Gestisce:

1. **Offline queue sync**: `useOfflineDischargeQueueSync()` — attiva al mount e ascolta eventi online/focus/visibility per flush coda locale.
2. **Supabase keepalive**: `useSupabaseKeepalive()` — ping silenzioso ogni 24h per prevenire pausa progetto Supabase free tier.
3. **Routing lazy**: `<Suspense>` + `<Switch>` con tre route lazy.
4. **Gate PIN avvio app**: overlay modale se `appPinRequiredOnStart = true` e PIN non ancora verificato nella sessione corrente (stato in `sessionStorage`).
5. **Gate PIN impostazioni**: overlay modale se `appPinRequiredForSettings = true` e si naviga verso `/impostazioni`; si azzera ad ogni uscita dalla route.
6. **Intro visibility**: callback `onIntroVisibilityChange` passata a `HomePage` per nascondere `BottomNav` durante l'intro.
7. **Reazione a `settingsChangedEvent`**: aggiorna in tempo reale i flag PIN senza refresh pagina.

Chiavi `sessionStorage`:

- `scarichi.app.pinUnlocked.v1` → PIN avvio app verificato nella sessione browser corrente.

PIN default: `1909` (SHA-256 Base64, calcolato al primo uso se assente in localStorage).

---

## Struttura directory completa

```
apps/scarichi-vini/
  index.html                    — entry HTML (preconnect Supabase, PWA meta)
  vite.config.ts                — build, PWA, chunk splitting, server porta 5001
  tsconfig.json                 — TypeScript strict
  .env.local                    — VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY (non committato)

  src/
    main.tsx                    — mount React + registrazione SW
    App.tsx                     — root: routing, gate PIN, keepalive, offline queue

    app/
      routes.ts                 — costanti route + helper isSettingsPath/isArchivePath
      appDomain.tsx             — contesto dominio attivo (`wine` | `spirits`) + persistenza localStorage
      useOfflineDischargeQueueSync.ts  — hook flush coda offline (startup/online/focus/visibility)
      useOnlineStatus.ts        — hook navigator.onLine + eventi online/offline
      useDebouncedValue.ts      — hook debounce generico (usato in ricerca archivio)

    components/
      BottomNav.tsx             — navbar fissa inferiore (Home / Archivio / Impostazioni)
      ConfirmModal.tsx          — modale conferma generica riutilizzabile
      Logo.tsx                  — logo SVG/PNG inline
      Toast.tsx                 — notifica temporanea (successo/errore)

    domain/
      types.ts                  — tipi fondamentali: Wine, SessionItem, WineId
      normalizeWineText.ts      — normalizzazione campi testo vino (uppercase/initcap)
      normalizeOrigin.ts        — uppercase provenienza
      formatWineInfoLine.ts     — riga info vino: "Produttore • Anno • Provenienza"

    lib/
      supabase.ts               — client Supabase (normalizza URL anche se env contiene `/rest/v1/`)
      useSupabaseKeepalive.ts   — hook ping Supabase ogni 24h via localStorage TTL

    app/
      appDomain.tsx             — provider React del dominio attivo (`wine` / `spirits`)
      appDomainContext.ts       — tipo/hook/contesto dominio, separati dal provider per Fast Refresh pulito

    data/
      localDb.ts                — DB locale (localStorage), tipi, seed, notifiche cross-tab
      useLocalDb.ts             — hook React per lettura/scrittura localDb con coalescing
      wineRepository.ts         — CRUD vini: Supabase + fallback locale, paginazione, sync
      dischargeRepository.ts    — sessioni scarico: CRUD Supabase, RPC, snapshot, storico
      useDischargeSessions.ts   — hook admin: carica storico/sospesi da Supabase on-demand
      offlineDischargeQueue.ts  — coda locale sessioni offline (localStorage FIFO)
      archiveCsv.ts             — parse e build CSV archivio vini
      categoryRepository.ts     — lista categorie gestite + upsert Supabase
      producerRepository.ts     — lista produttori gestiti (cache locale)
      originRepository.ts       — lista provenienze gestite (cache locale)

    integrations/
      googleSheetsSync.ts       — sync opzionale verso Google Sheets via webhook
                                   (placeholder lato frontend; sync live principale demandata ai trigger DB su `wines` / `spirits_products`)

    pages/
      AdminPage.tsx             — wrapper minimo che monta AdminGate

      home/
        useLocalSession.ts      — hook gestione sessione scarico (items, qty, stati)
        StartSessionDomainModal.tsx — modale scelta `Vini` / `Spirits` prima dell'apertura sessione
        ResultsList.tsx         — lista risultati ricerca con bottoni scarico -1/-2/-3
        SummaryList.tsx         — riepilogo vini in sessione con +1/-1/elimina
        SessionConfirmModal.tsx — modale conferma invio sessione

      admin/
        AdminGate.tsx           — router interno admin (home / history / settings)
        AdminLogin.tsx          — form login password admin
        AdminHome.tsx           — home admin con pulsanti azioni rapide
        AdminSettings.tsx       — orchestratore modali impostazioni
        AdminHistory.tsx        — storico sessioni inviate con filtri e reset
        AdminRegistryManager.tsx — gestione voci filtri (categorie/produttori/provenienze)
        AdminPending.tsx        — sessioni in sospeso (legacy, non più nel flusso principale)
        useAdminAuth.ts         — hook autenticazione admin (hash SHA-256, sessione 12h)
        crypto.ts               — sha256Base64() via Web Crypto API
        storage.ts              — chiavi localStorage admin + getBool/setBool + settingsChangedEvent
        settings/
          PasswordModal.tsx     — cambio password admin (con conferma)
          PinRequestModal.tsx   — toggle PIN avvio app e PIN impostazioni
          ThresholdModal.tsx    — imposta soglia unica su tutto l'archivio attivo (`vini` / `spirits`)
          ResetModal.tsx        — reset archivio con doppia conferma + PIN
          ImportModal.tsx       — import CSV con scelta modalità + PIN
          ExportModal.tsx       — export CSV/Excel/PDF archivio

      admina/
        WineAdminPage.tsx       — pagina archivio vini (orchestratore, ~689 righe)
        types.ts                — tipi locali admina (SortField, FilterState, ecc.)
        utils/
          archiveExport.ts      — export Excel (exceljs, lazy) e PDF (jspdf, lazy)
          archiveTableUtils.ts  — costanti tabella, helper calcoli, TABLE_RENDER_BATCH
        components/
          AdminArchiveToolbar.tsx    — toolbar filtri su singola riga desktop (+ Foglio Google + Totali)
          AdminArchiveTable.tsx      — tabella inline-editable con rendering progressivo (~1219 righe)
          WineArchiveFormModal.tsx   — modale aggiungi/modifica vino
          InlineStickyAddSelect.tsx  — dropdown con "+ Aggiungi …" sempre in cima
          BulkEditFilteredModal.tsx  — modifica massiva su filtri attivi (categoria)
          CategoryCreateModal.tsx    — creazione rapida categoria da tendina

    styles/
      styles.css                — import barrel dei 4 file CSS
      base.css                  — variabili CSS, reset, layout, intro, navbar, override background Spirits
      components.css            — bottoni, card, nav items, animazioni
      archive.css               — tabella archivio, toolbar, filtri, modale archivio
      misc.css                  — modali generici, toast, summary dock, admin, impostazioni

scripts/
  sql/
    2026-05-04_spirits_domain_setup.sql      — setup dominio Spirits lato Supabase
    2026-05-04_spirits_threshold_enable.sql  — migrazione incrementale soglie Spirits
  google-apps-script/
    enoteca_sync.gs            — sorgente versionato del progetto Google Apps Script (`Vini` + `Spirits`)
```

Nota UI dominio:

- modalità `Vini`: sfondo base crema (`--bg: #fdfaf2`);
- modalità `Spirits`: override globale `body[data-domain='spirits'] { --bg: #d6eaf4; }` per sfondo azzurro naturale;
- pulsanti e palette funzionale restano invariati salvo elementi di switch dominio.

---

## Modello dati dominio

### `Wine` (src/domain/types.ts)

```ts
type Wine = {
  id: string; // UUID o wine_<ts>_<rand>
  category?: string; // Initcap (opzionale)
  name: string; // UPPERCASE
  age?: string; // anno vendemmia (label UI: ANNO), stringa libera
  producer: string; // Initcap
  origin: string; // UPPERCASE
  threshold?: number; // soglia allerta (intero >= 1, undefined = nessuna soglia)
  purchasePrice?: number;
  salePrice?: number;
  vintage?: string; // campo legacy (non più usato attivamente)
  qty: number; // intero >= 0
  warehouse?: number; // calcolato: purchasePrice × qty
  margin?: number; // calcolato: salePrice − purchasePrice
  notes?: string;
};
```

### `SessionItem` (src/domain/types.ts)

```ts
type SessionItem = {
  wineId: string;
  qty: number;
};
```

---

## Campi calcolati (business rules)

- `salePrice = purchasePrice × 1.30` quando `salePrice` manca in input (fallback applicativo centralizzato)
- `warehouse = purchasePrice × qty` (arrotondato 2 decimali)
- `margin = salePrice − purchasePrice` (arrotondato 2 decimali)
- `warehouse` e `margin` sono calcolati sia lato frontend sia lato DB (trigger Supabase)
- `salePrice` oggi è auto-derivata lato frontend/repository quando assente; lato DB non è ancora forzata dal trigger
- `qty` mai sotto zero (vincolo frontend + DB)
- `threshold` valida: intero >= 1 oppure assente (null/undefined). Mai `0`.

---

## Build e chunking (vite.config.ts)

| Chunk             | Contenuto                 | Dimensione gzip |
| ----------------- | ------------------------- | --------------- |
| `vendor_supabase` | @supabase/supabase-js     | ~46 KB          |
| `vendor_excel`    | exceljs                   | ~270 KB (lazy)  |
| `vendor_pdf`      | jspdf + jspdf-autotable   | ~137 KB (lazy)  |
| `html2canvas`     | html2canvas               | ~48 KB (lazy)   |
| `index`           | React + wouter + core app | ~54 KB          |
| `WineAdminPage`   | archivio vini             | ~12 KB          |
| `HomePage`        | schermata scarichi        | ~7 KB           |

`vendor_excel` e `vendor_pdf` sono **lazy-loaded** (dynamic import in `archiveExport.ts`): scaricati solo all'azione export, non al caricamento iniziale.

Server dev: porta **5001** (strictPort, host: true, allowedHosts: true).

---

## PWA

- `registerType: 'autoUpdate'` — aggiornamento automatico senza prompt.
- Manifest: `id='/'`, `display='standalone'`, `orientation='portrait'`, `theme_color='#7c164a'`.
- Icone: `pwa-192x192.png`, `pwa-512x512.png` (purpose: any) + varianti `maskable`.
- Apple: `apple-touch-icon.png` + meta tag dedicati in `index.html`.
- Workbox precache: tutti i file `js/css/html/ico/png/svg/webmanifest`.
- In dev: `unregisterSwInDevOnce()` per evitare cache stale.

---

## Performance CSS (02/05/2026)

Ottimizzazioni applicate su tutti i CSS:

- Rimosso `filter: blur(2px)` dall'intro — solo `opacity + transform` (GPU-composited).
- `will-change: transform` su `.navbar` (fixed) + `.summaryDock` (fixed) + `.toast` (fixed).
- `will-change: opacity` su bottoni con animazione pulse infinita.
- `touch-action: manipulation` su `.button` e `.navNavItem` — elimina ritardo 300ms tap mobile.
- `-webkit-tap-highlight-color: transparent` globale — elimina flash blu tap Android.
- `-webkit-overflow-scrolling: touch` su tutte le aree `overflow-y: auto` dell'archivio.
- `transform: translateZ(0)` su elementi fixed per forzare compositing layer GPU.
- `preconnect` + `dns-prefetch` Supabase in `index.html` per ridurre latenza DNS.

---

## Invarianti architetturali

- File funzionali nuovi: target ~300–350 righe; file legacy oltre soglia si modularizzano solo con patch a rischio basso.
- Logica separata da rendering: hook per stato/azioni, componenti per UI.
- Zero refactor cosmetici: si cambia solo per bug o requisiti espliciti.
- Nessun mock/placeholder nei dati: sempre Supabase o fallback localStorage reale.
- Nessun campo `supplier/fornitore` nel frontend (legacy DB, non letto né scritto).
