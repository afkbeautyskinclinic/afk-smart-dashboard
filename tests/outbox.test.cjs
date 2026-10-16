const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
function fixture(data=new Map()){
 const storage={get length(){return data.size},key:i=>[...data.keys()][i]||null,getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k)};
 const c={localStorage:storage,SYNC_QUEUE_KEY:'queue',localPendingMutations:new Map(),setSyncStatus:()=>{},getOwnedMutationQueue:()=>c.getMutationQueue()};
 vm.runInNewContext(html.slice(html.indexOf('function mutationStorageKey'),html.indexOf('function currentSyncOwner()')),c);return {c,storage,data};
}
const item=id=>({id,clientTime:'2026-10-16T00:00:00Z',row:{value:id},attempt:0});
test('two tabs adding from stale queue snapshots do not overwrite each other',()=>{
 const data=new Map(),a=fixture(data).c,b=fixture(data).c;
 const qa=a.getMutationQueue(),qb=b.getMutationQueue();a.setMutationQueue([...qa,item('a')]);b.setMutationQueue([...qb,item('b')]);assert.deepEqual([...a.getMutationQueue()].map(x=>x.id).sort(),['a','b']);
});
test('ACK removes only its operation and stale tabs/legacy queues cannot resurrect it',()=>{
 const {c,storage}=fixture();c.setMutationQueue([item('a'),item('b')]);const stale=c.getMutationQueue();c.acknowledgeMutations(new Set(['a']));c.setMutationQueue(stale);storage.setItem('queue',JSON.stringify(stale));assert.deepEqual([...c.getMutationQueue()].map(x=>x.id),['b']);
});
test('retries preserve original payload and monotonic attempt count',()=>{
 const {c}=fixture();c.setMutationQueue([item('a')]);c.setMutationQueue([{...item('a'),row:{value:'changed'},attempt:3,nextAttemptAt:100}]);c.setMutationQueue([item('a')]);const saved=c.getMutationQueue()[0];assert.equal(saved.row.value,'a');assert.equal(saved.attempt,3);assert.equal(saved.nextAttemptAt,100);
});
test('migration retains original legacy queue if storage fails; malformed queues are not discarded',()=>{
 const {c,storage,data}=fixture();const original=JSON.stringify([item('a')]);storage.setItem('queue',original);storage.setItem=()=>{throw Error('quota');};assert.throws(()=>c.getMutationQueue(),/quota/);assert.equal(data.get('queue'),original);data.set('queue','bad-json');assert.throws(()=>c.getMutationQueue());assert.equal(data.get('queue'),'bad-json');
});
test('ACK receipt failure keeps the operation for an idempotent retry',()=>{
 const {c,storage}=fixture();c.setMutationQueue([item('a')]);storage.setItem=()=>{throw Error('quota');};assert.throws(()=>c.acknowledgeMutations(new Set(['a'])));assert.equal(c.getMutationQueue().length,1);
});
test('a shared role is never enough to claim another account queue',()=>{
 const c={normalizeRoleName:x=>x};vm.runInNewContext(html.slice(html.indexOf('function mutationBelongsToCurrentSession'),html.indexOf('function getOwnedMutationQueue')),c);const owner={userId:'u1',username:'one',role:'CRM'};
 assert.equal(c.mutationBelongsToCurrentSession({ownerRole:'CRM'},owner),false);assert.equal(c.mutationBelongsToCurrentSession({ownerUserId:'u2',ownerRole:'CRM'},owner),false);assert.equal(c.mutationBelongsToCurrentSession({ownerUserId:'u1'},owner),true);
});
test('money values use full Indonesian grouping in KPIs, finance cells, and exports',()=>{
 const fields=html.match(/const MONEY_REPORT_FIELDS = new Set\((\[[^\n]+\])\);/)[1];
 const c={Intl,num:v=>Number(v)||0,MONEY_REPORT_FIELDS:new Set(JSON.parse(fields)),OPTIONAL_FINANCE_FIELDS:new Set(['monthlyTarget']),escapeHtml:String};
 vm.runInNewContext(html.slice(html.indexOf('function money('),html.indexOf('function nextId('))+html.slice(html.indexOf('function tableCell('),html.indexOf('function bindForm('))+html.slice(html.indexOf('function formatExportValue('),html.indexOf('function csvCell(')),c);
 for(const value of [1000,10000,100000,1250000,1000000000,-1250000])assert.match(c.compactMoney(value),/\d\.\d{3}/);
 for(const key of ['annualBudget','monthlyBudget','cashInPatient','cashOutSalary','cashBalance','profitLoss','verifiedRevenue','outstandingBalance']){assert.match(c.tableCell('manager',{[key]:1250000},key),/1\.250\.000/);assert.match(c.formatExportValue(key,1250000),/1\.250\.000/);}
 assert.equal(c.formatExportValue('monthlyTarget',''),'');
});
function flushFixture(){
 const {c,storage,data}=fixture();Object.assign(c,{getBackendConfig:()=>({url:'https://example.invalid'}),syncInProgress:false,navigator:{onLine:true},acquireSyncLock:()=>true,releaseSyncLock:()=>{},datasetSessionGeneration:1,SYNC_BATCH_SIZE:20,getBackendSessionToken:()=> 'synthetic',CONFIG:{BACKEND_AUTH_REQUIRED:true},SYNC_SCHEMA_VERSION:1,getDeviceId:()=> 'device',randomId:()=> 'batch',collectAllDatasetColumns:()=>({}),state:{session:{authenticated:true}},invalidateDatasetCache:()=>{},retryDelayFor:()=>10,addSyncDeadLetters:()=>{},scheduleAutoSync:()=>{},toast:()=>{},setTimeout:()=>{},DATASET_KEYS:['crm'],canViewDataset:()=>true,startBackgroundDataLoad:()=>{}});
 vm.runInNewContext(html.slice(html.indexOf('async function flushMutationQueueOwned('),html.indexOf('function retryDelayFor(')),c);return {c,storage,data};
}
test('in-flight ACK does not remove a write added by another tab',async()=>{
 const {c,data}=flushFixture();c.setMutationQueue([{...item('a'),dataset:'crm'}]);
 c.fetchWithTimeout=async()=>({json:async()=>{fixture(data).c.setMutationQueue([{...item('b'),dataset:'crm'}]);return {ok:true,results:[{operationId:'a',status:'APPLIED'}]};}});
 assert.equal(await c.flushMutationQueueOwned({silent:true}),true);assert.deepEqual([...c.getMutationQueue()].map(x=>x.id),['b']);assert.equal(c.syncInProgress,false);
});
test('missing ACK and network timeout keep the same mutation identity for retry',async()=>{
 for(const mode of ['no-ack','timeout']) {const {c}=flushFixture();c.setMutationQueue([{...item('a'),dataset:'crm'}]);c.fetchWithTimeout=async()=>{if(mode==='timeout')throw Error('timeout');return {json:async()=>({ok:true,results:[]})};};await c.flushMutationQueueOwned({silent:true});assert.equal(c.getMutationQueue()[0].id,'a');assert.equal(c.getMutationQueue()[0].attempt,1);assert.equal(c.syncInProgress,false);}
});
test('all division add handlers persist an outbox entry before inserting a visible report',()=>{
 for(const dataset of ['manager','managerMarketingDaily','patientCommand','managerDecisionLog','ownerEscalation','crm','marketing','content','doctor','medis','inventory']) {
 assert.ok(html.includes(`enqueueLocalUpsert("${dataset}", row);\r\n  state.${dataset}.unshift(row);`),dataset);
 }
});
test('rejected-input panel is account scoped, escaped, and keeps an error visible after later sync',()=>{
 const nodes={syncReviewPanel:{},syncReviewItems:{},syncQueueStatus:{}};
 const c={getSyncStatus:()=>({}),getSyncDeadLetters:()=>[{ownerUserId:'a',dataset:'crm',row:{name:'<script>bad</script>'}},{ownerUserId:'b',dataset:'crm',row:{name:'OTHER-ACCOUNT'}}],mutationBelongsToCurrentSession:x=>x.ownerUserId==='a',getMutationQueue:()=>[],document:{getElementById:id=>nodes[id]},localStorage:{setItem:()=>{}},SYNC_STATUS_KEY:'status',escapeHtml:x=>String(x).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')};
 vm.runInNewContext(html.slice(html.indexOf('function setSyncStatus('),html.indexOf('function migrateTreatmentNames(')),c);c.setSyncStatus({phase:'synced'});
 assert.equal(nodes.syncReviewPanel.hidden,false);assert.match(nodes.syncQueueStatus.textContent,/perlu tindakan/);assert.ok(!nodes.syncReviewItems.innerHTML.includes('OTHER-ACCOUNT'));assert.ok(!nodes.syncReviewItems.innerHTML.includes('<script>'));
});
