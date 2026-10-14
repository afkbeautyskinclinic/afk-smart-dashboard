/** Runs only against a new synthetic spreadsheet owned by this staging project. */
function afkStageRun() {
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty('AFK_STAGE_MARKER') !== 'SYNTHETIC_ONLY') {
    if (props.getProperty(PROP_SPREADSHEET_ID)) throw new Error('STAGING_SAFETY: existing database property refused');
    var db = SpreadsheetApp.create('AFK STAGING SYNTHETIC - Security Tests 2026-10-14');
    props.setProperty(PROP_SPREADSHEET_ID, db.getId());
    props.setProperty('AFK_STAGE_DB_ID', db.getId());
    props.setProperty('AFK_STAGE_MARKER', 'SYNTHETIC_ONLY');
  }
  var id = props.getProperty(PROP_SPREADSHEET_ID);
  if (!id || id !== props.getProperty('AFK_STAGE_DB_ID')) throw new Error('STAGING_SAFETY: database mismatch');
  var ss = SpreadsheetApp.openById(id);
  if (ss.getName().indexOf('AFK STAGING SYNTHETIC') !== 0) throw new Error('STAGING_SAFETY: invalid database name');
  var results = [];
  function check(value, label) { if (!value) throw new Error('FAIL: '+label); results.push(label); }
  function rejected(fn, expected, label) {
    var error = '';
    try { fn(); } catch (e) { error = String(e.message || e); }
    check(error.indexOf(expected) !== -1, label);
  }
  DATASETS.forEach(function(name) { ensureDatasetSheet_(ss, name, DEFAULT_COLUMNS[name]); });
  afkEnsureAuthSheets_(ss);
  afkCreateOrUpdateAuthUser('stage_crm', 'SyntheticStageOnly!42', 'CRM', true);
  afkCreateOrUpdateAuthUser('stage_owner', 'SyntheticStageOnly!42', 'Owner', true);
  var login = afkHandleLogin_({username:'stage_crm', password:'SyntheticStageOnly!42'});
  check(login.ok && login.sessionToken, 'login and session creation');
  check(afkValidateSession_(login.sessionToken).role === 'CRM', 'valid session');
  var own = afkHandleSecureFetch_({sessionToken:login.sessionToken, datasets:['crm']});
  check(own.ok && Array.isArray(own.data.crm), 'authorized dataset read');
  rejected(function() { afkHandleSecureFetch_({sessionToken:login.sessionToken, datasets:['manager']}); }, 'Akses dataset ditolak', 'forbidden dataset rejected');
  var syncId = 'stage-report-' + Utilities.getUuid();
  var opId = 'stage-operation-' + Utilities.getUuid();
  var mutation = {id:opId, dataset:'crm', type:'upsert', rowId:syncId, row:{_syncId:syncId, date:'2026-10-14', userName:'Synthetic Staff', name:'SYNTHETIC PATIENT', ownerNote:'staff must not write'}, actorRole:'Owner'};
  var sync = afkHandleSecureSyncMutations_({sessionToken:login.sessionToken, mutations:[mutation]});
  check(sync.acceptedIds.indexOf(opId) !== -1, 'authorized report mutation');
  var replay = afkHandleSecureSyncMutations_({sessionToken:login.sessionToken, mutations:[mutation]});
  check(replay.skippedIds.indexOf(opId) !== -1, 'idempotent mutation retry');
  var reports = afkHandleSecureFetch_({sessionToken:login.sessionToken,datasets:['crm']}).data.crm;
  var report = reports.filter(function(row) { return row._syncId===syncId; });
  check(report.length===1, 'retry does not duplicate report');
  check(!report[0].ownerNote, 'staff cannot set Owner note');
  var denied = afkHandleSecureSyncMutations_({sessionToken:login.sessionToken, mutations:[{id:'denied-'+Utilities.getUuid(),dataset:'manager',type:'upsert',rowId:'denied',row:{date:'2026-10-14'}}]});
  check(denied.results[0].status==='FORBIDDEN','forged client role does not grant access');
  ['bootstrap','fetch','sync','syncMutations','uploadTreatmentMedia'].forEach(function(action) {
    check(JSON.parse(route_({action:action,method:'POST',token:'synthetic'}).getContent()).error==='LEGACY_API_DISABLED', 'legacy '+action+' rejected');
  });
  var owner = afkHandleLogin_({username:'stage_owner',password:'SyntheticStageOnly!42'});
  writeSettings_(ss,{clinicName:'SYNTHETIC CLINIC',userAccounts:[{username:'synthetic',password:'synthetic secret'}],backendToken:'synthetic secret'});
  var settings = afkHandleSecureFetch_({sessionToken:owner.sessionToken,datasets:['crm'],includeSettings:'true'}).data.settings;
  check(settings.clinicName==='SYNTHETIC CLINIC' && !settings.backendToken && !settings.userAccounts[0].password, 'Settings response strips credentials');
  afkCreateOrUpdateAuthUser('stage_crm','SyntheticStageOnly!42','CRM',false);
  rejected(function(){afkValidateSession_(login.sessionToken);},'AUTH_REVOKED','inactive account rejects old session');
  afkCreateOrUpdateAuthUser('stage_crm','SyntheticStageOnly!42','Owner',true);
  rejected(function(){afkValidateSession_(login.sessionToken);},'AUTH_REVOKED','role change rejects old session');
  afkCreateOrUpdateAuthUser('stage_crm','SyntheticStageOnly!42','CRM',true);
  var user = afkFindAuthUserByUsername_(ss,'stage_crm');
  var session = afkCreateSession_(ss,user);
  var sheet = ss.getSheetByName(AFK_AUTH_SESSIONS_SHEET), headers = afkGetAuthHeaders_(sheet);
  var row = afkFindAuthRowByValue_(sheet,headers,'sessionTokenHash',afkDigestHex_(session.sessionToken));
  afkUpdateAuthRow_(sheet,headers,row,{expiresAt:'invalid'});
  rejected(function(){afkValidateSession_(session.sessionToken);},'AUTH_EXPIRED','invalid expiry rejected');
  var fresh = afkHandleLogin_({username:'stage_crm',password:'SyntheticStageOnly!42'});
  afkHandleLogout_({sessionToken:fresh.sessionToken});
  rejected(function(){afkValidateSession_(fresh.sessionToken);},'AUTH_REVOKED','logout revokes session');
  var oversized = [{mimeType:'image/png',data:'A'.repeat(4*Math.ceil((2*1024*1024+3)/3))}];
  rejected(function(){afkValidateUploadFiles_(oversized);},'2 MB','oversized media rejected before upload');
  rejected(function(){afkValidateUploadFiles_([{mimeType:'text/html',data:'dGVzdA=='}]);},'Tipe file','HTML media rejected');
  var result = {ok:true,environment:'synthetic staging',tests:results.length,results:results,spreadsheetId:ss.getId()};
  Logger.log(JSON.stringify(result));
  return result;
}
