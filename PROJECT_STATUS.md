# Enoteca — Scarichi Vini (PWA)

Ultimo aggiornamento: **25/03/2026 12:55 CET**.

## Ultimi aggiornamenti (25/03/2026 - wave 19, hardening Security Advisor Supabase)

- Security Advisor (production) completamente allineato:
  - `0 errors`
  - `0 warnings`
  - `0 info`
- Risolto alert critico `RLS Disabled in Public` su:
  - `public.suppliers`
  - `public.categories`
  - `public.categories_backup_20260313`
  - `public.origins`
- Fix RLS/grants applicato in modalità non generica e aderente al runtime reale app:
  - `categories` + `suppliers` mantenute operative per frontend anon con privilegi minimi (`SELECT`, `INSERT`, `DELETE`);
  - `origins` + `categories_backup_20260313` mantenute chiuse al pubblico.
- Hardening sicurezza completato:
  - warning `Function Search Path Mutable` eliminati con `search_path` esplicito sulle funzioni segnalate;
  - warning `Extension in Public` risolto spostando `pg_trgm` nello schema `extensions`;
  - warning `RLS Policy Always True` risolti sostituendo policy permissive con policy esplicite a ruolo;
  - info `RLS Enabled No Policy` azzerati con deny-policy esplicite sulle tabelle volutamente chiuse.

## Ultimi aggiornamenti (17/03/2026 - wave 18, PIN hardening + UX sicurezza admin)

- Modale `Richiesta PIN` (`/admin`):
  - doppio controllo PIN nello stesso modale:
    - `Richiesta PIN all'avvio App`
    - `Richiesta PIN pagina IMPOSTAZIONI`
  - controlli aggiornati a switch orizzontali touch-friendly `ON/OFF` visibili.
  - stato colore switch:
    - `ON` attivo verde;
    - `OFF` attivo viola;
    - stato non attivo bianco.
  - pulsante `Chiudi` centrato, larghezza coerente agli switch e stile viola.
- Sicurezza accesso `Impostazioni`:
  - rimosso sblocco persistente della pagina impostazioni;
  - con richiesta PIN impostazioni attiva, il PIN viene richiesto a ogni nuovo accesso alla route `/admin`.
- Sicurezza avvio app:
  - fix runtime toggle: `ON` su PIN avvio app attiva subito il gate (nessuno stato sbloccato residuo).
- Cambio password admin:
  - aggiunto campo `Conferma nuova password`;
  - validazione match obbligatoria prima della conferma.
- Quality gate sessione:
  - `npm run lint -w @enoteca/scarichi-vini` ✅
  - `npm run typecheck -w @enoteca/scarichi-vini` ✅
  - `npm run test -w @enoteca/scarichi-vini -- --run` ✅ (15 test)

## Scopo di questo file

Questo documento serve per riprendere il progetto su un nuovo PC in modo rapido e senza ambiguità:

- setup ambiente
- comandi per avvio/build
- troubleshooting tipico
- stato attuale (feature completate / da fare)
- punti chiave del codice
- come riprendere il lavoro con Cascade (prompt operativi)

## Ultimi aggiornamenti (17/03/2026 - wave 17, home giacenza + registry manager performance)

- Home (`/`), solo modalità consultiva (sessione chiusa):
  - click/tap su card vino apre modale `Giacenza`;
  - selector a scroll per modificare esclusivamente `qty` (`0..999`);
  - conferma in due step (`Conferma` + modale conferma finale);
  - salvataggio su locale + Supabase con refresh inventory;
  - stile modale ottimizzato mobile:
    - `Annulla` bianco con bordo viola;
    - box valore giacenza ridotto in larghezza e ingrandito;
    - toast `Giacenza aggiornata` verde con durata 2s.
- `Gestione voci filtri` (`/admin`):
  - ottimizzato caricamento iniziale:
    - warm start da inventory/registry locali;
    - sync remoto in background;
    - cache in-memory TTL 60s per riaperture rapide.
  - delete voce aggiornato:
    - warning centrato;
    - testo allineato alle nuove regole;
    - i vini associati mantengono il record ma il campo viene impostato vuoto (`-` in UI), non `0`.
- Quality gate sessione:
  - `npm run format:check` ✅
  - `npm run lint -w @enoteca/scarichi-vini` ✅
  - `npm run typecheck -w @enoteca/scarichi-vini` ✅
  - `npm run test -w @enoteca/scarichi-vini -- --run` ✅ (15 test)
  - `npm run build -w @enoteca/scarichi-vini` ✅
