import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {chromium,expect} from '@playwright/test';
import {transform} from 'esbuild';
// Exercise actual Edge entry dispatch, not just the downstream handler.
const source=readFileSync('supabase/functions/generate-sample-pdf/index.ts','utf8');
const block=source.slice(source.indexOf('const allowedOrigins'),source.indexOf('export async function renderSampleWorkOrder'))+source.slice(source.indexOf('if (typeof Deno'));
const js=(await transform(block,{loader:'ts',format:'cjs'})).code;let handler,dispatch=0;
new Function('Deno','createClient','handleProductionBlend',js)({env:{get:k=>k},serve:fn=>handler=fn},()=>({rpc:async()=>({data:true})}),async({body})=>{assert.equal(body.action,'blend-list');dispatch++;return new Response('{}');});
assert.equal((await handler(new Request('http://localhost',{method:'POST',headers:{authorization:'Bearer local'},body:JSON.stringify({action:'blend-list'})}))).status,200);assert.equal(dispatch,1);
const fixture=JSON.parse(readFileSync('/private/tmp/tenops-production-blend-review/server.json'));
const browser=await chromium.launch();try{
 const page=await browser.newPage();page.setDefaultTimeout(20000);await page.goto(fixture.route);
 console.log('Checking Working Sample PDF');const pending=page.waitForResponse(r=>r.url().includes('generate-sample-pdf')&&r.request().postDataJSON()?.action==='working');await page.getByRole('button',{name:'Generate Working Sheet',exact:true}).click();const r=await pending;assert.equal(r.status(),200);writeFileSync('output/pdf/production-blend/unchanged-Working-Sample.pdf',await r.body());await page.getByRole('button',{name:'Close document viewer',exact:true}).click();
 console.log('Checking New Sample');await page.goto(fixture.route.split('?')[0]);await page.getByRole('button',{name:'New Sample',exact:true}).click();await expect(page.getByText('New Sample · not saved yet',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Plan Production Blend',exact:true})).toBeDisabled();
 console.log('Checking non-Admin UI');const member=await browser.newPage();member.setDefaultTimeout(20000);await member.route('**/rest/v1/rpc/get_my_app_user',async route=>{const response=await route.fetch();const data=await response.json();data[0].role='member';await route.fulfill({response,json:data});});await member.goto(fixture.route);await expect(member.getByRole('button',{name:'Generate Working Sheet',exact:true})).toBeVisible();await expect(member.getByRole('button',{name:'Plan Production Blend',exact:true})).toHaveCount(0);
 const denied=await member.request.post(fixture.route.split('/samples')[0]+'/functions/v1/generate-sample-pdf',{headers:{'x-review-role':'member'},data:{action:'blend-list',sampleId:fixture.sampleId}});assert.equal(denied.status(),403);
 console.log('PASS actual Edge route dispatch; real UI Working Sample PDF and New Sample; non-Admin Production action hidden and API denied');
}finally{await browser.close();}
