const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../backend/SecurityReplacements.gs'), 'utf8');
function fixture() {
  const calls = { updates: [], handlers: [] };
  const session = { userId: 'user-1', username: 'staff', role: 'CRM', active: true, expiresAt: new Date(Date.now()+60000).toISOString(), lastSeenAt: new Date().toISOString() };
  const user = { userId:'user-1', username:'staff', role:'CRM', active:true };
  const ctx = {
    AFK_AUTH_SESSIONS_SHEET: '_sessions', AFK_AUTH_SESSION_HEADERS: [],
    afkAuthSpreadsheet_: () => ({}), afkEnsureAuthSheets_: () => {},
    afkGetOrCreateAuthSheet_: () => ({}), afkGetAuthHeaders_: () => [],
    afkDigestHex_: () => 'hash', afkFindAuthRowByValue_: () => 2,
    afkReadAuthRow_: () => session, afkBoolean_: x => x===true || x==='true',
    afkFindAuthUserByUsername_: () => user,
    afkUsernameKey_: x => String(x).trim().toLowerCase(),
    afkIsKnownAuthRole_: x => ['CRM','Owner'].includes(x),
    afkNormalizeAuthRole_: x => x, afkMaskToken_: () => 'masked',
    afkUpdateAuthRow_: (...args) => calls.updates.push(args), afkAuthAudit_: () => {},
    json_: x => x, health_: () => ({ ok:true }),
    afkHandleLogin_: () => { calls.handlers.push('login'); return {ok:true}; },
    afkHandleLogout_: () => ({ok:true}), afkHandleValidateSession_: () => ({ok:true}),
    afkHandleSecureSyncMutations_: () => ({ok:true}),
    afkHandleSecureUploadTreatmentMedia_: () => ({ok:true}),
    afkHandleSecureUpdateAuthUsers_: () => ({ok:true}),
    afkRequireSession_: () => ({userId:'user-1',role:'Owner'}),
    afkRequestedDatasets_: () => ['crm'], afkCanAccessDataset_: () => true,
    afkFetchAuthorizedDatasetsOptimized_: () => ({ok:true,data:{crm:[]},timing:{}}),
    afkCanAccessSettings_: () => true, afkAuthorizationAudit_: () => {},
    readSettings_: () => ({ clinicName:'AFK', userAccounts:[{username:'owner',password:'synthetic'}], backendToken:'synthetic', nested:{ api_key:'synthetic', minimum:5 } })
  };
  vm.createContext(ctx); vm.runInContext(source,ctx);
  return {ctx,session,user,calls};
}
test('legacy shared-token actions are disabled without invoking their handlers', () => {
  const {ctx,calls}=fixture();
  for(const action of ['bootstrap','fetch','sync','syncMutations','uploadTreatmentMedia']) {
    assert.equal(ctx.route_({action,method:'POST',token:'synthetic'}).error,'LEGACY_API_DISABLED');
  }
  assert.equal(calls.handlers.length,0);
});
test('unknown/prototype actions rejected; login requires POST; secureFetch remains GET compatible', () => {
  const {ctx}=fixture();
  for(const action of ['constructor','__proto__','unknown']) assert.equal(ctx.route_({action,method:'POST'}).ok,false);
  assert.equal(ctx.route_({action:'login',method:'GET'}).error,'POST_REQUIRED');
  assert.equal(ctx.route_({action:'login',method:'POST'}).ok,true);
  assert.equal(ctx.route_({action:'secureFetch',method:'GET'}).ok,true);
});
test('valid session returns the current account identity', () => {
  const {ctx}=fixture();
  assert.equal(ctx.afkValidateSession_('synthetic').role,'CRM');
});
test('inactive, missing, role-changed, invalid-role and mismatched accounts rejected', () => {
  for(const modify of [
    f=>f.user.active=false,
    f=>f.ctx.afkFindAuthUserByUsername_=()=>null,
    f=>f.user.role='Owner',
    f=>f.user.role='Unknown',
    f=>f.user.userId='another-user'
  ]) {
    const f=fixture(); modify(f);
    assert.throws(()=>f.ctx.afkValidateSession_('synthetic'), /AUTH_REVOKED/);
  }
});
test('invalid, missing and expired session timestamps fail closed', () => {
  for(const expiresAt of ['invalid','',new Date(Date.now()-60000).toISOString()]) {
    const {ctx,session}=fixture(); session.expiresAt=expiresAt;
    assert.throws(()=>ctx.afkValidateSession_('synthetic'),/AUTH_EXPIRED/);
  }
});
test('missing/unknown/revoked session rejected', () => {
  const {ctx,session}=fixture();
  assert.throws(()=>ctx.afkValidateSession_(''),/AUTH_REQUIRED/);
  session.active=false;
  assert.throws(()=>ctx.afkValidateSession_('synthetic'),/AUTH_REVOKED/);
  ctx.afkFindAuthRowByValue_=()=>-1;
  assert.throws(()=>ctx.afkValidateSession_('synthetic'),/AUTH_INVALID/);
});
test('secureFetch recursively strips secrets without modifying stored settings', () => {
  const {ctx}=fixture();
  const stored=ctx.readSettings_(); ctx.readSettings_=()=>stored;
  const result=ctx.afkHandleSecureFetch_({includeSettings:'true'});
  const safe=JSON.parse(JSON.stringify(result.data.settings));
  assert.deepEqual(safe,{clinicName:'AFK',userAccounts:[{username:'owner'}],nested:{minimum:5}});
  assert.equal(stored.userAccounts[0].password,'synthetic');
  assert.equal(stored.backendToken,'synthetic');
});
test('fetch denies unauthorized datasets before reading', () => {
  const {ctx}=fixture(); ctx.afkCanAccessDataset_=()=>false;
  ctx.afkFetchAuthorizedDatasetsOptimized_=()=>{throw new Error('should not read');};
  assert.throws(()=>ctx.afkHandleSecureFetch_({}),/Akses dataset ditolak/);
});
