import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,existsSync,readFileSync} from 'node:fs';
import {chromium,expect} from '@playwright/test';
import {fixtureResponse} from './retrieval-review-fixture.mjs';
import {wave4Fixture,session,userId,otherUserId} from './support/wave4-fixture.mjs';
const baseline=process.argv.includes('--baseline'),origin=baseline?'http://localhost:3000':'http://localhost:3344';
const only=process.env.WAVE4_CHECK||'',browser=await chromium.launch({headless:true}),results=[],errors=[],external=[];
const evidence=`docs/project-memory/evidence/2026-10-19-wave4-browser-${baseline?'before':'after'}.json`;
if(only&&existsSync(evidence))results.push(...JSON.parse(readFileSync(evidence)).results);
const total=p=>p.getByTestId('analytics-total');
const emit=(page,event,next)=>page.evaluate(({event,next})=>{if(next)localStorage.setItem('sb-localhost-auth-token',JSON.stringify(next));else localStorage.removeItem('sb-localhost-auth-token');const c=new BroadcastChannel('sb-localhost-auth-token');c.postMessage({event,session:next});c.close();},{event,next});
async function run(name,test,{useServer=false}={}){
 if(only==='final'?!/^(selected-period|received-history|local historical|away and back)/.test(name):only==='remaining'?name.startsWith('ordinary Manpower'):only==='remaining2'?/^(ordinary Manpower|Inventory startup)/.test(name):only&&!name.includes(only))return;
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),tables=wave4Fixture(),calls=[],state={fail:'',access:'allowed',empty:false,delay:()=>0,closed:false};
 await context.addInitScript(s=>{localStorage.setItem('sb-localhost-auth-token',JSON.stringify(s));sessionStorage.setItem('tenops.welcomeHeroPlayed:'+s.user.id,'true');},session());
 await context.routeWebSocket('**/realtime/v1/**',()=>{});
 await context.route('**/*',async route=>{try{
  const url=new URL(route.request().url());if(url.origin!==origin){external.push(url.href);return route.abort();}
  if(useServer||!url.pathname.startsWith('/rest/v1/'))return route.continue();
  const name=url.pathname.split('/').at(-1);let actor=userId;try{actor=JSON.parse(Buffer.from((route.request().headers().authorization||'').split('.')[1],'base64url')).sub;}catch{}
  const json=(body,status=200,headers={})=>route.fulfill({status,contentType:'application/json',headers,body:JSON.stringify(body)});
  const call={name,url:url.pathname+url.search,method:route.request().method(),history:name==='manpower_entries'&&!url.searchParams.has('work_date'),at:Date.now()};calls.push(call);
  const delay=state.delay(url);if(delay)await new Promise(r=>setTimeout(r,delay));
  if(state.fail===name)return json({message:'Controlled denied '+name,code:'42501'},403);
  if(url.pathname.includes('/rpc/')){
   if(name==='get_my_app_access')return json(state.access==='missing'?[]:[{user_id:actor,display_name:'Wave4 fixture',role:'admin',is_active:state.access!=='denied',read_only:false}]);
   if(name==='get_my_account_preferences')return json({manpower_recent_labor_expanded:true});
   return json(/^(get_|list_|search_)/.test(name)?[]:null);
  }
  const data=state.empty||actor===otherUserId?{...tables,manpower_entries:[],inventory_items:[],pending_receivals:[],inventory_transactions:[]}:tables;
  const r=fixtureResponse(url,data,500);Object.assign(call,{rows:r.rows.length,bytes:Buffer.byteLength(JSON.stringify(r.rows))});return json(r.rows,200,r.headers);
 }catch(e){if(!state.closed&&!/Target.*closed|Route.*handled|Invalid InterceptionId/.test(e.message))throw e;}});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.clock.setFixedTime(new Date('2026-10-19T12:00:00Z'));
 try{const observation=await test({page,context,tables,calls,state});results.push({name,...observation});console.log('PASS '+name);mkdirSync('docs/project-memory/evidence',{recursive:true});writeFileSync(evidence,JSON.stringify({baseline,origin,results,pageErrors:errors,external,hostedWrites:0,note:'Actual components, synthetic local data. JSON bytes are not compressed transfer sizes or SQL timings.'},null,2));}
 catch(e){console.error((await page.locator('body').innerText()).slice(-2400));throw e;}
 finally{state.closed=true;await context.close();}
}
try{
 await run('ordinary Manpower report and complete history on demand',async({page,calls})=>{
  const start=performance.now();await page.goto(origin+'/manpower-reporting');await expect(total(page)).toHaveText('4,503.75 h');const reportReadyMs=Math.round(performance.now()-start);
  if(baseline)await expect.poll(()=>calls.filter(c=>c.history).reduce((n,c)=>n+(c.rows||0),0),{timeout:20000}).toBe(12001);
  else{await page.waitForTimeout(250);assert.equal(calls.filter(c=>c.history).length,0);await expect(page.getByRole('searchbox',{name:'Search manpower',exact:true})).toBeDisabled();}
  const initial=calls.filter(c=>c.name==='manpower_entries').map(c=>({...c}));
  if(!baseline){await page.getByRole('button',{name:'Load reporting history',exact:true}).click();await expect(page.getByRole('searchbox',{name:'Search manpower',exact:true})).toBeEnabled({timeout:20000});assert.equal(calls.filter(c=>c.history).reduce((n,c)=>n+(c.rows||0),0),12001);await expect(total(page)).toHaveText('4,503.75 h');}
  return {reportReadyMs,initial:{requests:initial.length,rows:initial.reduce((n,c)=>n+(c.rows||0),0),bytes:initial.reduce((n,c)=>n+(c.bytes||0),0)},historyRequests:calls.filter(c=>c.history).length};
 });
 await run('Inventory startup, current quantities and complete received history',async({page,tables,calls})=>{
  const start=performance.now();await page.goto(origin+'/inventory');await expect(page.getByText('Loading inventory...',{exact:true})).toHaveCount(0);await expect.poll(()=>calls.filter(c=>c.name==='inventory_items').reduce((n,c)=>n+(c.rows||0),0)).toBe(1201);
  await page.getByRole('button').filter({hasText:'Pending Receivals'}).click();await expect(page.getByText('Loading pending receivals...',{exact:true})).toHaveCount(0);
  const stockReadyMs=Math.round(performance.now()-start),initial=calls.filter(c=>['inventory_items','pending_receivals'].includes(c.name)).map(c=>({...c}));
  if(!baseline){await expect(page.locator('#pending-receivals tbody tr')).toHaveCount(5);assert.equal(calls.filter(c=>c.name==='pending_receivals').length,1);await page.getByRole('button',{name:'Load received items',exact:true}).click();}
  await expect(page.locator('#pending-receivals tbody tr')).toHaveCount(1206);assert.equal(calls.filter(c=>c.name==='inventory_items').length,3);
  const stockTotal=tables.inventory_items.reduce((n,r)=>n+Number(r.quantity),0);await expect(page.locator('main').last()).toContainText('Review marble');
  if(!baseline){const count=calls.length;await page.getByRole('button').filter({hasText:'Pending Receivals'}).click();await page.getByRole('button').filter({hasText:'Pending Receivals'}).click();assert.equal(calls.length,count);}
  return {stockReadyMs,stockRows:1201,stockTotal,initial:{requests:initial.length,rows:initial.reduce((n,c)=>n+(c.rows||0),0),bytes:initial.reduce((n,c)=>n+(c.bytes||0),0)},receivedRows:1201};
 });
 await run('Activity audit includes oldest intake and usage',async({page,calls})=>{
  await page.goto(origin+'/activity');await expect(page.locator('table').getByText('Audit marble 0',{exact:true})).toBeVisible();await expect(page.locator('table').getByText('Audit marble '+(baseline?499:1400),{exact:true})).toBeVisible();
  const reads=calls.filter(c=>c.name==='inventory_transactions');return {requests:reads.length,rows:reads.reduce((n,c)=>n+(c.rows||0),0),bytes:reads.reduce((n,c)=>n+(c.bytes||0),0)};
 });
 if(!baseline){
 await run('period and Job changes discard delayed obsolete reports',async({page,state,calls})=>{
  await page.goto(origin+'/manpower-reporting');await expect(total(page)).toHaveText('4,503.75 h');state.delay=u=>u.pathname.endsWith('manpower_entries')?300:0;
  await page.getByRole('button',{name:'90 Days',exact:true}).click();await page.getByRole('button',{name:'30 Days',exact:true}).click();await page.getByRole('combobox',{name:'Job labor review',exact:true}).selectOption('00000000-0000-4000-8000-000000001000');await expect(total(page)).toHaveText('228.75 h');await page.waitForTimeout(400);await expect(total(page)).toHaveText('228.75 h');assert.equal(calls.filter(c=>c.history).length,0);
 });
 await run('history denial is separate from usable report; explicit retry succeeds',async({page,state})=>{
  await page.goto(origin+'/manpower-reporting');await expect(total(page)).toHaveText('4,503.75 h');state.fail='manpower_entries';await page.getByRole('button',{name:'Load reporting history',exact:true}).click();await expect(page.getByRole('button',{name:'Retry history',exact:true})).toBeVisible();await expect(total(page)).toHaveText('4,503.75 h');state.fail='';await page.getByRole('button',{name:'Retry history',exact:true}).click();await expect(page.getByRole('searchbox',{name:'Search manpower',exact:true})).toBeEnabled({timeout:20000});
 });
 await run('empty Manpower and Inventory resolve without infinite loading',async({page,state})=>{
  state.empty=true;await page.goto(origin+'/manpower-reporting');await expect(total(page)).toHaveText('0 h');await page.getByRole('button',{name:'Load reporting history',exact:true}).click();await expect(page.getByRole('searchbox',{name:'Search manpower',exact:true})).toBeEnabled();await page.goto(origin+'/inventory');await expect(page.locator('table').getByText('No matching inventory rows found.',{exact:true})).toBeVisible();
 });
 await run('Inventory denial resolves; refresh supersedes delayed stock and keeps search',async({page,state,calls})=>{
  state.fail='inventory_items';await page.goto(origin+'/inventory');await expect(page.getByText('Controlled denied inventory_items',{exact:true})).toBeVisible();await expect(page.getByText('Loading inventory...',{exact:true})).toHaveCount(0);state.fail='';state.delay=u=>u.pathname.endsWith('inventory_items')?300:0;await page.getByRole('button',{name:'Refresh',exact:true}).click();await page.getByLabel('Search current stock',{exact:true}).fill('Review marble');state.delay=()=>0;await page.getByRole('button',{name:'Refresh',exact:true}).click();await expect(page.getByText('Loading inventory...',{exact:true})).toHaveCount(0);await expect(page.getByLabel('Search current stock',{exact:true})).toHaveValue('Review marble');assert(calls.filter(c=>c.name==='inventory_items').length>=3);
 });
 await run('session revalidation preserves current stock; account change clears private workspace',async({page,state,calls})=>{
  await page.goto(origin+'/inventory');await expect.poll(()=>calls.filter(c=>c.name==='inventory_items').reduce((n,c)=>n+(c.rows||0),0)).toBe(1201);await page.getByLabel('Search current stock',{exact:true}).fill('Review marble');const before=calls.filter(c=>c.name==='inventory_items').length;await emit(page,'TOKEN_REFRESHED',session(userId,2));await expect(page.getByLabel('Search current stock',{exact:true})).toHaveValue('Review marble');assert.equal(calls.filter(c=>c.name==='inventory_items').length,before);
  await emit(page,'SIGNED_IN',session(otherUserId));await expect(page.locator('table').getByText('No matching inventory rows found.',{exact:true})).toBeVisible();await expect(page.getByLabel('Search current stock',{exact:true})).toHaveValue('');state.access='denied';await emit(page,'TOKEN_REFRESHED',session(otherUserId,2));await expect(page.getByText(/This account is disabled/)).toBeVisible();
 });
 await run('selected-period denial terminates and next period recovers',async({page,state})=>{
  state.fail='manpower_entries';await page.goto(origin+'/manpower-reporting');await expect(page.getByText('Analytics unavailable — complete labor could not be loaded.',{exact:true})).toBeVisible();await expect(page.getByText('Loading complete labor…',{exact:true})).toHaveCount(0);state.fail='';await page.getByRole('button',{name:'90 Days',exact:true}).click();await expect(total(page)).toHaveText('6,753.75 h');
 });
 await run('received-history denial retains stock and explicit retry loads all records',async({page,state})=>{
  await page.goto(origin+'/inventory');await page.getByRole('button').filter({hasText:'Pending Receivals'}).click();await expect(page.locator('#pending-receivals tbody tr')).toHaveCount(5);state.fail='pending_receivals';await page.getByRole('button',{name:'Load received items',exact:true}).click();await expect(page.getByRole('button',{name:'Retry receivals',exact:true})).toBeVisible();await expect(page.getByText('Loading pending receivals...',{exact:true})).toHaveCount(0);await expect(page.locator('main').last()).toContainText('Review marble');state.fail='';await page.getByRole('button',{name:'Retry receivals',exact:true}).click();await expect(page.locator('#pending-receivals tbody tr')).toHaveCount(1206);
 });
 await run('local historical edit and receive/undo preserve totals and lineage',async({page,context})=>{
  await context.request.post(origin+'/__review/control',{data:{reset:true}});
  await page.goto(origin+'/manpower-reporting');await expect(total(page)).toHaveText('4,503.75 h');await page.getByRole('button',{name:'Load reporting history',exact:true}).click();
  const search=page.getByRole('searchbox',{name:'Search manpower',exact:true});await expect(search).toBeEnabled({timeout:20000});await search.fill('Historical edit target');
  const note=page.getByPlaceholder('Notes',{exact:true});await expect(note).toHaveCount(1);await note.fill('Historical edit verified');
  const saved=page.waitForResponse(r=>r.request().method()==='PATCH'&&r.url().includes('/manpower_entries'));
  await page.getByRole('heading',{name:'Manpower Reporting',exact:true}).click();assert.equal((await saved).status(),200);await expect(total(page)).toHaveText('4,503.75 h');
  let snapshot=await(await context.request.get(origin+'/__review/state')).json();assert.equal(snapshot.tables.manpower_entries[2000].notes,'Historical edit verified');const originalStock=snapshot.tables.inventory_items.reduce((n,r)=>n+Number(r.quantity),0);
  await page.goto(origin+'/inventory');await expect(page.locator('table').getByRole('cell',{name:new RegExp('^'+(originalStock-21).toLocaleString()+' Bags')})).toBeVisible();await page.getByRole('button').filter({hasText:'Pending Receivals'}).click();
  let row=page.locator('#pending-receivals tbody tr').filter({hasText:'Incoming marble 0'});await row.getByRole('button',{name:'Receive',exact:true}).click();
  const receive=page.getByRole('dialog',{name:'Receive pending receival',exact:true});await receive.getByPlaceholder('Name',{exact:true}).fill('Local Receiver');await receive.getByRole('spinbutton').fill('5');await receive.getByRole('button',{name:'Confirm Receive',exact:true}).click();await expect(receive).toHaveCount(0);await expect(row).toContainText('Received 5 · Remaining 15');
  snapshot=await(await context.request.get(origin+'/__review/state')).json();const receival=snapshot.tables.pending_receivals[0],stock=snapshot.tables.inventory_items.find(r=>r.id===receival.receipt_inventory_item_id);assert.equal(stock.quantity,5);assert.equal(stock.production_job_id,receival.production_job_id);assert.equal(stock.earmark_notes,receival.earmark_notes);assert.equal(snapshot.tables.inventory_items.reduce((n,r)=>n+Number(r.quantity),0),originalStock+5);
  await row.getByRole('button',{name:'Undo latest receipt',exact:true}).click();const undo=page.getByRole('dialog',{name:'Undo pending receival receipt',exact:true});await undo.getByPlaceholder('Name',{exact:true}).fill('Local Receiver');await undo.getByRole('button',{name:'Confirm Undo',exact:true}).click();await expect(undo).toHaveCount(0);
  snapshot=await(await context.request.get(origin+'/__review/state')).json();assert.equal(snapshot.tables.pending_receivals[0].quantity_received,0);assert.equal(snapshot.tables.inventory_items.reduce((n,r)=>n+Number(r.quantity),0),originalStock);assert.ok(snapshot.tables.inventory_transactions.at(-1).reversed_at);
  await row.getByRole('button',{name:'Receive',exact:true}).click();await receive.getByPlaceholder('Name',{exact:true}).fill('Local Receiver');await receive.getByRole('spinbutton').fill('20');await receive.getByRole('button',{name:'Confirm Receive',exact:true}).click();await expect(receive).toHaveCount(0);await expect(row).toHaveCount(0);
  await page.getByRole('button',{name:'Load received items',exact:true}).click();await expect(row).toBeVisible();await expect(row).toContainText('Received');
  await row.getByRole('button',{name:'Undo Receive',exact:true}).click();await undo.getByPlaceholder('Name',{exact:true}).fill('Local Receiver');await undo.getByRole('button',{name:'Confirm Undo',exact:true}).click();await expect(undo).toHaveCount(0);
  snapshot=await(await context.request.get(origin+'/__review/state')).json();assert.equal(snapshot.tables.pending_receivals[0].quantity_received,0);assert.equal(snapshot.tables.inventory_items.reduce((n,r)=>n+Number(r.quantity),0),originalStock);
  return {historicalEdit:true,reportHoursUnchanged:true,partialReceipt:5,fullReceipt:20,undoRestoresQuantity:true,reservationLineagePreserved:true,auditReversalRetained:true};
 },{useServer:true});
 await run('focus and continuing-sign-in preserve unsaved historical editor',async({page,calls})=>{
  await page.goto(origin+'/manpower-reporting');await expect(total(page)).toHaveText('4,503.75 h');await page.getByRole('button',{name:'Load reporting history',exact:true}).click();const search=page.getByRole('searchbox',{name:'Search manpower',exact:true});await expect(search).toBeEnabled({timeout:20000});await search.fill('Historical edit target');const note=page.getByPlaceholder('Notes',{exact:true});await note.fill('Unsaved focus note');const before=calls.filter(c=>c.history).length;
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));const response=page.waitForResponse(r=>r.url().endsWith('/get_my_app_access'));await emit(page,'SIGNED_IN',session(userId,2));await response;await expect(note).toHaveValue('Unsaved focus note');assert.equal(calls.filter(c=>c.history).length,before);
  return {simulatedFocus:true,continuingSignedIn:true,unsavedNotePreserved:true,extraHistoryReads:0,physicalVisibilityNotCertified:true};
 });
 await run('away and back while delayed history cannot repopulate a new workspace',async({page,state,calls})=>{
  await page.goto(origin+'/manpower-reporting');await expect(total(page)).toHaveText('4,503.75 h');state.delay=u=>u.pathname.endsWith('manpower_entries')&&!u.searchParams.has('work_date')?500:0;await page.getByRole('button',{name:'Load reporting history',exact:true}).click();await expect.poll(()=>calls.filter(c=>c.history).length).toBe(1);await page.goto(origin+'/inventory');await expect(page.getByLabel('Search current stock',{exact:true})).toBeVisible();await page.goto(origin+'/manpower-reporting');await expect(total(page)).toHaveText('4,503.75 h');await expect(page.getByRole('button',{name:'Load reporting history',exact:true})).toBeVisible();await expect(page.getByRole('searchbox',{name:'Search manpower',exact:true})).toBeDisabled();
 });
 }
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
}finally{await browser.close();}
