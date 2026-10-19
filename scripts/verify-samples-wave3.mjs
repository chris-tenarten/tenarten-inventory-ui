/** Actual exported components, disposable local API only. */
import assert from 'node:assert/strict';
import {writeFileSync,mkdirSync} from 'node:fs';
import {chromium,expect} from '@playwright/test';
import {reviewSession} from './support/messaging-draft-review-fixture.mjs';
const origin=process.env.SAMPLE_REVIEW_ORIGIN||'http://localhost:3333';
assert.match(origin,/^http:\/\/localhost:(3000|3333)$/);
const baseline=process.argv.includes('--baseline');
const browser=await chromium.launch({headless:true});
const seed=(await(await fetch(origin+'/__review/state')).json()).sample;
const results=[],external=[],errors=[];
async function run(name,fn,{samples=[{sample:seed}],listDelay=0,defaultsDelay=0,numberDelay=0,failList=false,failBids=false,history=0}={}){
 if(process.argv.includes('--profile-only')&&!name.startsWith('profile '))return;
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),counts={};let listBytes=0;
 await context.addInitScript(session=>{localStorage.setItem('sb-localhost-auth-token',JSON.stringify(session));sessionStorage.setItem('tenops.welcomeHeroPlayed:'+session.user.id,'true');},reviewSession);
 await context.routeWebSocket('**/realtime/v1/**',()=>{});
 await context.route('**/*',async route=>{
  const u=new URL(route.request().url());if(u.origin!==origin){external.push(u.href);return route.abort();}
  const key=u.pathname.split('/').at(-1);counts[key]=(counts[key]||0)+1;
  const json=async value=>route.fulfill({contentType:'application/json',body:JSON.stringify(value)});
  if(key==='list_samples'){
   const value=structuredClone(samples);
   if(history&&value[0])value[0].sample.working_versions=Array.from({length:history},(_,i)=>({id:'version-'+i,sample_id:seed.id,version_number:history-i,saved_at:'2026-10-19T12:00:00Z',saved_by_name:'Local operator',snapshot:seed}));
   listBytes=Buffer.byteLength(JSON.stringify(value));await new Promise(r=>setTimeout(r,listDelay));
   return failList?route.fulfill({status:403,contentType:'application/json',body:JSON.stringify({code:'42501',message:'Controlled denied list'})}):json(value);
  }
  if(key==='get_sample_formulation_default'){await new Promise(r=>setTimeout(r,defaultsDelay));return json({});}
  if(key==='suggest_sample_color_plate_number'){await new Promise(r=>setTimeout(r,numberDelay));return json('T26-902-A');}
  if(key==='restore_sample_working_version')return json(null);
  if(key==='vendors')return route.fulfill({contentType:'application/json',headers:{'content-range':'0-0/1'},body:JSON.stringify([{id:'00000000-0000-4000-8000-000000900010',name:'Local mineral supplier',is_active:true,vendor_contacts:[]}])});
  if(key==='vendor_catalog'||key==='vendor_catalog_v2')return route.fulfill({contentType:'application/json',headers:{'content-range':key==='vendor_catalog'?'0-0/1':'*/0'},body:JSON.stringify(key==='vendor_catalog'?[{id:'00000000-0000-4000-8000-000000900011',vendor:'Local mineral supplier',item_name:'Local marble chips',category:'aggregate',material_class:'marble',unit:'lb',price:1}]:[])});
  if(key==='list_bids'&&failBids)return route.fulfill({status:503,contentType:'application/json',body:'{"message":"Controlled Bid outage"}'});
  return route.continue();
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 const start=performance.now();
 try{await fn({page,context,counts,start});results.push({name,counts,listRows:samples.length,listBytes});console.log('PASS '+name);}
 finally{await context.close();}
}
const inspector=page=>page.getByRole('button',{name:'Generate Sample Work Order',exact:true});
try{
 await run('new draft independent readiness',async({page,counts,start})=>{
  await page.goto(origin+'/samples?open=new');await expect(inspector(page)).toBeVisible();
  const readyMs=Math.round(performance.now()-start);results.push({name:'readiness observation',readyMs,injectedDelays:{list:900,defaults:200,number:200}});
  await page.locator('#operator-sample-details > summary').click();await expect(page.getByLabel('Color Plate / Formula #',{exact:true})).toHaveValue('T26-902-A');
  assert.equal(counts.list_samples,1);assert.equal(counts.get_sample_formulation_default,1);assert.equal(counts.suggest_sample_color_plate_number,1);
 },{listDelay:900,defaultsDelay:200,numberDelay:200});
 if(!baseline){
 await run('late new-draft initialization cannot replace selected Sample',async({page})=>{
  await page.goto(origin+'/samples?open=new');await page.getByRole('button').filter({hasText:seed.sample_name}).click();
  await page.locator('#operator-sample-details > summary').click();const input=page.getByLabel('Color Plate / Formula #',{exact:true});await input.fill('KEEP-UNSAVED');await page.waitForTimeout(800);await expect(input).toHaveValue('KEEP-UNSAVED');
 },{defaultsDelay:600,numberDelay:600});
 await run('new draft remains usable when library denied',async({page})=>{await page.goto(origin+'/samples?open=new');await expect(inspector(page)).toBeVisible();await page.waitForTimeout(300);await expect(page.getByText('Loading…',{exact:true})).toHaveCount(0);},{failList:true});
 await run('empty library resolves',async({page,counts})=>{await page.goto(origin+'/samples');await expect.poll(()=>counts.list_samples).toBe(1);await expect(page.getByText('Loading…',{exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:/New Sample/}).first()).toBeVisible();},{samples:[]});
 await run('large complete library and history; no history DOM until expanded',async({page,counts})=>{
  await page.goto(origin+'/samples?open='+seed.id);await expect(inspector(page)).toBeVisible();assert.equal(await page.getByText('Saved Version 1',{exact:true}).count(),0);
  await page.locator('#sample-documents > summary').click();await page.getByText('Formula checkpoints and previews',{exact:true}).click();await expect(page.getByText('Saved Version 1',{exact:true})).toBeVisible();await expect(page.getByText('Saved Version 600',{exact:true})).toBeVisible();assert.equal(counts.list_samples,1);
  page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Use as Current Draft',exact:true}).first().click();
  await expect.poll(()=>counts.restore_sample_working_version).toBe(1);await expect.poll(()=>counts.list_samples).toBe(2);await expect(inspector(page)).toBeVisible();
 },{samples:Array.from({length:120},(_,i)=>({sample:{...seed,id:i?`00000000-0000-4000-8000-${String(810000+i).padStart(12,'0')}`:seed.id,sample_name:i?'Synthetic Sample '+i:seed.sample_name}})),history:600});
 await run('profile name refresh preserves unsaved Inspector and does not reload library',async({page,counts})=>{
  await page.goto(origin+'/samples?open='+seed.id);await expect(inspector(page)).toBeVisible();
  await page.locator('#operator-sample-details > summary').click();const input=page.getByLabel('Color Plate / Formula #',{exact:true});await input.fill('KEEP-PROFILE-EDIT');
  await page.route('**/rest/v1/rpc/get_my_app_access',async route=>{const response=await route.fetch();const profiles=await response.json();await route.fulfill({response,json:profiles.map(p=>({...p,display_name:'Renamed local operator'}))});});
  const response=page.waitForResponse(r=>r.url().endsWith('/get_my_app_access'));
  await page.evaluate(session=>{const channel=new BroadcastChannel('sb-localhost-auth-token');channel.postMessage({event:'SIGNED_IN',session});channel.close();},reviewSession);
  await response;await page.waitForTimeout(300);await expect(input).toHaveValue('KEEP-PROFILE-EDIT');assert.equal(counts.list_samples,1);assert.equal(counts.list_bids,1);assert.equal(counts.vendors,1);
 });
 await run('material Catalog and suppliers remain available',async({page,counts})=>{
  await page.goto(origin+'/samples?open='+seed.id);await expect(inspector(page)).toBeVisible();
  await page.locator('details').evaluateAll(items=>items.forEach(item=>{item.open=true;}));
  const color=page.locator('[data-sample-material-row][data-role="aggregate"] .blend-color input').first();await color.fill('Local marble');
  await expect(page.getByRole('option').filter({hasText:'Local marble chips'})).toBeVisible();
  assert.equal(counts.vendor_catalog,1);assert.equal(counts.vendor_catalog_v2,1);
 });
 await run('independent options survive Bid failure; navigation discards delayed initialization',async({page,counts})=>{
  await page.goto(origin+'/samples?open=new');await expect(inspector(page)).toBeVisible();assert.ok(Object.keys(counts).includes('jobs'));
  await page.goto(origin+'/my-work');await expect(page.getByRole('textbox',{name:'Task title',exact:true})).toBeVisible();await page.waitForTimeout(900);assert.equal(await inspector(page).count(),0);
 },{listDelay:800,failBids:true});
 }
 assert.deepEqual(external,[]);assert.deepEqual(errors,[]);
 const evidence={baseline,origin,results,external,pageErrors:errors,hostedWrites:0,note:'Synthetic JSON bytes and single browser observations; no hosted latency claim.'};
 mkdirSync('docs/project-memory/evidence',{recursive:true});writeFileSync(`docs/project-memory/evidence/2026-10-19-samples-wave3-${baseline?'before':process.argv.includes('--profile-only')?'profile':'after'}.json`,JSON.stringify(evidence,null,2));
}finally{await browser.close();}
