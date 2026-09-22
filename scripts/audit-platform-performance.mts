// Local production-build profiling only. All Supabase HTTP/WebSocket traffic is mocked.
import assert from 'node:assert/strict';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { chromium, expect, type Page } from '@playwright/test';
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, writeFileSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import { gzipSync } from 'node:zlib';
import { mockManpowerAuth } from '../tests/support/manpower-auth';
const root=resolve(process.env.PERF_ROOT||'out');
const output=process.env.PERF_OUTPUT||'/private/tmp/tenops-performance/profile.json';
const server=createServer((req,res)=>{
  const path=new URL(req.url!,'http://localhost').pathname;
  const local=path==='/'?'index':decodeURIComponent(path.slice(1));
  const file=[local,`${local}.html`,`${local}/index.html`].map(p=>resolve(root,p)).find(p=>p.startsWith(root+'/')&&existsSync(p)&&statSync(p).isFile());
  if(!file)return void res.writeHead(404).end();
  res.writeHead(200,{'content-type':({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.txt':'text/plain'} as Record<string,string>)[extname(file)]||'application/octet-stream'}).end(readFileSync(file));
});
await new Promise<void>(done=>server.listen(0,'127.0.0.1',done));
const address=server.address() as {port:number};const base=`http://127.0.0.1:${address.port}`;
const browser=await chromium.launch({headless:true});
const stamp='2026-09-20T12:00:00Z';const user='00000000-0000-0000-0000-000000000004';
const jobs=Array.from({length:120},(_,i)=>({id:`00000000-0000-4000-8000-${String(i).padStart(12,'0')}`,name:`Fixture Job ${i}`,job_number:`26-${String(i).padStart(4,'0')}`,customer:'Fixture Customer',production_status:'in_production',material_status:'ready',priority:'normal',progress_percent:25,owner_name:'Fixture',planned_start:'2026-09-01',planned_end:'2026-09-30',requested_delivery_date:'2026-10-01',estimated_man_hours:40,estimated_calendar_days:4,remarks:'',archived_at:null,created_at:stamp,updated_at:stamp}));
const ref=(id:string,name:string)=>({id,display_name:name,sort_order:1,is_active:true,created_at:stamp,updated_at:stamp});
const worker=ref('worker','Fixture Worker'),task=ref('task','Rough Grinding'),group=ref('group','Shop'),category=ref('category','Slabs');
const labor=Array.from({length:1674},(_,i)=>({id:`labor-${String(i).padStart(5,'0')}`,work_date:'2026-09-20',worker_id:worker.id,task_id:task.id,job_id:jobs[i%jobs.length].id,reporting_group_id:group.id,product_category_id:i%2?null:category.id,am_hours:2,pm_hours:1,notes:'',entered_by:null,rework_cycle_id:null,created_at:stamp,updated_at:stamp,worker,task,job:jobs[i%jobs.length],reporting_group:group,product_category:category,rework_cycle:null}));
const inventory=Array.from({length:1000},(_,i)=>({id:`inventory-${i}`,vendor:'Fixture vendor',color:`Material ${i}`,size:'#1',category:'marble',quantity:20,unit:'Bag',location:'Shop',pallet_number:`P${i}`,notes:'',earmarked_for_job:false,production_job_id:null,updated_at:stamp}));
const bids=Array.from({length:100},(_,i)=>({id:`bid-${i}`,customer:'Fixture customer',project_name:`Fixture Bid ${i}`,creator_user_id:user,creator_name:'Fixture',owner_user_id:user,owner_name:'Fixture',status:'active',created_at:stamp,updated_at:stamp}));
const tasks=Array.from({length:200},(_,i)=>({id:`task-${i}`,title:`Fixture task ${i}`,notes:'',visibility:'private',creator_user_id:user,creator_name:'Fixture',assignee_user_id:user,assignee_name:'Fixture',due_date:null,estimated_minutes:15,context_type:null,context_id:null,color_key:'neutral',completed_at:null,created_at:stamp,updated_at:stamp}));
const catalog=Array.from({length:218},(_,i)=>({id:`catalog-${String(i).padStart(3,'0')}`,vendor_name:'Klein & Co / KCI',item_name:i===217?'Plex-A-Bond':`Klein aggregate ${i}`,material_type:i===217?'Resin / chemical system':'chip',category:i===217?'resin':'marble',component_type:i===217?'Polyacrylate additive':'',quote_required:i===217,price:i===217?null:40,price_unit:i===217?'quote':'Bag',packaging:i===217?null:'50 LB Bag',is_active:true}));
const tables:Record<string,unknown[]>={jobs,manpower_entries:labor,manpower_workers:[worker],manpower_tasks:[task],manpower_reporting_groups:[group],manpower_product_categories:[category],inventory_items:inventory,vendor_catalog_v2:catalog};
const rpcs:Record<string,unknown>={list_bids:bids,list_bid_owners:[{user_id:user,display_name:'Fixture'}],list_my_work_tasks:tasks,has_proposal_access:true,list_my_work_inbox_recipients:[{user_id:'other',display_name:'Other fixture',role:'lead'}]};
const results:unknown[]=[];
async function profile(name:string,path:string,action?:(page:Page)=>Promise<void>){
  if(process.env.PERF_ONLY && !process.env.PERF_ONLY.split(',').includes(name))return;
  const context=await browser.newContext({viewport:{width:1440,height:1000}});const page=await context.newPage();
  const calls:{name:string;url:string;method:string;at:number;rows:number;bytes:number;done:number}[]=[];const channels:string[]=[];const errors:string[]=[];
  const scripts=new Set<string>();
  const allRequests:string[]=[];page.on('request',r=>{if(r.url().includes('/rest/v1/'))allRequests.push(new URL(r.url()).pathname);});
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{if(r.resourceType()==='script')scripts.add(new URL(r.url()).pathname);});
  await page.routeWebSocket('**/realtime/v1/**',ws=>{ws.onMessage(raw=>{try{const decoded=JSON.parse(String(raw));const m=Array.isArray(decoded)?{topic:decoded[2],event:decoded[3],ref:decoded[1]}:decoded;if(m.event==='phx_join')channels.push(m.topic);if(m.event==='phx_join'||m.event==='heartbeat'){const payload={status:'ok',response:{postgres_changes:[]}};ws.send(JSON.stringify(Array.isArray(decoded)?[decoded[0],m.ref,m.topic,'phx_reply',payload]:{event:'phx_reply',topic:m.topic,ref:m.ref,payload}));}}catch{}});});
  await page.route('**/rest/v1/**',async route=>{
    const request=route.request(),url=new URL(request.url()),name=url.pathname.split('/').at(-1)!;
    let body:unknown=rpcs[name]??tables[name]??[];
    if(url.searchParams.has('id'))body=(tables[name]??[]).find((row)=>String((row as {id:string}).id)===url.searchParams.get('id')?.slice(3))??null;
    if(Array.isArray(body)&&url.searchParams.has('or')){const terms=[...url.searchParams.get('or')!.matchAll(/(\w+)\.ilike\.("(?:[^"\\]|\\.)*")/g)];if(terms.length)body=body.filter(row=>terms.some(([,col,pat])=>String(row[col]??'').toLowerCase().includes(JSON.parse(pat).slice(1,-1).toLowerCase())));}
    const total=Array.isArray(body)?body.length:0;const offset=Number(url.searchParams.get('offset')??0),limit=Number(url.searchParams.get('limit')??1000);
    if(Array.isArray(body))body=body.slice(offset,offset+limit);
    const encoded=JSON.stringify(body),call={name,url:url.pathname+url.search,method:request.method(),at:performance.now(),rows:Array.isArray(body)?body.length:0,bytes:Buffer.byteLength(encoded),done:0};calls.push(call);
    await new Promise(done=>setTimeout(done,20));
    await route.fulfill({status:200,contentType:'application/json',headers:{'content-range':`${offset}-${Math.max(offset,offset+call.rows-1)}/${total}`,'access-control-expose-headers':'content-range'},body:request.method()==='HEAD'?'':encoded});call.done=performance.now();
  });
  await page.route('**/functions/v1/**',route=>route.fulfill({status:503,body:'Audit does not invoke hosted functions'}));
  await mockManpowerAuth(page,'admin');
  const cdp=await context.newCDPSession(page);await cdp.send('Performance.enable');
  const started=performance.now();await page.goto(base+path,{waitUntil:'load'});await page.waitForTimeout(1600);
  if(action){await action(page);await page.waitForTimeout(1200);}
  const metrics=Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m:{name:string;value:number})=>[m.name,m.value]));
  const dom=await page.evaluate(()=>({nodes:document.querySelectorAll('*').length,rows:document.querySelectorAll('tbody tr').length,headings:[...document.querySelectorAll('h1,h2')].map(x=>x.textContent),alerts:[...document.querySelectorAll('[role=alert]')].map(x=>x.textContent)}));
  const files=[...scripts].map(p=>resolve(root,'.'+p)).filter(p=>existsSync(p));
  const result={name,path,elapsedMs:Math.round(performance.now()-started),scriptBytes:files.reduce((n,p)=>n+statSync(p).size,0),scriptGzipBytes:files.reduce((n,p)=>n+gzipSync(readFileSync(p)).length,0),scriptCount:files.length,metrics:{scriptMs:metrics.ScriptDuration*1000,taskMs:metrics.TaskDuration*1000,layoutMs:metrics.LayoutDuration*1000,heapBytes:metrics.JSHeapUsedSize},dom,channels,errors,allRequests,calls:calls.map(c=>({...c,at:Math.round(c.at-started),done:Math.round(c.done-started)}))};results.push(result);console.log(JSON.stringify({name,js:result.scriptBytes,requests:calls.length,rows:calls.reduce((n,c)=>n+c.rows,0),nodes:dom.nodes,scriptMs:Math.round(result.metrics.scriptMs),errors,alerts:dom.alerts}));
  if(process.env.PERF_ASSERT==='1'){
    assert.deepEqual(errors,[],`${name}: no uncaught client errors`);
    assert.deepEqual(dom.alerts,[],`${name}: no error alerts`);
    const count=(table:string)=>calls.filter(c=>c.name===table).length;
    if(name==='Snapshot'){
      assert.equal(count('jobs'),1);assert.equal(count('manpower_entries'),8);
      await expect(page.getByText('5,022h',{exact:true}).first()).toBeVisible();
      await page.getByRole('button',{name:'Production Pipeline',exact:true}).click();
      await expect(page.getByText('Fixture Job 0',{exact:true}).filter({visible:true}).first()).toBeVisible();
      await expect.poll(()=>count('manpower_entries')).toBe(12);
      assert.equal(count('jobs'),2);
    }
    if(name==='Manpower')assert.equal(calls.filter(c=>c.name==='manpower_entries').reduce((sum,c)=>sum+c.rows,0),1674);
    if(name==='Inventory'){
      assert.equal(dom.rows,1000);assert.equal(await page.locator('main article').count(),0);
      await page.setViewportSize({width:390,height:844});
      await expect(page.locator('main article')).toHaveCount(1000);
      await expect(page.locator('tbody tr')).toHaveCount(0);
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'narrow Inventory overflow');
      await page.setViewportSize({width:1440,height:1000});
      await expect(page.locator('tbody tr')).toHaveCount(1000);
      assert.equal(count('inventory_items'),1,'resize must not reload inventory');
    }
    if(name==='Purchasing')assert.equal(count('list_my_work_inbox_messages_v2'),0,'closed Inbox must not load bodies');
    if(name==='Messaging'){
      assert.equal(count('list_my_work_inbox_messages_v2'),1,'one body load per open');
      await page.getByRole('button',{name:'Close Inbox',exact:true}).click();
      await page.waitForTimeout(200);assert.equal(count('list_my_work_inbox_messages_v2'),1);
      await page.getByRole('button',{name:'Messaging',exact:true}).click();
      await expect.poll(()=>count('list_my_work_inbox_messages_v2')).toBe(2);
    }
    if(name==='Catalog search'){
      await expect(page.getByText('1–50 of 218 Catalog matches',{exact:true})).toBeVisible();
      await expect(page.getByRole('listbox',{name:'Catalog matches'}).getByRole('option')).toHaveCount(50);
      for(let i=0;i<4;i++)await page.getByRole('button',{name:'Next results',exact:true}).click();
      await expect(page.getByText('201–218 of 218 Catalog matches',{exact:true})).toBeVisible();
      await expect(page.getByRole('listbox',{name:'Catalog matches'}).getByRole('option')).toHaveCount(18);
    }
    console.log(`${name}: focused acceptance passed`);
  }
  await context.close();
}
try{
  for(const [name,path] of [['startup','/'],['Intake','/pre-production'],['Production','/production'],['Snapshot','/?view=snapshot'],['Manpower','/manpower-reporting'],['Inventory','/inventory'],['My Work','/my-work'],['Purchasing','/purchasing'],['Samples','/samples'],['Proposals','/proposals'],['Transmittals','/transmittals']])await profile(name,path);
  await profile('Messaging','/purchasing',async page=>{await page.getByRole('button',{name:'Messaging',exact:true}).click();});
  await profile('Catalog search','/samples',async page=>{await page.getByRole('button',{name:'New Sample',exact:true}).click();await page.getByPlaceholder('Type or search Catalog').first().fill('Klein');});
  if(process.env.PERF_ASSERT==='1')await profile('PDF deferred import','/production',async page=>{
    const pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Helvetica),sheet=pdf.addPage();
    sheet.drawText('SHOP FABRICATION WORK ORDER',{x:40,y:740,font,size:12});
    sheet.drawText('JOB #',{x:40,y:700,font,size:12});sheet.drawText('26-9999',{x:40,y:680,font,size:12});
    sheet.drawText('JOB. NAME',{x:40,y:650,font,size:12});sheet.drawText('Performance Fixture',{x:40,y:630,font,size:12});
    await page.getByRole('button',{name:'New Job',exact:true}).click();
    await page.getByRole('button',{name:/Create from Existing Documents/}).click();
    await page.locator('input[type=file]').setInputFiles({name:'fixture.pdf',mimeType:'application/pdf',buffer:Buffer.from(await pdf.save())});
    await page.getByRole('button',{name:'Review documents',exact:true}).click();
    await expect(page.getByLabel('Job number',{exact:true})).toHaveValue('26-9999');
  });
  writeFileSync(output,JSON.stringify({environment:{root,headless:true,apiDelayMs:20,fixtures:{jobs:120,labor:1674,inventory:1000,bids:100,tasks:200,catalog:218},note:'Synthetic client fixture costs, not Production network or DB latency. Unspecified tables/RPCs empty. Auth requests excluded from recorded data calls.'},results},null,2));
}finally{await browser.close();server.close();}
