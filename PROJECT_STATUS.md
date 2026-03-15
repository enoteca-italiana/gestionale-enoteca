# Enoteca — Scarichi Vini (PWA)

Ultimo aggiornamento: **15/03/2026 20:30 CET**.

## Scopo di questo file

Questo documento serve per riprendere il progetto su un nuovo PC in modo rapido e senza ambiguità:

- setup ambiente
- comandi per avvio/build
- troubleshooting tipico
- stato attuale (feature completate / da fare)
- punti chiave del codice
- come riprendere il lavoro con Cascade (prompt operativi)

## Ultimi aggiornamenti (14/03/2026)

- Admin:
  - rimossa pagina intermedia `Sessioni`; il pulsante home è ora `Sessioni storico` e apre direttamente lo storico.
  - nuova azione `Imposta Soglie` in Admin, con ordine pulsanti:
    - `Sessioni storico`, `Importa archivio`, `Imposta Soglie`, `Aggiorna password`, `Reset totale`.
  - `Imposta Soglie` applica una soglia unica su tutti i vini:
    - doppia conferma;
    - PIN admin obbligatorio;
    - update massivo su Supabase + allineamento locale.
- Storico sessioni:
  - card cliccabili con apertura dettaglio contenuto sessione;
  - UI semplificata (rimossi elementi ridondanti);
  - data/ora formattate `18 Marzo 2026, 15:05` (mese con iniziale maiuscola, no secondi);
  - reset storico fisso in basso, con doppia conferma e PIN.
- Sessioni sospese:
  - rimosse dal flusso operativo e dalla UI admin.

## Ultimi aggiornamenti (15/03/2026)

- Performance Admin/Supabase:
  - caricamento storico sessioni reso **on-demand** (solo quando apri `Sessioni storico`);
  - rimossa la chiamata Supabase bloccante all’ingresso in `/admin`;
  - cache in memoria per storico con TTL breve per ridurre round-trip ripetuti;
  - query storico alleggerita:
    - limite server-side (default 300 sessioni);
    - conteggio item per sessione letto in una singola query con relation count;
    - eliminata query separata che scaricava tutte le righe `discharge_session_items`.
- Reset storico:
  - dopo reset, aggiornamento stato/cache locale senza refetch immediata (evitata query superflua).

- UX Admin:
  - evitando schermate vuote: durante il loading dello storico (`/admin` → `Sessioni storico`) viene mostrata una card `Caricamento…` invece di rendering `null`.

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
  - vini già aggiunti al riepilogo nascosti dalla lista risultati (modifiche quantità solo da riepilogo)
  - riepilogo sessione semplificato (titolo centrato, rimossi testi riassuntivi ridondanti)
  - messaggio `Scarico Aggiunto!` mostrato nel modale vino alla conferma
  - su mobile, in sessione ON è scrollabile solo la lista vini (parte alta fissa)
  - fix modale vino: pulsanti `+ / -` aggiornano quantità senza chiusura automatica
  - fix Safari/iOS: titolo `Riepilogo` nero (niente blu browser default)
  - pulsante primario sessione rinominato in `Conferma Scarico`
  - conferma finale con modale (controllata da toggle admin)
- Sessioni scarico:
  - conferma online su Supabase (`discharge_sessions` + RPC `submit_discharge_session`)
  - riconciliazione difensiva post-submit su `wines.qty` per garantire allineamento giacenze archivio/storico
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
  - colonne visibili: categoria, nome, anno, produttore, provenienza, fornitore, acquisto, vendita, q.tà, magazzino, margine, azioni
  - note spostate in colonna `Azioni` tramite icona dedicata:
    - gialla e cliccabile se nota presente (apre modale note)
    - grigia e disabilitata se nota assente
  - categorie gestite da lista precompilata (niente input manuale libero)
  - provenienze gestite da lista precompilata (niente input manuale libero)
  - fornitori gestiti da lista precompilata (niente input manuale libero)
  - in tutti i menu gestiti: `+ Aggiungi ...` con suggerimenti di valori uguali/simili e conferma libera
  - categorie archivio allineate al registry Supabase `public.categories`
  - fornitori archivio allineati al registry Supabase `public.suppliers`
  - in modifica vino: fornitore non più bloccante in edit su record legacy (resta obbligatorio in create)
  - colonna `Q.tà` con modifica inline:
    - click sul valore per edit rapido nella cella
    - input solo numerico da tastiera (niente lettere/simboli/selector)
    - su `Invio` apertura modale conferma prima del salvataggio
  - ordinamento `A-Z / Z-A` su `Categoria`, `Nome`, `Produttore`, `Provenienza`, `Fornitore` con bottone nell'header
  - formule automatiche:
    - `Magazzino = Acquisto × Q.tà`
    - `Margine = Vendita − Acquisto`
  - Assistente AI archivio:
    - apertura da pulsante AI in toolbar
    - modale conversazionale con analisi dati archivio
    - vista `Impostazioni` dedicata con soli campi `API key` + `Tipo agent`
    - import chiave da file `.txt` nelle impostazioni
    - chat allineata in colonna verticale (stile chat classica)
    - sanitizzazione robusta della chiave (`sk-...`) prima della chiamata API
    - nessuna scrittura dati su DB (solo analisi)
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
  - nuova colonna `Fornitore` inserita subito dopo `Provenienza` (spazio ricavato da `Nome`)
  - ordinamento `A-Z / Z-A` su `Categoria`, `Nome`, `Produttore`, `Provenienza`, `Fornitore`
  - icone `A/Z` allineate a destra nella rispettiva cella header
