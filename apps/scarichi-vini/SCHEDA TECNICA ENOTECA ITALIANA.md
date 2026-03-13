# SCHEDA TECNICA — APP GESTIONE SCARICHI VINI ENOTECA

Ultimo aggiornamento: **13/03/2026 03:12 CET**.

## Introduzione

Questa applicazione serve a gestire in modo rapido, semplice e affidabile gli **scarichi dei vini** all’interno di un’enoteca durante il servizio. I ragazzi in sala o al banco, quando devono prelevare bottiglie dalla cantina, aprono una **sessione di scarico** sull’app mobile web, cercano i vini per nome, aggiungono le quantità da scaricare tramite pulsanti rapidi e confermano la sessione finale.

L’obiettivo principale è avere un sistema **veloce, stabile, touch-friendly e sempre aggiornato**, capace di funzionare anche **offline** e di sincronizzarsi automaticamente quando torna la connessione. Il foglio Google resta parte integrante del progetto, ma il cuore operativo dell’applicazione sarà **Supabase**, così da garantire maggiore affidabilità, gestione offline, sincronizzazione ordinata e una base tecnica realmente scalabile.

L’app sarà sviluppata su **Replit**, con repository sincronizzato su **GitHub**, backend dati su **Supabase** e deploy su **Render**. Il progetto dovrà nascere già con una struttura **modulare, scalabile e pulita**, così da permettere future estensioni senza rifare l’architettura.

### Stato tecnico attuale (aggiornato)

- conferma sessione scarico collegata a Supabase (tabelle sessioni + RPC);
- storico e sospesi admin letti da Supabase;
- installazione PWA ottimizzata per Android, iOS (Safari) e desktop con icone dedicate (`maskable` + `apple-touch-icon`);
- backup operativo standard in formato `.tar.gz` (non zip).

---

## 1. Obiettivo dell’applicazione

L’applicazione ha un solo scopo operativo principale:

- permettere ai ragazzi dell’enoteca di **scaricare bottiglie di vino** dal database in modo rapido durante il servizio.

Il sistema **non gestisce il carico** da app.
I carichi e gli aggiornamenti inventariali saranno effettuati **manualmente sul foglio Google**.

---

## 2. Stack e struttura generale del progetto

### Stack previsto

- **Frontend app mobile web / PWA**
- **Replit** per sviluppo
- **GitHub** per versionamento
- **Supabase** come database operativo centrale
- **Render** per deploy
- **Google Sheets** come sorgente esterna sincronizzata e strumento gestionale manuale

### Principio architetturale centrale

Il database operativo principale deve essere **Supabase**.

Motivo:

- maggiore stabilità applicativa
- gestione offline molto più solida
- possibilità di code di sincronizzazione
- storico sessioni e impostazioni admin gestibili correttamente
- struttura più adatta a un’app rispetto a Google Sheets usato come database diretto

### Ruolo di Google Sheets

Google Sheets **non** deve essere il motore operativo principale dell’app.
Deve restare:

- fonte di aggiornamento manuale per carichi e inventari
- strumento visivo già in uso dal proprietario
- sorgente esterna sincronizzata con Supabase

### Flusso dati corretto

- **App → Supabase** per scarichi, sessioni, code offline, storico, impostazioni
- **Supabase → Google Sheets** per aggiornare il foglio dopo gli scarichi confermati
- **Google Sheets → Supabase** con sincronizzazione automatica periodica per recepire modifiche manuali effettuate sul foglio

---

## 3. Requisiti chiave di progetto

### Requisiti non negoziabili

- app **mobile web app**, non app App Store / Play Store
- installabile come **PWA**
- supporto **offline**
- invio automatico degli aggiornamenti appena torna la connessione
- aggiornamento dell’app **in tempo reale**, senza refresh manuali e senza riavvio
- struttura del codice **modulare e scalabile**
- UX ottimizzata per uso quotidiano su smartphone
- interfaccia molto chiara e molto veloce da usare durante il lavoro

### Requisito prioritario assoluto

L’app deve **aggiornarsi sempre in tempo reale senza dover fare refresh o riavvio dell’app**.
Questo requisito è stato indicato come fondamentale per tutta la fase di sviluppo.

### Ambito operativo attuale

