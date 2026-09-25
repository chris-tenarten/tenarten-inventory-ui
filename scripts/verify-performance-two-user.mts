// Local production-build profiling only. All Supabase HTTP/WebSocket traffic is mocked.
import assert from 'node:assert/strict';
import { chromium, expect, type BrowserContext } from '@playwright/test';
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import { mockManpowerAuth } from '../tests/support/manpower-auth';
const root=resolve(process.env.PERF_ROOT||'out');
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
const stamp='2026-09-20T12:00:00Z';
const jobs=Array.from({length:120},(_,i)=>({id:`00000000-0000-4000-8000-${String(i).padStart(12,'0')}`,name:`Fixture Job ${i}`,job_number:`26-${String(i).padStart(4,'0')}`,customer:'Fixture Customer',contract_value:null,production_status:'in_production',material_status:'ready',priority:'normal',progress_percent:25,owner_name:'Fixture',planned_start:'2026-09-01',planned_end:'2026-09-30',requested_delivery_date:'2026-10-01',estimated_man_hours:40,estimated_calendar_days:4,remarks:'',archived_at:null,created_at:stamp,updated_at:stamp}));
const ref=(id:string,name:string)=>({id,display_name:name,sort_order:1,is_active:true,created_at:stamp,updated_at:stamp});
const worker=ref('worker','Fixture Worker'),task=ref('task','Rough Grinding'),group=ref('group','Shop'),category=ref('category','Slabs');
const labor=Array.from({length:1674},(_,i)=>({id:`labor-${String(i).padStart(5,'0')}`,work_date:'2026-09-20',worker_id:worker.id,task_id:task.id,job_id:jobs[i%jobs.length].id,reporting_group_id:group.id,product_category_id:i%2?null:category.id,am_hours:2,pm_hours:1,notes:'',entered_by:null,rework_cycle_id:null,created_at:stamp,updated_at:stamp,worker,task,job:jobs[i%jobs.length],reporting_group:group,product_category:category,rework_cycle:null}));
const inventory=Array.from({length:1000},(_,i)=>({id:`inventory-${i}`,vendor:'Fixture vendor',color:`Material ${i}`,size:'#1',category:'marble',quantity:20,unit:'Bag',location:'Shop',pallet_number:`P${i}`,notes:'',earmarked_for_job:false,production_job_id:null,updated_at:stamp}));
const catalog=Array.from({length:218},(_,i)=>({id:`catalog-${String(i).padStart(3,'0')}`,vendor_name:'Klein & Co / KCI',item_name:i===217?'Plex-A-Bond':`Klein aggregate ${i}`,material_type:i===217?'Resin / chemical system':'chip',category:i===217?'resin':'marble',component_type:i===217?'Polyacrylate additive':'',quote_required:i===217,price:i===217?null:40,price_unit:i===217?'quote':'Bag',packaging:i===217?null:'50 LB Bag',is_active:true}));
const phases=Array.from({length:5},(_,i)=>({id:`phase-${i}`,job_id:jobs[0].id,title:`Phase ${i}`,description:'Description',owner:'',category:'',status:'active',start_date:'2026-09-02',end_date:'2026-09-25',timeline_behavior:'overlay',include_in_planning_progress:true,created_at:stamp,updated_at:stamp}));
const items=Array.from({length:16},(_,i)=>({id:`item-${String(i).padStart(5,'0')}`,phase_id:phases[i%5].id,title:`Planning item ${i}`,notes:'Detail only '.repeat(150),owner:'Fixture',is_complete:i%2===0,estimated_hours:2,sort_order:i,created_at:stamp,updated_at:stamp}));
const attachments=Array.from({length:1201},(_,i)=>({id:`attachment-${String(i).padStart(5,'0')}`,job_id:jobs[0].id,file_name:`File ${i}.txt`,storage_path:`fixture/${i}`,mime_type:'text/plain',size_bytes:20,document_type:'other',uploaded_by:'Fixture',created_at:stamp}));
const pending=Array.from({length:76},(_,i)=>({id:`pending-${i}`,vendor:'Fixture vendor',material_name:`Pending ${i}`,size:'#1',category:'marble',quantity_expected:10,quantity_received:0,unit:'Bag',status:'pending',created_at:stamp,eta:'2026-09-30',notes:''}));
const tables:Record<string,unknown[]>={planning_phases:phases,planning_items:items,job_attachments:attachments,pending_receivals:pending,jobs,manpower_entries:labor,manpower_workers:[worker],manpower_tasks:[task],manpower_reporting_groups:[group],manpower_product_categories:[category],inventory_items:inventory,vendor_catalog_v2:catalog};


