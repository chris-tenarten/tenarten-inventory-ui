import { chromium, expect } from '@playwright/test';
import { writeFileSync } from 'node:fs';
const origin=process.env.PERFORMANCE_REVIEW_ORIGIN||'http://localhost:3355', baseline=process.argv.includes('--baseline');
const browser=await chromium.launch({headless:true});
const context=await browser.newContext();const page=await context.newPage();
await page.clock.setFixedTime(new Date('2026-10-20T12:00:00Z'));
await context.routeWebSocket('**/realtime/v1/**',()=>{});
const state=async()=>(await context.request.get(origin+'/__review/state')).json();
const metrics=s=>{const calls=s.calls.filter(c=>c.name==='manpower_entries');return {requests:calls.length,bytes:calls.reduce((n,c)=>n+(c.bytes||0),0),rows:calls.reduce((n,c)=>n+(c.rows||0),0)};};
try {
 await context.request.post(origin+'/__review/control',{data:{reset:true}});
 const start=performance.now();await page.goto(origin+'/manpower-reporting');await expect(page.getByTestId('analytics-total')).toHaveText('4,503.75 h');
 const initial={ms:Math.round(performance.now()-start),...metrics(await state()),recentEntriesAutomatic:!baseline};
 if(!baseline)await expect(page.getByTestId('reporting-records')).toHaveAttribute('data-count','1201');
 initial.recentReadyMs=baseline?null:Math.round(performance.now()-start);
 const p=performance.now();await page.getByRole('button',{name:'90 Days',exact:true}).click();await expect(page.getByTestId('analytics-total')).toHaveText('6,753.75 h');
 if(!baseline)await expect(page.getByTestId('reporting-records')).toHaveAttribute('data-count','1801');
 const periodSwitch={ms:Math.round(performance.now()-p),...metrics(await state())};
 const h=performance.now();await page.getByRole('button',{name:baseline?'Load reporting history':'Load complete history',exact:true}).click();
 await expect(page.getByRole('button',{name:'New Group',exact:true})).toBeEnabled({timeout:30000});
 const completeHistory={ms:Math.round(performance.now()-h),...metrics(await state())};
 const result={synthetic:true,origin,baseline,initial,periodSwitch,completeHistory,note:'Period and history metrics are cumulative; recent readiness is manual in baseline.'};
 writeFileSync(`docs/project-memory/evidence/2026-10-20-manpower-${baseline?'baseline':'refinement'}-measurement.json`,JSON.stringify(result,null,2));console.log(result);
}finally{await context.request.post(origin+'/__review/control',{data:{reset:true}});await browser.close();}
