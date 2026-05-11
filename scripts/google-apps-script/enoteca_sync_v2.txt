const CFG = (() => {
  const p = PropertiesService.getScriptProperties();
  return {
    SUPABASE_URL: (p.getProperty('SUPABASE_URL') || '').replace(/\/+$/, ''),
    SUPABASE_SERVICE_ROLE_KEY: p.getProperty('SUPABASE_SERVICE_ROLE_KEY') || '',
    WEBHOOK_SECRET: p.getProperty('WEBHOOK_SECRET') || '',
    SHEET_NAME_WINES: p.getProperty('SHEET_NAME_WINES') || p.getProperty('SHEET_NAME') || 'Vini',
    SHEET_NAME_SPIRITS: p.getProperty('SHEET_NAME_SPIRITS') || 'Spirits',
    PAGE_SIZE: 1000,
    UPSERT_CHUNK_SIZE: 500,
    ID_HEADER: '__ID__'
  };
})();

const TABLES = {
  wines: {
    key: 'wines',
    table: 'wines',
    sheetName: CFG.SHEET_NAME_WINES,
    headers: [
      'NOME',
      'PRODUTTORE',
      'ANNO',
      'PROVENIENZA',
      'ACQUISTO',
      'VENDITA',
      'Q.tà',
      'MAGAZZINO'
    ],
    select: 'id,name,producer,age,origin,purchase_price,sale_price,qty,warehouse',
    order: 'name.asc'
  },
  spirits_products: {
    key: 'spirits_products',
    table: 'spirits_products',
    sheetName: CFG.SHEET_NAME_SPIRITS,
    headers: ['NOME', 'PRODUTTORE', 'ACQUISTO', 'VENDITA', 'Q.tà', 'MAGAZZINO'],
    select: 'id,name,producer,purchase_price,sale_price,qty,warehouse',
    order: 'name.asc'
  }
};

// ─── SYNC AUTOMATICO BIDIREZIONALE — logica semplificata ─────────────────
//
// Architettura:
//   App ↔ Supabase  : REST diretto + Realtime (istantaneo, gestito lato app)
//   Sheet ↔ DB      : timer reconcile ogni 5 minuti
//
// reconcile() per ogni tabella:
//   → se il foglio è stato modificato dall'utente (dirty=true) → push Sheet→DB
//   → altrimenti → pull DB→Sheet (mantiene il foglio aggiornato)
//
// Niente webhook, niente mute, niente pending map.
// ─────────────────────────────────────────────────────────────────────────

var DIRTY_WINES_KEY = 'dirty_wines';
var DIRTY_SPIRITS_KEY = 'dirty_spirits';

// Chiamato dal trigger onChange installabile.
// Segna il foglio come "modificato dall'utente" — nessuna chiamata HTTP.
function onSheetEdit_(e) {
  try {
    var changeType = e && e.changeType ? e.changeType : 'EDIT';
    var relevantTypes = ['EDIT', 'INSERT_ROW', 'DELETE_ROW', 'REMOVE_ROW'];
    if (relevantTypes.indexOf(changeType) === -1) return;

    var sheetName = null;
    if (e && e.range) {
      sheetName = e.range.getSheet().getName();
      if (e.range.getRow() === 1) return; // ignora modifiche all'header
    } else if (e && e.source) {
      try {
        sheetName = e.source.getActiveSheet().getName();
      } catch (_) {}
    }

    var dirtyKey = null;
    if (sheetName === CFG.SHEET_NAME_WINES) dirtyKey = DIRTY_WINES_KEY;
    else if (sheetName === CFG.SHEET_NAME_SPIRITS) dirtyKey = DIRTY_SPIRITS_KEY;
    if (!dirtyKey) return;

    // Ignora modifiche fatte dal pull stesso (flag temporaneo durante sync)
    var syncKey = 'reconcile_running_' + dirtyKey;
    if (PropertiesService.getScriptProperties().getProperty(syncKey) === 'true') return;

    PropertiesService.getScriptProperties().setProperty(dirtyKey, 'true');
  } catch (_) {
    // silenzioso — non disturba mai l'utente durante la modifica
  }
}

// Webhook da Supabase (DB trigger AFTER INSERT/UPDATE/DELETE).
// Con la nuova architettura reconcile non usiamo più il webhook per il pull.
// Rispondiamo subito 200 per evitare retry da Supabase.
function doPost(e) {
  return jsonResponse_({ ok: true, status: 200, mode: 'reconcile' });
}

