import assert from 'node:assert/strict';
import type { ManpowerReference } from '../../src/modules/manpower/types.ts';

const id = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const A=id(1), B=id(2), SLAB=id(11), STAIR=id(12), TASK=id(21);
const ref = (n: number, label: string, active=true): ManpowerReference => ({ id:id(n),display_name:label,sort_order:n,is_active:active,created_at:'2026-01-01T00:00:00Z',updated_at:'2026-01-01T00:00:00Z' });
const categories=[ref(11,'Slabs'),ref(12,'Stairs',false),ref(13,'Base')],tasks=[ref(21,'Finishing')];
const job = (jobId:string) => ({id:jobId,name:jobId===A?'Alpha':'Beta',job_number:jobId===A?'26-001':'26-002',production_status:'complete',archived_at:jobId===B?'2026-10-01T00:00:00Z':null});
type Entry = { id:string;work_date:string;task_id:string;product_category_id:string|null;job_id:string|null;rework_cycle_id:string|null;am_hours:number;pm_hours:number;created_at:string;updated_at:string;job:ReturnType<typeof job>|null;notes?:string };
const entry = (n:number,jobId:string|null,product:string|null,am:number,pm=0,work_date='2026-11-01',rework=false):Entry=>({id:id(n),work_date,task_id:TASK,product_category_id:product,job_id:jobId,rework_cycle_id:rework?id(900):null,am_hours:am,pm_hours:pm,created_at:'2026-11-01T00:00:00Z',updated_at:'2026-11-01T00:00:00Z',job:jobId?job(jobId):null,notes:'PRIVATE_SENTINEL_NOT_SELECTED'});
const entries=[entry(101,A,SLAB,2.13,.27),entry(102,A,SLAB,1.1,0,'2026-11-01',true),entry(103,B,SLAB,4),entry(104,null,SLAB,.5),entry(105,A,STAIR,6),entry(106,B,null,10),entry(107,A,STAIR,20,0,'2026-09-01'),entry(108,A,STAIR,20,0,'2026-11-03')];
type Options={ entries?:Entry[]; jobs?:ReturnType<typeof job>[]; categories?:ManpowerReference[]; tasks?:ManpowerReference[]; fault?:'count'|'duplicate'|'short'|'error'|'stall'; cap?:boolean };
function fixture(options:Options={}) {
  const source={manpower_entries:options.entries??entries,jobs:options.jobs??[...new Map([job(A),job(B),...(options.entries??entries).flatMap(e=>e.job?[e.job]:[])].map(j=>[j.id,j])).values()],manpower_product_categories:options.categories??categories,manpower_tasks:options.tasks??tasks};
  const calls:{table:string;columns:string;from:number;to:number;limit:number|null}[]=[];
  const caller={from(table:string){assert(['manpower_entries','manpower_product_categories','manpower_tasks','jobs'].includes(table));return{select(columns:string){
    assert(!/notes|worker|entered_by|reporting_group/.test(columns),'Projection must not retrieve private entry text or worker identity');
    const filters:{column:string;operation:string;value:unknown}[]=[],orders:{column:string;ascending:boolean}[]=[];
    let from=0,to=499,limit:number|null=null;
    const query={eq(column:string,value:unknown){filters.push({column,operation:'eq',value});return query;},gte(column:string,value:string){filters.push({column,operation:'gte',value});return query;},lte(column:string,value:string){filters.push({column,operation:'lte',value});return query;},or(){return query;},order(column:string,opts?:{ascending?:boolean}){orders.push({column,ascending:opts?.ascending!==false});return query;},range(a:number,b:number){from=a;to=b;return query;},limit(n:number){limit=n;return query;},abortSignal(){return query;},then(resolve:(value:unknown)=>unknown,reject:(reason:unknown)=>unknown){
      calls.push({table,columns,from,to,limit});
      if(options.fault==='stall'&&table==='manpower_entries')return new Promise(()=>{}).then(resolve,reject);
      let rows=(source[table as keyof typeof source] as unknown as Record<string,unknown>[]).filter(row=>filters.every(f=>f.operation==='eq'?row[f.column]===f.value:f.operation==='gte'?String(row[f.column])>=String(f.value):String(row[f.column])<=String(f.value)));
      rows=[...rows].sort((a,b)=>{for(const o of orders){const cmp=String(a[o.column]).localeCompare(String(b[o.column]));if(cmp)return o.ascending?cmp:-cmp;}return 0;});
      let count=rows.length;let data=structuredClone(limit!==null?rows.slice(0,limit):rows.slice(from,to+1));
      if(table==='manpower_entries'&&limit===null&&from>0&&options.fault==='count')count++;
      if(table==='manpower_entries'&&limit===null&&from>0&&options.fault==='duplicate'&&data.length)data[0]=structuredClone(rows[0]);
      if(table==='manpower_entries'&&limit===null&&options.fault==='short')data=data.slice(0,2);
      const result={data,count,error:options.fault==='error'?{message:'PRIVATE_PROVIDER_ERROR'}:null};
      return Promise.resolve(result).then(resolve,reject);
    }};return query;
  }};}};
  return {caller,calls};
}

export { id, A, B, SLAB, STAIR, TASK, ref, categories, tasks, job, entry, entries, fixture };
export type { Entry, Options as LaborFixtureOptions };
