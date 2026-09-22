import type { Page } from '@playwright/test';
import { mockManpowerAuth } from './manpower-auth';

const stamp = '2026-09-21T00:00:00Z';
const reference = (id: string, name: string, order = 1) => ({ id, display_name: name, sort_order: order, is_active: true, created_at: stamp, updated_at: stamp });
export async function fixture(page: Page, role = 'lead') {
  let categories = [reference('slabs','Slabs'), reference('stairs','Stairs',2), {...reference('base','Base',3),is_active:false}];
  const group = { id:'group',display_name:'Shop labor',created_at:stamp,updated_at:stamp };
  const job = { id:'job',name:'Test Job',job_number:'26-001',production_status:'in_production',archived_at:null as string | null };
  const worker=reference('worker','Test Worker');
  let tasks=[reference('wizard','Rough Grind on Wizard'),reference('polisher','Rough Grind on Polisher')];
  let workers=[worker];
  let entries = [
    {id:'a',product_category_id:'slabs',am_hours:2,pm_hours:1,task_id:'wizard',rework_cycle_id:null},
    {id:'b',product_category_id:'stairs',am_hours:4,pm_hours:0,task_id:'polisher',rework_cycle_id:'rework'},
    {id:'c',product_category_id:null,am_hours:1,pm_hours:1,task_id:'wizard',rework_cycle_id:null},
    {id:'d',product_category_id:'base',am_hours:1,pm_hours:0,task_id:'wizard',rework_cycle_id:null},
  ].map(row=>({...row,work_date:'2026-09-17',worker_id:worker.id,job_id:job.id,reporting_group_id:group.id,unlisted_work_label:null,notes:'',entered_by:null,created_at:stamp,updated_at:stamp,worker,task:tasks.find(t=>t.id===row.task_id)!,job,reporting_group:group,rework_cycle:row.rework_cycle_id?{id:'rework',job_id:job.id,sequence_number:1,production_status:'in_production'}:null}));
  entries.push({...entries[0],id:'other-job-row',job_id:'other-job',job:{...job,id:'other-job',name:'Archived Job',archived_at:stamp}});
  let failAfter = -1;
  const writes: {table:string;body:Record<string,unknown>}[]=[];
  await page.route('**/rest/v1/**', async route=>{
    const request=route.request(),url=new URL(request.url()),table=url.pathname.split('/').at(-1)!;
    if(url.pathname.includes('/rpc/')) return route.fulfill({status:200,contentType:'application/json',body:'[]'});
    if(request.method()==='POST'||request.method()==='PATCH') {
      const body=request.postDataJSON();writes.push({table,body});
      if (table === 'manpower_product_categories' && failAfter >= 0 && failAfter-- === 0) return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'Simulated interrupted save'})});
      const id=url.searchParams.get('id')?.replace('eq.','');
      if(table==='manpower_workers' || table==='manpower_tasks') {
        const rows = table==='manpower_workers' ? workers : tasks;
        const row = request.method()==='POST' ? {...reference(`new-${table}`,body.display_name,body.sort_order),...body} : {...rows.find(r=>r.id===id),...body};
        const next = request.method()==='POST' ? [...rows,row] : rows.map(r=>r.id===id?row:r);
        if(table==='manpower_workers') workers=next; else tasks=next;
        return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(row)});
      }
      if(table==='manpower_product_categories') {
        if(request.method()==='POST')categories.push({...reference('added',body.display_name,body.sort_order),is_active:body.is_active});
        else categories=categories.map(c=>c.id===id?{...c,...body,updated_at:new Date().toISOString()}:c);
        return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({id:id??'added'})});
      }
      if(table==='manpower_entries') {
        if(request.method()==='PATCH') entries=entries.map(e=>e.id===id?{...e,...body,updated_at:new Date().toISOString()}:e);
        else entries.push({...entries[0],...body,id:'new',updated_at:new Date().toISOString()});
        return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(entries.find(e=>e.id===(id??'new')))});
      }
    }
    const rows=table==='manpower_entries'?entries:table==='manpower_product_categories'?[...categories].sort((a,b)=>a.sort_order-b.sort_order||a.display_name.localeCompare(b.display_name)):table==='manpower_reporting_groups'?[group]:table==='manpower_workers'?workers:table==='manpower_tasks'?tasks:table==='jobs'?[job]:table==='production_rework_cycles'?[{id:'rework',job_id:'job',sequence_number:1,production_status:'in_production'}]:[];
    await route.fulfill({status:200,contentType:'application/json',headers:{'access-control-expose-headers':'content-range','content-range':`0-${Math.max(0,rows.length-1)}/${rows.length}`},body:JSON.stringify(rows)});
  });
  await mockManpowerAuth(page,role);
  return {writes, categories:()=>categories, entries:()=>entries, interruptAfter:(n:number)=>{failAfter=n;}, addRemote:()=>categories.push(reference('remote','Remote category',9))};
}