// ── Reconcile: eseguito dal timer ogni 5 minuti ──────────────────────────
// Per ogni tabella: se dirty → push Sheet→DB, altrimenti → pull DB→Sheet.
function reconcile() {
  var tables = [
    { tableKey: 'wines', dirtyKey: DIRTY_WINES_KEY },
    { tableKey: 'spirits_products', dirtyKey: DIRTY_SPIRITS_KEY }
  ];

  var props = PropertiesService.getScriptProperties();

  tables.forEach(function (t) {
    var isDirty = props.getProperty(t.dirtyKey) === 'true';

    if (isDirty) {
      // Foglio modificato dall'utente → push Sheet→DB (include delete diff)
      props.deleteProperty(t.dirtyKey);
      try {
        syncTableFromSheetToSupabaseWithLock_(t.tableKey);
      } catch (err) {
        // Ripristina dirty: riproverà al prossimo tick
        props.setProperty(t.dirtyKey, 'true');
      }
    } else {
      // Nessuna modifica utente → pull DB→Sheet
      // Setta flag temporaneo: onSheetEdit_ non marca dirty durante il pull
      var syncKey = 'reconcile_running_' + t.dirtyKey;
      props.setProperty(syncKey, 'true');
      try {
        syncTableFromSupabaseToSheetWithLock_(t.tableKey);
      } finally {
        props.deleteProperty(syncKey);
      }
    }
  });
}

// Installa tutti i trigger necessari. Da eseguire una sola volta.
function installTriggers() {
  var toRemove = ['onSheetEdit_', 'reconcile', 'processPendingSync_', 'processPendingPull_'];
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (toRemove.indexOf(t.getHandlerFunction()) !== -1) ScriptApp.deleteTrigger(t);
  });

  ScriptApp.newTrigger('onSheetEdit_')
    .forSpreadsheet(SpreadsheetApp.getActive())
    .onChange()
    .create();

  ScriptApp.newTrigger('reconcile').timeBased().everyMinutes(5).create();

  // Pulizia chiavi obsolete delle versioni precedenti
  var obsolete = [
    'autoSync_pending_push',
    'autoSync_pending_pull',
    'autoSync_table',
    'autoSync_ts',
    'autoPull_table',
    'autoPull_ts',
    'autoMute_push_ts',
    'autoMute_pull_ts'
  ];
  obsolete.forEach(function (k) {
    PropertiesService.getScriptProperties().deleteProperty(k);
  });

  toast_('✅ Attivatori installati (onChange + reconcile ogni 5 min)');
}

// Rimuove i trigger installati (utile per manutenzione).
function removeTriggers() {
  var toRemove = ['onSheetEdit_', 'reconcile', 'processPendingSync_', 'processPendingPull_'];
  var count = 0;
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (toRemove.indexOf(t.getHandlerFunction()) !== -1) {
      ScriptApp.deleteTrigger(t);
      count++;
    }
  });
  toast_('Rimossi ' + count + ' attivatori');
}
// ────────────────────────────────────────────────────────────────────────────

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Sync Enoteca')
    .addItem('Setup fogli', 'setupAllSheets')
    .addSeparator()
    .addItem('Pull Vini da Supabase', 'syncWinesFromSupabaseToSheet')
    .addItem('Push Vini da Foglio', 'syncWinesFromSheetToSupabase')
    .addSeparator()
    .addItem('Pull Spirits da Supabase', 'syncSpiritsFromSupabaseToSheet')
    .addItem('Push Spirits da Foglio', 'syncSpiritsFromSheetToSupabase')
    .addSeparator()
    .addItem('Verifica configurazione', 'checkConfig')
    .addSeparator()
    .addItem('▶ Installa attivatori auto-sync', 'installTriggers')
    .addItem('✕ Rimuovi attivatori', 'removeTriggers')
    .addToUi();
}

function setupAllSheets() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30 * 1000);
  try {
    setupSheetForTable_('wines');
    setupSheetForTable_('spirits_products');
    toast_('Setup completato: Vini + Spirits');
  } finally {
    lock.releaseLock();
  }
}

