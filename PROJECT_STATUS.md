# Enoteca — Scarichi Vini (PWA)

Ultimo aggiornamento: **13/03/2026 13:07 CET**.

## Scopo di questo file

Questo documento serve per riprendere il progetto su un nuovo PC in modo rapido e senza ambiguità:

- setup ambiente
- comandi per avvio/build
- troubleshooting tipico
- stato attuale (feature completate / da fare)
- punti chiave del codice
- come riprendere il lavoro con Cascade (prompt operativi)

---

## Quick start (nuovo PC)

### Prerequisiti

- Node.js LTS (consigliato 20.x)
- npm (incluso con Node)

### Install

Dalla root del repo:

```bash
npm install
```

### Dev

Dalla root:

```bash
npm run dev
```

Nota:

- La porta di default di Vite è `5173`.
- Se vedi `Port 5173 is already in use`, ferma l’altro processo oppure avvia Vite su un’altra porta.

### Build

```bash
npm run build
```

### Preview build

```bash
npm run preview
```

---

## Troubleshooting (pronto uso)

### Porta Vite occupata (5173)

- Verifica chi la sta usando:

```bash
lsof -iTCP:5173 -sTCP:LISTEN
```

- Poi chiudi il processo corretto (dal tuo terminale/IDE) oppure cambia porta (se decidi di farlo, allineare anche eventuali script).

### PWA / Service Worker (cache)

In sviluppo può capitare che il Service Worker mantenga cache “stale”.

- Se noti UI che non si aggiorna dopo modifiche, fai un hard refresh e/o rimuovi l’installazione PWA.

### Warning Tailwind “content missing”

Durante `build` può apparire un warning sul `content` di Tailwind. Al momento non blocca la build.

---

## Struttura repo

- Root workspace npm con `workspaces: apps/*`
- App: `apps/scarichi-vini`

Comandi root:

- `npm run dev` → `npm run dev -w @enoteca/scarichi-vini`
- `npm run build` → `npm run build -w @enoteca/scarichi-vini`
- `npm run preview` → `npm run preview -w @enoteca/scarichi-vini`

---

## Stato attuale funzionalità

### Completato (stato reale del progetto)

- Intro iniziale ~2.5s con logo
- Routing:
  - `/` Home sessione scarico
  - `/admin` Settings/Admin operativo
  - `/admina` Archivio vini (desktop-first)
- Inventario vini persistito in localStorage con seed e migrazione automatica
- Sessione di scarico:
  - apertura/chiusura sessione
  - ricerca per nome
  - risultati visibili **solo dopo ricerca** quando sessione ON
  - UI scarico per vino con stepper `- / +` (stile mobile)
  - per ogni vino in risultati: `Q.tà` (giacenza realtime) + `Scarico` (qty in sessione)
  - riepilogo sessione con correzioni
  - conferma finale con modale (controllata da toggle admin)
- Sessioni scarico:
  - conferma online su Supabase (`discharge_sessions` + RPC `submit_discharge_session`)
  - storico/sospesi admin letti da Supabase
  - in offline la conferma sessione è bloccata
- Admin:
  - login password (iniziale `1909`) e cambio password
  - toggle impostazioni (conferma finale, predisposizione nome utente)
  - storico sessioni inviate + reset con doppia conferma
  - pending queue: lista + delete singolo/massivo con conferma
  - reset totale (inventario + storico + pending)
- Admin archivio (`/admina`):
  - CRUD vini completo
  - tabella desktop-first con header sticky, separatori verticali, righe alternate e filler rows fino a fondo area
  - filtri in linea + pulsante `Aggiungi vino`
  - box statistiche-filtro `Totale / Soglia / Esauriti` (rimosso vecchio filtro `Tutte le giacenze`)
  - stato selezionato dei 3 filtri con colori invertiti (testo bianco)
  - q.tà `0` evidenziata in rosso
  - q.tà in soglia evidenziata in giallo chiaro
  - anno vuoto quando non presente (nessun placeholder in cella `ANNO`)
  - regola soglia: valore `Vuoto` oppure `>= 1` (mai `0`)
  - sui vini esistenti senza soglia valida: assegnazione automatica random `1..12`
  - colonne visibili: categoria, nome, anno, produttore, provenienza, acquisto, vendita, q.tà, magazzino, margine, azioni
  - note spostate in colonna `Azioni` tramite icona dedicata:
    - gialla e cliccabile se nota presente (apre modale note)
    - grigia e disabilitata se nota assente
  - categorie gestite da lista precompilata (niente input manuale libero)
  - provenienze gestite da lista precompilata (niente input manuale libero)
  - in entrambi i menu: `+ Aggiungi ...` con suggerimenti di valori uguali/simili e conferma libera
  - ordinamento `A-Z / Z-A` su `Categoria`, `Nome`, `Produttore`, `Provenienza` con bottone nell'header
  - formule automatiche:
    - `Magazzino = Acquisto × Q.tà`
    - `Margine = Vendita − Acquisto`
