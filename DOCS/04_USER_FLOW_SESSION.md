# Flusso utente — Sessione di scarico

Ultimo aggiornamento: **07/04/2026 00:25 CEST**.

## Entrata

- Home mostra header con logo.
- Box sessione:
  - stato OFF/ON
  - CTA:
    - viola `Inizia sessione di scarico`
  - input ricerca (abilitato solo quando sessione aperta)
- Sessione OFF:
  - lista consultiva visibile.
  - click/tap su card vino apre modale `Giacenza` per aggiornare solo la quantità:
    - selector a scroll (`0..999`);
    - pulsanti `Annulla` / `Conferma`;
    - conferma finale tramite secondo modale prima del salvataggio.
- Sessione ON:
  - risultati operativi visibili dopo ricerca.

## Ricerca

- Ricerca per nome su inventario locale.
- Risultati mostrano:
  - nome
  - produttore
  - provenienza
  - annata se presente
  - quantità

## Scarico rapido

- Bottoni: `-1`, `-2`, `-3`
- Se qty è 0:
  - bottoni disabilitati

Vincolo:

- la logica non permette mai qty < 0.

## Riepilogo

- Per ogni vino in sessione:
  - `+1` (se c’è disponibilità)
  - `-1`
  - `Elimina`

## Conferma

- La conferma finale avviene con modale.

## Comportamento online/offline

- Online:
  - la sessione viene salvata su Supabase:
    - insert `discharge_sessions` + `discharge_session_items`
    - submit RPC `submit_discharge_session`
  - aggiornamento inventario post-submit.
  - in modalità consultiva Home, aggiornamento giacenza da modale sincronizza locale + Supabase.
- Offline:
  - conferma sessione bloccata con messaggio operativo.

## Intro

- Durata: 2500ms.
- Logo con fade-in (opacity/translate/blur) e supporto `prefers-reduced-motion`.
- Durante l’intro la Bottom Nav non viene mostrata.
