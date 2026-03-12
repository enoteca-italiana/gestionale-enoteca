# DOCS — Enoteca Italiana / Scarichi Vini

Questa cartella contiene il **DNA del progetto**: decisioni, architettura, flussi e regole operative.

## Documenti

- `01_REQUIREMENTS.md`
  - Requisiti funzionali e non funzionali (baseline) — esclusi Supabase/Google per la modalità locale.
- `02_ARCHITECTURE.md`
  - Struttura del codice, moduli, routing, dipendenze, invarianti.
- `03_LOCAL_STORAGE_MODEL.md`
  - Modello dati locale (inventario, storico, sospesi), persistenza e sincronizzazione intra-tab.
- `04_USER_FLOW_SESSION.md`
  - Flusso utente: sessione scarico, ricerca, vincoli quantità, conferma, comportamento offline.
- `05_ADMIN.md`
  - Area Admin: login, settings, storico, sospesi, reset (storico/totale).
- `06_OFFLINE_PWA.md`
  - Offline reale (Service Worker), caching, update, note dev/prod.
- `07_OPERATIONS_BACKUP.md`
  - Operatività: comandi, preview, backup, naming e policy.

## Regole di mantenimento

- Questa cartella va aggiornata **ad ogni modifica significativa**:
  - nuovo flusso
  - cambio struttura moduli
  - cambio modello dati
  - cambio comportamento offline/PWA
  - nuove opzioni Admin
- Obiettivo: permettere a un dev di capire **al 100%** cosa fa l’app e dove intervenire.
