# Admin

Ultimo aggiornamento: **07/04/2026 16:04 CEST**.

## Accesso

- Route principale: `/impostazioni`
- Alias legacy supportato: `/admin`
- Password:
  - default `1909` (hashata e salvata localmente)
  - modificabile in Admin

Hook: `apps/scarichi-vini/src/pages/admin/useAdminAuth.ts`

- salva hash in localStorage
- sessione valida ~12h (`authedUntil`)

## Navigazione admin

`AdminGate` gestisce le sezioni:

- home admin (menu)
- history

Azioni rapide disponibili direttamente in home admin, in questo ordine:

- `Sessioni storico`
- `Imposta Soglie`
- `Aggiorna password`
- `Richiesta PIN`
- `Importa archivio`
- `Reset archivio`

Note:

- la pagina “Sessioni” intermedia è stata rimossa;
- il pulsante `Sessioni storico` apre direttamente lo storico;
- la pagina “Impostazioni” non è più parte del flusso UI;
- le azioni rapide aprono modali restando nella home admin (nessun redirect pagina).

La Bottom Nav operativa mostra:

- `Home` (`/`)
- `Archivio` (`/admina`)
- `Impostazioni` (`/impostazioni`, con compatibilità `/admin`)

## Impostazioni operative (modali)

File: `AdminSettings.tsx`

Modali attivi:

- cambio password admin
- import archivio CSV (aggiunta o sostituzione)
- imposta soglia unica su tutti i vini
- reset archivio con PIN
- richiesta PIN (avvio app + accesso impostazioni)

### Richiesta PIN (modale unico)

Nel modale `Richiesta PIN` sono disponibili due controlli distinti:

- `Richiesta PIN all'avvio App`
- `Richiesta PIN pagina IMPOSTAZIONI`

UI:

- switch orizzontali touch-friendly con `ON/OFF` sempre visibili;
- `ON` attivo: verde;
- `OFF` attivo: viola;
- stato non attivo: bianco;
- pulsante `Chiudi` viola.

Comportamento:

- PIN avvio app:
  - `ON` attiva subito il gate PIN in runtime;
  - `OFF` disattiva subito il gate.
- PIN impostazioni:
  - `ON` richiede PIN per accesso a `/impostazioni` (valido anche per alias `/admin`);
  - lo sblocco non resta persistente tra accessi (nuova richiesta PIN a ogni rientro in Impostazioni).

### Cambio password admin

Nel modale `Aggiorna password admin` è stato aggiunto:

- campo `Conferma nuova password`.

Regola:

- la modifica è consentita solo se `Nuova password` e `Conferma nuova password` coincidono.

### Importa archivio CSV

Flusso operativo aggiornato:

- step 1: selezione file CSV nel modale import;
- step 2: conferma `IMPORTANTE!` con scelta modalità:
  - `Aggiungi record ad archivio esistente`
  - `Sostituisci intero archivio con il CSV`
- step 3: conferma finale con `PIN admin` obbligatorio.
- step 4 (post-import riuscito): nel modale restano solo:
  - titolo `Importa archivio CSV`
  - messaggio centrato `Import completato: ... Vini`
  - pulsante `Chiudi` (viola)
  - box `Scegli file` non visibile nello stato completato.

Vincolo sicurezza:

- l'import non parte mai senza doppia conferma + PIN.

### Export archivio (modale)

Nel modale `Esporta archivio`:

- pulsante `Esporta Excel` su sfondo verde;
- pulsante `Esporta PDF` su sfondo rosso;
- durante export, la label `Esportazione...` appare solo sul pulsante del formato cliccato (non su entrambi).

### Imposta Soglie (nuovo)

Obiettivo:

- applicare una soglia unica a tutti i vini in archivio.

Sicurezza:

- doppia conferma;
- seconda conferma con PIN admin obbligatorio.

Persistenza:

- update massivo su Supabase (`wines.threshold`);
- allineamento cache locale;
- sincronizzazione hook esterni già presenti.

## Storico sessioni

File: `AdminHistory.tsx`

