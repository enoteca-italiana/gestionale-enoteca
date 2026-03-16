# Admin

Ultimo aggiornamento: **16/03/2026 02:12 CET**.

## Accesso

- Route: `/admin`
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
- `Importa archivio`
- `Imposta Soglie`
- `Aggiorna password`
- `Reset archivio`

Note:

- la pagina “Sessioni” intermedia è stata rimossa;
- il pulsante `Sessioni storico` apre direttamente lo storico;
- la pagina “Impostazioni” non è più parte del flusso UI;
- le azioni rapide aprono modali restando nella home admin (nessun redirect pagina).

La Bottom Nav operativa mostra:

- `Home` (`/`)
- `Archivio` (`/admina`)
- `Impostazioni` (`/admin`)

## Impostazioni operative (modali)

File: `AdminSettings.tsx`

Modali attivi:

- cambio password admin
- import archivio CSV (sostituzione totale)
- imposta soglia unica su tutti i vini
- reset archivio con PIN

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
  - conferma finale con PIN admin.
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

## Sessioni sospese

Rimosse dal flusso e dall’interfaccia admin.

## Reset archivio

In `AdminSettings.tsx`:

- doppia conferma;
- seconda conferma con PIN admin;
- cancella solo l'archivio vini (`public.wines`);
- storico sessioni non modificato.

Note tecniche:

- il reset archivio richiede schema Supabase allineato per indipendenza storico/archivio;
- `discharge_session_items.wine_id` deve essere nullable con FK `ON DELETE SET NULL`;
- i dettagli storico usano anche snapshot campi vino (`wine_name`, `wine_age`, `wine_producer`, `wine_origin`, `wine_category`, `wine_supplier`) per restare leggibili anche dopo rimozione archivio.

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
- pulsante reset filtri dedicato (tondo bianco, icona frecce viola) tra `Esauriti` e `Aggiungi vino`
  - resetta tutti i filtri allo stato default (`Totale` + select su `Tutti` + ricerca vuota)
- CRUD vini
- categoria/provenienza/fornitore da liste gestite
- tabella con header sticky, righe alternate e separatori verticali
- ordinamento `A-Z / Z-A` su `Categoria`, `Nome`, `Produttore`, `Provenienza`, `Fornitore`
- performance su dataset grandi:
  - route `/admina` lazy-loaded
  - tabella con rendering progressivo righe (`Carica altre righe`)
  - filtro ricerca con `useDeferredValue`
  - caricamento iniziale: hydration locale immediata + sync Supabase
- assistente AI in `/admina`:
  - export report contestuale solo PDF;
  - pulsante `Esporta PDF` mostrato nel singolo messaggio report (non fisso in header);
  - PDF con logo in alto e numerazione pagine `1/N`.

Regole business:

- `Magazzino = Acquisto × Q.tà`
- `Margine = Vendita − Acquisto`
- q.tà `0` in rosso
- q.tà in soglia in ambra
- `Soglia` valida: `Vuoto` oppure `>= 1` (mai `0`)
