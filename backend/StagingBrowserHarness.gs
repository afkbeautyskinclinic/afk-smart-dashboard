function afkStageAssertDatabase() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty(PROP_SPREADSHEET_ID);
  if (props.getProperty('AFK_STAGE_MARKER') !== 'SYNTHETIC_ONLY' || !id || id !== props.getProperty('AFK_STAGE_DB_ID')) throw new Error('STAGING_SAFETY');
  var ss = SpreadsheetApp.openById(id);
  if (ss.getName().indexOf('AFK STAGING SYNTHETIC') !== 0) throw new Error('STAGING_SAFETY');
  return ss;
}
function afkStageBrowserStart() {
  afkStageAssertDatabase();
  var login = afkHandleLogin_({username:'stage_crm',password:'SyntheticStageOnly!42'});
  if (!login.ok) throw new Error('Synthetic login failed');
  return {sessionToken:login.sessionToken,runId:'browser-'+Utilities.getUuid(),timing:login.timing};
}
function afkStageBrowserMutation(token, runId, index) {
  afkStageAssertDatabase();
  if (!/^browser-[a-f0-9-]+$/.test(String(runId)) || !Number.isInteger(index) || index<0 || index>5) throw new Error('Invalid synthetic request');
  var id=runId+'-'+index;
  return JSON.parse(route_({method:'POST',action:'secureSyncMutations',sessionToken:token,mutations:[{id:id,dataset:'crm',type:'upsert',rowId:id,row:{_syncId:id,date:'2026-10-14',name:'SYNTHETIC CONCURRENT '+index,userName:'stage_crm'}}]}).getContent());
}
function afkStageBrowserFinish(token, runId) {
  afkStageAssertDatabase();
  var result=JSON.parse(route_({method:'GET',action:'secureFetch',sessionToken:token,datasets:['crm']}).getContent());
  if (!result.ok) throw new Error(result.error);
  var rows=result.data.crm.filter(function(row){return String(row._syncId).indexOf(runId+'-')===0;});
  var ids={}; rows.forEach(function(row){ids[row._syncId]=true;});
  if (rows.length!==6 || Object.keys(ids).length!==6) throw new Error('Concurrent count/duplicate failure: '+rows.length);
  afkHandleLogout_({sessionToken:token});
  return {ok:true,rows:rows.length,distinctRows:Object.keys(ids).length};
}
function afkStageConflictRun() {
  afkStageAssertDatabase();
  var login=afkHandleLogin_({username:'stage_crm',password:'SyntheticStageOnly!42'});
  if (!login.ok) throw new Error('Synthetic login failed');
  var token=login.sessionToken, id='conflict-'+Utilities.getUuid(), results=[];
  function check(v,label){if(!v)throw new Error('FAIL: '+label);results.push(label);}
  function read(){return afkHandleSecureFetch_({sessionToken:token,datasets:['crm']}).data.crm.filter(function(r){return r._syncId===id;})[0];}
  function write(type,row,previous){return afkHandleSecureSyncMutations_({sessionToken:token,mutations:[{id:Utilities.getUuid(),dataset:'crm',type:type,rowId:id,row:row,previousRow:previous}]}).results[0];}
  try {
    check(write('upsert',{_syncId:id,name:'Original',date:'2026-10-14',userName:'stage_crm'}).status==='APPLIED','synthetic baseline');
    var previous=read();
    var first=Object.assign({},previous,{name:'Editor A'});
    check(write('update',first,previous).status==='APPLIED','first edit succeeds');
    var stale=Object.assign({},previous,{name:'Editor B'});
    var conflict=write('update',stale,previous);
    check(conflict.status==='PERMANENT_ERROR' && String(conflict.error).indexOf('CONFLICT')!==-1,'same-field stale edit rejected');
    check(read().name==='Editor A','winner data preserved');
    var independent=Object.assign({},previous,{performanceNote:'Independent field'});
    check(write('update',independent,previous).status==='APPLIED','different-field stale edit merges');
    var final=read();
    check(final.name==='Editor A' && final.performanceNote==='Independent field','both independent fields retained');
    var missing=afkHandleSecureSyncMutations_({sessionToken:token,mutations:[{id:Utilities.getUuid(),dataset:'crm',type:'update',rowId:'absent-'+id,row:{name:'Must not insert'}}]}).results[0];
    check(missing.status==='PERMANENT_ERROR' && String(missing.error).indexOf('NOT_FOUND')!==-1,'missing update cannot silently insert');
    return {ok:true,tests:results.length,results:results};
  } finally {afkHandleLogout_({sessionToken:token});}
}