- il progetto è previsto per **una sola enoteca / una sola sede**
- non è richiesta, nella baseline attuale, un’ottimizzazione specifica per scarichi concorrenti da molti telefoni nello stesso istante
- l’architettura deve comunque restare **scalabile** per eventuali evoluzioni future

---

## 4. Modello operativo dell’app

### Funzione operativa prevista

L’app gestisce esclusivamente lo **scarico**.

Non sono previsti:

- carichi da app
- modifica quantità da admin
- operazioni di magazzino diverse dallo scarico durante la sessione operativa

### Unità di misura

I vini vengono scaricati sempre e solo in **bottiglie**.

Non si usano:

- cartoni
- casse
- multipli di magazzino alternativi

---

## 5. Origine e organizzazione dei dati vino

### Fogli Google da sincronizzare

Il file Google contiene più tab, ma i fogli da sincronizzare operativamente sono due:

- **VINI ITALIANI**
- **VINI STRANIERI**

### Struttura dei fogli

- i due fogli hanno **la stessa struttura di colonne**
- nell’app il database è **unico**
- la distinzione italiani / stranieri resta una suddivisione interna del foglio Google, non un accesso separato nell’app

### Colonna quantità

La quantità attuale da sincronizzare è nella colonna:

- **H — Q.tà**

### Identificazione univoca dei vini

Il riferimento più affidabile da usare per la sincronizzazione non è un singolo ID già esistente nel foglio, ma una combinazione di campi:

- **Nome**
- **Annata**
- **Produttore**
- **Provenienza**

### Nota importante sui dati foglio

L’**annata** può a volte:

- mancare
- non essere uniforme

Nell’app devono essere visualizzate **solo le informazioni presenti**, senza obblighi forzati di completezza.

---

## 6. Logica di sincronizzazione

### Decisione architetturale approvata

La soluzione scelta come migliore per stabilità, velocità percepita e rischio tecnico ridotto è:

- **Supabase come database centrale operativo**
- **Google Sheets sincronizzato con Supabase**

### Sincronizzazione da Google Sheets verso Supabase

Le modifiche manuali fatte sul foglio Google devono entrare in app tramite:

- **sincronizzazione automatica periodica**
- frequenza scelta: **ogni 1 minuto**

Questa sincronizzazione deve essere:

- invisibile agli utenti operativi
- totalmente automatica lato front
- senza pulsanti manuali per l’utente normale

**Nota importante di coerenza:**

- il requisito di aggiornamento **in tempo reale senza refresh** vale per l’**app collegata a Supabase**
- le modifiche manuali fatte direttamente sul **foglio Google** non entrano in app in tempo reale puro, ma tramite controllo automatico **ogni 1 minuto**, scelta approvata come compromesso più stabile e meno invasivo

### Sincronizzazione da App / Supabase verso Google Sheets

Quando una sessione viene inviata correttamente:

- l’app aggiorna Supabase
- il sistema aggiorna il foglio Google
- il foglio deve restare visivamente allineato con l’app

### Vincolo di sicurezza foglio Google

Il foglio Google deve restare:

- modificabile solo da persone autorizzate
- non pubblicato apertamente sul web

Per l’autorizzazione si userà:

- **account Google del proprietario dell’enoteca**

---

## 7. Logica offline

### Requisito offline

L’app deve funzionare anche offline, perché in cantina il segnale può mancare.

### Comportamento richiesto

Quando il telefono torna online:

- gli aggiornamenti offline devono essere inviati **automaticamente**

### Regola di sincronizzazione offline approvata

Se il foglio Google viene modificato manualmente mentre un telefono è offline, quando la sessione offline torna online:

- lo scarico offline deve comunque essere **applicato sopra il valore aggiornato**

### Ordine di invio

Le sessioni offline devono essere inviate:

- **in ordine cronologico esatto**
- una per una
- appena torna la connessione

### Fallimento invio in fase di conferma

Se al momento della conferma una sessione non può essere inviata:

- deve essere **salvata in coda automatica offline**
- l’utente può chiudere
- l’invio dovrà ripartire automaticamente quando possibile

### Feedback utente richiesto

Se il telefono è offline o se la sessione non riesce a partire:

- l’utente deve ricevere un messaggio chiaro che faccia capire che c’è un problema
- il sistema deve comunque essere orientato al salvataggio in coda automatica

---

## 8. Modello operativo: sessione di scarico

### Scelta approvata

