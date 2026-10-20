import {wave4Fixture} from './wave4-fixture.mjs';
import {wave2Response} from './wave2-fixture.mjs';
import {uuid,stamp} from '../retrieval-review-fixture.mjs';
export {uuid};
export function progressiveManpowerFixture(){
 const tables=wave4Fixture(),ref=(i,name,date)=>({id:uuid(51000+i),display_name:name,created_at:date+'T12:00:00Z',updated_at:stamp});
 const groups=Array.from({length:1013},(_,i)=>{const date=i<8?'2026-10-14':new Date(Date.UTC(2026,7,1-(i-8))).toISOString().slice(0,10),[y,m,d]=date.split('-');return ref(i,`${m}/${d}/${y} Group ${i}`,date);});
 let next=100000;const rows=[],add=(group,date,count,archived=false)=>{for(let n=0;n<count;n++){
  const job=tables.jobs[(archived?20:0)+n%20];rows.push({id:uuid(next++),work_date:date,worker_id:tables.manpower_workers[0].id,task_id:tables.manpower_tasks[0].id,product_category_id:n%2?null:tables.manpower_product_categories[0].id,job_id:job.id,rework_cycle_id:null,reporting_group_id:group?.id??null,unlisted_work_label:null,am_hours:2.25,pm_hours:1.5,notes:group?`Group ${Number(group.id.slice(-12))-51000} record ${n}`:'Ungrouped historical entry',entered_by:null,created_at:stamp,updated_at:stamp,job,rework_cycle:null,worker:tables.manpower_workers[0],task:tables.manpower_tasks[0],reporting_group:group});
 }};
 for(let i=0;i<8;i++)add(groups[i],'2026-10-14',i===0?151:150);
 add(groups[0],'2024-01-01',6,true); // A recent group crosses dates and archived Jobs.
 for(let i=8;i<groups.length;i++)add(groups[i],groups[i].created_at.slice(0,10),i===8?1501:10,true);
 add(null,'2023-01-01',140,true);
 rows.find(row=>row.reporting_group_id===groups[8].id).notes='Historical edit target';
 return {...tables,manpower_reporting_groups:groups,manpower_entries:rows};
}
export function progressiveResponse(url,tables,cap=137){
 const copy={...tables};if(url.pathname.endsWith('/manpower_entries')){
  let rows=tables.manpower_entries??[];
  for(const [key,value]of url.searchParams)if(value.startsWith('gt.'))rows=rows.filter(row=>row[key]>value.slice(3));
  copy.manpower_entries=rows;
 }
 return wave2Response(url,copy,cap);
}
