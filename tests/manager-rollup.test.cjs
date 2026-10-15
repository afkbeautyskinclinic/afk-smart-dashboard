const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
function fixture() {
 const state = Object.fromEntries(['manager','doctor','medis','inventory','crm','marketing','content','managerMarketingDaily','ownerEscalation'].map(k=>[k,[]]));
 const ctx = {state,Intl,Date,Set,Map,num:v=>Number(v)||0,sum:(rows,key)=>rows.reduce((n,r)=>n+(Number(r[key])||0),0),safeDiv:(a,b)=>b?a/b:0,stockStatus:r=>r.status,compactMoney:String,pct:String};
 const slice=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b));
 vm.runInNewContext(slice('function businessToday(', 'function latestIsoDate')+slice('function latestIsoDate','function uniquePatientCount')+slice('function getOwnerTopProblems()', 'function getManagerKpis()'),ctx);
 return ctx;
}
test('target uses current month explicit target, latest date and update; no budget fallback',()=>{
 const c=fixture(); c.state.manager=[{date:'2026-09-30',monthlyTarget:900},{date:'2026-10-02',monthlyBudget:10000},{date:'2026-10-03',monthlyTarget:200,_updatedAt:'a'},{date:'2026-10-03',monthlyTarget:300,_updatedAt:'b'},{date:'2026-10-04',monthlyTarget:''},{date:'2026-11-01',monthlyTarget:500}];
 assert.equal(c.getFinanceSummary('2026-10-15').monthlyTarget,300);
 c.state.manager=[{date:'2026-10-02',monthlyBudget:10000}];assert.equal(c.getFinanceSummary('2026-10-15').monthlyTarget,null);
});
test('finance separates recognized revenue, cash, latest outstanding and profit; ignores cross-division duplicates',()=>{
 const c=fixture(); c.state.manager=[{date:'2026-10-01',verifiedRevenue:100,cashInPatient:70,outstandingBalance:30,monthlyProfitEstimate:20},{date:'2026-10-02',verifiedRevenue:200,cashInPatient:100,cashInOther:10,outstandingBalance:100,monthlyProfitEstimate:-10}];
 c.state.marketing=[{date:'2026-10-01',revenue:10000,dailyOmzet:10000}];c.state.crm=[{date:'2026-10-01',revenue:10000}];
 const k=c.getFinanceSummary('2026-10-15');assert.equal(k.monthlyRevenue,300);assert.equal(k.cashIn,180);assert.equal(k.outstandingPayment,100);assert.equal(k.estimatedProfit,-10);assert.equal(k.todayRevenue,null);assert.equal(k.forecastRevenue,620);
});
test('daily revenue revisions replace rather than sum; zero differs from missing',()=>{
 const c=fixture();c.state.manager=[{date:'2026-10-15',verifiedRevenue:100,_updatedAt:'a'},{date:'2026-10-15',verifiedRevenue:0,_updatedAt:'b'}];
 assert.equal(c.getFinanceSummary('2026-10-15').monthlyRevenue,0);assert.equal(c.getFinanceSummary('2026-10-15').todayRevenue,0);assert.equal(c.getFinanceSummary('2026-10-15').estimatedProfit,null);
});
test('marketing funnel comes from CRM without adding attributed ads and content counts',()=>{
 const c=fixture();c.state.crm=[{date:'2026-10-01',id:'a',responseLead:'Booking'},{date:'2026-10-02',id:'a',responseLead:'Show Up'},{date:'2026-09-01',id:'old',responseLead:'Treatment'}];c.state.marketing=[{date:'2026-10-01',booking:100,showUp:100,spend:5,leads:50}];c.state.content=[{date:'2026-10-01',leads:200,status:'Posted'}];
 const k=c.getMarketingSummary('2026-10-15');assert.equal(k.booking,1);assert.equal(k.showUp,1);assert.equal(k.totalLeads,1);assert.equal(k.creativePosted,1);assert.equal(k.adSpend,5);
});
test('business date is Jakarta, including UTC day boundary',()=>{
 assert.equal(fixture().businessToday(new Date('2026-10-14T18:00:00Z')),'2026-10-15');
});
test('closed decisions are removed and critical problems sort first',()=>{
 const c=fixture();assert.equal(c.isOpenManagementItem({status:'Disetujui'}),false);assert.equal(c.isOpenManagementItem({status:'Selesai'}),false);assert.equal(c.isOpenManagementItem({status:'Menunggu Persetujuan'}),true);
 assert.equal(c.rankManagementItems([{title:'low',priority:'Low',date:'2026-10-15'},{title:'critical',priority:'Critical',date:'2026-10-01'}])[0].title,'critical');
});
test('target field follows budget and precedes patient cash input; blank optional values survive parsing',()=>{
 const form=html.slice(html.indexOf('function managerForm()'),html.indexOf('async function addManager'));
 assert.ok(form.indexOf('input("monthlyBudget"')<form.indexOf('input("monthlyTarget"'));
 assert.ok(form.indexOf('input("monthlyTarget"')<form.indexOf('input("cashInPatient"'));
 const c={OPTIONAL_FINANCE_FIELDS:new Set(['monthlyTarget','verifiedRevenue','monthlyProfitEstimate']),MONEY_REPORT_FIELDS:new Set(['monthlyTarget','verifiedRevenue','monthlyProfitEstimate']),parseMoneyInput:v=>Number(v),NUMERIC_REPORT_FIELDS:new Set()};
 vm.runInNewContext(html.slice(html.indexOf('function normalizeEditValue('),html.indexOf('function bindOwnerNotes()')),c);
 assert.equal(c.normalizeEditValue('monthlyTarget',''),'');assert.equal(c.normalizeEditValue('verifiedRevenue','0'),0);assert.throws(()=>c.normalizeEditValue('monthlyTarget','-5'));assert.equal(c.normalizeEditValue('monthlyProfitEstimate','-5'),-5);
});
test('patient records link across doctor and medical divisions using shared identifiers',()=>{
 const c=fixture();c.state.doctor=[{date:'2026-10-15',patientName:'Sample A',bookingId:'b1'},{date:'2026-10-15',patientName:'Sample A',bookingId:'b2'}];c.state.medis=[{date:'2026-10-15',patientId:'p1',bookingId:'b1'}];
 assert.equal(c.getFinanceSummary('2026-10-15').todayPatients,1);
 assert.equal(c.getFinanceSummary('2026-10-16').todayPatients,'Belum dilaporkan');
});