- Hygiene:
  - nessun marker conflitto merge rilevato.

## Ultimi aggiornamenti (16/03/2026 - wave 15, import CSV hardening + performance archivio)

- Import CSV (`AdminSettings`):
  - supporto operativo per due modalità import:
    - `Aggiungi record ad archivio esistente`
    - `Sostituisci intero archivio con il CSV`
  - la scelta modalità è richiesta al click su `Importa archivio`, nel primo step di conferma (`IMPORTANTE!`, titolo rosso).
  - protezione finale resa obbligatoria con doppio step:
    - conferma modalità
    - conferma con `PIN admin` prima dell'esecuzione reale import.
- Performance archivio (`/admina`) ulteriormente ottimizzata:
  - hydration locale immediata e sync remoto in background mantenuta;
  - fetch paginato vini con prima pagina + pagine successive in parallelo;
  - deduplica richieste concorrenti su `listWines()` (riuso promise in-flight);
  - riduzione rendering iniziale tabella (batch progressivo alleggerito) e skip sort ridondante nella vista default (`Nome A-Z`).
- Robustezza operativa:
  - nessun marker conflitto merge rilevato nel codice (`<<<<<<<`, `=======`, `>>>>>>>`).
- Quality gate sessione:
  - `npm run format:check` ✅
  - `npm run typecheck` ✅
  - `npm run lint` ✅
  - `npm run test` ✅ (15 test)
  - `npm run build` ✅
  - `npm run test:coverage` non disponibile negli script root correnti (`Missing script`).

## Ultimi aggiornamenti (17/03/2026 - wave 16, tuning UX import/home + hardening performance)

- Home (`/`):
  - aggiunto pulsante refresh forzato (icona frecce) sulla stessa riga di `Inizia sessione di scarico`, allineato a destra;
  - action: riallinea inventory con refresh esplicito da repository;
  - bordo pulsante ribilanciato a tono meno marcato mantenendo stile coerente.
- Admin Home (`/admin`):
  - riordinati pulsanti azioni rapide:
    - `Sessioni storico`, `Imposta Soglie`, `Aggiorna password`, `Richiesta PIN`, `Importa archivio`, `Reset archivio`.
- Import CSV (`AdminSettings`):
  - nel primo modale import, dopo completamento:
    - rimosso box `Scegli file`;
    - visibili solo titolo, testo esito centrato e pulsante `Chiudi` (viola);
    - sottotitolo operativo nascosto nello stato completato.
  - testo esito aggiornato:
    - sostituzione: `Import completato: N Vini`;
    - aggiunta: `Import completato: aggiunti N Vini`.
- Filtri archivio (`/admina`):
  - dopo creazione di un nuovo valore da `+ Aggiungi ...` nelle tendine
    (`Categoria`, `Produttore`, `Provenienza`, `Fornitore`),
    il filtro resta sempre su default `Tutte/Tutti` (`all`).
- Performance hardening risk-zero:
  - eliminata scrittura ridondante su localStorage durante `refreshInventory` (hook aggiorna solo stato UI);
  - introdotto guard di persistenza (`sameInventory`) per non salvare/propagare inventory invariata;
  - polling stato nota Home alleggerito (`12s`) mantenendo sync su eventi focus/pageshow/visibility.
- Quality gate finale:
  - `npm run format:check` ✅
  - `npm run typecheck` ✅
  - `npm run lint` ✅
  - `npm run test` ✅ (15 test)
  - `npm run build` ✅
- Hygiene:
  - nessun marker conflitto merge rilevato.

## Ultimi aggiornamenti (16/03/2026 - wave 14, hardening finale sync/archivio)

- Archivio `/admina`:
  - reset filtri esteso anche agli stati interni tabella (ordinamenti colonne verdi + stati inline), oltre ai filtri toolbar;
  - stato iniziale coerente al refresh (filtri default + reset stato tabella).
- Celle tabella archivio:
  - placeholder `—` centrato solo quando il valore è assente in `Categoria`, `Produttore`, `Provenienza`, `Fornitore`;
  - quando presente un valore, allineamento a sinistra invariato.
- UX messaggi:
  - rimossi i toast spot inline in Archivio (es. `Nome aggiornato`), mantenendo solo error handling non invasivo.
- Sync Home ↔ Archivio:
  - sincronizzazione locale resa più robusta con `BroadcastChannel` + evento custom;
  - Home aggiorna inventory automaticamente su `focus/pageshow/visibilitychange` (senza refresh manuale).
