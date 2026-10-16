const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const fn=name=>{const i=html.indexOf('function '+name+'(');return html.slice(i,html.indexOf('\nfunction ',i+1));};
test('background render leaves focused, dirty and uploading forms untouched',()=>{
 let renders=0;const form={dataset:{},contains:el=>el==='focus'};
 const c={NAV:[{id:'marketing',page:'marketingPage'}],activePage:'marketing',document:{activeElement:null,getElementById:()=>({querySelectorAll:()=>[form]}),querySelector:()=>null},canAccessPage:()=>true,applyBrandSettings(){},renderShell(){},renderPageContent(){renders++},renderActivePage(){},renderCharts(){},cleanupRenderedPage(){}};
 vm.runInNewContext(fn('hasActiveReportDraft')+fn('renderAll'),c);
 for(const state of ['focus','dirty','submitting']){form.dataset={};c.document.activeElement=state==='focus'?'focus':null;if(state!=='focus')form.dataset[state]='true';c.renderAll({background:true});assert.equal(renders,0,state);}
 form.dataset={};c.document.activeElement=null;c.renderAll({background:true});assert.equal(renders,1);form.dataset.dirty='true';c.renderAll();assert.equal(renders,2,'explicit save/navigation can render');
});
test('form protection tracks input and change, prevents input Enter but preserves notes and keyboard buttons',()=>{
 const handlers={};const form={dataset:{},addEventListener:(name,fn)=>{assert.equal(handlers[name],undefined);handlers[name]=fn}};const c={};vm.runInNewContext(fn('protectReportForm'),c);c.protectReportForm(form);c.protectReportForm(form);
 handlers.input();assert.equal(form.dataset.dirty,'true');form.dataset.dirty='false';handlers.change();assert.equal(form.dataset.dirty,'true');
 for(const [tag,blocked]of [['INPUT',true],['TEXTAREA',false],['BUTTON',false],['SELECT',false]]){let prevented=false;handlers.keydown({key:'Enter',target:{tagName:tag},preventDefault:()=>{prevented=true}});assert.equal(prevented,blocked,tag);}
});
test('submit requires a submit button, blocks repeated saves and retains input on error',async()=>{
 const handlers={};let calls=0;let resolve;const button={disabled:false};const form={dataset:{},querySelector:s=>s==='fieldset'?{disabled:false}:button,addEventListener:(name,fn)=>{handlers[name]=fn}};button.form=form;
 const c={document:{getElementById:()=>form},bindMoneyInputs(){},protectReportForm(){},bindExports(){},bindDeletes(){},bindEdits(){},bindOwnerNotes(){},formValues:()=>({note:'draft'}),formFiles:()=>({}),toast(){}};
 vm.runInNewContext(fn('bindForm'),c);c.bindForm('form',()=>{calls++;return new Promise(r=>{resolve=r})});
 await handlers.submit({preventDefault(){}});assert.equal(calls,0);
 const pending=handlers.submit({preventDefault(){},submitter:button});assert.equal(calls,1);assert.equal(button.disabled,true);
 await handlers.submit({preventDefault(){},submitter:button});assert.equal(calls,1);resolve();await pending;assert.equal(button.disabled,false);
 c.bindForm('form',()=>{throw Error('save failed')});form.dataset.dirty='true';await handlers.submit({preventDefault(){},submitter:button});assert.equal(form.dataset.dirty,'true');assert.equal(form.dataset.submitting,'false');
});
test('both fetch success/failure and delayed search use non-destructive background renders',()=>{
 const start=html.indexOf('async function fetchFromGoogleSheets('),end=html.indexOf('\nfunction getBackendConfig()',start);const body=html.slice(start,end);assert.equal((body.match(/renderAll\(\{ background: true \}\)/g)||[]).length,2);assert.doesNotMatch(body,/renderAll\(\)/);assert.match(fn('scheduleSearchRender'),/background: true/);
});
