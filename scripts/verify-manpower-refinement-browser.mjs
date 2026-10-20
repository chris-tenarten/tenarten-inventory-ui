import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {chromium,expect} from '@playwright/test';
import {session,uuid} from './support/wave4-fixture.mjs';
const origin=process.env.PERFORMANCE_REVIEW_ORIGIN||'http://localhost:3000';
const browser=await chromium.launch({headless:true}),checks=[],errors=[],external=[];
const file='docs/project-memory/evidence/2026-10-20-manpower-refinement-browser.json';
const record=p=>p.getByTestId('reporting-records'),total=p=>p.getByTestId('analytics-total');
const count=async(p,n)=>expect(record(p)).toHaveAttribute('data-count',String(n),{timeout:20000});
async function run(name,fn){
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();page.setDefaultTimeout(15000);
 const control=async data=>assert((await context.request.post(origin+'/__review/control',{data})).ok());
 const state=async()=>(await context.request.get(origin+'/__review/state')).json();
 await control({reset:true});await page.clock.setFixedTime(new Date('2026-10-20T12:00:00Z'));
 page.on('pageerror',e=>errors.push(e.message));await context.routeWebSocket('**/realtime/v1/**',()=>{});
 await context.route('**/*',r=>{const u=new URL(r.request().url());if(u.origin===origin||u.protocol==='blob:')return r.continue();external.push(u.href);return r.abort();});
 try{await fn({page,context,control,state});checks.push(name);console.log('PASS '+name);}
 catch(e){console.error((await page.locator('body').innerText()).slice(-2200));throw e;}
 finally{await control({reset:true});await context.close();writeFileSync(file,JSON.stringify({origin,checks,errors,external,synthetic:true,hostedWrites:0},null,2));}
}
const open=async p=>{await p.goto(origin+'/manpower-reporting');await expect(total(p)).toHaveText('4,503.75 h');await count(p,1201);};
const search=p=>p.getByRole('searchbox',{name:'Search manpower',exact:true});
const emit=(p,event,s)=>p.evaluate(({event,s})=>{localStorage.setItem('sb-localhost-auth-token',JSON.stringify(s));const channel=new BroadcastChannel('sb-localhost-auth-token');channel.postMessage({event,session:s});channel.close();},{event,s});
try{
 await run('Automatic complete 30-day records, editable rows, scoped bulk selection and unchanged analytics',async({page,state})=>{
  await open(page);await expect(search(page)).toBeEnabled();const s=await state(),calls=s.calls.filter(c=>c.name==='manpower_entries');assert.equal(calls.length,11);assert.equal(calls.filter(c=>!new URL(c.path,origin).searchParams.has('work_date')).length,0);
  await page.getByRole('button',{name:/^Expand 10\/14\/26 Group/}).first().click();const table=record(page).locator('table').first();await expect(table.getByPlaceholder('Notes',{exact:true}).first()).toBeEditable();await expect(table).toContainText('Fixture Worker');
  await expect(page.getByRole('button',{name:'Add New Line',exact:true})).toHaveCount(0);
  // A full group spans recent and older entries. Partial records cannot change its identity.
  await expect(record(page).getByRole('button',{name:/Production job for/}).first()).toBeDisabled();
  const note=table.getByPlaceholder('Notes',{exact:true}).first();await note.fill('Recent edit verified');const response=page.waitForResponse(r=>r.request().method()==='PATCH');await page.getByRole('heading',{name:'Manpower Reporting',exact:true}).click();assert.equal((await response).status(),200);
  await search(page).fill('Recent edit verified');await count(page,1);await expect(record(page).getByPlaceholder('Notes',{exact:true})).toHaveValue('Recent edit verified');await expect(total(page)).toHaveText('4,503.75 h');
  await record(page).getByRole('checkbox',{name:/Select displayed entries/}).check();await expect(record(page)).toContainText('1 selected');await page.getByRole('button',{name:'90 Days',exact:true}).click();await expect(record(page)).not.toContainText('1 selected');await expect(total(page)).toHaveText('6,753.75 h');
  await search(page).fill('');await count(page,1801);await page.getByRole('button',{name:'1 Year',exact:true}).click();await count(page,1801);await expect(total(page)).toHaveText('6,753.75 h');
 });
 await run('Period/Job changes reject late replies and preserve selected-period filters',async({page,control,state})=>{
  await open(page);await control({delays:{manpower_entries:180}});await page.getByRole('button',{name:'90 Days',exact:true}).click();await count(page,0);
  await page.getByRole('button',{name:'30 Days',exact:true}).click();await page.getByRole('combobox',{name:'Job labor review',exact:true}).selectOption(uuid(1000));await expect(total(page)).toHaveText('228.75 h');await count(page,61);await page.waitForTimeout(450);await count(page,61);
  await page.getByRole('combobox',{name:'Product Category filter',exact:true}).selectOption(uuid(50003));await count(page,61);await expect(total(page)).toHaveText('228.75 h');
  await search(page).fill('not a matching worker');await count(page,0);await expect(page.getByText('No manpower entries match your filters in this scope.',{exact:true})).toBeVisible();
  assert.equal((await state()).calls.filter(c=>c.name==='manpower_entries'&&!new URL(c.path,origin).searchParams.has('work_date')).length,0);
 });
 await run('Empty selected period settles with no false historical entries',async({page,control})=>{
  await control({emptyManpower:true});await page.goto(origin+'/manpower-reporting');await expect(total(page)).toHaveText('0 h');await count(page,0);await expect(page.getByText('No labor entries recorded in the selected period.',{exact:true})).toBeVisible();await expect(search(page)).toBeEnabled();
  await control({});await page.clock.setFixedTime(new Date('2027-03-20T12:00:00Z'));await page.reload();await expect(total(page)).toHaveText('0 h');await count(page,0);await expect(page.getByText('No labor entries recorded in the selected period.',{exact:true})).toBeVisible();
 });
 await run('Denied period terminates, has no retry loop and explicit retry restores complete rows',async({page,control,state})=>{
  await control({failure:'manpower_entries'});await page.goto(origin+'/manpower-reporting');await expect(page.getByRole('button',{name:'Retry period',exact:true})).toBeVisible();await count(page,0);await expect(page.getByText('Loading selected-period entries…',{exact:true})).toHaveCount(0);
  const before=(await state()).calls.length;await page.waitForTimeout(350);assert.equal((await state()).calls.length,before);await control({});await page.getByRole('button',{name:'Retry period',exact:true}).click();await count(page,1201);await expect(total(page)).toHaveText('4,503.75 h');
 });
 await run('History denial preserves recent rows; retry loads all 12001, archived editing and cached period switching',async({page,control,state})=>{
  await open(page);await control({failure:'manpower_entries'});await page.getByRole('button',{name:'Load complete history',exact:true}).click();await expect(page.getByRole('button',{name:'Retry history',exact:true})).toBeVisible();await count(page,1201);await expect(total(page)).toHaveText('4,503.75 h');
  const before=(await state()).calls.length;await page.waitForTimeout(350);assert.equal((await state()).calls.length,before);await control({});await page.getByRole('button',{name:'Retry history',exact:true}).click();await count(page,12001);
  await search(page).fill('Historical edit target');await count(page,1);await expect(record(page)).toContainText('26-1020');
  const note=page.getByPlaceholder('Notes',{exact:true});await note.fill('Historical archived edit verified');const saved=page.waitForResponse(r=>r.request().method()==='PATCH');await page.getByRole('heading',{name:'Manpower Reporting',exact:true}).click();const response=await saved;assert.equal(response.status(),200);const row=await response.json();assert.equal(row.job_id,uuid(1020));assert.equal(row.notes,'Historical archived edit verified');assert.equal(row.am_hours,2.25);await expect(total(page)).toHaveText('4,503.75 h');
  await search(page).fill('');const requests=(await state()).calls.filter(c=>c.name==='manpower_entries').length;await page.getByRole('button',{name:'90 Days',exact:true}).click();await count(page,1801);await expect(total(page)).toHaveText('6,753.75 h');await page.getByRole('button',{name:'30 Days',exact:true}).click();await count(page,1201);await page.getByRole('button',{name:'Show complete history',exact:true}).click();await count(page,12001);assert.equal((await state()).calls.filter(c=>c.name==='manpower_entries').length,requests);
 });
 await run('A period selected during history loading is not overwritten by completion',async({page,control})=>{
  await open(page);await control({delays:{manpower_entries:15}});await page.getByRole('button',{name:'Load complete history',exact:true}).click();await page.getByRole('button',{name:'90 Days',exact:true}).click();await expect(page.getByRole('button',{name:'Show complete history',exact:true})).toBeVisible({timeout:20000});await count(page,1801);await expect(total(page)).toHaveText('6,753.75 h');
 });
 await run('Read-only account sees complete recent rows with disabled write controls',async({page,context})=>{
  await context.route('**/rpc/get_my_app_access',async route=>{const response=await route.fetch();const rows=await response.json();await route.fulfill({response,json:rows.map(row=>({...row,read_only:true}))});});
  await open(page);await page.getByRole('button',{name:/^Expand 10\/14\/26 Group/}).first().click();await expect(record(page).getByPlaceholder('Notes',{exact:true}).first()).toBeDisabled();await expect(record(page).getByRole('spinbutton').first()).toBeDisabled();
 });
 await run('Same-account refocus/revalidation preserves unsaved input; Messaging/navigation and account change remain safe',async({page,state})=>{
  await open(page);await page.getByRole('button',{name:/^Expand 10\/14\/26 Group/}).first().click();const note=record(page).getByPlaceholder('Notes',{exact:true}).first();await note.fill('Unsent current draft');const before=(await state()).calls.filter(c=>c.name==='manpower_entries').length;
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await emit(page,'SIGNED_IN',session(uuid(900021),2));await expect(note).toHaveValue('Unsent current draft');assert.equal((await state()).calls.filter(c=>c.name==='manpower_entries').length,before);
  await page.getByRole('button',{name:'Messaging',exact:true}).click();await expect(page.locator('#my-work-inbox-title')).toBeVisible();await page.getByRole('button',{name:'Close Inbox',exact:true}).click();await expect(note).toHaveValue('Unsent current draft');
  await page.goto(origin+'/inventory');await page.goto(origin+'/manpower-reporting');await count(page,1201);await emit(page,'SIGNED_IN',session(uuid(900024)));await count(page,0);await expect(total(page)).toHaveText('0 h');await expect(record(page)).not.toContainText('Fixture Worker');
 });
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
}finally{await browser.close();}
