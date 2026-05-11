# DNA — Enoteca Italiana / Scarichi Vini

Quartier generale della documentazione. Chiunque legga questi file deve ottenere una panoramica maniacalmente dettagliata del progetto, senza dover aprire il codice sorgente.

Ultimo aggiornamento: **04/05/2026 — CEST**.

---

## Documenti

| File                        | Contenuto                                                                             |
| --------------------------- | ------------------------------------------------------------------------------------- |
| `01_REQUIREMENTS.md`        | Requisiti funzionali completi: flussi, vincoli, UX, scope                             |
| `02_ARCHITECTURE.md`        | Stack, routing, tutti i moduli, invarianti, PWA, build                                |
| `03_LOCAL_STORAGE_MODEL.md` | Modello dati locale: tipi, chiavi, eventi, funzioni                                   |
| `04_USER_FLOW_SESSION.md`   | Flusso completo sessione scarico: stati, logica, comportamento online/offline         |
| `05_ADMIN.md`               | Area admin: autenticazione, modali, archivio, storico, filtri                         |
| `06_OFFLINE_PWA.md`         | Offline queue, service worker, caching, installazione multi-device                    |
| `07_OPERATIONS_BACKUP.md`   | Dev server, build, GitHub, backup, handover nuovo PC                                  |
| `08_SUPABASE_SETUP.md`      | Setup Supabase, schema DB, RLS, indici, RPC, variabili ambiente                       |
| `09_CODE_REFERENCE.md`      | Riferimento codice completo: firme funzioni, logica, comportamento modulo per modulo  |
| `10_TEXT_CASING_POLICY.md`  | Policy obbligatoria casing campi vino (Categoria Initcap, Nome/Provenienza UPPERCASE) |
| `11_SPIRITS_WORKPLAN.md`    | Stato lavori Spirits, decisioni UI/DB/Sheets, fix applicati e note operative          |
| `12_HANDOFF_STATUS.md`      | Stato consolidato del progetto, cosa è chiuso, cosa resta, checklist nuovo PC         |

---

## Regola di manutenzione

Aggiornare questi file ad ogni cambiamento significativo di:

- flussi UX/UI
- modello dati o tipo dominio
- routing o struttura moduli
- comportamento offline/PWA
- operatività backup/deploy/handover
- funzioni repository o hook principali

Il DNA è la fonte di verità. Il codice non va mai letto per capire cosa fa l'app: lo dice il DNA.

Ordine di lettura consigliato per riprendere il lavoro su un altro PC:

1. `12_HANDOFF_STATUS.md`
2. `02_ARCHITECTURE.md`
3. `07_OPERATIONS_BACKUP.md`
4. `08_SUPABASE_SETUP.md`
5. `11_SPIRITS_WORKPLAN.md`
