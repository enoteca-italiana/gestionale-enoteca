# Flusso utente — Sessione di scarico

Ultimo aggiornamento: **16/03/2026 15:12 CET**.

## Entrata

- Home mostra header con logo.
- Box sessione:
  - stato OFF/ON
  - CTA:
    - viola `Inizia sessione di scarico` (nessuna nota pronta)
    - verde `Avvia scarico da nota (N)` (nota pronta disponibile)
  - input ricerca (abilitato solo quando sessione aperta)
- Sessione OFF:
  - lista consultiva visibile (solo lettura).
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

## Avvio da Nota Scarico

- Se esiste nota `ready`, la CTA Home diventa verde.
- Click su CTA verde:
  - carica automaticamente i vini della nota nel riepilogo sessione;
  - nota passa a stato `in_progress`.
- Durante la sessione:
  - è sempre possibile aggiungere altri vini con la normale ricerca.
- A submit sessione riuscito:
  - nota marcata `completed` lato Supabase.

## Comportamento online/offline

- Online:
  - la sessione viene salvata su Supabase:
    - insert `discharge_sessions` + `discharge_session_items`
    - submit RPC `submit_discharge_session`
  - aggiornamento inventario post-submit.
- Offline:
  - conferma sessione bloccata con messaggio operativo.

## Intro

- Durata: 2500ms.
- Logo con fade-in (opacity/translate/blur) e supporto `prefers-reduced-motion`.
- Durante l’intro la Bottom Nav non viene mostrata.