- Modale vino:
  - sfondo allineato al colore base app (bianco crema)
  - campo `Soglia` sulla stessa riga di `Provenienza` e convertito a selector standard (`Vuoto`, `1..99`)
  - campo `Fornitore` aggiunto come selector standard gestito (`+ Aggiungi fornitore…`)
  - campo `Q.tà` allineato a selector standard unico (`0..99`) come gli altri controlli
  - regola validazione: `Soglia` mai `0`
- Supabase:
  - predisposto script SQL dedicato: `sql/supabase_add_supplier.sql`
  - aggiunta colonna `supplier` su `public.wines` + indice + tabella `public.suppliers`
- Consistenza iPhone/Safari:
  - fix stile lista sessione su iOS (`button` ora eredita tipografia/colore) per allineare il design a desktop/local
  - fix specifico `Riepilogo` (colore titolo nero forzato anche su Safari iOS)
  - migliorato scroll mobile: contenuto pagina bloccato, scroll interno su lista vini
- Asset/public cleanup:
  - rimossi file non usati: `logo.webp`, `logo home.png`, `icon.svg`
  - rigenerate icone installazione PWA (`pwa-192/512`, `maskable`, `apple-touch-icon`) con peso ridotto
- Documentazione:
  - mantenuta una sola scheda tecnica (`SCHEDA TECNICA ENOTECA ITALIANA.md` in root)
- Backup:
  - creato nuovo archivio: `backup/backup_13 Venerdi_17.53.tar.gz`
- GitHub / Deploy hygiene:
  - push su `main` completato con `gh auth login` (device flow) e script `./scripts/commit_github.sh`
  - rimossi dal tracking i file pesanti non necessari al deploy:
    - `backup/*.tar.gz`
    - `apps/scarichi-vini/dev-dist/*`
    - `*.tsbuildinfo`
  - `.gitignore` aggiornato per prevenire re-upload in futuro
- Export/Import archivio:
  - export Excel migrato a `.xlsx` reale (no warning formato/estensione)
  - export Excel con stile professionale coerente alla tabella archivio:
    - header verde chiaro, righe alternate, bordi, `Nome` in grassetto
    - q.tà colorata (rosso `0`, ambra in soglia), colonne auto-size con limiti min/max
  - export PDF migrato a generazione nativa file (`jsPDF + autoTable`), senza popup/print browser
  - PDF con logo Enoteca Italiana su ogni pagina, footer pagina e layout compatto landscape
  - naming file export uniformato:
    - `archivio_vini_13 Marzo 2026.xlsx`
    - `archivio_vini_13 Marzo 2026.pdf`
  - impostazioni admin: import archivio CSV con validazione e conferma
  - import CSV con sostituzione totale record archivio (Supabase + cache locale allineata)

### Ultimi aggiornamenti AI + toolbar (14/03/2026)

- Assistente AI (`/admina`):
  - unificata la chat in una sola vista (rimossa la sezione impostazioni separata nel modale);
  - selezione modello spostata accanto al pulsante `Invia`;
  - chiamata `Responses API` stabilizzata (fix errore payload `input_text`);
  - contesto AI esteso con dati archivio completi + contesto sessioni storico/sospese;
  - modalità operativa web+app attiva lato chiamata AI con vincoli anti-divulgazione nel system prompt.
- Configurazione API key:
  - supporto variabile ambiente `VITE_OPENAI_API_KEY` (consigliato);
  - supporto fallback modello con `VITE_OPENAI_MODEL`.
- Toolbar archivio:
  - fix chirurgico altezze pulsanti: allineamento uniforme basato su variabile CSS condivisa;
  - riduzione dimensionale progressiva dei pulsanti top in base alla richiesta utente.

### Verifica qualità (14/03/2026 15:20 CET)

- `npm run lint` ✅
- `npm run typecheck` ✅
- `npm run test` ✅ (8 test passati)
- `npm run build` ✅

### Verifica qualità (15/03/2026 20:29 CET)

- `npm run lint` ✅
- `npm run typecheck` ✅
- `npm run test` ✅ (8 test passati)
- `npm run build` ✅

### Verifica qualità (13/03/2026 17:53 CET)

- `npm run lint` ✅
- `npm run typecheck` ✅
- `npm run test` ✅ (3 test passati)
- `npm run build` ✅
- `npm run test:coverage` ✅

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

---

## Aggiornamento rapido (14/03/2026 17:33 CET)

- Admin semplificato:
  - rimosso titolo `Admin` dalla home admin.
  - rimossi pulsante e pagina “Impostazioni” dal flusso utente.
  - azioni `Aggiorna password`, `Importa archivio`, `Reset totale` disponibili direttamente nella home admin.
  - fix bug: click azioni non cambia più pagina, apre i modali restando in home admin.
- Conferma sessione scarico:
  - conferma finale sempre obbligatoria (rimossa opzione di disattivazione).
  - rimossa opzione “Nome utente per scarico” dalle impostazioni e dal flusso conferma.
- Uniformità UI area admin:
  - pulsanti principali uniformati a forma/colore del pulsante `Sessioni`.
  - blocchi azione centrati verticalmente nella viewport (home admin e schermata sessioni).
- Verifica qualità eseguita:
  - `npm run -s typecheck` ✅
  - `npm run -s lint` ✅
  - `npm run -s test` ✅
  - `npm run -s build` ✅
- Audit asset `public`:
  - nessun PNG 100% inutilizzato rilevato.
  - nessuna eliminazione effettuata per evitare regressioni PWA/favicon/export/UI.
