# Requisiti (baseline) — Scarichi Vini

## Scopo

- L’app serve a gestire **scarichi** di bottiglie durante il servizio.
- Non gestisce carichi o aggiornamenti inventario da UI.

## UX / UI

- Mobile web app installabile come **PWA**.
- UX touch-first, veloce e chiara.
- Intro iniziale **2.5s** con **logo** e comparsa graduale.
- Navbar in basso con sole voci:
  - `Home`
  - `Admin`

## Modello operativo: sessione di scarico

- L’utente deve lavorare dentro una **sessione**.
- Flusso:
  1. avvia sessione
  2. ricerca per nome
  3. scarica con bottoni rapidi `-1`, `-2`, `-3`
  4. riepilogo con correzioni `+1`, `-1`, `elimina`
  5. conferma finale (modale)

## Ricerca vini

- Ricerca testuale per **nome**.
- Risultati mostrano:
  - nome
  - produttore
  - provenienza
  - annata (se presente)
- Quantità visibile.
- Vini con quantità `0`:
  - restano visibili
  - non scaricabili

## Vincoli quantità

- Mai andare sotto zero.

## Offline (modalità locale)

- L’app deve funzionare anche offline:
  - conferme offline finiscono in **coda** (sospesi)
  - quando torna online, la coda viene inviata **automaticamente** in ordine cronologico.

## Admin

- Area protetta da password.
- Password iniziale: `1909`.
- Password modificabile.
- Settings (toggle):
  - conferma finale on/off
  - associazione nome utente on/off (predisposizione)
- Storico Admin:
  - mostra solo sessioni inviate correttamente
  - reset storico con **doppia conferma**
- Sospesi Admin:
  - lista sessioni in coda
  - dettaglio (baseline: riepilogo in lista)
  - delete singolo con conferma
  - delete tutti con conferma
- Reset totale:
  - cancella inventario locale + storico + sospesi con **doppia conferma**

## Fuori scope (baseline)

- Login utente operativo.
- Carichi da app.
- Modifica quantità inventario da admin.
- Supabase / Google Sheets (in modalità locale).