function checkConfig() {
  const missing = [];
  if (!CFG.SUPABASE_URL) missing.push('SUPABASE_URL');
  if (!CFG.SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  if (!CFG.WEBHOOK_SECRET) missing.push('WEBHOOK_SECRET');
  if (!CFG.SHEET_NAME_WINES) missing.push('SHEET_NAME_WINES');
  if (!CFG.SHEET_NAME_SPIRITS) missing.push('SHEET_NAME_SPIRITS');

  if (missing.length) {
    toast_('Config mancante: ' + missing.join(', '));
    return;
  }

  toast_('Configurazione OK');
}

function syncWinesFromSupabaseToSheet() {
  syncTableFromSupabaseToSheetWithLock_('wines');
}

function syncWinesFromSheetToSupabase() {
  syncTableFromSheetToSupabaseWithLock_('wines');
}

function syncSpiritsFromSupabaseToSheet() {
  syncTableFromSupabaseToSheetWithLock_('spirits_products');
}

function syncSpiritsFromSheetToSupabase() {
  syncTableFromSheetToSupabaseWithLock_('spirits_products');
}

function syncTableFromSupabaseToSheetWithLock_(tableKey) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30 * 1000);
  try {
    syncTableFromSupabaseToSheet_(tableKey, { silentToast: false });
  } finally {
    lock.releaseLock();
  }
}

function syncTableFromSheetToSupabaseWithLock_(tableKey) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30 * 1000);
  try {
    syncTableFromSheetToSupabase_(tableKey);
  } finally {
    lock.releaseLock();
  }
}

function syncTableFromSupabaseToSheet_(tableKey, options) {
  const tableCfg = getTableConfig_(tableKey);
  const sh = getSheet_(tableCfg);
  ensureHeaders_(sh, tableCfg);

  const rows = supabaseSelectAll_(tableCfg);
  const out = rows.map(function (row) {
    return toSheetRow_(tableKey, row);
  });

  clearDataKeepHeader_(sh, tableCfg);

  if (out.length) {
    sh.getRange(2, 1, out.length, out[0].length).setValues(out);
  }

  if (!options || !options.silentToast) {
    toast_('Pull completato (' + labelForTable_(tableKey) + '): ' + out.length + ' righe');
  }
}

function syncTableFromSheetToSupabase_(tableKey) {
  const tableCfg = getTableConfig_(tableKey);
  const sh = getSheet_(tableCfg);
  ensureHeaders_(sh, tableCfg);

  const values = sh.getDataRange().getValues();
  const header = values[0];
  const idx = indexByHeader_(header, tableCfg);

  // Righe con contenuto reale (esclude righe vuote/header)
  const body =
    values.length > 1
      ? values.slice(1).filter(function (row) {
          return rowHasContent_(tableKey, row, idx);
        })
      : [];

  const payload = body.map(function (row) {
    return normalizeSheetRowAndBuildPayload_(tableKey, row, idx);
  });

  // Normalizza valori nel foglio
  if (body.length) {
    sh.getRange(2, 1, body.length, header.length).setValues(body);
  }

  // UPSERT righe presenti nel foglio
  if (payload.length) {
    supabaseUpsert_(tableCfg, payload);
  }

  // DELETE righe presenti nel DB ma assenti dal foglio (hard delete bidirezionale)
  const sheetIds = payload
    .map(function (r) {
      return r.id;
    })
    .filter(Boolean);
  supabaseDeleteMissing_(tableCfg, sheetIds);

  toast_('Push completato (' + labelForTable_(tableKey) + '): ' + payload.length + ' upsert');
}

function setupSheetForTable_(tableKey) {
  const tableCfg = getTableConfig_(tableKey);
  const sh = getSheet_(tableCfg);
  const headers = tableCfg.headers.concat([CFG.ID_HEADER]);

  sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  sh.setFrozenRows(1);
  sh.hideColumns(headers.length);
}

function resolveTableKey_(rawTable) {
  const value = safeString_(rawTable).toLowerCase();
  if (value === 'wines') return 'wines';
  if (value === 'spirits_products' || value === 'spirits') return 'spirits_products';
  return null;
}

function getTableConfig_(tableKey) {
  const cfg = TABLES[tableKey];
  if (!cfg) throw new Error('Configurazione tabella non trovata: ' + tableKey);
  return cfg;
}

function labelForTable_(tableKey) {
  return tableKey === 'wines' ? 'Vini' : 'Spirits';
}

function getSheet_(tableCfg) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(tableCfg.sheetName) || ss.insertSheet(tableCfg.sheetName);
}