- mostra solo sessioni inviate correttamente (`status=submitted`);
- card cliccabili con dettaglio contenuto sessione;
- formato data: `18 Marzo 2026`;
- formato ora: `15:05` (senza secondi);
- in lista e dettaglio, le info sessione sono solo:
  - data/ora
  - numero vini
  - numero bottiglie
- nessun nome/titolo sessione viene mostrato o gestito in UI.
- nel dettaglio, la quantità scaricata per vino è mostrata come testo inline (senza pill/contenitore).
- reset storico:
  - doppia conferma;
  - conferma finale con PIN admin;
  - nel modale PIN è disponibile `Mantieni storico`:
    - `Niente (cancella tutto)`,
    - `Ultimi 7 giorni`,
    - `Ultimi 30 giorni`,
    - `Ultimi 3 mesi`,
    - `Ultimi 12 mesi`.
  - comportamento: elimina solo le sessioni `submitted` più vecchie del periodo scelto.
- filtro temporale desktop aggiornato:
  - preset rapidi periodo (`Tutto`, `Oggi`, `Ultimi 7/30/90 giorni`, `Ultimi 6/12 mesi`, `Anno corrente`, `Personalizzato`);
  - selezione manuale intervallo `Da` / `A` su una riga unica;
  - pulsante reset filtri con icona frecce;
  - filtraggio per giorno (la componente ora viene ignorata).

## Ottimizzazioni performance Supabase

File principali:

- `useDischargeSessions.ts`
- `dischargeRepository.ts`
- `AdminGate.tsx`

Ottimizzazioni introdotte:

- storico caricato solo su sezione `history` (on-demand);
- `/admin` non resta più bloccata su “Caricamento dati Supabase…” in home;
- cache in memoria per storico (`TTL` breve) per ridurre reload ravvicinati;
- query storico limitata lato server (`limit` default 300, cap 2000);
- conteggio elementi sessione calcolato nella query principale (`discharge_session_items(count)`), senza seconda query bulk sugli item.

Nota UX:

- durante il caricamento dello storico, viene mostrato uno stato `Caricamento…` (evitato rendering vuoto).

## Gestione voci filtri (`/admin` → `Gestione voci filtri`)

File principale:

- `pages/admin/AdminRegistryManager.tsx`

Comportamento aggiornato:

- apertura pagina ottimizzata:
  - warm start da dati locali (inventory + registry locali) senza attesa rete;
  - sync remoto in background;
  - cache in-memory con TTL breve per riaperture ravvicinate più fluide.
- modifica voce:
  - doppio step conferma (`Conferma` + modale `Confermare modifica?`).
- eliminazione voce:
  - warning centrato e PIN obbligatorio;
  - i vini associati restano in archivio ma il campo viene impostato vuoto (render `-`), non `0`.
- creazione voce:
  - apertura tramite modale standard (`Nuova voce`), non più barra input inline.
- policy casing enforcement (in input e visualizzazione):
  - `Categorie` => maiuscolo;
  - `Produttori` => iniziale maiuscola;
  - `Provenienze` => maiuscolo.

## Sessioni sospese

Rimosse dal flusso e dall’interfaccia admin.

## Guardia abbandono sessione (Navbar)

File coinvolti:

- `pages/HomePage.tsx`
- `components/BottomNav.tsx`

Comportamento:

- quando la sessione scarico è aperta e contiene almeno 1 vino, il click su qualsiasi voce Navbar (`Home`, `Archivio`, `Impostazioni`) non naviga subito;
- viene aperto un modale di conferma abbandono sessione (`Conferma` / `Annulla`);
- se l’utente conferma:
  - la sessione viene chiusa completamente (`endSession`, non solo reset item),
  - la navigazione atterra sempre su Home (`/`) su mobile e desktop;
- se annulla, resta nella sessione in corso senza perdere dati.

## Reset archivio

In `AdminSettings.tsx`:

- doppia conferma;
- seconda conferma con PIN admin;
- cancella solo l'archivio vini (`public.wines`);
- storico sessioni non modificato.
- pulisce anche registry/cache filtri locali (`categories`, `origins`, `producers`) per evitare residui post-reset.