L’operatività non deve essere libera e frammentata.
La logica corretta è una **sessione unica di scarico con riepilogo finale**.

### Motivi della scelta

- più ordine durante il lavoro
- meno errori
- migliore gestione offline
- base più solida per storico e futuri sviluppi

### Struttura della sessione

L’utente:

1. apre una nuova sessione
2. cerca i vini per nome
3. aggiunge scarichi con pulsanti rapidi
4. vede un riepilogo finale
5. conferma la sessione
6. il sistema invia o mette la sessione in coda se offline

### Contenuto della sessione

Una singola sessione può contenere:

- **più vini diversi**
- tutti raccolti nello stesso riepilogo finale

### Chiusura sessione

Una volta confermata la sessione:

- il riepilogo si svuota automaticamente
- l’utente torna subito alla ricerca / ripartenza operativa

### Tracciatura sessioni

Ogni sessione deve avere sempre:

- **data**
- **orario**

Questo è necessario anche per lo storico.

---

## 9. Ricerca vini e risultati

### Modalità di ricerca approvata

I vini devono essere trovati tramite:

- **ricerca testuale per nome**

La navigazione iniziale tramite categorie non fa parte della baseline.
Potrà essere aggiunta in futuro.

### Informazioni da mostrare nei risultati ricerca

Per distinguere vini simili, nei risultati devono comparire:

- **Nome**
- **Produttore**
- **Provenienza**
- **Annata**

### Quantità visibile

Quando si apre un vino, l’utente deve vedere:

- la **quantità attuale disponibile**
  prima di premere i pulsanti di scarico.

### Vini a quantità zero

I vini a quantità zero:

- devono **restare visibili**
- devono comparire nella ricerca
- devono essere chiaramente segnati come non scaricabili
- devono essere **non cliccabili / non scaricabili subito**

### Filtro solo disponibili

Non è richiesto, in baseline, un filtro rapido per nascondere i vini a zero.

---

## 10. Meccanica di scarico

### Modalità di scarico approvata

Lo scarico deve avvenire tramite pulsanti rapidi tipo:

- **-1**
- **-2**
- **-3**

### Vincolo sulla disponibilità

Il sistema deve:

- **impedire** che un vino venga scaricato sotto zero

### Nessun limite massimo per riga

Non è richiesto un limite massimo di bottiglie scaricabili per singola riga dentro la sessione.

---

## 11. Riepilogo sessione e correzioni

### Conferma finale

Dopo aver composto la sessione, lo scarico **non** deve partire subito.
È richiesta una **conferma finale**.

### Tipo di conferma

La conferma finale deve essere:

- **popup / modale**
- con conferma manuale

### Impostazione futura

La conferma finale deve essere progettata come:

- **opzione disattivabile da admin**

### Correzioni nel riepilogo

Prima della conferma finale l’utente deve poter correggere la sessione.

### Modalità di correzione approvata

Nel riepilogo ogni riga deve poter essere corretta con:

- pulsante **+1**
- pulsante **-1**
- pulsante **elimina riga**

Non è stata scelta la modifica via modale.

---

## 12. Storico sessioni

### Storico utenti operativi

Non è previsto uno storico consultabile dagli utenti operativi.

### Storico admin

Lo storico deve esistere **dentro l’area Admin**.

### Formato storico admin

Lo storico admin deve mostrare:

- **una riga per ogni sessione**
- ogni riga deve essere **apribile nel dettaglio**

### Sessioni archiviate nello storico

Nello storico devono comparire solo:

- sessioni **concluse e inviate correttamente**

Non devono comparire sessioni fallite o semplicemente in attesa.

### Reset storico

L’admin deve poter fare reset dello storico.

Caratteristiche del reset:

- **cancellazione totale definitiva**
- **doppio messaggio di conferma**

---

## 13. Sessioni in sospeso

### Area di gestione

Le sessioni in sospeso devono stare:

- **dentro l’area Admin**

### Visibilità sessioni in sospeso

Gli utenti operativi non devono vedere il numero delle sessioni pendenti.
Questa informazione deve essere disponibile solo in admin, in una sezione tipo:

- status
- sospesi
- coda sincronizzazione

### Permessi admin sulle sessioni sospese

L’admin deve poter:

- vedere le sessioni in sospeso
- aprire il dettaglio di ciascuna sessione
- vedere i vini contenuti nella sessione prima di eliminarla
- eliminare manualmente la sessione

