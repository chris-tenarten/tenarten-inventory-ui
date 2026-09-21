import { expect, test, type Page } from '@playwright/test';
import { mockManpowerAuth } from '../support/manpower-auth';

const stamp='2026-09-21T00:00:00Z';
const ref=(id:string,display_name:string,is_active=true)=>({id,display_name,is_active,sort_order:1,created_at:stamp,updated_at:stamp});
const section=(page:Page,name:string)=>page.locator('section').filter({has:page.getByRole('checkbox',{name:`Select all entries in ${name}`,exact:true})});
async function fixture(page:Page, mode:'success'|'inactive'|'partial'|'lost'|'refresh-failed'|'limit'='success') {
  const categories=[ref('slabs','Slabs'),ref('stairs','Stairs'),ref('retired','Retired',false)];
  const groups=['A','B'].map(name=>({id:name,display_name:`Group ${name}`,created_at:stamp,updated_at:stamp}));
  const jobs=['A','B'].map(name=>({id:name,name:`Job ${name}`,job_number:`26-${name}`,production_status:'in_production',archived_at:null}));
  const worker=ref('worker','Worker'),task=ref('task','Grind');
  let entries=Array.from({length:mode==='limit'?101:4},(_,index)=>({
    id:`row-${index}`,work_date:index===3?'2026-01-01':'2026-09-21',worker_id:worker.id,task_id:task.id,
    product_category_id:index===0?'stairs':null,job_id:index===3?null:index<2?'A':'B',
    rework_cycle_id:index===1?'rw':null,reporting_group_id:mode==='limit'||index<2?'A':'B',
    unlisted_work_label:index===3?'Temporary label':null,am_hours:index%4+1,pm_hours:0.25,
    notes:`Original note ${index}`,entered_by:'Operator',created_at:stamp,updated_at:stamp,
    worker,task,job:index===3?null:jobs[index<2?0:1],reporting_group:groups[mode==='limit'||index<2?0:1],
    rework_cycle:index===1?{id:'rw',job_id:'A',sequence_number:1,production_status:'in_production'}:null,
  }));
  let recovered=false;
  const before=structuredClone(entries);
  const patches:{ids:string[];body:Record<string,unknown>}[]=[];
  await page.clock.setFixedTime(new Date('2026-09-21T12:00:00'));
  await page.route('**/rest/v1/**',async route=>{
    const req=route.request(),url=new URL(req.url()),table=url.pathname.split('/').at(-1);
    if(table==='manpower_entries' && req.method()==='PATCH') {
      expect(url.searchParams.get('id')).toMatch(/^in\.\(/);
      const ids=url.searchParams.get('id')!.slice(4,-1).split(',');
      const body=req.postDataJSON();patches.push({ids,body});
      if(mode==='inactive') {categories[0].is_active=false;return route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({code:'23514',message:'This Product Category is no longer active.'})});}
      if(mode==='refresh-failed')return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'Service unavailable'})});
      const changed=mode==='partial'?ids.slice(0,1):ids;
      entries=entries.map(row=>changed.includes(row.id)?{...row,...body,updated_at:'2026-09-21T12:01:00Z'}:row);
      if(mode==='lost')return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'Response unavailable'})});
      const returned=entries.filter(row=>changed.includes(row.id));
      return route.fulfill({status:200,contentType:'application/json',headers:{'access-control-expose-headers':'content-range','content-range':`0-${returned.length-1}/${returned.length}`},body:JSON.stringify(returned)});
    }
    if(table==='manpower_entries'&&mode==='refresh-failed'&&patches.length&&!recovered)return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'Reconciliation unavailable'})});
    let rows:unknown[]=table==='manpower_entries'?entries:table==='manpower_product_categories'?categories:table==='manpower_reporting_groups'?groups:table==='jobs'?jobs:table==='manpower_workers'?[worker]:table==='manpower_tasks'?[task]:[];
    if(table==='manpower_entries') {
      let labor=entries;
      for(const date of url.searchParams.getAll('work_date')) {
        if(date.startsWith('gte.'))labor=labor.filter(row=>row.work_date>=date.slice(4));
        if(date.startsWith('lte.'))labor=labor.filter(row=>row.work_date<=date.slice(4));
      }
      if(url.searchParams.get('job_id')==='not.is.null')labor=labor.filter(row=>row.job_id!==null);
      rows=labor.map(row=>({...row,product_category:categories.find(category=>category.id===row.product_category_id)??null}));
    }
    await route.fulfill({status:200,contentType:'application/json',headers:{'access-control-expose-headers':'content-range','content-range':`0-${Math.max(0,rows.length-1)}/${rows.length}`},body:JSON.stringify(rows)});
  });
  await mockManpowerAuth(page);
  return {before,patches,recover:()=>{recovered=true;},current:()=>structuredClone(entries)};
}
const facts=(rows:Record<string,unknown>[])=>rows.map(({product_category_id,updated_at,...row})=>{void product_category_id;void updated_at;return row;});
async function selectGroup(page:Page,name:string) {await page.getByRole('checkbox',{name:`Select all entries in Group ${name}`,exact:true}).check();}
async function apply(page:Page) {const bar=section(page,'Group A');await bar.getByLabel('Bulk Product Category').selectOption('slabs');await bar.getByRole('button',{name:'Apply Category',exact:true}).click();}