function ensureHeaders_(sh, tableCfg) {
  const expected = tableCfg.headers.concat([CFG.ID_HEADER]);
  const current = sh.getRange(1, 1, 1, expected.length).getValues()[0];
  const ok = expected.every(function (h, i) {
    return String(current[i] || '').trim() === h;
  });

  if (!ok) {
    sh.getRange(1, 1, 1, expected.length).setValues([expected]);
    sh.setFrozenRows(1);
    sh.hideColumns(expected.length);
  }
}

function clearDataKeepHeader_(sh, tableCfg) {
  const lastRow = sh.getLastRow();
  const width = tableCfg.headers.length + 1;
  if (lastRow > 1) {
    sh.getRange(2, 1, lastRow - 1, width).clearContent();
  }
}

function indexByHeader_(headerRow, tableCfg) {
  const out = {};
  headerRow.forEach(function (h, i) {
    out[String(h).trim()] = i;
  });

  const required = tableCfg.headers.concat([CFG.ID_HEADER]);
  required.forEach(function (h) {
    if (typeof out[h] !== 'number') {
      throw new Error('Header mancante (' + labelForTable_(tableCfg.key) + '): ' + h);
    }
  });

  return out;
}

function rowHasContent_(tableKey, row, idx) {
  if (tableKey === 'wines') {
    return !!(
      safeString_(row[idx.NOME]) ||
      safeString_(row[idx.PRODUTTORE]) ||
      safeString_(row[idx.PROVENIENZA]) ||
      safeString_(row[idx.__ID__])
    );
  }

  return !!(
    safeString_(row[idx.NOME]) ||
    safeString_(row[idx.PRODUTTORE]) ||
    safeString_(row[idx.__ID__])
  );
}

function toSheetRow_(tableKey, row) {
  if (tableKey === 'wines') {
    const purchase = toNumber_(row.purchase_price);
    const qty = toQty_(row.qty);
    const sale = coalesceNumber_(toNumber_(row.sale_price), deriveSalePrice_(purchase));
    const warehouse = coalesceNumber_(toNumber_(row.warehouse), deriveWarehouse_(purchase, qty));

    return [
      normalizeUpper_(row.name),
      normalizeProducer_(row.producer),
      safeString_(row.age),
      normalizeUpper_(row.origin),
      formatMoney_(purchase),
      formatMoney_(sale),
      formatQty_(qty),
      formatMoney_(warehouse),
      safeString_(row.id)
    ];
  }

  const purchase = toNumber_(row.purchase_price);
  const qty = toQty_(row.qty);
  const sale = coalesceNumber_(toNumber_(row.sale_price), deriveSalePrice_(purchase));
  const warehouse = coalesceNumber_(toNumber_(row.warehouse), deriveWarehouse_(purchase, qty));

  return [
    normalizeUpper_(row.name),
    normalizeProducer_(row.producer),
    formatMoney_(purchase),
    formatMoney_(sale),
    formatQty_(qty),
    formatMoney_(warehouse),
    safeString_(row.id)
  ];
}

function normalizeSheetRowAndBuildPayload_(tableKey, row, idx) {
  let id = safeString_(row[idx.__ID__]);
  if (!id) id = Utilities.getUuid();

  if (tableKey === 'wines') {
    const normalizedName = normalizeUpper_(row[idx.NOME]);
    const normalizedProducer = normalizeProducer_(row[idx.PRODUTTORE]);
    const normalizedAge = nullableString_(row[idx.ANNO]);
    const normalizedOrigin = normalizeUpper_(row[idx.PROVENIENZA]) || 'N/D';

    const purchasePrice = parseMoney_(row[idx.ACQUISTO]);
    const qty = parseQty_(row[idx['Q.tà']]);
    const salePrice = deriveSalePrice_(purchasePrice);
    const warehouse = deriveWarehouse_(purchasePrice, qty);

    row[idx.__ID__] = id;
    row[idx.NOME] = normalizedName;
    row[idx.PRODUTTORE] = normalizedProducer;
    row[idx.ANNO] = normalizedAge || '';
    row[idx.PROVENIENZA] = normalizedOrigin;
    row[idx.ACQUISTO] = formatMoney_(purchasePrice);
    row[idx.VENDITA] = formatMoney_(salePrice);
    row[idx['Q.tà']] = formatQty_(qty);
    row[idx.MAGAZZINO] = formatMoney_(warehouse);

    return {
      id: id,
      name: normalizedName,
      producer: normalizedProducer,
      age: normalizedAge,
      origin: normalizedOrigin,
      purchase_price: purchasePrice,
      sale_price: salePrice,
      qty: qty,
      warehouse: warehouse
    };
  }

  const normalizedName = normalizeUpper_(row[idx.NOME]);
  const normalizedProducer = normalizeProducer_(row[idx.PRODUTTORE]);

  const purchasePrice = parseMoney_(row[idx.ACQUISTO]);
  const qty = parseQty_(row[idx['Q.tà']]);
  const salePrice = deriveSalePrice_(purchasePrice);
  const warehouse = deriveWarehouse_(purchasePrice, qty);

  row[idx.__ID__] = id;
  row[idx.NOME] = normalizedName;
  row[idx.PRODUTTORE] = normalizedProducer;
  row[idx.ACQUISTO] = formatMoney_(purchasePrice);
  row[idx.VENDITA] = formatMoney_(salePrice);
  row[idx['Q.tà']] = formatQty_(qty);
  row[idx.MAGAZZINO] = formatMoney_(warehouse);

  return {
    id: id,
    name: normalizedName,
    producer: normalizedProducer,
    purchase_price: purchasePrice,
    sale_price: salePrice,
    qty: qty,
    warehouse: warehouse
  };
}