### Eliminazione sessione sospesa

Se l’admin elimina una sessione in sospeso:

- l’eliminazione deve essere **definitiva**
- con **messaggio di conferma**

Non è previsto un archivio errori separato.

---

## 14. Admin / Impostazioni

### Natura della pagina admin

La pagina admin **non** deve essere una pagina di consultazione database.
Deve essere una **pagina impostazioni protetta da codice**.

### Accesso admin

- protezione con **password unica**
- password iniziale: **1909**
- la password deve essere **modificabile in admin**

### Protezione app

La password deve proteggere:

- **solo l’area admin**

L’app utente operativa deve aprirsi senza login.

### Funzione admin

L’admin serve per:

- gestire le opzioni e configurazioni dell’app
- consultare storico sessioni
- consultare sessioni in sospeso
- eliminare storico o sessioni in sospeso con conferma

### Cosa non deve fare l’admin

L’admin **non** deve:

- effettuare scarichi
- modificare quantità vini
- essere usato come operatività di magazzino

### Impostazioni già richieste da prevedere come toggle/future options

Almeno queste opzioni devono essere previste fin dall’architettura, anche se alcune non sono obbligatorie in baseline:

1. **conferma finale attiva/disattiva**
2. **associazione dello scarico al nome utente attiva/disattiva**
3. spazio per future opzioni senza rifare la pagina admin

### Nota importante sull’opzione nome utente

Attualmente l’associazione dello scarico al nome dell’utente **non è obbligatoria**, ma deve essere prevista come funzione attivabile/disattivabile in futuro dalla pagina admin.

---

## 15. Accesso utente e navigazione principale

### Login utente

Non è richiesto login per la parte operativa.

### Avvio app

All’apertura dell’app deve esserci:

- una **piccola intro di circa 2,5 secondi**
- con **logo** da inserire successivamente

Dopo l’intro deve comparire direttamente la possibilità di iniziare una sessione di scarico.

### Home iniziale

Nella schermata principale dopo l’intro devono esserci:

- possibilità chiara di **iniziare una sessione di scarico**
- **barra di ricerca già visibile**

La schermata deve quindi far capire subito l’azione principale, ma gli **scarichi effettivi** devono restare possibili **solo dentro una sessione aperta**.

### Sessione operativa

Solo aprendo una sessione si devono poter effettuare scarichi.

### Barra di ricerca durante la sessione

Durante la sessione:

- la barra di ricerca deve restare **sempre visibile in alto**

### Navbar

La navbar in basso deve avere solo due voci:

- **Home**
- **Archivio**

Pur avendo solo 2 voci, il codice deve essere progettato in modo modulare e scalabile.

---

## 16. Esperienza utente e design

## Visione generale design

L’app deve avere uno stile:

- **moderno**
- **pulito**
- **minimal**
- **ispirato ad Apple**

### Requisiti visivi richiesti

- icone minimali
- testi chiari e semplici
- tipografia **Apple-like**, con resa pulita e moderna coerente con gli standard iOS
- scroll, inerzia, pulsanti e gesture con feeling mobile standard di alta qualità
- interfaccia estremamente touch-friendly
- esperienza visiva molto curata su ogni dispositivo mobile

### Obiettivo UX

L’app deve risultare:

- naturale da usare con una mano
- leggibile in modo immediato
- elegante ma pratica
- veloce nelle interazioni
- senza elementi visivi inutili

### Compatibilità e adattamento

L’app deve essere ottimizzata al meglio su:

- smartphone iPhone
- smartphone Android
- diversi formati display mobile

### Priorità touch

Tutta l’esperienza deve essere costruita in ottica:

- mobile-first
- touch-first
- standard moderno da web app premium

---

## 17. Vincoli funzionali già decisi

### Cosa è dentro la baseline

- scarico vini tramite sessioni
- ricerca testuale per nome
- pulsanti rapidi -1 / -2 / -3
- quantità visibile
- blocco sotto zero
- riepilogo finale
- correzione righe sessione
- supporto offline
- coda automatica sessioni offline
- invio automatico al ritorno online
- storico admin sessioni concluse
- area admin impostazioni protetta da password
- gestione sessioni in sospeso in admin
- sincronizzazione automatica con Google Sheets
- aggiornamento in tempo reale senza refresh lato app collegata a Supabase
- recezione modifiche manuali da Google Sheets con controllo automatico ogni 1 minuto
- PWA mobile web