- PWA:
  - service worker + caching app shell/assets
  - auto-update
  - icone installazione complete per Android/iOS/desktop:
    - `pwa-192x192.png`, `pwa-512x512.png`
    - `pwa-192x192-maskable.png`, `pwa-512x512-maskable.png`
    - `apple-touch-icon.png`
- Seed dataset:
  - aggiunti 15 vini test (totale seed attuale: 20)

### In corso / parzialmente predisposto

- Integrazione Supabase:
  - repository CRUD presente con fallback schema legacy
  - operatività completa dipende da variabili ambiente e schema remoto allineato
- Sincronizzazione Google Sheets:
  - hook di integrazione predisposti lato codice
  - da completare/alimentare con credenziali e pipeline definitiva
- Deploy Render

### Ultimi aggiornamenti UI/asset (13/03/2026)

- Logo applicazione sostituito e ricompresso:
  - asset operativo: `apps/scarichi-vini/public/logo.png` (ottimizzato, ~77 KB)
  - mantenute proporzioni visive precedenti in header/app
  - intro lasciata invariata come dimensioni
- Intro:
  - aggiunta firma `By DERO` in basso schermata
  - rimossa la scritta `Avvio...`
- Tema colore:
  - elementi brand/pulsanti aggiornati su palette viola `#7c164a`
  - eccezione business archivio: q.tà `0` resta evidenziata in rosso acceso
- Archivio (`/admina`) toolbar filtri:
  - layout desktop su una riga
  - box statistiche compatto (`Totale`, `Soglia`, `Esauriti`) e rimozione filtro `Tutte le giacenze`
  - semantica colore statistiche: `Totale` verde, `Soglia` ambra, `Esauriti` rosso
  - stato selezionato con colori invertiti (testo bianco su sfondo colorato)
- Archivio (`/admina`) tabella:
  - quantità in soglia colorata ambra chiaro
  - ordinamento `A-Z / Z-A` su `Categoria`, `Nome`, `Produttore`, `Provenienza`
- Modale vino:
  - sfondo allineato al colore base app (bianco crema)
  - campo `Soglia` sulla stessa riga di `Provenienza` e convertito a selector standard (`Vuoto`, `1..99`)
  - campo `Q.tà` allineato a selector standard unico (`0..99`) come gli altri controlli
  - regola validazione: `Soglia` mai `0`
- Consistenza iPhone/Safari:
  - fix stile lista sessione su iOS (`button` ora eredita tipografia/colore) per allineare il design a desktop/local
- Asset/public cleanup:
  - rimossi file non usati: `logo.webp`, `logo home.png`, `icon.svg`
  - rigenerate icone installazione PWA (`pwa-192/512`, `maskable`, `apple-touch-icon`) con peso ridotto
- Documentazione:
  - mantenuta una sola scheda tecnica (`SCHEDA TECNICA ENOTECA ITALIANA.md` in root)
- Backup:
  - creato nuovo archivio: `backup/backup_13 Venerdi_13.07.tar.gz`
- GitHub / Deploy hygiene:
  - push su `main` completato con `gh auth login` (device flow) e script `./scripts/commit_github.sh`
  - rimossi dal tracking i file pesanti non necessari al deploy:
    - `backup/*.tar.gz`
    - `apps/scarichi-vini/dev-dist/*`
    - `*.tsbuildinfo`
  - `.gitignore` aggiornato per prevenire re-upload in futuro

### Verifica qualità (13/03/2026 01:48 CET)

- `npm run lint` ✅
- `npm run typecheck` ✅
- `npm run test` ✅ (2 test passati)
- `npm run build` ✅

---

## Decisioni UX recenti (importanti)