const contexts:BrowserContext[]=[];
async function openAs(userId:string,path='/manpower-reporting'){
 const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});contexts.push(context);
 const page=await context.newPage();
 await page.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.fulfill({status:200,contentType:'application/json',body:'[]'}));
 await page.routeWebSocket('**/realtime/v1/**',()=>{});
 await page.route('**/rest/v1/**',async route=>{
   const request=route.request(),url=new URL(request.url()),name=url.pathname.split('/').at(-1)!;
   if(request.method()==='PATCH'){
     assert(['manpower_reporting_groups','jobs'].includes(name));const target=name==='jobs'?jobs.find(job=>job.id===url.searchParams.get('id')?.slice(3))!:group;Object.assign(target,request.postDataJSON());
     await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(target)});return;
   }
   let data=(tables[name]??[]) as Record<string,unknown>[];
   if(url.searchParams.get('id')?.startsWith('eq.'))data=data.filter(row=>row.id===url.searchParams.get('id')!.slice(3));
   const count=data.length,offset=Number(url.searchParams.get('offset')||0),limit=Number(url.searchParams.get('limit')||1000);
   data=data.slice(offset,offset+limit);
   const projection=url.searchParams.get('select')||'';
   if(name==='manpower_entries')data=data.map(row=>{const next={...row};for(const [field,token] of [['worker','worker:'],['task','task:'],['reporting_group','reporting_group:']])if(!projection.includes(token))delete next[field];return next;});
   await route.fulfill({status:200,contentType:'application/json',headers:{'content-range':`${offset}-${offset+data.length-1}/${count}`,'access-control-expose-headers':'content-range'},body:JSON.stringify(request.headers().accept?.includes('vnd.pgrst.object')?data[0]??null:data)});
 });
 await mockManpowerAuth(page,'admin',userId);
 await page.goto(base+path);
 if(path==='/manpower-reporting')await expect(page.getByText('Shop',{exact:true}).first()).toBeVisible();
 await expect(page.locator('[data-welcome-hero]')).toHaveCount(0,{timeout:12000});
 return page;
}
try{
 if(process.env.PERF_ONLY!=='options'){
 const a=await openAs('00000000-0000-0000-0000-000000000004');
 const b=await openAs('00000000-0000-0000-0000-000000000005');
 await a.getByRole('button',{name:'Edit group name',exact:true}).click();
 await a.getByRole('textbox',{name:'Reporting group name',exact:true}).fill('Renamed by first user');
 await a.getByRole('textbox',{name:'Reporting group name',exact:true}).press('Enter');
 await expect(a.getByText('Renamed by first user',{exact:true})).toBeVisible();
 await b.getByRole('button',{name:'Refresh',exact:true}).click();
 await expect(b.getByText('Renamed by first user',{exact:true})).toBeVisible();
 await expect(b.getByRole('checkbox',{name:'Select all entries in Renamed by first user',exact:true})).toBeVisible();
 await b.getByRole('button',{name:/Expand.*Renamed/}).click();
 await expect(b.getByRole('checkbox',{name:'Select Fixture Worker entry on 2026-09-20',exact:true})).toHaveCount(1674);
 await expect(b.locator('option:checked').filter({hasText:/^Rough Grinding$/})).toHaveCount(1674);
 assert.equal(labor.length,1674);
 console.log('PASS: two synthetic authenticated users; A renames group, B refreshes and opens full historical entries with fresh group/worker/task labels. No shared response cache.');
 }
 if(process.env.PERF_ONLY==='options'){
  const a=await openAs('00000000-0000-0000-0000-000000000004','/production');
  const b=await openAs('00000000-0000-0000-0000-000000000005','/inventory');
  await b.getByRole('button',{name:/Pending Receivals/}).click();
  const openChoices=async()=>{
    await b.getByRole('button',{name:'+ Pending Receival',exact:true}).click();
    const dialog=b.getByRole('dialog',{name:'Pending receival',exact:true});
    await dialog.locator('select').filter({has:b.locator('option[value="canonical"]')}).first().selectOption('canonical');
    return dialog;
  };
  const first=await openChoices();await expect(first.locator('option').filter({hasText:'Fixture Job 0 —'})).toHaveCount(1);
  b.once('dialog',dialog=>void dialog.accept());await first.getByRole('button',{name:'Close',exact:true}).click();await expect(first).toHaveCount(0);
  await a.getByRole('button',{name:'Open Fixture Job 0',exact:true}).filter({visible:true}).first().focus();await a.keyboard.press('Enter');
  await a.getByRole('button',{name:'Edit project name',exact:true}).click();
  await a.locator('#job-inspector-title').fill('Job renamed by user A');
  await a.locator('#job-inspector-title').press('Enter');
  await a.getByRole('button',{name:'Save changes',exact:true}).click();
  await expect.poll(()=>jobs[0].name).toBe('Job renamed by user A');
  const next=await openChoices();await expect(next.locator('option').filter({hasText:'Job renamed by user A'})).toHaveCount(1);
  await b.goto(base+'/my-work');await b.getByRole('textbox',{name:'Task title',exact:true}).focus();
  await b.getByRole('combobox',{name:'Composer Job',exact:true}).fill('Job renamed by user A');
  await expect(b.getByRole('option',{name:/Job renamed by user A/})).toBeVisible();
  console.log('PASS: two synthetic authenticated users; A edits a Job through Production UI; B reopens Inventory choices and My Work composer with the authoritative new label.');
 }
}finally{for(const context of contexts)await context.close();await browser.close();server.close();}