function supabaseSelectAll_(tableCfg) {
  const pageSize = CFG.PAGE_SIZE;
  let from = 0;
  const all = [];

  while (true) {
    const to = from + pageSize - 1;
    const query = [
      'select=' + encodeURIComponent(tableCfg.select),
      'order=' + encodeURIComponent(tableCfg.order),
      'id=not.is.null'
    ].join('&');

    const url = CFG.SUPABASE_URL + '/rest/v1/' + tableCfg.table + '?' + query;

    const res = UrlFetchApp.fetch(url, {
      method: 'get',
      headers: {
        apikey: CFG.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: 'Bearer ' + CFG.SUPABASE_SERVICE_ROLE_KEY,
        Range: from + '-' + to,
        Prefer: 'count=exact'
      },
      muteHttpExceptions: true
    });

    const code = res.getResponseCode();
    const txt = res.getContentText();

    if (code < 200 || code >= 300) {
      throw new Error('Supabase select error ' + code + ' [' + tableCfg.table + ']: ' + txt);
    }

    const chunk = JSON.parse(txt || '[]');
    if (!Array.isArray(chunk) || chunk.length === 0) break;

    all.push.apply(all, chunk);

    if (chunk.length < pageSize) break;
    from += pageSize;
  }

  return all;
}

function supabaseUpsert_(tableCfg, rows) {
  if (!rows || !rows.length) return;

  const chunkSize = CFG.UPSERT_CHUNK_SIZE;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const url = CFG.SUPABASE_URL + '/rest/v1/' + tableCfg.table + '?on_conflict=id';

    const res = UrlFetchApp.fetch(url, {
      method: 'post',
      headers: {
        apikey: CFG.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: 'Bearer ' + CFG.SUPABASE_SERVICE_ROLE_KEY,
        Prefer: 'resolution=merge-duplicates,return=minimal',
        'Content-Type': 'application/json'
      },
      payload: JSON.stringify(chunk),
      muteHttpExceptions: true
    });

    const code = res.getResponseCode();
    const txt = res.getContentText();

    if (code < 200 || code >= 300) {
      throw new Error('Supabase upsert error ' + code + ' [' + tableCfg.table + ']: ' + txt);
    }
  }
}

// Recupera tutti gli ID presenti nel DB (paginato, solo colonna id).
function supabaseSelectIds_(tableCfg) {
  const pageSize = CFG.PAGE_SIZE;
  let from = 0;
  const all = [];

  while (true) {
    const url =
      CFG.SUPABASE_URL + '/rest/v1/' + tableCfg.table + '?select=id&id=not.is.null&order=id.asc';

    const res = UrlFetchApp.fetch(url, {
      method: 'get',
      headers: {
        apikey: CFG.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: 'Bearer ' + CFG.SUPABASE_SERVICE_ROLE_KEY,
        Range: from + '-' + (from + pageSize - 1),
        Prefer: 'count=exact'
      },
      muteHttpExceptions: true
    });

    const code = res.getResponseCode();
    if (code < 200 || code >= 300) {
      throw new Error(
        'Supabase selectIds error ' + code + ' [' + tableCfg.table + ']: ' + res.getContentText()
      );
    }

    const chunk = JSON.parse(res.getContentText() || '[]');
    if (!Array.isArray(chunk) || chunk.length === 0) break;

    chunk.forEach(function (r) {
      if (r.id) all.push(r.id);
    });

    if (chunk.length < pageSize) break;
    from += pageSize;
  }

  return all;
}

