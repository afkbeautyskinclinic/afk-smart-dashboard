/**
 * AFK Growth Intelligence Dashboard - multi-user sync hardening module.
 *
 * Cara pasang di Apps Script:
 * 1. Tambahkan file baru, misalnya "SyncMutations.gs".
 * 2. Paste seluruh isi file ini.
 * 3. Di doPost(e) lama, setelah payload JSON terbaca, tambahkan:
 *    if (payload.action === "syncMutations") return json_(afkHandleSyncMutations_(payload));
 *
 * Modul ini sengaja dibuat sebagai add-on agar action lama seperti fetch, sync,
 * dan uploadTreatmentMedia tetap bisa dipertahankan.
 */

var AFK_SYNC_OPERATION_SHEET = "_afk_sync_operations";
var AFK_SYNC_META_COLUMNS = ["_syncId", "_createdAt", "_updatedAt"];
var AFK_SYNC_DATASETS = [
  "manager",
  "managerMarketingDaily",
  "patientCommand",
  "managerDecisionLog",
  "ownerEscalation",
  "marketing",
  "content",
  "crm",
  "doctor",
  "medis",
  "inventory"
];

function afkHandleSyncMutations_(payload) {
  var lock = LockService.getScriptLock();
  lock.waitLock(28000);
  try {
    var mutations = Array.isArray(payload.mutations) ? payload.mutations : [];
    var acceptedIds = [];
    var skippedIds = [];
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var seenOperations = afkLoadOperationIds_(ss);

    mutations.forEach(function(mutation) {
      if (!mutation || !mutation.id) return;
      if (seenOperations[mutation.id]) {
        skippedIds.push(mutation.id);
        acceptedIds.push(mutation.id);
        return;
      }

      if (mutation.type === "settingsUpdate" || mutation.dataset === "settings") {
        afkSaveSettingsMutation_(ss, mutation);
      } else if (AFK_SYNC_DATASETS.indexOf(mutation.dataset) !== -1) {
        afkApplyDatasetMutation_(ss, mutation, payload.columns || {});
      } else {
        throw new Error("Dataset tidak dikenal: " + mutation.dataset);
      }

      afkAppendOperationLog_(ss, mutation, "accepted");
      seenOperations[mutation.id] = true;
      acceptedIds.push(mutation.id);
    });

    return {
      ok: true,
      acceptedIds: acceptedIds,
      skippedIds: skippedIds,
      serverTime: new Date().toISOString()
    };
  } finally {
    lock.releaseLock();
  }
}

function afkApplyDatasetMutation_(ss, mutation, columnsByDataset) {
  var dataset = mutation.dataset;
  var row = mutation.row || {};
  var sheet = afkGetOrCreateSheet_(ss, dataset);
  var headers = afkEnsureHeaders_(sheet, afkResolveHeaders_(dataset, row, columnsByDataset));
  var syncId = String(mutation.rowId || row._syncId || "");
  if (!syncId) throw new Error("Mutation tanpa rowId pada dataset " + dataset);

  row._syncId = syncId;
  if (!row._createdAt) row._createdAt = mutation.clientTime || new Date().toISOString();
  row._updatedAt = new Date().toISOString();

  var syncColumn = headers.indexOf("_syncId") + 1;
  var targetRow = afkFindRowByValue_(sheet, syncColumn, syncId);

  if (mutation.type === "delete") {
    if (targetRow > 1) sheet.deleteRow(targetRow);
    return;
  }

  var values = headers.map(function(header) {
    return afkCellValue_(row[header]);
  });

  if (targetRow > 1) {
    sheet.getRange(targetRow, 1, 1, headers.length).setValues([values]);
  } else {
    sheet.appendRow(values);
  }
}

function afkSaveSettingsMutation_(ss, mutation) {
  var sheet = afkGetOrCreateSheet_(ss, "settings");
  afkEnsureHeaders_(sheet, ["key", "value", "updatedAt", "_syncId"]);
  var settings = mutation.row || {};
  var syncId = String(mutation.rowId || mutation.id);
  var rowIndex = afkFindRowByValue_(sheet, 1, "settings");
  var values = ["settings", JSON.stringify(settings), new Date().toISOString(), syncId];
  if (rowIndex > 1) {
    sheet.getRange(rowIndex, 1, 1, values.length).setValues([values]);
  } else {
    sheet.appendRow(values);
  }
}

function afkResolveHeaders_(dataset, row, columnsByDataset) {
  var fromClient = Array.isArray(columnsByDataset[dataset]) ? columnsByDataset[dataset] : [];
  var headers = [];
  fromClient.concat(Object.keys(row || {})).concat(AFK_SYNC_META_COLUMNS).forEach(function(header) {
    header = String(header || "").trim();
    if (header && headers.indexOf(header) === -1) headers.push(header);
  });
  return headers;
}

function afkEnsureHeaders_(sheet, desiredHeaders) {
  var lastColumn = Math.max(sheet.getLastColumn(), 1);
  var current = sheet.getRange(1, 1, 1, lastColumn).getValues()[0]
    .map(function(header) { return String(header || "").trim(); })
    .filter(Boolean);

  desiredHeaders.forEach(function(header) {
    if (current.indexOf(header) === -1) current.push(header);
  });

  if (!current.length) current = desiredHeaders;
  sheet.getRange(1, 1, 1, current.length).setValues([current]);
  return current;
}

function afkGetOrCreateSheet_(ss, name) {
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

function afkFindRowByValue_(sheet, column, value) {
  if (!value || sheet.getLastRow() < 2) return -1;
  var values = sheet.getRange(2, column, sheet.getLastRow() - 1, 1).getValues();
  for (var i = 0; i < values.length; i += 1) {
    if (String(values[i][0]) === String(value)) return i + 2;
  }
  return -1;
}

function afkCellValue_(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return value;
}

function afkLoadOperationIds_(ss) {
  var sheet = afkGetOrCreateSheet_(ss, AFK_SYNC_OPERATION_SHEET);
  afkEnsureHeaders_(sheet, ["mutationId", "dataset", "type", "rowId", "deviceId", "actorRole", "clientTime", "serverTime", "status"]);
  var seen = {};
  if (sheet.getLastRow() < 2) return seen;
  var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
  values.forEach(function(row) {
    if (row[0]) seen[String(row[0])] = true;
  });
  return seen;
}

function afkAppendOperationLog_(ss, mutation, status) {
  var sheet = afkGetOrCreateSheet_(ss, AFK_SYNC_OPERATION_SHEET);
  sheet.appendRow([
    mutation.id,
    mutation.dataset,
    mutation.type,
    mutation.rowId,
    mutation.deviceId,
    mutation.actorRole,
    mutation.clientTime,
    new Date().toISOString(),
    status
  ]);
}