- Home (sessione OFF): lista vini **consultiva** (solo info + giacenza), niente azioni.
- Sessione (sessione ON): i vini compaiono solo quando fai ricerca.
- Controllo quantità scarico per vino: stepper `- / +` con quantità ben visibile.
- Bottom nav operativa: `Home` + `Archivio`.
- `Impostazioni` resta su `/admin`, non come CTA ridondante in `/admina`.

---

## Punti chiave del codice (dove mettere mano)

- Home:
  - `apps/scarichi-vini/src/pages/HomePage.tsx`

- Sessione locale e filtro ricerca:
  - `apps/scarichi-vini/src/pages/home/useLocalSession.ts`

- Lista risultati (consultiva vs interattiva):
  - `apps/scarichi-vini/src/pages/home/ResultsList.tsx`

- Riepilogo sessione:
  - `apps/scarichi-vini/src/pages/home/SummaryList.tsx`

- CSS globale:
  - `apps/scarichi-vini/src/styles.css`

- Modello dati:
  - `apps/scarichi-vini/src/domain/types.ts`
  - persistenza: `apps/scarichi-vini/src/data/*`

- Archivio vini (`/admina`):
  - `apps/scarichi-vini/src/pages/admina/WineAdminPage.tsx`
  - `apps/scarichi-vini/src/pages/admina/components/AdminArchiveToolbar.tsx`
  - `apps/scarichi-vini/src/pages/admina/components/AdminArchiveTable.tsx`
  - `apps/scarichi-vini/src/pages/admina/components/WineArchiveFormModal.tsx`

---

## Documentazione (cartella DOCS)

Indice:

- `DOCS/00_INDEX.md`

Documenti principali:

- `DOCS/01_REQUIREMENTS.md`
- `DOCS/02_ARCHITECTURE.md`
- `DOCS/03_LOCAL_STORAGE_MODEL.md`
- `DOCS/04_USER_FLOW_SESSION.md`
- `DOCS/05_ADMIN.md`
- `DOCS/06_OFFLINE_PWA.md`
- `DOCS/07_OPERATIONS_BACKUP.md`

---

## Riprendere il lavoro con Cascade (prompt pratici)

Quando importi il progetto su un nuovo PC, puoi chiedere:

1. “Avvia l’app e dimmi se gira correttamente”

- obiettivo: `npm install` + `npm run dev` + controllo errori console

1. “Fammi una panoramica delle modifiche non committate e dei file toccati”

- obiettivo: capire cosa manca prima di committare

1. “Implementiamo Supabase come source of truth”

- obiettivo: definire schema minimo + storage adapter + migrazione dalla persistenza locale

1. “Implementiamo sync Google Sheets ↔ Supabase”

- obiettivo: definire strategia (cron + webhook + edge function) e conflitti offline

---

## Nota su Git (importante)

Su questa macchina era presente un repo Git accidentale in `/Users/dero/.git` che inquinava `git status` con file personali.
È stato disattivato rinominando la cartella e poi è stato eseguito `git init` nella root corretta del progetto.

Se su un nuovo PC fai `git status` e vedi file esterni al progetto, **fermati** e verifica la root con:

```bash
git rev-parse --show-toplevel
```

### Push rapido su GitHub

Workflow previsto quando chiedi "**commit github**":

1. Assicurati di aver accettato la licenza Xcode una volta (macOS richiede admin):

   ```bash
   sudo xcodebuild -license
   ```

2. Configura una volta il remote se manca:

   ```bash
   git remote add origin https://github.com/dero975/enoteca.git
   ```

3. Imposta le tue credenziali Git (user name/email) e autenticati verso GitHub usando `gh auth login`, il macOS Keychain o `git credential-store` (non salvare token nel repo).

4. Da root del progetto esegui lo script helper (viene invocato anche dall'agente quando scrivi “commit github”):

   ```bash
   ./scripts/commit_github.sh "messaggio del commit"
   ```

   Lo script:
   - verifica che ci siano modifiche;
   - chiede il commit message se non passato;
   - fa `git add -A`, `git commit` e `git push origin main`.

Se l'autenticazione GitHub non è configurata o la porta è bloccata, il push fallirà: sistemare le credenziali e rilanciare.

### Regola repository leggero (Render)

- Non versionare artefatti temporanei o backup compressi.
- In `main` devono restare solo sorgenti e file necessari al deploy.
- Cartella `backup/` consentita solo per script/tooling (`make_backup.sh`), non per archivi `.tar.gz/.zip`.

Dettaglio operativo anche in `DOCS/07_OPERATIONS_BACKUP.md#github`.