- Performance/stabilità:
  - deduplica refresh inventory concorrenti (`useLocalDb.refreshInventory`);
  - polling nota scarico in Home sospeso quando tab non visibile.
- Quality gate finale eseguito:
  - `npm run format` ✅
  - `npm run format:check` ✅
  - `npm run typecheck` ✅
  - `npm run lint` ✅
  - `npm run test` ✅ (15 test)
  - `npm run test:coverage` ✅
  - `npm run build` ✅

## Ultimi aggiornamenti (16/03/2026 - wave 11, policy casing persistente)

- Policy testo campi vino resa vincolante in codice:
  - `Categoria`, `Nome`, `Provenienza` sempre in **MAIUSCOLO**;
  - `Produttore`, `Fornitore` sempre con **iniziale maiuscola**.
- Enforcement applicato su:
  - input CRUD archivio, repository vini, import/export CSV, snapshot sessioni scarico, rendering info vino.
- Nuovo modulo centralizzato:
  - `apps/scarichi-vini/src/domain/normalizeWineText.ts`.
- Nuovo script SQL versionato per Supabase:
  - `scripts/sql/supabase_text_casing_policy.sql`
  - trigger `before insert/update` + normalizzazione retroattiva su `public.wines`.
- Nuova documentazione operativa:
  - `DOCS/10_TEXT_CASING_POLICY.md` (riferimento unico, valido anche per script SQL futuri).

## Ultimi aggiornamenti (16/03/2026 - wave 12, quality gate enterprise + backup)

- Quality gate eseguito su codice aggiornato:
  - `npm run lint -w @enoteca/scarichi-vini` ✅
  - `npm run typecheck -w @enoteca/scarichi-vini` ✅
  - `npm run test -w @enoteca/scarichi-vini -- --run` ✅ (11 test passati)
  - `npm run build -w @enoteca/scarichi-vini` ✅
- Verifica conflitti Git:
  - nessun marker merge (`<<<<<<<`, `=======`, `>>>>>>>`).
- Verifica hygiene:
  - nessun file obsoleto rimosso in questa wave per vincolo risk-zero su logica/layout;
  - top file più lunghi identificati (`AiAssistantModal.tsx`, `AdminSettings.tsx`, `WineAdminPage.tsx`) e mantenuti invariati lato comportamento.
- Backup creato senza eliminare backup precedenti:
  - `backup/backup_16 Lunedi_16.24.tar.gz`.

## Ultimi aggiornamenti (16/03/2026 - wave 13, bulk edit archivio + robustezza reset/csv)

- Import CSV archivio (`AdminSettings`):
  - regola obbligatoria ridotta a `Nome` + `Produttore`;
  - fallback automatici in parse:
    - `Provenienza` mancante => `N/D`,
    - `Q.tà` mancante => `0`;
  - sanitizzazione marker foglio: `Categoria = CATEGORIA` ignorata durante import.
- Reset archivio hard:
  - oltre a `public.wines`, il reset ora pulisce anche registry/local cache dei filtri (`categories`, `origins`, `suppliers`, `producers`) e notifica refresh UI archivio;
  - eliminati residui filtro “fantasma” post-reset.
- Archivio `/admina`:
  - nuove opzioni `+ Aggiungi ...` direttamente nelle tendine filtri (`Categoria`, `Produttore`, `Provenienza`, `Fornitore`);
  - `+ Aggiungi ...` resa prima voce visibile nelle tendine dove presente (filtri + modali archivio).
- Modifica massiva su filtri attivi:
  - apertura con click destro in tabella (solo con filtri attivi e risultati presenti);
  - applicazione bulk su tutti i vini filtrati;
  - campi supportati: `Categoria` e `Fornitore` (anche insieme nella stessa operazione);
  - sicurezza: doppio step `conferma` + `PIN admin` obbligatorio.
- Quality gate finale:
  - `npm run lint -w @enoteca/scarichi-vini` ✅
  - `npm run typecheck -w @enoteca/scarichi-vini` ✅
  - `npm run test -w @enoteca/scarichi-vini` ✅ (13 test passati)
  - `npm run build -w @enoteca/scarichi-vini` ✅

## Ultimi aggiornamenti (14/03/2026)

- Admin:
  - rimossa pagina intermedia `Sessioni`; il pulsante home è ora `Sessioni storico` e apre direttamente lo storico.
  - nuova azione `Imposta Soglie` in Admin, con ordine pulsanti:
    - `Sessioni storico`, `Importa archivio`, `Imposta Soglie`, `Aggiorna password`, `Reset archivio`.
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

