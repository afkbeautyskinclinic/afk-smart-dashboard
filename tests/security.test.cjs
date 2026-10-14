const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');
function harness({ cached, offline = false, status = 200, redirected = false } = {}) {
  const listeners = {}, calls = { fetch: [], put: [], deleted: [], claimed: 0 };
  const cache = {
    addAll: async () => {}, match: async () => cached,
    put: async (...args) => calls.put.push(args)
  };
  const context = {
    URL, Request, Response, Set,
    self: {
      registration: { scope: 'https://afkbeautyskinclinic.github.io/afk-smart-dashboard/' },
      location: { origin: 'https://afkbeautyskinclinic.github.io' },
      addEventListener: (name, handler) => listeners[name] = handler,
      skipWaiting() {}, clients: { claim: async () => calls.claimed++ }
    },
    caches: {
      open: async () => cache,
      keys: async () => ['afk-dashboard-v1.5.35-security-cutover', 'afk-dashboard-v1.5.36-private-data-cache-fix', 'another-app'],
      delete: async key => calls.deleted.push(key)
    },
    fetch: async req => {
      calls.fetch.push(req);
      if (offline) throw new Error('offline');
      return { ok: status === 200, type: 'basic', redirected, clone: () => ({}) };
    }
  };
  vm.runInNewContext(source, context);
  async function dispatch(url, { method = 'GET', mode = 'cors', accept = '' } = {}) {
    let response;
    listeners.fetch({ request: { url, method, mode, headers: new Headers({ accept }) }, respondWith: p => response = p });
    return response ? await response : undefined;
  }
  return { dispatch, calls, listeners };
}
const base = 'https://afkbeautyskinclinic.github.io/afk-smart-dashboard/';
test('Workspace API, private media, unknown endpoints and credential query strings bypass SW cache even offline', async () => {
  const h = harness({ cached: { private: 'old data' }, offline: true });
  for (const url of [
    'https://script.google.com/macros/s/example/exec?action=secureFetch&sessionToken=test',
    'https://script.googleusercontent.com/macros/echo?sessionToken=test',
    'https://drive.google.com/file/d/example/view',
    base + 'api?sessionToken=test',
    base + 'assets/icon-192.png?sessionToken=test',
    base + 'manifest.webmanifest?v=1.5.35-security-cutover&sessionToken=test'
  ]) assert.equal(await h.dispatch(url), undefined);
  assert.equal(h.calls.fetch.length, 0);
  assert.equal(h.calls.put.length, 0);
});
test('POST bypasses SW', async () => {
  const h = harness();
  assert.equal(await h.dispatch(base + 'assets/icon-192.png', { method: 'POST' }), undefined);
});
test('allowlisted static asset reuses cache without network', async () => {
  const cached = { static: 'icon' };
  const h = harness({ cached, offline: true });
  assert.equal(await h.dispatch(base + 'assets/icon-192.png'), cached);
  assert.equal(h.calls.fetch.length, 0);
});
test('only successful nonredirected static responses are cached', async () => {
  for (const options of [{}, { status: 404 }, { redirected: true }]) {
    const h = harness(options);
    await h.dispatch(base + 'assets/icon-192.png');
    assert.equal(h.calls.put.length, options.status || options.redirected ? 0 : 1);
  }
});
test('activation deletes prior AFK cache but preserves other apps and current cache', async () => {
  const h = harness();
  let completion;
  h.listeners.activate({ waitUntil: p => completion = p });
  await completion;
  assert.deepEqual(h.calls.deleted, ['afk-dashboard-v1.5.35-security-cutover']);
  assert.equal(h.calls.claimed, 1);
});
test('HTML is network-only and never returns an old cached page offline', async () => {
  const h = harness({ cached: { private: 'old HTML' }, offline: true });
  let completion;
  h.listeners.fetch({ request: new Request(base, { headers: { accept: 'text/html' } }), respondWith: p => completion = p });
  const response = await completion;
  assert.match(await response.text(), /sedang offline/);
  assert.equal(h.calls.fetch[0].cache, 'no-store');
  assert.equal(h.calls.put.length, 0);
});
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const mediaSource = html.slice(html.indexOf('function mediaLinks(value)'), html.indexOf('function badgeClass'));
const context = { URL, escapeHtml: value => String(value).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' }[c])) };
vm.runInNewContext(mediaSource, context);
test('media links reject executable, insecure, relative and credential URLs', () => {
  for (const url of ['javascript:alert(1)', 'data:text/html,test', 'file:///test', '//evil.example/a', 'https://user:password@example.com/a', 'http://example.com/a', 'invalid']) {
    assert.equal(context.mediaLinks(url), '-');
  }
});
test('valid HTTPS media survives, markup is escaped, and referrer is suppressed', () => {
  const result = context.mediaLinks('https://drive.google.com/file/d/example/view\njavascript:alert(1)\nhttps://example.com/?x="&y=1');
  assert.equal((result.match(/<a /g) || []).length, 2);
  assert.match(result, /noopener noreferrer/);
  assert.match(result, /&quot;&amp;/);
  assert.doesNotMatch(result, /javascript:/);
});
test('frontend inline script remains syntactically valid', () => {
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
  for (const script of scripts) new vm.Script(script[1]);
  assert.ok(scripts.length);
});
const csvSource = html.slice(html.indexOf('function csvCell(value)'), html.indexOf('async function syncToGoogleSheets'));
const csvContext = {}; vm.runInNewContext(csvSource, csvContext);
test('CSV neutralizes formula text, including whitespace prefixes, and keeps numeric values', () => {
  for (const value of ['=SUM(1,2)', '+CMD', '-CMD', '@SUM(1)', '\t=SUM(1)', '\r\n=SUM(1)']) {
    assert.ok(csvContext.csvCell(value).startsWith('"\''));
  }
  assert.equal(csvContext.csvCell(-42), '"-42"');
  assert.equal(csvContext.csvCell('ordinary text'), '"ordinary text"');
  assert.equal(csvContext.csvCell('a"b'), '"a""b"');
});
const exportSource = html.slice(html.indexOf('function getExportSections(dataset)'), html.indexOf('function getIntegratedOwnerMetrics'));
test('Owner export refuses non-Owner roles even if called directly', () => {
  const ctx = { currentRole: 'CRM', toast: () => {}, getOwnerExportSections: () => {throw new Error('must not export');} };
  vm.runInNewContext(exportSource,ctx);
  assert.equal(ctx.getExportSections('owner').length,0);
});
const pollingSource=html.slice(html.indexOf('function pollActiveDashboard()'),html.indexOf('function datasetsForPage'));
test('polling refreshes visible authenticated pages and pauses for pending writes/offline/busy state',()=>{
 const calls=[];
 const ctx={state:{session:{authenticated:true}},document:{visibilityState:'visible'},navigator:{onLine:true},syncInProgress:false,secureFetchInProgress:false,getOwnedMutationQueue:()=>[],activePage:'crm',datasetsForPage:()=>['crm'],startBackgroundDataLoad:x=>calls.push(x)};
 vm.runInNewContext(pollingSource,ctx);ctx.pollActiveDashboard();assert.equal(calls.length,1);assert.equal(calls[0].force,true);
 for(const field of ['hidden','offline','busy','queue','logged-out']){
  ctx.document.visibilityState=field==='hidden'?'hidden':'visible';ctx.navigator.onLine=field!=='offline';ctx.syncInProgress=field==='busy';ctx.getOwnedMutationQueue=()=>field==='queue'?[{}]:[];ctx.state.session.authenticated=field!=='logged-out';
  ctx.pollActiveDashboard();assert.equal(calls.length,1);
 }
});
const fetchSource=html.slice(html.indexOf('async function fetchFromGoogleSheets(options = {})'),html.indexOf('function getBackendConfig()'));
test('secure fetch sends session in POST body, never in URL; auth revocation clears current session',async()=>{
 let captured,logout=0;
 const ctx={URL,performance:{now:()=>0},getBackendConfig:()=>({url:'https://script.google.com/macros/s/staging/exec'}),getBackendSessionToken:()=> 'synthetic-session',CONFIG:{BACKEND_AUTH_REQUIRED:true},getOwnedMutationQueue:()=>[],datasetSessionGeneration:1,DATASET_KEYS:['crm'],state:{session:{authenticated:true}},requestBackendJson:async(url,options)=>{captured={url,options};return {ok:false,error:'AUTH_REVOKED'};},handleLogout:async()=>logout++,toast:()=>{}};
 vm.runInNewContext(fetchSource,ctx);
 await ctx.fetchFromGoogleSheets({silent:true,datasets:['crm'],includeSettings:true});
 assert.equal(captured.url,'https://script.google.com/macros/s/staging/exec');assert.equal(captured.options.method,'POST');
 const payload=JSON.parse(captured.options.body);assert.equal(payload.sessionToken,'synthetic-session');assert.deepEqual(payload.datasets,['crm']);assert.equal(logout,1);
});
