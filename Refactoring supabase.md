# Refactoring Supabase

Ultimo aggiornamento: **07/04/2026**

## 1) Obiettivo di questo file
Questo documento serve per ripartire da **zero** su un altro computer senza perdere contesto.

Contiene:
- stato reale attuale del progetto;
- cosa rifare da zero in Supabase;
- come collegare correttamente GitHub `enoteca-italiana/gestionale`;
- cosa aggiornare in app e in Google Apps Script;
- codice completo Apps Script (versione operativa da incollare in blocco);
- SQL pronto per webhook Supabase -> Google Sheets;
- checklist test finale.

---

## 2) Stato attuale fotografato

### Repo applicazione
- Repository: `https://github.com/enoteca-italiana/gestionale.git`
- Branch operativo: `main`
- Root progetto locale: `CascadeProjects/windsurf-project`

### Architettura dati voluta
- **Supabase = source of truth** (database centrale)
- **App** legge/scrive su Supabase
- **Google Sheet** sincronizzato bidirezionale

### Stato trigger `public.wines` visto da SQL Editor
Risultato confermato:

- `trg_wines_before_write`
  - `BEFORE INSERT OR UPDATE`
  - funzione: `wines_before_write()`
- `trg_wines_notify_google_sheets`
  - `AFTER INSERT OR UPDATE OR DELETE`
  - funzione: `integration.notify_google_sheets_wines()`