- Storico sessioni (UI):
  - nessun nome/titolo sessione (solo data/ora + numero vini + numero bottiglie);
  - nel dettaglio, quantità scaricate per vino mostrate inline (senza pill).
  - aggiunto filtro data (desktop) in alto a destra, con matching per giorno (senza ora).

- Home (Intro):
  - durante l’intro la Bottom Nav non viene mostrata.

- Standard UI metadati vino:
  - riga info sotto al nome: `Produttore • Anno(se presente) • Provenienza`.

- Provenienza (origin):
  - salvata e mostrata sempre in **MAIUSCOLO** (input + rendering).

- Archivio `/admina` (toolbar):
  - label sopra i 4 filtri (Categoria/Produttore/Provenienza/Fornitore) senza disallineare la riga;
  - i select mostrano solo il valore selezionato (default `Tutte/Tutti`);
  - export Excel/PDF: icone dockate in alto a destra (solo icone) + ricerca più larga;
  - pulsante reset filtri tondo tra `Esauriti` e `Aggiungi vino`:
    - reset completo a default (`Totale` + select su `Tutti` + ricerca vuota);
    - stile coerente: bianco con bordo grigio leggero, icona frecce viola.

- Admin reset archivio:
  - azione home rinominata da `Reset totale` a `Reset archivio`;
  - reset applicato solo a `public.wines` (archivio vini), storico sessioni non toccato;
  - gestione robusta vincoli DB:
    - con schema aggiornato (`wine_id` nullable + FK `ON DELETE SET NULL`) il reset archivio completa senza impattare lo storico;
    - dettaglio storico mantiene i metadati vino tramite snapshot su `discharge_session_items`.

## Ultimi aggiornamenti (16/03/2026)

- Storico sessioni (desktop):
  - filtro intervallo `Da/A` su una sola riga;
  - aggiunto reset filtri con icona frecce;
  - introdotto preset rapidi periodo (`Tutto`, `Oggi`, `7/30/90 giorni`, `6/12 mesi`, `Anno corrente`, `Personalizzato`).
- Verifica tecnica completa:
  - `npm run lint` ✅
  - `npm run typecheck` ✅
  - `npm run test` ✅
  - `npm run build` ✅
- Hygiene:
  - nessun marker di conflitto (`<<<<<<<`, `=======`, `>>>>>>>`) rilevato;
  - documentazione Supabase riallineata ai file realmente presenti in repository.

## Ultimi aggiornamenti (16/03/2026 - wave 2)

- Performance runtime (enterprise hardening):
  - `localDb` con coalescing scritture (batch ravvicinati) per ridurre blocchi UI durante modifiche quantità ad alta frequenza;
  - Home: filtro testo deferred + riduzione lavoro O(n) ridondante durante sessione;
  - Archivio: hydration locale immediata prima del refresh Supabase;
  - Archivio: filtro testuale ottimizzato con indice in memoria per ridurre lavoro CPU per battitura.
- Quality gate post-ottimizzazioni:
  - `npm run lint` ✅
  - `npm run typecheck` ✅
  - `npm run test` ✅
  - `npm run build` ✅

## Ultimi aggiornamenti (16/03/2026 - wave 3)

- Performance runtime (home/sessione):
  - ricerca testuale con debounce dedicato e indice testuale memoizzato per ridurre CPU durante digitazione;
  - lookup vini ottimizzati con mappe `id -> wine` / `id -> qty` / `id -> index` (meno scansioni lineari su liste grandi);
  - semplificato flusso Home rimuovendo passaggio deferred ridondante sulla lista filtrata.
- Quality gate post-wave 3:
  - `npm run lint` ✅
  - `npm run typecheck` ✅
  - `npm run test` ✅
  - `npm run build` ✅

## Ultimi aggiornamenti (16/03/2026 - wave 4)

- Performance liste grandi:
  - Home risultati: autoload progressivo via `IntersectionObserver` + fallback pulsante `Carica altri vini`;
  - Archivio tabella desktop: autoload progressivo righe + fallback pulsante `Carica altre righe`;
  - Storico sessioni: rendering progressivo con batch, autoload e fallback pulsante.
- Performance filtri e query locali:
  - Archivio: campi filtro normalizzati memoizzati per vino (`category/producer/origin/supplier`) per ridurre trasformazioni ripetute;
  - fetch paginato Supabase su `wines` allineato al limite API (`1000`) per evitare stop prematuro a 1000 record.
