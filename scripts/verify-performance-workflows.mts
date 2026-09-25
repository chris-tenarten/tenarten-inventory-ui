// Local production-build profiling only. All Supabase HTTP/WebSocket traffic is mocked.
import assert from 'node:assert/strict';
import { chromium, expect, type Page } from '@playwright/test';
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, writeFileSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import { gzipSync } from 'node:zlib';
import { mockManpowerAuth } from '../tests/support/manpower-auth';
const root=resolve(process.env.PERF_ROOT||'out');
const output=process.env.PERF_OUTPUT||'/private/tmp/tenops-comprehensive.json';
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
const inventory=Array.from({length:process.env.PERF_LARGE==='1'?1101:1000},(_,i)=>({id:`inventory-${i}`,vendor:'Fixture vendor',color:`Material ${i}`,size:'#1',category:'marble',quantity:20,unit:'Bag',location:'Shop',pallet_number:`P${i}`,notes:'',earmarked_for_job:false,production_job_id:null,updated_at:stamp}));
const bids=Array.from({length:100},(_,i)=>({id:`bid-${i}`,customer:'Fixture customer',project_name:`Fixture Bid ${i}`,creator_user_id:user,creator_name:'Fixture',owner_user_id:user,owner_name:'Fixture',status:'active',created_at:stamp,updated_at:stamp}));
const tasks=Array.from({length:200},(_,i)=>({id:`task-${i}`,title:`Fixture task ${i}`,notes:'',visibility:'private',creator_user_id:user,creator_name:'Fixture',assignee_user_id:user,assignee_name:'Fixture',due_date:null,estimated_minutes:15,context_type:null,context_id:null,color_key:'neutral',completed_at:null,created_at:stamp,updated_at:stamp}));
tasks[1].visibility='shared';tasks[1].assignee_user_id='other';tasks[1].assignee_name='Other fixture';
const catalog=Array.from({length:218},(_,i)=>({id:`catalog-${String(i).padStart(3,'0')}`,vendor_name:'Klein & Co / KCI',item_name:i===217?'Plex-A-Bond':`Klein aggregate ${i}`,material_type:i===217?'Resin / chemical system':'chip',category:i===217?'resin':'marble',component_type:i===217?'Polyacrylate additive':'',quote_required:i===217,price:i===217?null:40,price_unit:i===217?'quote':'Bag',packaging:i===217?null:'50 LB Bag',is_active:true}));
const phases=Array.from({length:5},(_,i)=>({id:`phase-${i}`,job_id:jobs[0].id,title:`Phase ${i}`,description:'Description',owner:'',category:'',status:'active',start_date:'2026-09-02',end_date:'2026-09-25',timeline_behavior:'overlay',include_in_planning_progress:true,created_at:stamp,updated_at:stamp}));
const items=Array.from({length:16},(_,i)=>({id:`item-${String(i).padStart(5,'0')}`,phase_id:phases[i%5].id,title:`Planning item ${i}`,notes:'Detail only '.repeat(150),owner:'Fixture',is_complete:i%2===0,estimated_hours:2,sort_order:i,created_at:stamp,updated_at:stamp}));
const attachments=Array.from({length:1201},(_,i)=>({id:`attachment-${String(i).padStart(5,'0')}`,job_id:jobs[0].id,file_name:`File ${i}.txt`,storage_path:`fixture/${i}`,mime_type:'text/plain',size_bytes:20,document_type:'other',uploaded_by:'Fixture',created_at:stamp}));
const pending=Array.from({length:76},(_,i)=>({id:`pending-${i}`,vendor:'Fixture vendor',material_name:`Pending ${i}`,size:'#1',category:'marble',quantity_expected:10,quantity_received:0,unit:'Bag',status:'pending',created_at:stamp,eta:'2026-09-30',notes:''}));
const transactions=Array.from({length:91},(_,i)=>({id:`transaction-${i}`,created_at:stamp,transaction_type:'stock_in',vendor:'Fixture vendor',item_name:`Historical material ${i}`,size:'#1',quantity:2,unit:'Bag',location:'Shop',notes:`Historical detail ${i}`}));
const library=Array.from({length:10},(_,i)=>({id:`library-${i}`,name:`Template ${i}`,active:true,sort_order:i,default_timeline_behavior:'overlay',created_at:stamp,updated_at:stamp}));
const libraryItems=Array.from({length:120},(_,i)=>({id:`library-item-${String(i).padStart(4,'0')}`,library_phase_id:`library-${i%10}`,title:`Template item ${i}`,notes:'Template instructions '.repeat(40),sort_order:i,estimated_hours:2,created_at:stamp,updated_at:stamp}));
const tables:Record<string,unknown[]>={bids,planning_phase_library:library,planning_phase_library_items:libraryItems,inventory_transactions:transactions,planning_phases:phases,planning_items:items,job_attachments:attachments,pending_receivals:pending,jobs,manpower_entries:labor,manpower_workers:[worker],manpower_tasks:[task],manpower_reporting_groups:[group],manpower_product_categories:[category],inventory_items:inventory,vendor_catalog_v2:catalog};
const workGroups:{id:string;name:string;color_key:string;created_at:string;updated_at:string}[]=[];
const rpcs:Record<string,unknown>={list_my_work_task_groups:workGroups,list_bids:bids,list_bid_owners:[{user_id:user,display_name:'Fixture'}],list_my_work_tasks:tasks,has_proposal_access:true,list_my_work_inbox_recipients:[{user_id:'other',display_name:'Other fixture',role:'lead'}]};
const results:unknown[]=[];
async function profile(name:string,path:string,action?:(page:Page)=>Promise<void>){
  if(process.env.PERF_ONLY && !process.env.PERF_ONLY.split(',').includes(name))return;
  const context=await browser.newContext({reducedMotion:'reduce',viewport:{width:1440,height:1000}});const page=await context.newPage();
  const calls:{name:string;url:string;method:string;at:number;rows:number;bytes:number;done:number}[]=[];const channels:string[]=[];const errors:string[]=[];
  const scripts=new Set<string>();
  const allRequests:string[]=[];page.on('request',r=>{if(r.url().includes('/rest/v1/'))allRequests.push(new URL(r.url()).pathname);});
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{if(r.resourceType()==='script')scripts.add(new URL(r.url()).pathname);});
  await page.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.fulfill({status:503,body:'Unmocked external request blocked'}));
  await page.routeWebSocket('**/realtime/v1/**',ws=>{ws.onMessage(raw=>{try{const decoded=JSON.parse(String(raw));const m=Array.isArray(decoded)?{topic:decoded[2],event:decoded[3],ref:decoded[1]}:decoded;if(m.event==='phx_join')channels.push(m.topic);if(m.event==='phx_join'||m.event==='heartbeat'){const payload={status:'ok',response:{postgres_changes:[]}};ws.send(JSON.stringify(Array.isArray(decoded)?[decoded[0],m.ref,m.topic,'phx_reply',payload]:{event:'phx_reply',topic:m.topic,ref:m.ref,payload}));}}catch{}});});
  await page.route('**/rest/v1/**',async route=>{
    const request=route.request(),url=new URL(request.url()),name=url.pathname.split('/').at(-1)!;
    if(name==='create_my_work_task_group'){const input=request.postDataJSON();workGroups.push({id:'new-group',name:input.p_name,color_key:input.p_color_key,created_at:stamp,updated_at:stamp});}
    let body:unknown=name==='create_my_work_task_group'?'new-group':rpcs[name]??tables[name]??[];
    if(url.searchParams.get('job_id')?.startsWith('eq.')&&Array.isArray(body))body=body.filter(row=>(row as {job_id:string}).job_id===url.searchParams.get('job_id')!.slice(3));
    if(url.searchParams.get('job_id')?.startsWith('in.(')&&Array.isArray(body)){const ids=url.searchParams.get('job_id')!.slice(4,-1).split(',');body=body.filter(row=>ids.includes((row as {job_id:string}).job_id));}
    if(url.searchParams.get('library_phase_id')?.startsWith('eq.')&&Array.isArray(body))body=body.filter(row=>(row as {library_phase_id:string}).library_phase_id===url.searchParams.get('library_phase_id')!.slice(3));
    if(url.searchParams.get('id')?.startsWith('eq.')){const matches=(tables[name]??[]).filter((row)=>String((row as {id:string}).id)===url.searchParams.get('id')?.slice(3));body=request.headers().accept?.includes('vnd.pgrst.object')?matches[0]??null:matches;}
    if(Array.isArray(body)&&url.searchParams.has('or')){const terms=[...url.searchParams.get('or')!.matchAll(/(\w+)\.ilike\.("(?:[^"\\]|\\.)*")/g)];if(terms.length)body=body.filter(row=>terms.some(([,col,pat])=>String(row[col]??'').toLowerCase().includes(JSON.parse(pat).slice(1,-1).toLowerCase())));}
    const total=Array.isArray(body)?body.length:0;const offset=Number(url.searchParams.get('offset')??0),limit=Number(url.searchParams.get('limit')??1000);
    if(Array.isArray(body))body=body.slice(offset,offset+limit);
    const projection=url.searchParams.get('select');
    if(name==='manpower_entries'&&Array.isArray(body)&&projection?.includes('job:'))body=body.map(row=>{const next={...row};for(const [field,token] of [['worker','worker:'],['task','task:'],['reporting_group','reporting_group:']])if(!projection.includes(token))delete next[field];return next;});
    if(Array.isArray(body)&&projection&&projection!=='*'&&!projection.includes('('))body=body.map(row=>Object.fromEntries(projection.split(',').map(key=>[key.trim(),row[key.trim()]])));
    const encoded=JSON.stringify(body),call={name,url:url.pathname+url.search,method:request.method(),at:performance.now(),rows:Array.isArray(body)?body.length:0,bytes:Buffer.byteLength(encoded),done:0};calls.push(call);
    await new Promise(done=>setTimeout(done,name==='job_attachments'&&url.searchParams.get('select')?.includes('file_name')?150:20));
    await route.fulfill({status:200,contentType:'application/json',headers:{'content-range':`${offset}-${Math.max(offset,offset+call.rows-1)}/${total}`,'access-control-expose-headers':'content-range'},body:request.method()==='HEAD'?'':encoded});call.done=performance.now();
  });
  await page.route('**/functions/v1/**',route=>route.fulfill({status:503,body:'Audit does not invoke hosted functions'}));
  await mockManpowerAuth(page,'admin');
  const cdp=await context.newCDPSession(page);await cdp.send('Performance.enable');
  const started=performance.now();await page.goto(base+path,{waitUntil:'load'});await page.waitForTimeout(1600);
  await expect(page.locator('[data-welcome-hero]')).toHaveCount(0,{timeout:12000});
  const initialAuthCalls=allRequests.filter(p=>/get_my_app_user|ensure_my_welcome_notification/.test(p));
  const initialCalls=calls.map(c=>({...c})); const initialDom=await page.locator('*').count();
  if(action){await action(page);await page.waitForTimeout(1200);}
  const metrics=Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m:{name:string;value:number})=>[m.name,m.value]));
  const dom=await page.evaluate(()=>({nodes:document.querySelectorAll('*').length,rows:document.querySelectorAll('tbody tr').length,headings:[...document.querySelectorAll('h1,h2')].map(x=>x.textContent),alerts:[...document.querySelectorAll('[role=alert]')].map(x=>x.textContent)}));
  const files=[...scripts].map(p=>resolve(root,'.'+p)).filter(p=>existsSync(p));
  const result={initialAuthCalls,initialDom,initialCalls,authCalls:allRequests.filter(p=>/get_my_app_user|ensure_my_welcome_notification/.test(p)),name,path,elapsedMs:Math.round(performance.now()-started),scriptBytes:files.reduce((n,p)=>n+statSync(p).size,0),scriptGzipBytes:files.reduce((n,p)=>n+gzipSync(readFileSync(p)).length,0),scriptCount:files.length,metrics:{scriptMs:metrics.ScriptDuration*1000,taskMs:metrics.TaskDuration*1000,layoutMs:metrics.LayoutDuration*1000,heapBytes:metrics.JSHeapUsedSize},dom,channels,errors,allRequests,calls:calls.map(c=>({...c,at:Math.round(c.at-started),done:Math.round(c.done-started)}))};results.push(result);writeFileSync(output,JSON.stringify({results},null,2));console.log(JSON.stringify({name,js:result.scriptBytes,requests:calls.length,rows:calls.reduce((n,c)=>n+c.rows,0),nodes:dom.nodes,scriptMs:Math.round(result.metrics.scriptMs),errors,alerts:dom.alerts}));
  if(process.env.PERF_ASSERT==='1'){
    assert.equal(initialCalls.filter(c=>c.name==='list_my_work_message_page_v11').length,0,'no closed-Inbox history');
    assert.deepEqual(errors,[],`${name}: no uncaught client errors`);
    assert.deepEqual(dom.alerts,[],`${name}: no error alerts`);
    assert.equal(initialAuthCalls.filter(p=>p.endsWith('/get_my_app_user')).length,1,'one bootstrap profile read');
    const detailFiles=calls.filter(c=>c.name==='job_attachments'&&c.url.includes('file_name'));
    if(name.startsWith('Production'))assert.equal(initialCalls.filter(c=>c.name==='planning_items').length,0,'Overview must not fetch Timeline items');
    if(name==='Production detail')assert.equal(detailFiles.length,0,'Details must not fetch file metadata');
    if(name==='Production files')assert.equal(detailFiles.reduce((n,c)=>n+c.rows,0),1201,'Files are complete');
    if(name==='Production timeline'){
      const progress=calls.filter(c=>c.name==='planning_items');assert.equal(progress.reduce((n,c)=>n+c.rows,0),16);
      assert(progress.every(c=>!c.url.includes('notes')&&!c.url.includes('title')),'progress is a lean projection');
    }
    if(name==='Inventory collapsed'){await expect(page.getByText('Pending 0',{exact:true})).toHaveCount(0);await expect(page.locator('tbody tr')).toHaveCount(process.env.PERF_LARGE==='1'?1101:1000);}
    if(name==='My Work groups')assert.equal(calls.filter(c=>c.name==='list_my_work_task_groups').length-initialCalls.filter(c=>c.name==='list_my_work_task_groups').length,1,'one groups reload per mutation');
    if(name==='My Work'||name==='Inventory collapsed')assert.equal(initialCalls.filter(c=>c.name==='jobs').length,0,'no unopened Job choices');
    if(name==='Production templates'){const reads=calls.filter(c=>c.name==='planning_phase_library_items');assert.equal(reads.reduce((n,c)=>n+c.rows,0),12);assert(reads.every(c=>c.url.includes('library_phase_id=eq.')));}
    if(name==='Manpower')assert.equal(calls.filter(c=>c.name==='manpower_entries').reduce((n,c)=>n+c.rows,0),1674);
    console.log(`${name}: focused acceptance passed`);
  }
  if(process.env.PERF_SCREENSHOT)await page.screenshot({path:process.env.PERF_SCREENSHOT});
  await context.close();
}
try{
  await profile('Production detail','/production',async page=>{
    await page.getByRole('button',{name:'Open Fixture Job 0',exact:true}).filter({visible:true}).first().focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('tab',{name:'Details',exact:true})).toBeVisible();
  });
  await profile('Production files','/production',async page=>{
    await page.getByRole('button',{name:'Open Fixture Job 0',exact:true}).filter({visible:true}).first().focus();
    await page.keyboard.press('Enter');
    await page.getByRole('tab',{name:/^Files/}).click();
    if(process.env.PERF_ASSERT==='1')await expect(page.locator('input[type=file]').last()).toBeDisabled();
    await expect(page.getByText('File 0.txt',{exact:true})).toBeVisible();
    if(process.env.PERF_ASSERT==='1')await expect(page.locator('input[type=file]').last()).toBeEnabled();
    if(process.env.PERF_ASSERT==='1')await expect(page.getByText('File 1200.txt',{exact:true})).toBeVisible();
  });
  await profile('Production timeline','/production',async page=>{
    await page.getByRole('button',{name:'Timeline',exact:true}).click();
  });
  await profile('Production switch','/production',async page=>{
    await page.getByRole('button',{name:'Open Fixture Job 0',exact:true}).filter({visible:true}).first().focus();await page.keyboard.press('Enter');
    await page.getByRole('tab',{name:/^Files/}).click();await page.getByRole('button',{name:'Close',exact:true}).click();
    await page.getByRole('button',{name:'Open Fixture Job 1',exact:true}).filter({visible:true}).first().focus();await page.keyboard.press('Enter');
    await page.getByRole('tab',{name:/^Files/}).click();await page.waitForTimeout(650);
    await expect(page.getByText('File 0.txt',{exact:true})).toHaveCount(0);await expect(page.locator('input[type=file]').last()).toBeEnabled();
    await page.getByRole('tab',{name:/Job Updates/}).click();await expect(page.getByRole('tab',{name:/Job Updates/})).toHaveAttribute('aria-selected','true');
  });
  await profile('Production templates','/production',async page=>{
    await page.getByRole('button',{name:'Open Fixture Job 1',exact:true}).filter({visible:true}).first().focus();await page.keyboard.press('Enter');
    await page.getByRole('tab',{name:/^Planning/}).click();
    await expect(page.getByRole('combobox',{name:'Add from Phase Library'})).toBeVisible();
    await page.getByRole('combobox',{name:'Add from Phase Library'}).selectOption('library-0');
    await expect(page.getByText('Template item 110',{exact:true})).toBeVisible();
  });
  await profile('Inventory collapsed','/inventory');
  await profile('Inventory expanded','/inventory',async page=>{
    await page.getByRole('button',{name:/Pending Receivals/}).click();
    await expect(page.getByText('Pending 75',{exact:true}).first()).toBeVisible();
    await page.getByRole('checkbox',{name:'Select Pending 0',exact:true}).check();
    await page.getByRole('button',{name:/Pending Receivals/}).click();
    await page.getByRole('button',{name:/Pending Receivals/}).click();
    await expect(page.getByRole('checkbox',{name:'Select Pending 0',exact:true})).toBeChecked();
  });
  await profile('Intake','/pre-production',async page=>{
    await page.getByText('Fixture Bid 0',{exact:true}).filter({visible:true}).first().click();
    await page.getByRole('button',{name:'Close Bid workspace',exact:true}).click();
  });
  await profile('Intake switch','/pre-production',async page=>{
    await page.route('**/rest/v1/rpc/list_bid_activity',async route=>{
      const id=route.request().postDataJSON().p_bid_id;
      await new Promise(done=>setTimeout(done,id==='bid-0'?800:20));
      await route.fulfill({headers:{'content-range':'0-0/1'},json:[{id:'activity-'+id,activity_type:'created',actor_user_id:user,actor_name:'Actor '+id,occurred_at:stamp,details:{}}]});
    });
    await page.getByText('Fixture Bid 0',{exact:true}).filter({visible:true}).first().click();
    await page.getByRole('button',{name:'Close Bid workspace',exact:true}).click();
    await page.getByText('Fixture Bid 1',{exact:true}).filter({visible:true}).first().click();
    await expect(page.getByText('Actor bid-1',{exact:true})).toBeVisible();
    await page.waitForTimeout(950);await expect(page.getByText('Actor bid-0',{exact:true})).toHaveCount(0);
  });
  await profile('Inventory history','/inventory',async page=>{
    await page.goto(base+'/activity');
    await expect(page.getByText('Historical material 90',{exact:true}).filter({visible:true}).first()).toBeVisible();
    await page.getByText('Historical material 90',{exact:true}).filter({visible:true}).first().click();
    await expect(page.getByText('Historical detail 90',{exact:true}).filter({visible:true}).first()).toBeVisible();
  });
  await profile('Intake Planning','/pre-production',async page=>{
    await page.getByRole('button',{name:'Planning',exact:true}).click();
    await expect(page.getByRole('button',{name:'Combined',exact:true})).toBeVisible();
    await page.getByRole('button',{name:'Combined',exact:true}).click();
    await expect(page.getByText('Fixture Job 0',{exact:false}).filter({visible:true}).first()).toBeVisible();
  });
  await profile('Messaging','/my-work',async page=>{
    await page.getByRole('button',{name:'Messaging',exact:true}).click();
    await expect(page.getByRole('button',{name:'Close Inbox',exact:true})).toBeVisible();
    await page.getByRole('button',{name:'Close Inbox',exact:true}).click();
  });
  await profile('Manpower','/manpower-reporting');
  await profile('My Work','/my-work');
  await profile('My Work groups','/my-work',async page=>{
    await page.getByRole('button',{name:'Task Groups',exact:true}).click();
    await page.getByRole('textbox',{name:'New Group name',exact:true}).fill('Performance fixture group');
    await page.getByRole('button',{name:'Create Group',exact:true}).click();
    await expect(page.getByRole('textbox',{name:'Group name',exact:true})).toHaveValue('Performance fixture group');
  });
  await profile('My Work options','/my-work',async page=>{
    await page.getByRole('textbox',{name:'Task title',exact:true}).focus();
    await page.getByRole('combobox',{name:'Composer Job',exact:true}).fill('Fixture Job 119');
    await page.getByRole('option',{name:/Fixture Job 119/}).click();
    await expect(page.getByRole('combobox',{name:'Composer Job',exact:true})).toHaveValue(/Fixture Job 119/);
    await page.getByRole('tab',{name:'Shared Tasks',exact:true}).click();
    await expect(page.locator('[data-work-task-id="task-1"]')).toBeVisible();await expect(page.locator('[data-work-task-id="task-0"]')).toHaveCount(0);
  });
  await profile('My Work switch','/my-work',async page=>{
    await page.route('**/rest/v1/work_task_attachments?*',async route=>{
      const id=new URL(route.request().url()).searchParams.get('task_id')?.slice(3);if(!id)return route.fallback();
      await new Promise(done=>setTimeout(done,id==='task-0'?800:20));
      await route.fulfill({headers:{'content-range':'0-0/1'},json:[{id:'file-'+id,task_id:id,uploader_user_id:user,original_filename:id+'.txt',storage_path:'fixture',content_type:'text/plain',byte_size:2,created_at:stamp}]});
    });
    await page.locator('[data-work-task-id="task-0"]').click();
    await page.getByRole('button',{name:'Close task details'}).click();
    await page.locator('[data-work-task-id="task-1"]').click();
    await expect(page.getByRole('button',{name:'task-1.txt',exact:true})).toBeVisible();
    await page.waitForTimeout(950);await expect(page.getByRole('button',{name:'task-0.txt',exact:true})).toHaveCount(0);
    await page.getByRole('button',{name:'Close task details'}).click();
    const old=jobs[119].name;jobs[119].name='Other user updated Job';
    await page.locator('[data-work-task-id="task-1"]').click();
    await page.getByRole('combobox',{name:'Task detail Job'}).fill('Other user updated Job');
    await expect(page.getByRole('option',{name:/Other user updated Job/})).toBeVisible();jobs[119].name=old;
  });
  await profile('Inventory options','/inventory',async page=>{
    await page.getByRole('button',{name:/Pending Receivals/}).click();
    await page.getByRole('button',{name:'+ Pending Receival',exact:true}).click();
    const dialog=page.getByRole('dialog',{name:'Pending receival',exact:true});
    // Reservation mode lives in each expected-material line.
    await dialog.locator('select').filter({has:page.locator('option[value="canonical"]')}).first().selectOption('canonical');
    await expect(dialog.locator('option').filter({hasText:'Fixture Job 119'})).toHaveCount(1);
    page.once('dialog',dialog=>void dialog.accept());await dialog.getByRole('button',{name:'Close',exact:true}).click();
    await expect(dialog).toHaveCount(0);
    const old=jobs[119].name;jobs[119].name='Other user updated Job';
    await page.getByRole('button',{name:'+ Pending Receival',exact:true}).click();
    await dialog.locator('select').filter({has:page.locator('option[value="canonical"]')}).first().selectOption('canonical');
    await expect(dialog.locator('option').filter({hasText:'Other user updated Job'})).toHaveCount(1);jobs[119].name=old;
  });
  writeFileSync(output,JSON.stringify({environment:{root,headless:true,apiDelayMs:20,fixtures:{jobs:120,labor:1674,inventory:1000,bids:100,tasks:200,catalog:218},note:'Synthetic client fixture costs, not Production network or DB latency. Unspecified tables/RPCs empty. Auth requests excluded from recorded data calls.'},results},null,2));
}finally{await browser.close();server.close();}
