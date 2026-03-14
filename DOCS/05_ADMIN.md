# Admin

Ultimo aggiornamento: **14/03/2026 18:42 CET**.

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
- `Reset totale`

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
- reset totale con PIN

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
- reset storico:
  - doppia conferma;
  - conferma finale con PIN admin.

## Sessioni sospese

Rimosse dal flusso e dall’interfaccia admin.

## Reset totale

In `AdminSettings.tsx`:

- doppia conferma;
- seconda conferma con PIN admin;
- cancella dati locali tecnici;
- pulizia storico gestita via API Supabase dedicate.

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
- CRUD vini
- categoria/provenienza/fornitore da liste gestite
- tabella con header sticky, righe alternate e separatori verticali
- ordinamento `A-Z / Z-A` su `Categoria`, `Nome`, `Produttore`, `Provenienza`, `Fornitore`

Regole business:

- `Magazzino = Acquisto × Q.tà`
- `Margine = Vendita − Acquisto`
- q.tà `0` in rosso
- q.tà in soglia in ambra
- `Soglia` valida: `Vuoto` oppure `>= 1` (mai `0`)
