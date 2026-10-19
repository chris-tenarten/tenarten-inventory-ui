import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {chromium,expect} from '@playwright/test';
import {uuid} from './support/wave2-fixture.mjs';
const origin='http://localhost:3322',browser=await chromium.launch({headless:true}),context=await browser.newContext({viewport:{width:1500,height:1100}}),page=await context.newPage();
const errors=[],external=[],checks=[],measurements=[];page.on('pageerror',e=>errors.push(e.message));
await context.route('**/*',route=>{const url=new URL(route.request().url());if(url.origin===origin||url.protocol==='blob:')return route.continue();external.push(url.href);return route.abort();});await context.routeWebSocket('**/realtime/v1/**',()=>{});
const control=body=>context.request.post(origin+'/__review/control',{data:body});
const state=async()=>(await context.request.get(origin+'/__review/state')).json();
async function run(name,work){console.log('CHECK '+name);await control({reset:true});await work();checks.push(name);}
try{
 await run('Production usable before delayed Planning; scoped complete activity',async()=>{
  await control({delays:{planning_phases:2000}});const start=Date.now();await page.goto(origin+'/');await expect(page.getByRole('button',{name:'Open Wave Job 0',exact:true})).toBeVisible();const core=Date.now()-start;
  await expect(page.getByRole('button',{name:/Open Job Updates for .*1201 job updates/}).first()).toBeVisible({timeout:15000});const activity=Date.now()-start;const snapshot=await state();assert(!snapshot.calls.some(c=>c.table==='planning_phases'),'activity must publish before delayed Planning finishes');
  const scoped=snapshot.calls.filter(c=>['job_updates','job_attachments'].includes(c.table));assert(scoped.length);for(const call of scoped)assert(new URL(call.url,origin).searchParams.has('job_id'));
  const before=scoped.length;await page.locator('[data-production-search]').fill('Wave Job 1');await expect(page.getByText('Wave Job 0',{exact:true})).toHaveCount(0);assert.equal((await state()).calls.filter(c=>['job_updates','job_attachments'].includes(c.table)).length,before);
  measurements.push({name:'Production with 2-second Planning fixture delay',coreVisibleMs:core,activityVisibleMs:activity,planningNotCompleteAtActivity:true,scopedActivityRows:scoped.reduce((n,c)=>n+c.rows,0)});
 });
 await run('Production denial leaves Jobs usable with unavailable indicators',async()=>{
  await control({failure:'job_updates'});await page.goto(origin+'/');await expect(page.getByRole('button',{name:'Open Wave Job 0',exact:true})).toBeVisible();await expect(page.getByRole('alert').filter({hasText:'Attachment and Job Update indicators are unavailable'})).toBeVisible();await expect(page.locator('[data-job-updates-indicator]:visible').first()).toHaveAttribute('title','Job Update indicators unavailable');assert.equal((await state()).calls.filter(c=>c.table==='job_updates').length,1);
 });
 await run('PO history beyond 1000 is searchable without additional filtering requests',async()=>{
  await page.goto(origin+'/purchasing');await expect(page.locator('tbody tr')).toHaveCount(1201,{timeout:15000});const before=(await state()).calls.length;
  await page.getByPlaceholder('Search PO number, vendor, date, or status',{exact:true}).fill('PO-1200');await expect(page.locator('tbody tr')).toHaveCount(1);assert.equal((await state()).calls.length,before);await page.locator('tbody tr').click();await expect(page.getByRole('heading',{name:'Edit Purchase Order',exact:true})).toBeVisible();await expect(page.getByText('PO-1200',{exact:true}).last()).toBeVisible();
 });
 await run('PO New action rejects delayed selected detail',async()=>{
  await page.goto(origin+'/purchasing');await expect(page.locator('tbody tr')).toHaveCount(1201,{timeout:15000});await control({delays:{purchase_orders:800}});await page.getByPlaceholder('Search PO number, vendor, date, or status',{exact:true}).fill('PO-0000');await page.locator('tbody tr').click();await page.getByRole('button',{name:'+ New Purchase Order',exact:true}).click();await expect(page.getByRole('heading',{name:'New Purchase Order',exact:true})).toBeVisible();await expect.poll(async()=> (await state()).calls.filter(c=>c.table==='purchase_orders'&&c.url.includes('eq.')).length).toBe(1);await expect(page.getByRole('heading',{name:'New Purchase Order',exact:true})).toBeVisible();
 });
 await run('Proposal complete narrow history, historical open, creation and real local PDF',async()=>{
  await page.goto(origin+'/proposals');await expect(page.locator('article')).toHaveCount(1201,{timeout:15000});const rows=(await state()).calls.filter(c=>c.table==='proposals');for(const r of rows)assert(!new URL(r.url,origin).searchParams.get('select').includes('*'));
  const old=page.locator('article').filter({hasText:'EST-1200'});await old.getByRole('button',{name:'Open draft',exact:true}).click();await expect(page.getByRole('button',{name:'Back to history',exact:true})).toBeVisible();await page.getByRole('button',{name:'Back to history',exact:true}).click();await page.getByRole('button',{name:'Create Proposal',exact:true}).click();await expect(page.getByText(/LOCAL-NEW-/).first()).toBeVisible();await page.getByRole('button',{name:'Preview PDF',exact:true}).click();const viewer=page.getByRole('dialog',{name:/Proposal preview|Proposal Preview|Estimate/});await expect(page.getByRole('link',{name:'Download',exact:true})).toBeVisible();const href=await page.getByRole('link',{name:'Download',exact:true}).getAttribute('href');assert.equal(await page.evaluate(async url=>(await(await fetch(url)).text()).slice(0,4),href),'%PDF');void viewer;
 });
 await run('Proposal and PO denied history never look like empty results',async()=>{
  await control({failure:'proposals'});await page.goto(origin+'/proposals');await expect(page.getByText('Proposal history unavailable.',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Create Proposal',exact:true})).toBeDisabled();await control({failure:'purchase_orders'});await page.goto(origin+'/purchasing');await expect(page.getByText('Purchase Order list unavailable.',{exact:true})).toBeVisible();await expect(page.getByText(/No matching Purchase Orders/)).toHaveCount(0);
 });
 await run('Material historical tail search and New reject delayed detail',async()=>{
  await page.goto(origin+'/material-usage');await expect.poll(async()=> (await state()).calls.filter(c=>c.table==='material_usage_reports').reduce((n,c)=>n+c.rows,0)).toBe(1201);await page.getByPlaceholder('Search reports…',{exact:true}).fill('History 1200');const row=page.locator('aside [role="button"]').first();await expect(row).toBeVisible();await control({delays:{material_usage_reports:800}});await row.click();await page.getByRole('button',{name:'New Material Report',exact:true}).click();await expect(page.locator('#material-usage-work-order')).toHaveValue('');await expect.poll(async()=> (await state()).calls.filter(c=>c.table==='material_usage_reports'&&c.url.includes('eq.')).length).toBe(1);await expect(page.locator('#material-usage-work-order')).toHaveValue('');
 });
 await run('Material history failure is distinct from empty history',async()=>{
  await control({failure:'material_usage_reports'});await page.goto(origin+'/material-usage');await expect(page.getByText('Synthetic retrieval denied',{exact:true})).toBeVisible();await expect(page.getByText('No material reports yet',{exact:true})).toHaveCount(0);
 });
 await run('Empty lists terminate and show their legitimate empty states',async()=>{
  await control({reset:true,size:0});await page.goto(origin+'/purchasing');await expect(page.getByText(/No matching Purchase Orders/)).toBeVisible();await page.goto(origin+'/proposals');await expect(page.getByText('No Proposals are linked to this workspace.',{exact:true})).toBeVisible();
 });
 await run('In-place account switch discards delayed former-account history',async()=>{
  await control({delays:{material_usage_reports:700}});await page.goto(origin+'/material-usage');const id=uuid(9998);await page.evaluate(id=>{const old=JSON.parse(localStorage.getItem('sb-localhost-auth-token'));const payload={sub:id,exp:4102444800,role:'authenticated',session_id:id};const token=btoa('{"alg":"HS256","typ":"JWT"}').replace(/=/g,'')+'.'+btoa(JSON.stringify(payload)).replace(/=/g,'')+'.fixture';const session={...old,access_token:token,user:{...old.user,id}};localStorage.setItem('sb-localhost-auth-token',JSON.stringify(session));const c=new BroadcastChannel('sb-localhost-auth-token');c.postMessage({event:'SIGNED_IN',session});c.close();},id);await expect(page.getByRole('button',{name:'Account menu for Review B, Admin',exact:true})).toBeVisible();await expect(page.getByText('No material reports yet',{exact:true})).toBeVisible();await expect(page.locator('aside [role="button"]')).toHaveCount(0);
 });
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);mkdirSync('output',{recursive:true});writeFileSync('output/wave2-browser.json',JSON.stringify({origin,checks,measurements,pageErrors:errors,external,hostedWrites:0},null,2));console.log(JSON.stringify({checks,measurements},null,2));
}catch(error){console.error({pageErrors:errors});console.error((await page.locator('body').innerText()).slice(-1800));throw error;}finally{await control({reset:true});await browser.close();}