test('one historical row: category-only update reconciles Job Product and Task breakdowns',async({page})=>{
  const state=await fixture(page);await page.goto('/manpower-reporting?job=A');
  await page.getByRole('button',{name:'Expand Group A'}).click();
  await section(page,'Group A').getByRole('checkbox',{name:'Select Worker entry on 2026-09-21',exact:true}).nth(1).check();
  await expect(section(page,'Group A').getByLabel('Bulk Product Category').locator('option')).toHaveText(['Product Category','Slabs','Stairs']);
  await page.getByText('Product / Task breakdown',{exact:true}).click();
  await page.getByLabel('Product Category filter',{exact:true}).selectOption('__uncategorized__');
  await apply(page);
  await expect(page.getByRole('status')).toContainText('applied to 1 row');
  expect(state.patches).toEqual([{ids:['row-1'],body:{product_category_id:'slabs'}}]);
  expect(facts(state.current())).toEqual(facts(state.before));
  await expect(page.getByTestId('labor-total')).toHaveText('3.50 h');
  await expect(page.getByTestId('labor-matching')).toHaveText('0.00 h');
  await page.getByLabel('Product Category filter',{exact:true}).selectOption('slabs');
  await expect(page.getByTestId('labor-matching')).toHaveText('2.25 h');
  await expect(page.locator('summary').filter({hasText:'Slabs'})).toContainText('2.25 h');
  await page.getByRole('button',{name:'By Task',exact:true}).click();
  await page.locator('summary').filter({hasText:'Grind'}).click();
  await expect(page.getByRole('listitem').filter({hasText:'Slabs'})).toContainText('2.25 h');
});

test('cross-group / cross-Job assignment is one PATCH, preserves every fact, and reconciles period Snapshot',async({page})=>{
  const state=await fixture(page);await page.goto('/manpower-reporting');
  await selectGroup(page,'A');await selectGroup(page,'B');
  const bar=section(page,'Group A');
  await expect(bar.getByText(/Category applies to all 4 selected rows/)).toBeVisible();
  await page.screenshot({path:'tmp/bulk-category/desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
  await bar.getByLabel('Bulk Product Category').scrollIntoViewIfNeeded();
  expect(await bar.getByRole('button',{name:'Apply Job / Label',exact:true}).evaluate(button=>button.scrollHeight<=button.clientHeight)).toBe(true);
  await bar.screenshot({path:'tmp/bulk-category/narrow.png'});
  await apply(page);
  await expect(page.getByRole('status')).toContainText('applied to 4 rows');
  expect(state.patches).toHaveLength(1);expect(state.patches[0].body).toEqual({product_category_id:'slabs'});
  expect(state.patches[0].ids.sort()).toEqual(state.before.map(row=>row.id).sort());
  expect(facts(state.current())).toEqual(facts(state.before));
  expect(state.current().every(row=>row.product_category_id==='slabs')).toBe(true);
  await page.goto('/?view=snapshot');
  const summary=page.getByRole('region',{name:'Product Category distribution'});
  await expect(summary.getByTestId('categorized-hours')).toHaveText('6.75 h');
  await expect(summary.getByTestId('uncategorized-hours')).toHaveText('0.00 h');
  await expect(summary.locator('summary')).toContainText('100.0%');
  await expect(page.getByText('6.8h across 1 work dates and 2 linked jobs.',{exact:true})).toBeVisible();
});

for(const mode of ['inactive','partial','lost','refresh-failed'] as const)test(`bulk ${mode}: no false complete success; selection retained and values reconciled`,async({page})=>{
  const state=await fixture(page,mode);await page.goto('/manpower-reporting?job=A');
  await selectGroup(page,'A');await apply(page);
  await expect(page.getByRole('alert').filter({hasText:'Category application was not confirmed'})).toBeVisible();
  await expect(page.getByRole('status')).toHaveCount(0);
  if(mode!=='refresh-failed') await expect(page.getByRole('checkbox',{name:'Select all entries in Group A',exact:true})).toBeChecked();
  expect(state.patches).toHaveLength(1);expect(facts(state.current())).toEqual(facts(state.before));
  if(mode==='inactive') {
    expect(state.current()).toEqual(state.before);
    await expect(section(page,'Group A').getByLabel('Bulk Product Category').locator('option[value="slabs"]')).toHaveCount(0);
    await expect(section(page,'Group A').getByRole('button',{name:'Apply Category',exact:true})).toBeDisabled();
  } else if(mode==='refresh-failed') {
    await expect(page.getByTestId('labor-total')).toHaveCount(0);
    await expect(page.getByRole('alert').filter({hasText:'Unable to reconcile labor'})).toBeVisible();
    state.recover();await page.getByRole('button',{name:'Refresh',exact:true}).click();
    await expect(page.getByRole('checkbox',{name:'Select all entries in Group A',exact:true})).toBeChecked();
  } else {
    await page.getByText('Product / Task breakdown',{exact:true}).click();
    await expect(page.locator('summary').filter({hasText:'Slabs'})).toContainText(mode==='lost'?'3.50 h':'1.25 h');
    await expect(page.getByTestId('labor-total')).toHaveText('3.50 h');
  }
});

test('more than 100 selected rows is bounded before sending any PATCH',async({page})=>{
  const state=await fixture(page,'limit');await page.goto('/manpower-reporting');await selectGroup(page,'A');
  const bar=section(page,'Group A');await bar.getByLabel('Bulk Product Category').selectOption('slabs');
  await expect(bar.getByRole('button',{name:'Apply Category',exact:true})).toBeDisabled();
  await expect(bar.getByText(/Maximum 100 per category apply/)).toBeVisible();expect(state.patches).toEqual([]);
});
