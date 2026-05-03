# Requisiti (baseline) — Scarichi Vini

Ultimo aggiornamento: **02/05/2026 — CEST**.

---

## Scopo

L'app gestisce gli **scarichi di bottiglie** durante il servizio in enoteca.

- Non gestisce carichi o aggiornamenti inventario da UI operativa (solo da admin archivio).
- Non gestisce login utente operativo.
- Non gestisce fornitori (campo legacy `supplier` ignorato dal frontend).

---

## UX / UI

- Mobile web app installabile come **PWA** (standalone, portrait).
- Installazione supportata su Android, iOS e desktop (Chrome/Safari/Edge).
- UX touch-first: tap immediati (300ms delay eliminato via `touch-action: manipulation`), nessun flash blu tap.
- Intro iniziale **2500ms** con logo e comparsa graduale (opacity + translate, nessun blur).
- Navbar fissa in basso con tre voci: `Home`, `Archivio`, `Impostazioni`.
- La navbar non compare durante l'intro.
- Font system stack: `-apple-system, BlinkMacSystemFont, 'SF Pro Text', Segoe UI, Roboto, Helvetica`.

---

## Modello operativo: sessione di scarico

L'utente lavora sempre dentro una **sessione attiva**.

Flusso:
1. **Avvia sessione** (pulsante viola)
2. **Ricerca** per nome vino (real-time, locale)
3. **Scarico rapido** con bottoni `-1`, `-2`, `-3` per ogni risultato
4. **Riepilogo** con correzioni `+1`, `-1`, `Elimina` voce
5. **Conferma finale** (modale) → invio a Supabase o coda offline

---

## Ricerca vini

- Ricerca testuale per **nome** sull'inventario locale (no round-trip Supabase).
- Ogni card risultato mostra: nome, produttore • anno (se presente) • provenienza, quantità.
- Vini con `qty = 0`: visibili ma bottoni scarico disabilitati.
- Sessione chiusa (modalità consultiva): click su card → modale **Giacenza** per aggiornamento quantità.

---

## Modalità consultiva (sessione chiusa)

- Lista inventario completa visibile.
- Tap su vino → modale Giacenza:
  - Selector a scroll `0..999`
  - Conferma in due step (`Conferma` + modale di conferma finale)
  - Salvataggio: `updateWine()` → locale + Supabase

---

## Vincoli quantità

- `qty` mai sotto zero (guard sia in UI sia in Supabase via `CHECK (qty >= 0)`).
- Soglia (`threshold`): intero `>= 1` oppure assente (`null/undefined`). Mai `0`.

---

## Offline

- L'app si apre offline (PWA/app shell cached).
- La conferma sessione è consentita anche offline → sessione in coda localStorage.
- La coda viene svuotata automaticamente al ritorno online (FIFO).

---

## Admin — Area impostazioni (`/impostazioni`, alias `/admin`)

- Protetta da password (default: `1909`).
- Sessione admin valida 12h (hash SHA-256 in localStorage).
- Azioni rapide in home admin (tutte in modale, nessun redirect):
  - `Sessioni storico` → storico sessioni inviate
  - `Imposta Soglie` → soglia unica su tutti i vini (doppia conferma + PIN)
  - `Aggiorna password` → cambio password con conferma
  - `Richiesta PIN` → toggle PIN avvio app e PIN impostazioni
  - `Importa archivio` → import CSV (aggiungi o sostituisci) con doppia conferma + PIN
  - `Reset archivio` → cancella archivio vini Supabase con doppia conferma + PIN

---

## Admin — Archivio vini (`/admina`)

- CRUD tabellare desktop-first.
- Filtri: Cerca, Categoria, Produttore, Provenienza — complementari tra loro.
- Ordinamento A-Z / Z-A su Categoria, Nome, Produttore, Provenienza.
- Toolbar su singola riga desktop: `Aggiungi vino` | `Cerca...` | filtri | box statistiche (Totale/Soglia/Esauriti) | reset filtri | azioni.
- Colonna `ANNO`: cella vuota se valore assente.
- Colonna note: accessibile via icona in colonna `Azioni` (gialla se presenti, grigia se assenti).
- Quantità `0` evidenziata in rosso acceso.
- Quantità in soglia evidenziata in ambra.
- Modifica massiva filtrata: click destro su tabella → aggiorna campo su tutti i vini filtrati.
- Import CSV: modalità `Aggiungi` o `Sostituisci`, doppia conferma + PIN.
- Export: CSV, Excel (exceljs), PDF con logo e numerazione pagine.

---

## Policy testo campi vino

Obbligatoria ovunque (input, CSV, DB, storico):

| Campo | Regola |
|---|---|
| `Categoria` | UPPERCASE |
| `Nome` | UPPERCASE |
| `Provenienza` | UPPERCASE |
| `Produttore` | Initcap (prima lettera maiuscola) |

---

## Business rules archivio

- `Magazzino = Acquisto × Q.tà`
- `Margine = Vendita − Acquisto`
- Entrambi calcolati automaticamente (frontend + trigger DB Supabase).

---

## Storico sessioni

- Mostra solo sessioni `status = 'submitted'`.
- Card cliccabili con dettaglio vini e quantità.
- Formato data: `18 Marzo 2026`. Formato ora: `15:05`.
- Filtro temporale con preset (`Oggi`, `7/30/90 giorni`, `6/12 mesi`, ecc.) + intervallo personalizzato.
- Reset storico con doppia conferma + PIN + scelta retention (Tutto / ultimi 7d / 30d / 3m / 12m).

---

## Fuori scope

- Login utente operativo con account individuali.
- Carichi inventario da UI app.
- Google Sheets (integrazione opzionale via webhook, non nel flusso principale).
- Modifica quantità inventario da admin (solo da archivio `/admina`).