// Cancella dal DB le righe il cui id NON è presente in keepIds (hard delete).
function supabaseDeleteMissing_(tableCfg, keepIds) {
  const dbIds = supabaseSelectIds_(tableCfg);

  const toDelete = dbIds.filter(function (id) {
    return keepIds.indexOf(id) === -1;
  });

  if (!toDelete.length) return;

  supabaseDelete_(tableCfg, toDelete);
}

// DELETE su Supabase per lista di ID (a blocchi di 100 per sicurezza URL length).
function supabaseDelete_(tableCfg, ids) {
  if (!ids || !ids.length) return;

  const chunkSize = 100;
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    const url =
      CFG.SUPABASE_URL + '/rest/v1/' + tableCfg.table + '?id=in.(' + chunk.join(',') + ')';

    const res = UrlFetchApp.fetch(url, {
      method: 'delete',
      headers: {
        apikey: CFG.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: 'Bearer ' + CFG.SUPABASE_SERVICE_ROLE_KEY,
        Prefer: 'return=minimal'
      },
      muteHttpExceptions: true
    });

    const code = res.getResponseCode();
    if (code < 200 || code >= 300) {
      throw new Error(
        'Supabase delete error ' + code + ' [' + tableCfg.table + ']: ' + res.getContentText()
      );
    }
  }
}

function deriveSalePrice_(purchasePrice) {
  if (typeof purchasePrice !== 'number' || !isFinite(purchasePrice)) return null;
  return round2_(purchasePrice * 1.3);
}

function deriveWarehouse_(purchasePrice, qty) {
  if (typeof purchasePrice !== 'number' || !isFinite(purchasePrice)) return null;
  const safeQty = typeof qty === 'number' && isFinite(qty) ? Math.max(0, Math.round(qty)) : 0;
  return round2_(purchasePrice * safeQty);
}

function round2_(value) {
  return Number(Number(value).toFixed(2));
}

function toNumber_(value) {
  if (typeof value === 'number' && isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(',', '.').trim());
    return isFinite(parsed) ? parsed : null;
  }
  return null;
}

function coalesceNumber_(a, b) {
  return a !== null && a !== undefined ? a : b;
}

function formatMoney_(value) {
  if (value === null || value === undefined || value === '') return '';
  const n = Number(value);
  if (!isFinite(n)) return '';
  return '€' + n.toFixed(2).replace('.', ',');
}

function parseMoney_(value) {
  if (value === null || value === undefined || value === '') return null;

  let s = String(value).trim();
  if (!s) return null;

  s = s.replace(/[€\s]/g, '');
  const hasComma = s.indexOf(',') >= 0;
  const hasDot = s.indexOf('.') >= 0;

  if (hasComma && hasDot) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (hasComma) {
    s = s.replace(',', '.');
  }

  const n = Number(s);
  return isFinite(n) ? round2_(n) : null;
}

function formatQty_(value) {
  const n = Number(value);
  if (!isFinite(n)) return 0;
  return Math.max(0, Math.round(n));
}

function parseQty_(value) {
  const n = Number(String(value == null ? '' : value).replace(',', '.'));
  if (!isFinite(n)) return 0;
  return Math.max(0, Math.round(n));
}

function toQty_(value) {
  const n = Number(value);
  if (!isFinite(n)) return 0;
  return Math.max(0, Math.round(n));
}

function compactSpaces_(value) {
  return String(value == null ? '' : value)
    .trim()
    .replace(/\s+/g, ' ');
}

function normalizeUpper_(value) {
  const s = compactSpaces_(value);
  return s ? s.toUpperCase() : '';
}

function normalizeProducer_(value) {
  const s = compactSpaces_(value);
  if (!s) return '';
  return s
    .toLowerCase()
    .split(' ')
    .map(function (part) {
      return part ? part.charAt(0).toUpperCase() + part.slice(1) : '';
    })
    .join(' ');
}

function safeString_(value) {
  return String(value == null ? '' : value).trim();
}

function nullableString_(value) {
  const s = safeString_(value);
  return s ? s : null;
}

function jsonResponse_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}

function toast_(message) {
  const ss = SpreadsheetApp.getActive();
  if (ss) ss.toast(message);
}