Questo conferma che il webhook DB->Sheet è stato applicato (sull'ambiente corrente).

---

## 3) Problema principale emerso
In passato sono stati usati account GitHub/Supabase diversi (`dero975` vs `enoteca-italiana`).

Per evitare confusione futura:
1. rifare o riallineare Supabase da account corretto;
2. collegare integrazione GitHub **solo** su `enoteca-italiana/gestionale`;
3. aggiornare tutte le chiavi in App + Apps Script.

---

## 4) Procedura da zero (alto livello)

1. Login corretto su GitHub (`enoteca-italiana`).
2. Creazione nuovo progetto Supabase (o reset completo progetto esistente).
3. Collegamento GitHub Integration in Supabase al repo `enoteca-italiana/gestionale`.
4. Setup schema SQL (`wines`, sessioni, RPC, RLS, indici).
5. Setup webhook SQL verso Apps Script.
6. Setup Apps Script completo (pull/push + webhook endpoint + trigger timer/edit).
7. Aggiornamento variabili app frontend (`VITE_SUPABASE_*`).
8. Test end-to-end.

---

## 5) Step dettagliati Supabase (da rifare)

## 5.1 Creazione progetto
In Supabase:
- Organization: `enoteca-italiana`
- Project name: `enoteca`
- Environment: `main / production`

Appena creato il progetto, salvare:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

> Importante: non committare mai `SERVICE_ROLE_KEY` su Git.

## 5.2 Collegamento GitHub corretto
In GitHub App `Supabase`:
- installazione su account `enoteca-italiana`
- repository access: `Only select repositories`
- selezionare: `enoteca-italiana/gestionale`
- salvare.

In Supabase -> `Settings -> Integrations -> GitHub`:
- selezionare repo `enoteca-italiana/gestionale`
- branch `main`

## 5.3 SQL base (schema + policy)
Riferimento ordine ufficiale in `DOCS/08_SUPABASE_SETUP.md`:
1. SCRIPT 01 create table
2. SCRIPT 02 add missing columns
3. SCRIPT 03 constraints
4. SCRIPT 04A trigger function
5. SCRIPT 04B trigger attach
6. SCRIPT 05 backfill + normalizzazione
7. SCRIPT 06A enable RLS
8. SCRIPT 06B policies + grants
9. SCRIPT 07 indexes
10. SCRIPT 08 seed upsert
11. SCRIPT 09A/09B check finale

Nota operativa (07/04/2026):
- su ambiente con dataset reale già allineato da Google Sheet, `SCRIPT 08` va saltato per evitare overwrite seed.
- in questo caso procedere con `SCRIPT 09A/09B` e poi webhook.

## 5.4 SQL webhook verso Google Sheets
Eseguire in SQL Editor questo blocco (aggiornando URL/secret se cambiano):

```sql
create extension if not exists pg_net with schema extensions;

create schema if not exists integration;

create table if not exists integration.runtime_config (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

insert into integration.runtime_config (key, value)
values
  ('google_sheets_webhook_url', 'https://script.google.com/macros/s/AKfycbw6ESjoN-mNfaMax_10y2RYS9IWLGHAy7LXVZ46RHdd4-_EMcR0bBNHE6KxR4T15qVj1w/exec'),
  ('google_sheets_webhook_secret', 'enoteca_sync_7f3a9c2d5e1b8k4m')
on conflict (key) do update
set value = excluded.value,
    updated_at = now();

create or replace function integration.notify_google_sheets_wines()
returns trigger
language plpgsql
security definer
set search_path = public, integration, extensions
as $$
declare
  v_url text;
  v_secret text;
  v_payload jsonb;
begin
  select value into v_url
  from integration.runtime_config
  where key = 'google_sheets_webhook_url';

  select value into v_secret
  from integration.runtime_config
  where key = 'google_sheets_webhook_secret';

  if coalesce(v_url, '') = '' then
    raise warning 'Google webhook URL mancante';
    return coalesce(new, old);
  end if;

  v_payload := jsonb_build_object(
    'source', 'supabase',
    'table', 'wines',
    'op', tg_op,
    'id', coalesce(new.id, old.id),
    'secret', coalesce(v_secret, ''),
    'timestamp', now()
  );

  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := v_payload
  );

  return coalesce(new, old);
exception
  when others then
    raise warning 'notify_google_sheets_wines errore: %', sqlerrm;
    return coalesce(new, old);
end;
$$;

drop trigger if exists trg_wines_notify_google_sheets on public.wines;

create trigger trg_wines_notify_google_sheets
after insert or update or delete
on public.wines
for each row
execute function integration.notify_google_sheets_wines();
```

Verifica trigger:

```sql
select
  tgname as trigger_name,
  pg_get_triggerdef(oid) as trigger_def
from pg_trigger
where tgrelid = 'public.wines'::regclass
  and not tgisinternal
order by tgname;
```

Atteso: 2 trigger (`trg_wines_before_write`, `trg_wines_notify_google_sheets`).

---

## 6) Variabili da aggiornare nell'app (frontend)
File locale app:
- `apps/scarichi-vini/.env.local` (o `.env` nel workflow usato)

Variabili minime:

```env
VITE_SUPABASE_URL=https://aezqtgadyaxdcptwlpci.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlenF0Z2FkeWF4ZGNwdHdscGNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1NTE3MzYsImV4cCI6MjA5MTEyNzczNn0.XHygA3zVLT10OICJMsKJ8EmVK1-VUkIop9jFG4aZciQ
```

Note:
- dopo cambio chiavi, riavviare dev server;
- verificare che CRUD Archivio funzioni (aggiungi/modifica/elimina).

---

## 7) Google Apps Script - configurazione

## 7.1 Proprietà script (Script Properties)
Inserire:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SHEET_NAME` = `Vini`
- `WEBHOOK_SECRET` = stesso valore usato in SQL (`google_sheets_webhook_secret`)

## 7.2 Trigger consigliati
- Trigger 1: funzione `syncFromSheetToSupabase`
  - origine: `Da foglio di lavoro`
  - evento: `Alla modifica`
- Trigger 2: funzione `syncFromSupabaseToSheet`
  - origine: `Evento vincolato a specifiche temporali`
  - intervallo: ogni 1 minuto

## 7.3 Deploy web app
- Deploy -> New deployment -> Web app
- Execute as: account proprietario script
- Who has access: `Anyone` (o policy equivalente del dominio)
- copiare URL `/exec` e usarlo nel SQL `google_sheets_webhook_url`.

---

## 8) Codice Apps Script completo (da incollare in blocco in `Codice.gs`)

> Questo è il blocco operativo unico da usare come baseline. Se ricrei Supabase, cambieranno solo le Script Properties (URL/KEY/secret), non la logica.

```javascript
const CFG = (() => {
  const p = PropertiesService.getScriptProperties();
  return {
    SUPABASE_URL: (p.getProperty('SUPABASE_URL') || '').replace(/\/+$/, ''),
    SUPABASE_SERVICE_ROLE_KEY: p.getProperty('SUPABASE_SERVICE_ROLE_KEY') || '',
    SHEET_NAME: p.getProperty('SHEET_NAME') || 'Vini',
    TABLE: 'wines',
    HEADERS: ['NOME', 'PRODUTTORE', 'ANNO', 'PROVENIENZA', 'ACQUISTO', 'VENDITA', 'Q.tà', 'MAGAZZINO'],
    ID_HEADER: '__ID__',
    WEBHOOK_SECRET: p.getProperty('WEBHOOK_SECRET') || ''
  };
})();

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Sync Enoteca')
    .addItem('Setup foglio (header + colonna ID)', 'setupSheet')
    .addItem('Pull da Supabase -> Foglio', 'syncFromSupabaseToSheet')
    .addItem('Push da Foglio -> Supabase', 'syncFromSheetToSupabase')
    .addToUi();
}

