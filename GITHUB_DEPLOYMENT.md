const APP_NAME = 'AFK Beauty Clinic Smart Dashboard';
const DEPLOYMENT_OWNER_EMAIL = 'aefkaskincare@gmail.com';
const SHEET_ID_PROPERTY = 'AFK_DASHBOARD_SHEET_ID';
const TOKEN_PROPERTY = 'AFK_DASHBOARD_TOKEN';
const MEDIA_FOLDER_ID_PROPERTY = 'AFK_TREATMENT_MEDIA_FOLDER_ID';

const TABLES = {
  crm: ['date', 'id', 'name', 'gender', 'address', 'wa', 'interest', 'status', 'category', 'followUp', 'note', 'revenue', 'bottleneck', 'ownerNote', 'updatedAt'],
  marketing: ['date', 'platform', 'name', 'objective', 'spend', 'impressions', 'clicks', 'leads', 'qualified', 'booking', 'showUp', 'treatment', 'revenue', 'bottleneck', 'ownerNote', 'updatedAt'],
  content: ['date', 'id', 'title', 'platform', 'format', 'hook', 'cta', 'asset', 'publishDate', 'views', 'reach', 'likes', 'comments', 'shares', 'saves', 'leads', 'status', 'ownerNote', 'updatedAt'],
  medis: ['date', 'patientId', 'bookingId', 'treatmentName', 'doctor', 'nurseBeautician', 'room', 'status', 'products', 'aftercare', 'upsales', 'rebooking', 'complaint', 'mediaLinks', 'bottleneck', 'ownerNote', 'updatedAt'],
  inventory: ['id', 'name', 'category', 'unit', 'supplier', 'initial', 'inQty', 'outQty', 'minimum', 'expired', 'bottleneck', 'ownerNote', 'updatedAt'],
  settings: ['key', 'value', 'updatedAt'],
  auditLog: ['timestamp', 'email', 'action', 'tableName', 'details']
};

function doGet(e) {
  try {
    const params = e && e.parameter ? e.parameter : {};
    assertAuthorized_(params.token);
    const action = params.action || 'fetch';

    if (action === 'health') {
      return json_({ ok: true, app: APP_NAME, owner: DEPLOYMENT_OWNER_EMAIL, timestamp: now_() });
    }

    if (action === 'bootstrap') {
      const sheet = bootstrap();
      return json_({ ok: true, spreadsheetId: sheet.getId(), spreadsheetUrl: sheet.getUrl() });
    }

    return json_({ ok: true, data: readAllData_(), timestamp: now_() });
  } catch (error) {
    return json_({ ok: false, error: error.message });
  }
}

function doPost(e) {
  try {
    const body = parseBody_(e);
    assertAuthorized_(body.token);

    if (body.action === 'bootstrap') {
      const sheet = bootstrap();
      return json_({ ok: true, spreadsheetId: sheet.getId(), spreadsheetUrl: sheet.getUrl() });
    }

    if (body.action === 'sync') {
      writeDashboardState_(body.data || {});
      logAudit_('sync', 'all', 'Full dashboard sync from frontend');
      return json_({ ok: true, message: 'Data dashboard berhasil disinkronkan.', timestamp: now_() });
    }

    if (body.action === 'append') {
      appendRow_(body.tableName, body.row || {});
      logAudit_('append', body.tableName, JSON.stringify(body.row || {}));
      return json_({ ok: true, message: 'Row berhasil ditambahkan.', timestamp: now_() });
    }

    if (body.action === 'uploadTreatmentMedia') {
      const uploadedFiles = uploadTreatmentMedia_(body.files || [], body.meta || {});
      logAudit_('uploadTreatmentMedia', 'medis', JSON.stringify({ meta: body.meta || {}, count: uploadedFiles.length }));
      return json_({ ok: true, files: uploadedFiles, timestamp: now_() });
    }

    return json_({ ok: false, error: 'Action tidak dikenal.' });
  } catch (error) {
    return json_({ ok: false, error: error.message });
  }
}

function bootstrap() {
  const props = PropertiesService.getScriptProperties();
  let spreadsheetId = props.getProperty(SHEET_ID_PROPERTY);
  let ss = spreadsheetId ? SpreadsheetApp.openById(spreadsheetId) : null;

  if (!ss) {
    ss = SpreadsheetApp.create(APP_NAME + ' - Database');
    props.setProperty(SHEET_ID_PROPERTY, ss.getId());
  }

  Object.keys(TABLES).forEach(tableName => ensureSheet_(ss, tableName, TABLES[tableName]));
  seedSettings_();
  logAudit_('bootstrap', 'system', 'Spreadsheet initialized');
  return ss;
}

