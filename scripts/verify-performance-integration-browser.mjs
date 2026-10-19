import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,readFileSync,existsSync} from 'node:fs';
import {chromium,expect} from '@playwright/test';
import {session as makeSession,uuid} from './support/wave4-fixture.mjs';
const origin='http://localhost:3355',owner=uuid(900021),other=uuid(900024),only=process.env.INTEGRATION_CHECK||'';
const browser=await chromium.launch({headless:true}),errors=[],external=[],checks=[],observations=[],file='docs/project-memory/evidence/2026-10-19-integration-browser.json';
if(only&&existsSync(file)){const old=JSON.parse(readFileSync(file));checks.push(...old.checks);observations.push(...old.observations);}
const ctx=await browser.newContext({viewport:{width:1440,height:1000}}),page=await ctx.newPage();
page.setDefaultTimeout(15000);await page.clock.setFixedTime(new Date('2026-10-19T12:00:00Z'));
page.on('pageerror',e=>errors.push(e.message));await ctx.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin===origin||u.protocol==='blob:')return route.continue();external.push(u.href);return route.abort();});await ctx.routeWebSocket('**/realtime/v1/**',()=>{});
await ctx.addInitScript(s=>{if(!localStorage.getItem('sb-localhost-auth-token'))localStorage.setItem('sb-localhost-auth-token',JSON.stringify(s));sessionStorage.setItem('tenops.welcomeHeroPlayed:'+s.user.id,'true');},makeSession(owner));
const control=async data=>{assert((await ctx.request.post(origin+'/__review/control',{data})).ok());};
const state=async()=>(await ctx.request.get(origin+'/__review/state')).json();
const emit=async(event,s)=>page.evaluate(({event,s})=>{if(s)localStorage.setItem('sb-localhost-auth-token',JSON.stringify(s));else localStorage.removeItem('sb-localhost-auth-token');const c=new BroadcastChannel('sb-localhost-auth-token');c.postMessage({event,session:s});c.close();},{event,s});
async function run(name,fn){if(only==='remaining'?/^(Production enrichment|Complete Proposals)/.test(name):only&&!name.includes(only))return;await control({reset:true});try{await fn();checks.push(name);mkdirSync('docs/project-memory/evidence',{recursive:true});writeFileSync(file,JSON.stringify({checks,observations,pageErrors:errors,external,hostedWrites:0,origin,note:'Actual integrated export, one synthetic source for all modules. Not hosted performance.'},null,2));console.log('PASS '+name);}catch(e){console.error((await page.locator('body').innerText()).slice(-1800));throw e;}}
const total=()=>page.getByTestId('analytics-total');
async function openMessaging(){await page.getByRole('button',{name:'Messaging',exact:true}).click();await expect(page.locator('#my-work-inbox-title')).toBeVisible();}
async function pdf(){const link=page.getByRole('link',{name:'Download',exact:true});await expect(link).toBeVisible();const href=await link.getAttribute('href');assert.equal(await page.evaluate(async u=>(await(await fetch(u)).text()).slice(0,4),href),'%PDF');}
try{
 await run('Production enrichment, Messaging and notifications coexist before Planning completes',async()=>{
  await control({delays:{planning_phases:1800}});const start=performance.now();await page.goto(origin+'/');await expect(page.getByRole('button',{name:'Open Wave Job 0',exact:true})).toBeVisible();const jobsReadyMs=Math.round(performance.now()-start);
  await expect(page.getByRole('button',{name:/Open Job Updates for .*1201 job updates/}).first()).toBeVisible();
  await openMessaging();await page.getByRole('button').filter({has:page.getByText('Wave Bob',{exact:true})}).last().click();const composer=page.getByRole('textbox',{name:'Message',exact:true});await composer.fill('Integrated unsent draft');
  await emit('TOKEN_REFRESHED',makeSession(owner,2));await expect(composer).toHaveValue('Integrated unsent draft');await page.getByRole('button',{name:'Close Inbox',exact:true}).click();
  const s=await state();const scoped=s.calls.filter(c=>['job_updates','job_attachments'].includes(c.name));assert(scoped.length);for(const c of scoped)assert(new URL(c.path,origin).searchParams.has('job_id'));observations.push({name:'Production readiness',jobsReadyMs,scopeRows:scoped.reduce((n,c)=>n+(c.rows||0),0)});
  await page.goto(origin+'/proposals');await openMessaging();await page.getByRole('button').filter({has:page.getByText('Wave Bob',{exact:true})}).last().click();await expect(composer).toHaveValue('Integrated unsent draft');await composer.fill('Integrated local sent message');await page.getByRole('button',{name:'Send',exact:true}).click();await expect(composer).toHaveValue('');await page.getByRole('button',{name:'Close Inbox',exact:true}).click();
 });
 await run('Complete Proposals and purchasing with creation and local PDF',async()=>{
  await page.goto(origin+'/proposals');await expect(page.locator('article')).toHaveCount(1201);await page.locator('article').filter({hasText:'EST-1200'}).getByRole('button',{name:'Open draft',exact:true}).click();await expect(page.getByRole('button',{name:'Back to history',exact:true})).toBeVisible();await page.getByRole('button',{name:'Back to history',exact:true}).click();
  await page.getByRole('button',{name:'Create Proposal',exact:true}).click();await expect(page.getByRole('button',{name:'Preview PDF',exact:true})).toBeEnabled();await page.getByRole('button',{name:'Preview PDF',exact:true}).click();await pdf();
  await page.goto(origin+'/purchasing');await expect(page.locator('tbody tr')).toHaveCount(1201);await page.getByPlaceholder('Search PO number, vendor, date, or status',{exact:true}).fill('PO-1200');await expect(page.locator('tbody tr')).toHaveCount(1);
 });
 await run('Samples initialize independently of complete supplier enrichment and preserve edits',async()=>{
  await control({delays:{vendors:100,vendor_contacts:100}});const start=performance.now();await page.goto(origin+'/samples?open=new');await expect(page.getByRole('button',{name:'Save Sample',exact:true})).toBeVisible();observations.push({name:'New draft with delayed complete vendors',readyMs:Math.round(performance.now()-start)});
  await page.goto(origin+'/samples?open=00000000-0000-4000-8000-000000710001');await page.locator('#operator-sample-details > summary').click();const identity=page.getByLabel('Color Plate / Formula #',{exact:true});await identity.fill('KEEP-INTEGRATED-EDIT');const profile=page.waitForResponse(r=>r.url().endsWith('/get_my_app_access'));await emit('SIGNED_IN',makeSession(owner,3));await profile;await expect(identity).toHaveValue('KEEP-INTEGRATED-EDIT');
  await expect.poll(async()=>{const s=await state();return s.calls.filter(c=>c.name==='vendor_contacts').reduce((n,c)=>n+(c.rows||0),0);}).toBe(1201);await expect(identity).toHaveValue('KEEP-INTEGRATED-EDIT');
  await identity.fill('T26-901-A');await page.locator('#sample-documents > summary').click();await page.getByText('Formula checkpoints and previews',{exact:true}).click();await page.getByRole('button',{name:'Preview current Sample',exact:true}).click();await pdf();
 });
 await run('Manpower report readiness and complete history coexist with Messaging',async()=>{
  await page.goto(origin+'/manpower-reporting');await expect(total()).toHaveText('4,503.75 h');let s=await state();assert.equal(s.calls.filter(c=>c.name==='manpower_entries'&&!new URL(c.path,origin).searchParams.has('work_date')&&!new URL(c.path,origin).searchParams.has('job_id')).length,0);
  await openMessaging();await page.getByRole('button',{name:'Close Inbox',exact:true}).click();await page.getByRole('button',{name:'Load reporting history',exact:true}).click();await expect(page.getByRole('searchbox',{name:'Search manpower',exact:true})).toBeEnabled();await expect(total()).toHaveText('4,503.75 h');await page.getByRole('button',{name:'90 Days',exact:true}).click();await expect(total()).toHaveText('6,753.75 h');
 });
 await run('Inventory current quantities and complete receiving/usage histories',async()=>{
  await page.goto(origin+'/inventory');await expect(page.locator('table').getByRole('cell',{name:/^13,189 Bags/})).toBeVisible();await page.getByRole('button').filter({hasText:'Pending Receivals'}).click();await expect(page.locator('#pending-receivals tbody tr')).toHaveCount(5);await page.getByRole('button',{name:'Load received items',exact:true}).click();await expect(page.locator('#pending-receivals tbody tr')).toHaveCount(1206);
  await page.goto(origin+'/activity');await expect(page.locator('table').getByText('Audit marble 1400',{exact:true})).toBeVisible();await page.goto(origin+'/material-usage');await page.getByPlaceholder('Search reports…',{exact:true}).fill('History 1200');await expect(page.locator('aside [role="button"]')).toHaveCount(1);
 });
 await run('Denied enrichment and histories resolve without loops or false empty states',async()=>{
  await control({failure:'job_updates'});await page.goto(origin+'/');await expect(page.getByRole('button',{name:'Open Wave Job 0',exact:true})).toBeVisible();await expect(page.getByRole('alert').filter({hasText:'Attachment and Job Update indicators are unavailable'})).toBeVisible();
  await control({failure:'proposals'});await page.goto(origin+'/proposals');await expect(page.getByText('Proposal history unavailable.',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Create Proposal',exact:true})).toBeDisabled();
  const before=(await state()).calls.filter(c=>c.name==='proposals').length;await page.waitForTimeout(400);assert.equal((await state()).calls.filter(c=>c.name==='proposals').length,before);
 });
 await run('Rapid navigation, delayed summaries and account switch clear former account data',async()=>{
  await control({delays:{list_samples:500,list_my_work_conversations_v11:500}});await page.goto(origin+'/samples');await expect(page.getByRole('button',{name:'Messaging',exact:true})).toBeVisible();await emit('SIGNED_IN',makeSession(other));await expect(page.getByRole('button',{name:'Account menu for Review B, Admin',exact:true})).toBeVisible();await expect(page.getByRole('button').filter({hasText:'Integrated Sample'})).toHaveCount(0);await openMessaging();await expect(page.getByText('Wave Bob',{exact:true})).toHaveCount(0);await page.getByRole('button',{name:'Close Inbox',exact:true}).click();await page.goto(origin+'/inventory');await expect(page.locator('table').getByText('No matching inventory rows found.',{exact:true})).toBeVisible();
  await control({access:'denied'});await emit('TOKEN_REFRESHED',makeSession(other,2));await expect(page.getByText(/This account is disabled/)).toBeVisible();
 });
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
}finally{await control({reset:true});await browser.close();}