function setupSheet() {
  const sh = getSheet_();
  const headers = [...CFG.HEADERS, CFG.ID_HEADER];
  sh.clear();
  sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  sh.setFrozenRows(1);
  sh.hideColumns(headers.length);
}

function syncFromSupabaseToSheet() {
  const sh = getSheet_();
  ensureHeader_(sh);

  const rows = supabaseSelectAll_();
  const values = rows.map(r => [
    safeString_(r.name),
    safeString_(r.producer),
    safeString_(r.age),
    safeString_(r.origin),
    numOrBlank_(r.purchase_price),
    numOrBlank_(r.selling_price),
    numOrBlank_(r.qty),
    numOrBlank_(r.warehouse),
    safeString_(r.id)
  ]);

  const lastRow = sh.getLastRow();
  const width = CFG.HEADERS.length + 1;
  if (lastRow > 1) {
    sh.getRange(2, 1, lastRow - 1, width).clearContent();
  }

  if (values.length) {
    sh.getRange(2, 1, values.length, width).setValues(values);
  }
}

function syncFromSheetToSupabase() {
  const sh = getSheet_();
  ensureHeader_(sh);

  const lastRow = sh.getLastRow();
  if (lastRow < 2) return;

  const width = CFG.HEADERS.length + 1;
  const data = sh.getRange(2, 1, lastRow - 1, width).getValues();

  const payload = data
    .filter(r => String(r[0]).trim() !== '')
    .map(r => {
      const id = String(r[8] || '').trim();
      return {
        ...(id ? { id } : {}),
        name: safeString_(r[0]),
        producer: safeString_(r[1]),
        age: safeString_(r[2]),
        origin: safeString_(r[3]),
        purchase_price: toNumber_(r[4]),
        selling_price: toNumber_(r[5]),
        qty: toInteger_(r[6]),
        warehouse: toNumber_(r[7])
      };
    });

  if (!payload.length) return;

  supabaseUpsert_(payload);
  syncFromSupabaseToSheet();
}

function doPost(e) {
  try {
    const provided = (e && e.parameter && e.parameter.secret)
      ? String(e.parameter.secret)
      : '';

    const body = e && e.postData && e.postData.contents
      ? JSON.parse(e.postData.contents)
      : {};

    const bodySecret = body && body.secret ? String(body.secret) : '';
    const secret = provided || bodySecret;

    if (!CFG.WEBHOOK_SECRET || secret !== CFG.WEBHOOK_SECRET) {
      return jsonOut_({ ok: false, error: 'unauthorized', status: 401 });
    }

    syncFromSupabaseToSheet();
    return jsonOut_({ ok: true, status: 200 });
  } catch (err) {
    return jsonOut_({ ok: false, error: String(err), status: 500 });
  }
}

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(CFG.SHEET_NAME) || ss.insertSheet(CFG.SHEET_NAME);
  return sh;
}

function ensureHeader_(sh) {
  const headers = [...CFG.HEADERS, CFG.ID_HEADER];
  const row = sh.getRange(1, 1, 1, headers.length).getValues()[0];
  const mismatch = headers.some((h, i) => String(row[i] || '').trim() !== h);
  if (mismatch) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    sh.setFrozenRows(1);
    sh.hideColumns(headers.length);
  }
}

