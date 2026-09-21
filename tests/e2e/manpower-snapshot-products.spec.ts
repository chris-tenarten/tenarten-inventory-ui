import { expect, test, type Page } from '@playwright/test';
import { mockManpowerAuth } from '../support/manpower-auth';

async function snapshotFixture(page: Page, mode: 'mixed' | 'legacy' | 'empty' | 'failed' = 'mixed') {
  await page.clock.setFixedTime(new Date('2026-09-21T12:00:00'));
  const rows = Array.from({length:1002}, (_, index) => ({
    id: String(index).padStart(5,'0'), job_id:null, rework_cycle_id: index === 1000 ? 'rw' : null,
    work_date: index === 1001 ? '2026-08-23' : '2026-09-21',
    am_hours: index < 1000 ? 1 : 2, pm_hours:0,
    product_category_id: index < 1000 || mode === 'legacy' ? null : 'slabs',
    product_category: index < 1000 || mode === 'legacy' ? null : {id:'slabs',display_name:'Slabs',is_active:false},
    task_id: index === 1001 ? 'task-b' : 'task-a', task:{display_name:'Rough Grinding'},
    worker:{display_name:'Worker'}, rework_cycle:null,
  }));
  // Both dates immediately outside the inclusive selected period must be excluded.
  rows.push({...rows[0],id:'outside-old',work_date:'2026-08-22',am_hours:9000});
  rows.push({...rows[0],id:'outside-new',work_date:'2026-09-22',am_hours:9000});
  const periodOffsets:number[]=[];
  const writes:string[]=[];
  await page.route('**/rest/v1/**', async route => {
    const request=route.request(), url=new URL(request.url());
    const readRpc = ['get_my_account_preferences','list_my_account_notification_history','list_my_unseen_job_update_jobs'].includes(url.pathname.split('/').at(-1)!);
    if(!['GET','HEAD'].includes(request.method()) && !readRpc) writes.push(request.method()+' '+url.pathname);
    let result:unknown[]=[];
    let count=0, offset=0;
    if(url.pathname.endsWith('/manpower_entries')) {
      let filtered=mode === 'empty' ? [] : rows;
      const dates=url.searchParams.getAll('work_date');
      for(const date of dates) {
        if(date.startsWith('gte.')) filtered=filtered.filter(row=>row.work_date>=date.slice(4));
        if(date.startsWith('lte.')) filtered=filtered.filter(row=>row.work_date<=date.slice(4));
      }
      if(url.searchParams.get('job_id')==='not.is.null') filtered=filtered.filter(row=>row.job_id!==null);
      offset=Number(url.searchParams.get('offset')??0);
      if(dates.length) {
        expect(dates).toEqual(['gte.2026-08-23','lte.2026-09-21']);
        expect(url.searchParams.get('select')).toContain('product_category_id');
        periodOffsets.push(offset);
        if(mode==='failed' && offset===500) return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'Second labor page unavailable'})});
      }
      count=filtered.length;
      result=filtered.slice(offset,offset+Number(url.searchParams.get('limit')??500));
    }
    await route.fulfill({status:200,contentType:'application/json',headers:{'access-control-expose-headers':'content-range','content-range':`${offset}-${offset+Math.max(0,result.length-1)}/${count}`},body:JSON.stringify(result)});
  });
  await mockManpowerAuth(page);
  return {periodOffsets,writes};
}

test('Snapshot uses complete selected-period labor, separates legacy hours, and drills by stable Task ID', async ({page})=>{
  const state=await snapshotFixture(page);
  await page.goto('/?view=snapshot');
  const summary=page.getByRole('region',{name:'Product Category distribution'});
  await expect(summary.getByTestId('categorized-hours')).toHaveText('4.00 h');
  await expect(summary.getByTestId('uncategorized-hours')).toHaveText('1000.00 h');
  await expect(summary.locator('summary')).toContainText('Slabs · Inactive');
  await expect(summary.locator('summary')).toContainText('100.0%');
  await summary.locator('summary').click();
  await expect(summary.getByRole('listitem')).toHaveCount(2);
  await expect(summary.getByRole('listitem').first()).toHaveText('Rough Grinding2.00 h');
  expect(state.periodOffsets).toEqual([0,500,1000]);
  expect(state.writes).toEqual([]);
  await summary.scrollIntoViewIfNeeded();
  await page.screenshot({path:'tmp/manpower-snapshot-products-desktop.png'});
  await page.setViewportSize({width:390,height:844});
  await summary.scrollIntoViewIfNeeded();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
  await page.screenshot({path:'tmp/manpower-snapshot-products-narrow.png'});
});

for(const mode of ['legacy','empty'] as const) test(`Snapshot ${mode} labor has an honest empty distribution`,async({page})=>{
  await snapshotFixture(page,mode);await page.goto('/?view=snapshot');
  const summary=page.getByRole('region',{name:'Product Category distribution'});
  await expect(summary.getByTestId('categorized-hours')).toHaveText('0.00 h');
  await expect(summary.getByTestId('uncategorized-hours')).toHaveText(mode==='legacy'?'1004.00 h':'0.00 h');
  await expect(summary.getByText('No categorized labor in this scope.')).toBeVisible();
  await expect(summary).not.toContainText('NaN');
});

test('Snapshot failed later page publishes no partial Product summary',async({page})=>{
  await snapshotFixture(page,'failed');await page.goto('/?view=snapshot');
  await expect(page.getByText('Second labor page unavailable', {exact:false})).toBeVisible();
  await expect(page.getByTestId('categorized-hours')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Retry',exact:true})).toBeVisible();
});