function setDashboardToken(token) {
  if (!token || String(token).length < 16) {
    throw new Error('Token minimal 16 karakter.');
  }
  PropertiesService.getScriptProperties().setProperty(TOKEN_PROPERTY, String(token));
  return 'Token backend berhasil disimpan.';
}

function authorizeDriveAccess() {
  return getTreatmentMediaFolder_().getUrl();
}

function createDashboardToken() {
  const token = Utilities.getUuid() + '-' + Utilities.getUuid();
  PropertiesService.getScriptProperties().setProperty(TOKEN_PROPERTY, token);
  Logger.log('Dashboard token: ' + token);
  return token;
}

function getSpreadsheetUrl() {
  const ss = getSpreadsheet_();
  return ss.getUrl();
}

function readAllData_() {
  const ss = getSpreadsheet_();
  const output = {};

  ['crm', 'marketing', 'content', 'medis', 'inventory'].forEach(tableName => {
    output[tableName] = readTable_(ss, tableName);
  });

  output.settings = readSettings_(ss);
  return output;
}

function writeDashboardState_(data) {
  const ss = getSpreadsheet_();
  ['crm', 'marketing', 'content', 'medis', 'inventory'].forEach(tableName => {
    replaceTable_(ss, tableName, data[tableName] || []);
  });

  if (data.settings) {
    writeSettings_(ss, data.settings);
  }
}

function replaceTable_(ss, tableName, rows) {
  const headers = TABLES[tableName];
  const sheet = ensureSheet_(ss, tableName, headers);
  sheet.clearContents();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');

  if (!rows.length) return;

  const values = rows.map(sourceRow => {
    const row = normalizeRowForTable_(tableName, sourceRow);
    return headers.map(header => {
      if (header === 'updatedAt') return now_();
      return row[header] == null ? '' : row[header];
    });
  });
  sheet.getRange(2, 1, values.length, headers.length).setValues(values);
  sheet.autoResizeColumns(1, headers.length);
}

function appendRow_(tableName, row) {
  if (!TABLES[tableName]) throw new Error('Nama tabel tidak valid: ' + tableName);
  const ss = getSpreadsheet_();
  const headers = TABLES[tableName];
  const sheet = ensureSheet_(ss, tableName, headers);
  row = normalizeRowForTable_(tableName, row);
  sheet.appendRow(headers.map(header => header === 'updatedAt' ? now_() : (row[header] == null ? '' : row[header])));
}

function normalizeRowForTable_(tableName, row) {
  if (tableName !== 'medis') return row || {};
  row = row || {};
  return {
    ...row,
    nurseBeautician: row.nurseBeautician || row.therapist || '',
    mediaLinks: row.mediaLinks || ''
  };
}

function readTable_(ss, tableName) {
  const sheet = ensureSheet_(ss, tableName, TABLES[tableName]);
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0];
  return values.slice(1)
    .filter(row => row.some(cell => cell !== ''))
    .map(row => headers.reduce((record, header, index) => {
      record[header] = normalizeCell_(row[index]);
      return record;
    }, {}));
}

function writeSettings_(ss, settings) {
  const sheet = ensureSheet_(ss, 'settings', TABLES.settings);
  const rows = Object.keys(settings).map(key => [key, settings[key], now_()]);
  sheet.clearContents();
  sheet.getRange(1, 1, 1, TABLES.settings.length).setValues([TABLES.settings]).setFontWeight('bold');
  if (rows.length) sheet.getRange(2, 1, rows.length, TABLES.settings.length).setValues(rows);
}

function readSettings_(ss) {
  const sheet = ensureSheet_(ss, 'settings', TABLES.settings);
  const values = sheet.getDataRange().getValues();
  return values.slice(1).reduce((settings, row) => {
    if (row[0]) settings[row[0]] = row[1];
    return settings;
  }, {});
}