function supabaseSelectAll_() {
  const pageSize = 1000;
  let from = 0;
  let all = [];

  while (true) {
    const to = from + pageSize - 1;
    const url = `${CFG.SUPABASE_URL}/rest/v1/${CFG.TABLE}` +
      `?select=id,name,producer,age,origin,purchase_price,selling_price,qty,warehouse` +
      `&order=name.asc&id=not.is.null`;

    const res = UrlFetchApp.fetch(url, {
      method: 'get',
      headers: {
        apikey: CFG.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${CFG.SUPABASE_SERVICE_ROLE_KEY}`,
        Range: `${from}-${to}`,
        Prefer: 'count=exact'
      },
      muteHttpExceptions: true
    });

    const code = res.getResponseCode();
    const txt = res.getContentText();
    if (code < 200 || code >= 300) {
      throw new Error(`Supabase select error ${code}: ${txt}`);
    }

    const chunk = JSON.parse(txt || '[]');
    all = all.concat(chunk);

    if (!chunk.length || chunk.length < pageSize) break;
    from += pageSize;
  }

  return all;
}

function supabaseUpsert_(rows) {
  const url = `${CFG.SUPABASE_URL}/rest/v1/${CFG.TABLE}`;
  const res = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: {
      apikey: CFG.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${CFG.SUPABASE_SERVICE_ROLE_KEY}`,
      Prefer: 'resolution=merge-duplicates,return=minimal'
    },
    payload: JSON.stringify(rows),
    muteHttpExceptions: true
  });

  const code = res.getResponseCode();
  const txt = res.getContentText();
  if (code < 200 || code >= 300) {
    throw new Error(`Supabase upsert error ${code}: ${txt}`);
  }
}

function safeString_(v) {
  return String(v == null ? '' : v).trim();
}

function toNumber_(v) {
  if (v === '' || v == null) return null;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function toInteger_(v) {
  if (v === '' || v == null) return 0;
  const n = Math.round(Number(String(v).replace(',', '.')));
  return Number.isFinite(n) ? n : 0;
}

function numOrBlank_(v) {
  return (v == null || v === '') ? '' : Number(v);
}

function jsonOut_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
```

---

## 9) Cosa aggiornare quando rigeneri Supabase

Dopo la creazione nuovo progetto, aggiornare subito:

1. App frontend
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

2. Apps Script (Script Properties)
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `WEBHOOK_SECRET` (allineato SQL)

3. SQL runtime config in Supabase
- `google_sheets_webhook_url`
- `google_sheets_webhook_secret`

4. Se rigeneri DB da zero
- rieseguire tutti script schema/RLS/trigger/rpc
- rieseguire trigger webhook

---

## 10) Test consolidamento (obbligatori)

## 10.1 Test App -> Supabase
- modifica un vino da Archivio
- verifica record aggiornato in `public.wines`

## 10.2 Test Supabase -> Foglio
- modifica un vino in app
- entro pochi secondi/minuto foglio aggiornato

## 10.3 Test Foglio -> Supabase
- modifica riga nel foglio (colonne gestite)
- trigger `Alla modifica` pusha su Supabase
- app mostra dato aggiornato

## 10.4 Test consistenza colonne
Foglio atteso (gestite):
- `NOME`, `PRODUTTORE`, `ANNO`, `PROVENIENZA`, `ACQUISTO`, `VENDITA`, `Q.tà`, `MAGAZZINO`, `__ID__`

Vincoli richiesti:
- `categoria` resta gestita in app (non nel foglio)
- `fornitore` eliminato dal runtime
- `vendita`, `magazzino`, `margine` con eventuale logica/calcolo da preservare secondo flusso attuale

---

## 11) Rischi noti / attenzione

- OAuth GitHub<->Supabase può bloccarsi su "Completing GitHub Authorization..." per cookie/sessione.
- In quel caso: salvare repo access su GitHub App, poi refresh Supabase Integrations.
- Assicurarsi sempre di stare nell'account corretto (`enoteca-italiana`) quando si installa l'app GitHub Supabase.
- Non usare `SERVICE_ROLE_KEY` nel frontend.

---

## 12) Piano operativo quando riapri su un altro PC

1. Apri questo file.
2. Verifica account GitHub attivo (`enoteca-italiana`).
3. Crea/rigenera progetto Supabase.
4. Collega GitHub integration al repo corretto.
5. Esegui SQL base + SQL webhook.
6. Aggiorna variabili app + script properties Apps Script.
7. Deploy web app Apps Script.
8. Esegui test 10.1/10.2/10.3.
9. Solo dopo esito positivo: commit aggiornamenti docs/config.

---

## 13) File di riferimento nel repo

- `DOCS/08_SUPABASE_SETUP.md`
- `PROJECT_STATUS.md`
- `apps/scarichi-vini/src/lib/supabase.ts`
- `scripts/sql/supabase_enterprise_index_cleanup.sql`
- `scripts/sql/supabase_text_casing_policy.sql`
