# Scarichi Vini (PWA)

App frontend del progetto Enoteca (workspace `@enoteca/scarichi-vini`).

Ultimo aggiornamento: **07/04/2026 17:12 CEST**.

## Quick Start

Dalla root del monorepo:

```bash
npm install
npm run dev
```

Comandi utili:

- `npm run build`
- `npm run preview`
- `npm run dev -w @enoteca/scarichi-vini -- --port 5001` (porta dedicata)

Nota tecnica (07/04/2026):

- in sviluppo locale la PWA è disabilitata (`vite.config.ts -> VitePWA.devOptions.enabled = false`) per evitare cache/service worker stale che possono bloccare il bootstrap dev;
- in build production la PWA resta attiva.

## Funzionalità principali

- Sessione scarico mobile-first (`/`) con supporto offline.
- Intro iniziale (2.5s): durante l’intro la Bottom Nav non viene mostrata.
- Routing post-intro:
  - desktop (Safari/Chrome, web o installata): redirect automatico a `/admina` dopo intro
  - mobile: resta su `/` (home) dopo intro
- Conferma sessione integrata su Supabase (RPC `submit_discharge_session`).
- Sessione scarico aggiornata:
  - CTA primaria rinominata in `Conferma Scarico`
  - nel modale vino, conferma con feedback inline `Scarico Aggiunto!`
  - in sessione aperta, i vini già presenti nel riepilogo non compaiono più nella lista principale
  - riepilogo semplificato (titolo centrato, rimosse etichette riassuntive ridondanti)
  - su mobile, scroll confinato alla sola lista vini (header/ricerca/CTA fissi)
  - guardia abbandono sessione dalla Navbar:
    - se sessione aperta con almeno 1 vino e l’utente clicca `Home/Archivio/Impostazioni`, viene richiesto conferma;
    - su conferma, la sessione viene chiusa e l’utente viene portato sempre alla Home;
    - su annulla, resta nella sessione in corso.
  - fix modale scarico: `+/-` aggiornano il valore senza chiusura involontaria
  - fix iOS Safari: titolo `Riepilogo` forzato su colore nero coerente con app
  - modalità consultiva Home:
    - click/tap su card vino apre modale `Giacenza`;
    - modifica solo quantità tramite selector scroll (`0..999`);
    - doppia conferma prima del salvataggio;
    - update sincronizzato su locale + Supabase;
    - toast `Giacenza aggiornata` in verde (2s).