Note tecniche:

- il reset archivio richiede schema Supabase allineato per indipendenza storico/archivio;
- `discharge_session_items.wine_id` deve essere nullable con FK `ON DELETE SET NULL`;
- i dettagli storico usano anche snapshot campi vino (`wine_name`, `wine_age`, `wine_producer`, `wine_origin`, `wine_category`) per restare leggibili anche dopo rimozione archivio.

## Archivio vini (`/admina`)

Route dedicata per gestione archivio desktop-first.

Componenti:

- `pages/admina/WineAdminPage.tsx`
- `pages/admina/components/AdminArchiveToolbar.tsx`
- `pages/admina/components/AdminArchiveTable.tsx`
- `pages/admina/components/WineArchiveFormModal.tsx`

Funzioni principali:

- ricerca e filtri (testo, categoria, soglia/esauriti)
- filtri su singola riga desktop con box statistiche (`Totale`, `Soglia`, `Esauriti`) e pulsante `Aggiungi vino`
- ordine toolbar: `Aggiungi vino` in prima posizione a sinistra, poi campo `Cerca...`, poi filtri/comandi.
- filtri con creazione rapida valori:
  - `+ Aggiungi categoria…`
  - `+ Aggiungi produttore…`
  - `+ Aggiungi provenienza…`
  - nei selector (toolbar + inline tabella), la voce `+ Aggiungi...` resta fissa in cima mentre la lista scorre.
  - dopo creazione valore da una tendina filtro, il filtro resta su default `Tutte/Tutti` (`all`).
- pulsante reset filtri dedicato (tondo bianco, icona frecce viola) tra box statistiche e pulsante AI
  - resetta tutti i filtri allo stato default (`Totale` + select su `Tutti` + ricerca vuota);
  - resetta anche stati tabella (ordinamenti colonne verdi e stati inline aperti).
  - con filtri attivi cambia colore e lampeggia; dopo reset torna normale.
- filtri complementari:
  - `Cerca...`, `Categoria`, `Produttore`, `Provenienza` si restringono reciprocamente.
- CRUD vini
- categoria/produttore/provenienza da liste gestite
- policy campi testo vino (anche su import CSV):
  - `Categoria`, `Nome`, `Provenienza` sempre in **MAIUSCOLO**
  - `Produttore` sempre con **iniziale maiuscola**
- tabella con header sticky, righe alternate e separatori verticali
- ordinamento `A-Z / Z-A` su `Categoria`, `Nome`, `Produttore`, `Provenienza`
- placeholder celle vuote:
  - `—` centrato solo quando valore assente in `Categoria`, `Produttore`, `Provenienza`;
  - valore presente sempre allineato a sinistra.
- modifica massiva su filtri attivi (tabella):
  - apertura con click destro;
  - applicazione su tutti i vini filtrati;
  - campi supportati: `Categoria`;
  - conferma protetta con doppio step (`Conferma` + `PIN admin`).
- modale aggiungi/modifica vino:
  - campi `Acquisto`/`Vendita` gestiscono correttamente decimali e centesimi in digitazione (`virgola`/`punto`), con parsing numerico al salvataggio.
- performance su dataset grandi:
  - route `/admina` lazy-loaded
  - tabella con rendering progressivo righe (`Carica altre righe`)
  - filtro ricerca con `useDeferredValue`
  - caricamento iniziale: hydration locale immediata + sync Supabase
- assistente AI in `/admina`:
  - export report contestuale solo PDF;
  - pulsante `Esporta PDF` mostrato nel singolo messaggio report (non fisso in header);
  - PDF con logo in alto e numerazione pagine `1/N`.
- notifiche spot:
  - rimossi toast inline non bloccanti in archivio (es. `Nome aggiornato`), mantenendo feedback errori.

Regole business:

- `Magazzino = Acquisto × Q.tà`
- `Margine = Vendita − Acquisto`
- q.tà `0` in rosso
- q.tà in soglia in ambra
- `Soglia` valida: `Vuoto` oppure `>= 1` (mai `0`)