function seedSettings_() {
  const ss = getSpreadsheet_();
  const current = readSettings_(ss);
  if (Object.keys(current).length) return;

  writeSettings_(ss, {
    brandName: APP_NAME,
    primaryColor: '#F81894',
    divisions: 'CRM, Digital Marketing, Design Content, Medis, Inventory',
    pics: 'Ryan CRM, Rizki Digital Marketing & Ads, Nur Hikmah Medis, Ridho Inventory',
    treatments: 'Vaser Liposuction, Mini Surgery',
    sources: 'Meta Ads (FB), Instagram Ads, Tiktok Ads, Google Ads, Websites, Data Base, Walk In, Referral',
    platforms: 'Instagram, TikTok, Meta Ads, Google Ads, WhatsApp'
  });
}

function uploadTreatmentMedia_(files, meta) {
  if (!files.length) throw new Error('Tidak ada file media yang dikirim.');
  const rootFolder = getTreatmentMediaFolder_();
  const recordFolder = getOrCreateChildFolder_(rootFolder, treatmentMediaFolderName_(meta));

  return files.map(file => {
    if (!file.data) throw new Error('Data file kosong: ' + (file.name || 'media'));
    const blob = Utilities.newBlob(
      Utilities.base64Decode(file.data),
      file.mimeType || 'application/octet-stream',
      sanitizeDriveName_(file.name || 'media-treatment')
    );
    const driveFile = recordFolder.createFile(blob);
    return {
      name: driveFile.getName(),
      url: driveFile.getUrl(),
      id: driveFile.getId(),
      mimeType: driveFile.getMimeType()
    };
  });
}

function getTreatmentMediaFolder_() {
  const props = PropertiesService.getScriptProperties();
  const existingId = props.getProperty(MEDIA_FOLDER_ID_PROPERTY);
  if (existingId) {
    try {
      return DriveApp.getFolderById(existingId);
    } catch (error) {
      props.deleteProperty(MEDIA_FOLDER_ID_PROPERTY);
    }
  }

  const folder = DriveApp.createFolder(APP_NAME + ' - Treatment Media');
  props.setProperty(MEDIA_FOLDER_ID_PROPERTY, folder.getId());
  return folder;
}

function getOrCreateChildFolder_(parentFolder, name) {
  const folders = parentFolder.getFoldersByName(name);
  return folders.hasNext() ? folders.next() : parentFolder.createFolder(name);
}

function treatmentMediaFolderName_(meta) {
  const parts = [
    meta.date || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd'),
    meta.bookingId || '',
    meta.patientId || '',
    meta.treatmentName || ''
  ].filter(Boolean);
  return sanitizeDriveName_(parts.join(' - ') || 'Treatment Media');
}

function sanitizeDriveName_(value) {
  return String(value || 'media').replace(/[\\/:*?"<>|#%{}~&]/g, '-').slice(0, 140);
}

function getSpreadsheet_() {
  const props = PropertiesService.getScriptProperties();
  const spreadsheetId = props.getProperty(SHEET_ID_PROPERTY);
  if (!spreadsheetId) return bootstrap();
  return SpreadsheetApp.openById(spreadsheetId);
}

function ensureSheet_(ss, tableName, headers) {
  let sheet = ss.getSheetByName(tableName);
  if (!sheet) sheet = ss.insertSheet(tableName);

  const existingHeaders = sheet.getLastColumn()
    ? sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), headers.length)).getValues()[0]
    : [];

  const needsHeaders = headers.some((header, index) => existingHeaders[index] !== header);
  if (needsHeaders) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }

  return sheet;
}

function parseBody_(e) {
  if (!e || !e.postData || !e.postData.contents) return {};
  const text = e.postData.contents;
  try {
    return JSON.parse(text);
  } catch (error) {
    return e.parameter || {};
  }
}

function assertAuthorized_(token) {
  const expected = PropertiesService.getScriptProperties().getProperty(TOKEN_PROPERTY);
  if (!expected) return;
  if (String(token || '') !== expected) throw new Error('Token backend tidak valid.');
}

function logAudit_(action, tableName, details) {
  const ss = getSpreadsheet_();
  const sheet = ensureSheet_(ss, 'auditLog', TABLES.auditLog);
  const email = Session.getActiveUser().getEmail() || DEPLOYMENT_OWNER_EMAIL;
  sheet.appendRow([now_(), email, action, tableName, details || '']);
}

function normalizeCell_(value) {
  if (value instanceof Date) return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return value;
}

function now_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ssXXX");
}

function json_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

