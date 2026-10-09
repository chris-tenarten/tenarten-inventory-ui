import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
const url=process.env.SAMPLE_REVIEW_URL;if(!url||new URL(url).hostname!=='localhost')throw Error('Disposable localhost URL required');
const browser=await chromium.launch();
try{for(const role of ['admin','developer','member']){
 const context=await browser.newContext({permissions:['clipboard-read','clipboard-write']});const page=await context.newPage();page.setDefaultTimeout(15000);
 if(role!=='admin')await page.route(/\/rpc\/get_my_app_(user|access)$/,async route=>{const response=await route.fetch();const body=await response.json();for(const p of body){p.role=role;}await route.fulfill({response,json:body});});
 await page.route('**/rpc/issue_sample_form',route=>route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({code:'22023',message:'Complete the shop preparation quantities before issuing.',details:'SECRET_PAYLOAD_DO_NOT_COPY'})}));
 await page.goto(url);await expect(page.getByRole('button',{name:'Generate Sample Work Order',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Generate Sample Work Order',exact:true}).click();await expect(page.getByRole('alert').filter({hasText:'Complete the Sample preparation quantities.'})).toBeVisible();
 const details=page.locator('details').filter({has:page.locator('summary').filter({hasText:'Technical Details'})});
 if(role!=='member'){await expect(details).toHaveCount(1);await details.locator('summary').click();await expect(details).toContainText('SAMPLE_PREPARATION_INCOMPLETE');await expect(details).toContainText('issue-snapshot');await expect(details).toContainText('savedCapturedRatio');await expect(details).not.toContainText('SECRET_PAYLOAD');await details.getByRole('button',{name:'Copy technical details'}).click();const copied=await page.evaluate(()=>navigator.clipboard.readText());assert.equal(JSON.parse(copied).code,'SAMPLE_PREPARATION_INCOMPLETE');assert(!copied.includes('SECRET_PAYLOAD'));}
 else await expect(details).toHaveCount(0);
 console.log('PASS',role,'Sample generation error visibility and sanitized copy');await context.close();
 }}finally{await browser.close();}
