# Flusso utente — Sessione di scarico

## Entrata

- Home mostra header con logo.
- Box sessione:
  - stato OFF/ON
  - CTA `Inizia sessione`
  - input ricerca (abilitato solo quando sessione aperta)

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

- Se setting `conferma finale` è ON:
  - appare modale di conferma.
- Se setting `nome utente` è ON:
  - la modale mostra input e salva `userLabel`.

## Comportamento online/offline

- Online:
  - la sessione confermata va in `history`.
- Offline:
  - la sessione confermata va in `pending`.
- Quando torna online:
  - `pending` viene spostata in `history` automaticamente in ordine cronologico.

## Intro

- Durata: 2500ms.
- Logo con fade-in (opacity/translate/blur) e supporto `prefers-reduced-motion`.