### Cosa non fa parte della baseline attuale

- login utente operativo
- carichi da app
- modifica quantità vini da admin
- storico visibile agli utenti operativi
- filtri avanzati nella ricerca
- categorie operative separate nell’app
- pagina admin come gestione database completa
- app nativa App Store / Play Store

---

## 18. Predisposizioni future richieste

Il progetto deve nascere già pronto per possibili estensioni future, senza dover rifare la struttura.

### Estensioni future da tenere in considerazione

- attivazione del nome utente per ogni scarico
- toggle opzioni da admin
- eventuali filtri o categorie nella ricerca
- nuove sezioni nella navbar
- nuove configurazioni di workflow sessione
- espansione funzionalità admin
- ulteriori controlli di sincronizzazione

La logica richiesta è chiara:

- baseline semplice
- architettura già pensata per crescere

---

## 19. Linee guida tecniche per Replit

### Obiettivo di sviluppo

Replit dovrà partire impostando una base di progetto:

- modulare
- scalabile
- stabile
- performante
- non fragile
- chiara da manutenere

### Principi tecnici da rispettare

- separare chiaramente frontend, logica sessioni, logica offline, sync engine, admin settings e servizi esterni
- non legare l’app a logiche improvvisate o accoppiate al foglio Google come sorgente primaria
- predisporre meccanismi robusti per realtime e sincronizzazione
- evitare architetture che richiedano refresh o riavvio dell’app per aggiornarsi
- progettare subito bene la coda offline
- trattare Google Sheets come integrazione importante ma non come cuore operativo dell’app

---

## 20. Sintesi finale della logica approvata

Questa applicazione è una **mobile web app PWA per la gestione degli scarichi vino in enoteca**.

La logica principale è:

- aprire una sessione di scarico
- cercare i vini per nome
- aggiungere bottiglie con pulsanti rapidi
- correggere eventuali errori nel riepilogo
- confermare la sessione con modale finale
- aggiornare l’app in tempo reale tramite Supabase, senza refresh
- funzionare anche offline
- sincronizzare automaticamente appena torna la rete

A livello architetturale:

- **Supabase è il database centrale operativo**
- **Google Sheets è sincronizzato con Supabase**
- il foglio continua a essere usato per carichi e aggiornamenti manuali
- l’app resta sempre il punto operativo rapido per lo scarico

A livello admin:

- esiste una sola area impostazioni protetta da password
- lo storico e le sessioni in sospeso stanno dentro admin
- l’admin non effettua scarichi

A livello esperienza utente:

- l’app deve essere bella, pulita, moderna, Apple-like, touch-friendly e mobile-first
- deve aggiornarsi senza refresh
- deve restare semplice da usare anche sotto stress durante il servizio

---

## 21. Stato attuale del progetto

Alla data di questa scheda, la fase svolta è:

### Completato (stato reale locale + admin archivio)

- creazione progetto greenfield in `apps/scarichi-vini` con struttura modulare (routing `Home` / `Admin` / `Archivio`)
- UI mobile-first con stile minimal, palette brand e sfondo crema vintage
- intro iniziale 2.5s con logo e comparsa graduale
- ottimizzazione asset logo:
  - `logo.png` come asset operativo unico ottimizzato (peso ridotto)
- sessione di scarico completa:
  - ricerca testuale per nome
  - risultati con quantità visibile
  - vini a quantità 0 visibili ma non scaricabili
  - scarico rapido `-1 / -2 / -3` con vincolo sotto zero
  - riepilogo con correzioni `+1 / -1 / elimina`
  - modale di conferma e comportamento controllato dai toggle admin
- persistenza locale (localStorage) con modello dati:
  - inventario vini
  - storico sessioni inviate
  - coda sessioni in sospeso
- gestione offline locale:
  - se offline al momento della conferma, la sessione va in coda sospesi
  - ritorno online: invio automatico in ordine cronologico (flush pending → history)
- area Admin completa (locale):
  - login con password iniziale `1909` e password modificabile
  - toggle impostazioni: conferma finale, predisposizione nome utente
  - storico sessioni (solo inviate) con reset e doppia conferma
  - sospesi con eliminazione singola e massiva con conferma
  - reset totale (inventario + storico + sospesi) con doppia conferma