- Assistente AI (stabilità + velocità):
  - cache in memoria TTL per storico sessioni usato dal contesto AI;
  - precomputo analytics inventario memoizzato (leaderboard/breakdown) evitando ricalcolo completo a ogni domanda.
- DB ops:
  - aggiunto script SQL versionato per cleanup indici duplicati:
    - `scripts/sql/supabase_enterprise_index_cleanup.sql`

## Ultimi aggiornamenti (16/03/2026 - wave 5)

- Archivio desktop UX:
  - confinato lo scroll verticale alla sola tabella; pagina esterna fissa su desktop.
- Assistente AI (copertura dataset storico completa):
  - lettura paginata completa di `discharge_sessions` e `discharge_session_items` (submitted), non più limitata a 600/1200;
  - contesto AI arricchito con blocco `recency` per:
    - vini mai scaricati,
    - vini non scaricati da >3 mesi / >6 mesi / >12 mesi,
    - classifica “più vecchi o mai scaricati”;
  - metadata contesto con conteggi record effettivamente caricati (`loadedSubmittedSessions`, `loadedSubmittedItems`).
- Quality gate post-wave 5:
  - `npm run lint` ✅
  - `npm run typecheck` ✅
  - `npm run test` ✅

## Ultimi aggiornamenti (16/03/2026 - wave 6)

- Assistente AI “strict analytics mode”:
  - regole prompt più rigide: niente stime/ipotesi, uso esplicito `non disponibile nel contesto` quando manca un dato;
  - nuovo blocco `inventory.byProducer` con metriche determinate per produttore (vini, qty attuale, qty scaricata, % mai scaricati, % sotto soglia/esauriti);
  - nuovo blocco `sessions.dataQuality` con conteggi/samples deterministici su:
    - nomi mancanti,
    - qty non positive,
    - duplicati sessione-vino,
    - date incoerenti;
  - nuovo blocco `sessions.outliers` con analisi outlier sessioni basata su media/deviazione standard.
- Quality gate post-wave 6:
  - `npm run lint` ✅
  - `npm run typecheck` ✅
  - `npm run test` ✅

## Ultimi aggiornamenti (16/03/2026 - UX desktop startup)

- Intro + landing differenziata per device:
  - desktop (Safari/Chrome, web/installata): dopo intro redirect a `/admina`;
  - mobile: dopo intro resta su `/` (home).
- Theme UI shell PWA:
  - `theme_color` allineato al viola brand `#7c164a` (manifest + meta).

## Ultimi aggiornamenti (16/03/2026 - wave 7, AI export PDF)

- Assistente AI (`/admina`):
  - export messaggi assistente limitato a **PDF** (rimossi CSV/XLSX dal flusso AI);
  - pulsante `Esporta PDF` mostrato **solo** sui messaggi assistente derivanti da richieste esplicite di report/export;
  - PDF assistente con logo `Enoteca Italiana` in alto, proporzioni preservate;
  - numerazione pagine in piccolo formato `1/N` su tutte le pagine.
- Export PDF Archivio:
  - aggiunta numerazione pagine globale in footer `1/N` su tutte le pagine.
- Quality gate post-wave 7:
  - `npm run lint` ✅
  - `npm run typecheck` ✅
  - `npm run test` ✅
  - `npm run build` ✅

## Ultimi aggiornamenti (16/03/2026 - wave 8, reset storico selettivo)

- Admin storico (`/admin` → `Sessioni storico`):
  - nel modale di conferma con PIN è stata aggiunta la selezione “Mantieni storico” con opzioni:
    - `Niente (cancella tutto)`
    - `Ultimi 7 giorni`
    - `Ultimi 30 giorni`
    - `Ultimi 3 mesi`
    - `Ultimi 12 mesi`
  - il reset elimina solo le sessioni `submitted` più vecchie del periodo scelto.
- Data layer:
  - introdotta API repository `clearSubmittedHistoryByRetention(...)` con cutoff temporale server-side.
  - hook storico aggiornato per refresh coerente dopo reset selettivo.
- Quality gate post-wave 8:
  - `npm run lint` ✅
  - `npm run typecheck` ✅
  - `npm run test` ✅

## Ultimi aggiornamenti (16/03/2026 - wave 9, guardia sessione navbar)