- Admin impostazioni (`/impostazioni`, compat legacy `/admin`) con autenticazione locale.
  - azione `Reset archivio` con PIN:
    - cancella archivio vini e pulisce i registry/cache filtri correlati
    - storico sessioni preservato (indipendente dall'archivio vini)
  - in `Sessioni storico`:
    - filtro temporale desktop con preset rapidi (`Tutto`, `Oggi`, `7/30/90 giorni`, `6/12 mesi`, `Anno corrente`, `Personalizzato`)
    - intervallo manuale `Da/A` e pulsante reset filtri con icona frecce
    - filtraggio per giorno (senza ora)
    - reset storico selettivo nel modale PIN:
      - `Niente (cancella tutto)`, `Ultimi 7 giorni`, `Ultimi 30 giorni`, `Ultimi 3 mesi`, `Ultimi 12 mesi`
      - vengono eliminate solo le sessioni `submitted` più vecchie della finestra scelta
  - `Gestione voci filtri` (`/admin`):
    - apertura ottimizzata con warm start locale + sync remoto in background;
    - cache in-memory a TTL breve per riaperture rapide;
    - creazione nuova voce via modale standard (non inline);
    - enforcement casing live su voci filtro:
      - `Categorie` uppercase;
      - `Produttori` iniziale maiuscola;
      - `Provenienze` uppercase;
    - eliminazione voce: i vini collegati mantengono il record ma il campo viene svuotato (render `-`).
  - `Esporta archivio` (modale):
    - pulsante Excel verde;
    - pulsante PDF rosso;
    - stato `Esportazione...` mostrato solo sul pulsante del formato selezionato.
- Archivio vini desktop-first (`/admina`) con CRUD completo:
  - colonne estese (categoria, nome, anno, produttore, provenienza, prezzi, q.tà, azioni)
  - toolbar filtri ottimizzata su una riga desktop con box statistiche compatto (`Totale`, `Soglia`, `Esauriti`)
  - pulsante `Aggiungi vino` in prima posizione a sinistra, prima del box `Cerca...`
  - pulsante reset filtri tondo (tra box statistiche e comandi a destra), con diametro coerente agli action button:
    - reset completo filtri a default (`Totale` + tutti i select su `Tutti` + ricerca vuota)
    - stile: sfondo bianco, bordo grigio leggero, icona frecce viola
  - il box statistiche sostituisce il vecchio filtro `Tutte le giacenze`
  - filtri archivio (`Cerca...`, `Categoria`, `Produttore`, `Provenienza`) complementari tra loro
  - filtri archivio (`Categoria`, `Produttore`, `Provenienza`) con shortcut `+ Aggiungi ...` direttamente nelle tendine
    - la voce `+ Aggiungi ...` è sempre fissa in cima (toolbar + inline tabella), anche durante lo scroll opzioni
  - pulsanti statistiche con stato selezionato a colori invertiti (testo bianco)
  - `Soglia` in tono giallo/ambra, `Esauriti` in tono rosso
  - q.tà `0` evidenziata in rosso acceso
  - q.tà in soglia evidenziata in giallo chiaro
  - `ANNO` vuoto quando assente
  - `Soglia` nel modale vino con selector standard (`Vuoto` oppure `1..99`, mai `0`)
  - `Q.tà` nel modale vino con selector standard (`0..99`) allineato agli altri controlli
  - note consultabili da icona dedicata in `Azioni`
  - categoria selezionabile solo da lista gestita, con `+ Aggiungi categoria…` e suggerimenti anti-duplicato
  - provenienza selezionabile solo da lista gestita, con `+ Aggiungi provenienza…` e suggerimenti anti-duplicato
  - allineamento registry da Supabase:
    - categorie lette da `public.categories`
  - colonna `Q.tà` con edit inline:
    - click sul valore per entrare in edit
    - input solo numerico da tastiera (senza selector)
    - conferma via modale su tasto `Invio`
  - ordinamento `A-Z / Z-A` su colonne `Categoria`, `Nome`, `Produttore`, `Provenienza`
  - modifica massiva su risultati filtrati:
    - apertura da click destro tabella (solo con filtri attivi e risultati presenti)
    - campi supportati: `Categoria`
    - sicurezza: `Conferma` + `PIN admin` prima dell'applicazione
  - funzionalità `Nota Scarico` rimossa dal runtime Archivio/Home per semplificare il flusso operativo.
  - calcoli automatici:
    - `Magazzino = Acquisto × Q.tà`
    - `Margine = Vendita − Acquisto`
  - standard rendering info sotto al nome vino: `Produttore • Anno(se presente) • Provenienza`
  - policy campi testuali vino (input, CSV, visualizzazione, export):
    - `Categoria`, `Nome`, `Provenienza` sempre in **MAIUSCOLO**
    - `Produttore` sempre con **iniziale maiuscola**
  - modale aggiungi/modifica vino:
    - `Acquisto`/`Vendita` supportano decimali e centesimi in digitazione (`virgola`/`punto`) con parsing numerico al salvataggio
  - pulsante reset filtri:
    - con filtri attivi cambia colore e lampeggia;
    - dopo reset torna allo stato normale
  - export archivio: Excel/PDF con icone dockate in alto a destra (solo icone)
  - pulsante `Totali` (ambra) in ultima posizione a destra, dopo `Foglio Google`
  - pagina `Totali Archivio` (`/admina/totali`):
    - filtri `Categoria`, `Produttore`, `Provenienza` complementari;
    - card aggregate `Totale acquisto`, `Totale vendita`, `Totale margine`, `Totale magazzino`;
    - indicatore centrale `N voci incluse nel calcolo`;
    - pulsante `Esci` per ritorno a `/admina`.
  - performance avanzata (dataset grandi):
    - route lazy-loaded (`/`, `/impostazioni`, `/admin`, `/admina`) per startup più rapido
    - rendering progressivo liste (`Carica altri vini` / `Carica altre righe`)
    - filtri con `useDeferredValue` (Home + Archivio)
    - coalescing scritture local DB (batch ravvicinati) per ridurre jank durante update quantità
    - ricerca Home con debounce + indice testuale memoizzato (meno CPU su digitazione)
    - lookup O(1) via mappe per sessione/riepilogo/modali (meno scansioni su migliaia di righe)
    - autoload progressivo con `IntersectionObserver` su liste lunghe (Home/Archivio/Storico)
    - normalizzazione memoizzata campi filtro archivio per ridurre lavoro per-riga
    - fetch paginato `wines` allineato al limite API Supabase (page size 1000) per evitare blocco a 1000 righe
- Logo applicativo ottimizzato in `public/logo.png` per ridurre peso asset.
- Icone installazione PWA multi-device:
  - Android/desktop: `pwa-192x192.png`, `pwa-512x512.png` + `maskable`
  - iOS/Safari: `apple-touch-icon.png`
- Tema PWA/title bar allineato al brand: `#7c164a` (manifest + meta theme-color)
- Export PDF archivio: numerazione pagine in footer `1/N`.

## Quality Gate

- `npm run lint` passed
- `npm run typecheck` passed
- `npm run test` passed
- `npm run build` passed

## Setup su un altro PC

1. Clona il repo.
2. Verifica Node LTS 20.x (`node -v`).
3. Esegui `npm install` dalla root.
4. Avvia `npm run dev`.
5. Se porta occupata: `lsof -iTCP:5173 -sTCP:LISTEN`.
6. Se UI stale in PWA: hard refresh o rimozione SW/PWA installata.

## Variabili ambiente

- Crea `.env` da `.env.example`.
- Supabase corrente (07/04/2026):
  - `VITE_SUPABASE_URL=https://aezqtgadyaxdcptwlpci.supabase.co`
  - `VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlenF0Z2FkeWF4ZGNwdHdscGNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1NTE3MzYsImV4cCI6MjA5MTEyNzczNn0.XHygA3zVLT10OICJMsKJ8EmVK1-VUkIop9jFG4aZciQ`
- Con Supabase configurato, storico/sospesi sessioni usano le tabelle dedicate server-side.
- Post-submit sessione: riconciliazione difensiva delle giacenze `wines.qty` per garantire allineamento archivio/storico anche in caso di RPC parziale.
- Script SQL enterprise DB ops: `scripts/sql/supabase_enterprise_index_cleanup.sql`.
- Script SQL policy casing campi vino: `scripts/sql/supabase_text_casing_policy.sql`.
- Cloudflare Pages SPA routing:
  - file `public/_redirects` incluso per deep-link client-side (`/impostazioni`, `/admin`, `/admina`).

## Regole Deploy (Cloudflare Pages)

- Repository mantenuto leggero: esclusi dal tracking i file pesanti/temporanei.
- Non versionare:
  - `backup/*.tar.gz`, `backup/*.zip`
  - `apps/scarichi-vini/dev-dist/`
  - `*.tsbuildinfo`