- PWA offline reale:
  - service worker con caching app shell + assets
  - auto-update
  - fix dev contro cache stale (unregister SW in dev una volta per sessione)
- governance codice:
  - limite ~300–350 righe per file funzionali lunghi tramite modularizzazione preventiva
- operatività:
  - creata cartella `backup/` e primo archivio compresso nominato secondo specifica
  - script `backup/make_backup.sh` per generare nuovi backup con esclusioni standard
  - creata cartella `DOCS/` con documenti Markdown che descrivono il DNA del progetto

### In corso / parzialmente predisposto

- integrazione Supabase come database operativo centrale (repository e fallback schema già presenti)
- sincronizzazione Google Sheets ↔ Supabase (predisposizione presente, completamento operativo con credenziali/pipeline)
- deploy su Render

Questa scheda rappresenta la base tecnica e funzionale su cui costruire il progetto in Replit.

---

## 22. Aggiornamento stato attuale — 12/03/2026

### Stato applicazione

- Routing attivo:
  - `/` Home sessione scarico
  - `/admin` impostazioni/admin
  - `/admina` archivio vini desktop-first
- Bottom nav aggiornata: `Home` + `Archivio`

### Archivio vini (`/admina`)

- CRUD completo
- Tabella ottimizzata:
  - header sticky
  - righe alternate bianco/grigio chiaro
  - separatori verticali colonne
  - toolbar filtri in singola riga desktop
  - box statistiche compatto (`Totale`, `Soglia`, `Esauriti`) con logica filtro integrata
  - semantica colori box: `Totale` verde, `Soglia` ambra, `Esauriti` rosso
  - stato selezionato a colori invertiti (testo bianco)
  - allineamenti centrati sulle colonne economiche/quantità
  - campo `ANNO` vuoto quando il valore è assente
  - colonna `Note` rimossa dalla griglia; note consultabili da icona in `Azioni`
  - righe filler vuote fino al fondo area tabella
  - ordinamento `A-Z / Z-A` su `Categoria`, `Nome`, `Produttore`, `Provenienza`
- Regole calcolo:
  - `Magazzino = Acquisto × Q.tà`
  - `Margine = Vendita − Acquisto`
- q.tà `0` evidenziata in rosso
- q.tà in soglia evidenziata in giallo ambra chiaro

### Dati locali

- Seed esteso a 20 vini (aggiunti 15 record test).
- Migrazione automatica inventario locale per aggiungere vini seed mancanti senza perdere dati esistenti.

### Handover su altro PC

Già predisposto e verificato:

- `PROJECT_STATUS.md`
- `DOCS/00_INDEX.md`
- `DOCS/07_OPERATIONS_BACKUP.md`

Quick start:

1. `npm install` (root)
2. `npm run dev` (root)
3. se porta occupata: `lsof -iTCP:5173 -sTCP:LISTEN` (o `5001`)
4. se cache PWA stale: hard refresh / rimozione app installata

---

## 23. Aggiornamento operativo — 12/03/2026 (notte)

### Logo e performance

- Nuovo logo integrato in `public/logo.png` con compressione applicata.
- Proporzioni UI mantenute rispetto al logo precedente.
- Intro mantenuta invariata.

### Colori UI

- Palette brand allineata su viola `#7c164a` per pulsanti/elementi principali.
- Eccezione archivio: q.tà `0` in colonna quantità resta in rosso acceso.

### Archivio (`/admina`) — toolbar filtri

- Ottimizzazione layout su una sola riga desktop.
- Box statistiche ulteriormente compattato (riduzione dimensionale progressiva).
- Box statistiche aggiornato a `Totale`, `Soglia`, `Esauriti`.
- Stato selezionato dei 3 pulsanti a colori invertiti (testo bianco).

### Backup

- Creato nuovo backup: `backup/backup_13 Venerdi_01.48.tar.gz`.

### Regola repository leggero (nuova logica)

- Per deploy Render, su GitHub `main` devono restare solo file utili al runtime.
- Esclusi dal tracking:
  - `backup/*.tar.gz`, `backup/*.zip`
  - `apps/scarichi-vini/dev-dist/`
  - `*.tsbuildinfo`
- La cartella `backup/` resta nel repo solo per script operativi (`backup/make_backup.sh`).