- Home/sessione in corso:
  - introdotta guardia navigazione su click Navbar (`Home`, `Archivio`, `Impostazioni`) quando sessione scarico è aperta e contiene almeno 1 vino;
  - visualizzato modale conferma abbandono con azioni `Conferma` / `Annulla`;
  - su conferma: la sessione viene chiusa correttamente (`endSession`) e l'utente viene sempre riportato alla Home (`/`), su mobile e desktop.
- Stabilità routing Home:
  - click su pulsante `Home` forzato verso pagina Home reale, senza riattivare redirect non desiderati nel flusso di navigazione esplicita.
- Quality gate post-wave 9:
  - `npm run lint` ✅
  - `npm run typecheck` ✅
  - `npm run test` ✅
  - `npm run build` ✅

## Ultimi aggiornamenti (16/03/2026 - wave 10, Nota Scarico Supabase strict)

- Nota Scarico end-to-end:
  - nuovo repository dati `dischargeNoteRepository.ts` collegato a RPC Supabase;
  - flusso stati supportato: `draft -> ready -> in_progress -> completed`;
  - Home sincronizzata con stato remoto (`get_discharge_note_state`) senza refresh manuale (eventi + focus/pageshow + polling leggero);
  - avvio da Home con RPC `start_ready_discharge_note`;
  - chiusura nota a submit sessione riuscito con RPC `complete_in_progress_discharge_note`.
- Archivio `/admina`:
  - drawer `Nota Scarico` semplificato in stile blocco note;
  - ricerca unificata placeholder `Cerca vino...`;
  - esclusione vini già presenti nella lista nota;
  - conferma nota con modale;
  - avviso operativo se esiste nota precedente ancora `in_progress`.
- Toolbar archivio:
  - pulsante `Nota` in prima posizione riga;
  - stato visivo verde quando esiste nota con contenuto (`draft/ready/in_progress`).
- Governance codice:
  - rimosso fallback locale per Nota Scarico (modalità strict Supabase);
  - nessun marker di conflitto;
  - quality gate rieseguito completo.
- Quality gate post-wave 10:
  - `npm run lint` ✅
  - `npm run typecheck` ✅
  - `npm run test` ✅
  - `npm run build` ✅

## Ultimi aggiornamenti (16/03/2026 - wave 11, Nota Scarico semplificata + storico)

- Archivio `/admina`:
  - rimossa la segnalazione bloccante “nota precedente da concludere” nel drawer;
  - dopo `Conferma nota scarico`, la bozza si resetta subito per nuova compilazione;
  - aggiunto mini-storico in basso con le ultime 3 note `completed`:
    - `Reinvia` (riattiva la nota in Home come `ready`);
    - `Elimina` (rimozione storica).
- Toolbar archivio:
  - stato pulsante `Nota` semplificato: verde solo con bozza valorizzata (`draftItemsCount > 0`) o nota `ready` (non più `in_progress`).
- Home mobile/sessione:
  - caricamento da nota mantenuto nella lista risultati fino a conferma puntuale dei vini (non va più in schermata vuota);
  - ogni vino della nota entra nel riepilogo solo dopo conferma nel modale vino.
- Hygiene codice:
  - rimossa funzione non usata `startSessionWithItems` (`useLocalSession`);
  - rimosse classi CSS obsolete non referenziate;
  - eliminata notifica evento ridondante nel reinvio nota.
- SQL/Supabase:
  - nessuna migrazione schema obbligatoria per wave 11 (si riusano tabelle/RPC già operative).
- Quality gate post-wave 11:
  - `npm run lint` ✅
  - `npm run typecheck` ✅
  - `npm run test` ✅
  - `npm run build` ✅

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
  - in offline la conferma sessione salva in coda locale automatica
  - invio automatico coda al ritorno online (FIFO, una sessione alla volta)
- Admin:
  - login password (iniziale `1909`) e cambio password
  - toggle impostazioni (conferma finale, predisposizione nome utente)
  - storico sessioni inviate + reset con doppia conferma
  - pending queue: lista + delete singolo/massivo con conferma
  - reset totale (inventario + storico + pending)
- Admin archivio (`/admina`):
  - CRUD vini completo
  - caricamento: warm-start da cache locale + sincronizzazione remota forzata (evita conteggi stale tipo 1000 vs totale reale)
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
  - predisposto script SQL dedicato per migrazione `supplier` (esecuzione via SQL Editor operativo)
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
   git remote add origin https://github.com/enoteca-italiana/gestionale.git
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
  - azioni `Aggiorna password`, `Importa archivio`, `Reset archivio` disponibili direttamente nella home admin.
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
