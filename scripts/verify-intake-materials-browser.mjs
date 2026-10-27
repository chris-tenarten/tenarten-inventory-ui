import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
const origin='http://localhost:3000',output='/private/tmp/tenops-intake-materials-review';mkdirSync(output,{recursive:true});
const browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1440,height:1050}}),errors=[],dialogs=[];
page.on('pageerror',e=>errors.push(e.message));page.on('dialog',async d=>{dialogs.push(d.message());await d.dismiss();});
await page.route('**/*',route=>{const u=new URL(route.request().url());if(['blob:','data:'].includes(u.protocol)||u.origin===origin)return route.continue();return route.abort('blockedbyclient');});
const captures=async()=>await page.evaluate(async()=>await (await fetch('/rest/v1/bid_scope_captures?select=*')).json());
try{
 const local=JSON.parse(readFileSync(output+'/server.json','utf8'));
 // Author through the existing Blend handler, then reference its immutable inputs in Intake.
 const issued=await fetch(origin+'/functions/v1/generate-sample-pdf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'blend-issue',sampleId:local.sample,inputs:{batchCount:'2',plannedQuantity:'400',blendSize:'800'}})});assert(issued.ok,await issued.text());
 await page.goto(origin+'/pre-production');await page.getByRole('button',{name:/Local review customer/}).first().click();const dialog=page.getByRole('dialog',{name:/Intake graduation/});await expect(dialog).toBeVisible();
 const scope=dialog.getByRole('region',{name:'Accepted scope and materials'});
 // Merely opening optional planning must not dirty the Bid or impede ordinary tabs.
 await scope.getByRole('button',{name:'Review scope for acceptance'}).click();
 await expect(scope.getByLabel('Commercial units per Batch',{exact:true})).toBeHidden();
 await dialog.getByRole('tab',{name:'Updates',exact:true}).click();await expect(dialog.getByLabel('Add Update',{exact:true})).toBeVisible();
 await dialog.getByLabel('Add Update',{exact:true}).fill('Ordinary Bid update with no material plan.');await dialog.getByRole('button',{name:'Add Update',exact:true}).click();await expect(dialog.getByText('Ordinary Bid update with no material plan.',{exact:true})).toBeVisible();
 await dialog.getByRole('tab',{name:'Files',exact:true}).click();await expect(dialog.getByText('No Bid Files yet.',{exact:true})).toBeVisible();
 await dialog.getByRole('tab',{name:'Overview',exact:true}).click();assert.deepEqual(dialogs,[]);
 await dialog.getByLabel('Notes',{exact:true}).fill('Commercial activity remains usable without planning fields.');await dialog.getByRole('button',{name:'Save Bid',exact:true}).click();
 await scope.getByRole('button',{name:'Review scope for acceptance'}).click();
 await scope.getByLabel('Accepted issued Proposal revision').selectOption({label:'Q26-1026-1.0'});
 await scope.getByLabel('Finish / scope description').fill('Finish A');await scope.getByLabel('Sample / formulation revision').selectOption({label:'T26-497-A · saved v1'});
 await scope.getByLabel('Commercial quantity',{exact:true}).fill('150');await scope.getByLabel('Commercial unit',{exact:true}).fill('pieces');
 // A missing Production quantity is capturable as advisory, without manufacturing entry.
 await scope.getByRole('button',{name:'Review material requirements'}).click();await expect(scope.getByTestId('production-basis')).toContainText('Unresolved');
 await scope.getByLabel('Acceptance evidence').fill('Commercial scope accepted; Production quantity remains advisory.');await scope.getByRole('button',{name:'Accept immutable scope revision'}).click();await expect(scope.getByText('Accepted revision 1',{exact:true})).toBeVisible();
 const first=(await captures())[0];assert(first.requirements.every(r=>r.quantity===null));assert(first.unresolved.length>0);
 await scope.getByRole('button',{name:'Review new scope revision'}).click();await scope.getByLabel('Production quantity (Batches)',{exact:true}).fill('3');
 // Reference changes clear stale manufacturing inputs but retain commercial scope.
 await scope.getByText('Manufacturing assumptions & overrides (optional)',{exact:true}).click();await scope.getByLabel('Chip quantity override (lb)',{exact:true}).fill('600');
 await scope.getByLabel('Sample / formulation revision').selectOption('');await scope.getByLabel('Sample / formulation revision').selectOption({label:'T26-497-A · saved v1'});
 await expect(scope.getByLabel('Production quantity (Batches)',{exact:true})).toHaveValue('');await expect(scope.getByLabel('Chip quantity override (lb)',{exact:true})).toHaveValue('');await expect(scope.getByLabel('Commercial quantity',{exact:true})).toHaveValue('150');
 await scope.getByText('Manufacturing assumptions & overrides (optional)',{exact:true}).click();
 await scope.getByLabel('Sample / formulation revision').selectOption({label:'T26-497-A · issued Blend'});
 await scope.getByRole('button',{name:'Review material requirements'}).click();await expect(scope.getByTestId('production-basis')).toContainText('Captured issued Blend inputs · 2 Batches');await expect(scope.getByText(/Finish A · Local White/).locator('..')).toHaveText(/240 lb/);
 await scope.getByLabel('Sample / formulation revision').selectOption({label:'T26-497-A · saved v1'});await scope.getByLabel('Production quantity (Batches)',{exact:true}).fill('3');
 await scope.getByRole('button',{name:'Review material requirements'}).click();await expect(scope.getByTestId('production-basis')).toContainText('3 Batches');await expect(scope.getByText(/Finish A · Local White/)).toBeVisible();
 await expect(scope.getByLabel('Thickness override (in)',{exact:true})).toHaveValue('');
 await scope.getByText('Review material identity / conversion / supplier estimate',{exact:true}).first().click();await scope.getByLabel('Exact Inventory / incoming identity').first().selectOption({label:'Local supplier · Local White · #1 · chip · Bags'});
 await scope.getByLabel('lb per stock unit',{exact:true}).first().fill('50');await scope.getByLabel('Identity & conversion evidence').first().fill('Exact material and size checked; confirmed 50 lb supplier bag, local review evidence');await scope.getByLabel('Supplier / package information').first().fill('Local supplier · 50 lb bags');await scope.getByLabel('Estimated lead time (days; blank = unknown)').first().fill('14');
 await scope.getByRole('button',{name:'Review material requirements'}).click();await scope.getByLabel('Acceptance evidence').fill('Reviewed Proposal revision, saved formulation, 150 pieces and three Production Batches. No manufacturing overrides.');await scope.getByRole('button',{name:'Accept immutable scope revision'}).click();await expect(scope.getByText('Accepted revision 2',{exact:true})).toBeVisible();
 const accepted=await captures(),second=accepted.find(r=>r.revision===2);assert.deepEqual(accepted.find(r=>r.revision===1),first);assert.equal(second.requirements.find(r=>r.material==='Local White').quantity,324);assert.equal(second.lines[0].thickness,'');assert.equal(second.lines[0].assumptions,'');
 await scope.getByRole('button',{name:'Refresh read-only availability'}).click();await expect(scope.getByText(/Available 200/)).toBeVisible();await expect(scope.getByText(/reserved elsewhere 500/)).toBeVisible();await expect(scope.getByText(/shortage against on-hand 124/)).toBeVisible();
 await scope.scrollIntoViewIfNeeded();await page.screenshot({path:output+'/desktop-scope-refined.png'});
 await page.setViewportSize({width:390,height:844});assert((await dialog.boundingBox()).width<=390);await scope.scrollIntoViewIfNeeded();await page.screenshot({path:output+'/mobile-scope-refined.png'});
 await dialog.getByLabel('Status',{exact:false}).selectOption('won');await dialog.getByLabel('Deposit Received Date').fill('2026-10-27');await dialog.getByRole('button',{name:'Save Bid',exact:true}).click();await dialog.getByRole('button',{name:'Convert to Production',exact:true}).click();await dialog.getByRole('button',{name:'Confirm conversion',exact:true}).click();await expect(dialog.getByText(/Converted to Production. Original projection/)).toBeVisible();
 const handoffs=await page.evaluate(async()=>await (await fetch('/rest/v1/job_bid_scope_handoffs?select=*')).json());assert.equal(handoffs[0].scope_id,second.id);
 // Ordinary conversion also remains usable with no accepted scope or planning entry.
 await page.setViewportSize({width:1440,height:1050});
 await dialog.getByRole('button',{name:'Close Bid workspace',exact:true}).click();await page.getByRole('button',{name:'New Bid',exact:true}).click();
 const create=page.getByRole('dialog',{name:'New Bid',exact:true});await create.getByLabel('Customer',{exact:true}).fill('Local ordinary review');await create.getByLabel('Project Name',{exact:true}).fill('No material planning');await create.getByRole('button',{name:'Create Bid',exact:true}).click();
 const ordinary=page.getByRole('dialog',{name:/Local ordinary review/});await expect(ordinary).toBeVisible();await ordinary.getByRole('button',{name:'Review scope for acceptance'}).click();
 await ordinary.getByLabel('Status',{exact:false}).selectOption('won');await ordinary.getByLabel('Deposit Received Date').fill('2026-10-27');await ordinary.getByRole('button',{name:'Save Bid',exact:true}).click();await ordinary.getByRole('button',{name:'Convert to Production',exact:true}).click();await ordinary.getByRole('button',{name:'Confirm conversion',exact:true}).click();await expect(ordinary.getByText(/Converted to Production. Original projection/)).toBeVisible();
 await expect(ordinary.getByRole('button',{name:'Review material requirements',exact:true})).toBeHidden();
 // The established Sample library, importer and document action remain available.
 await page.goto(origin+'/samples');await expect(page.getByRole('button',{name:/Historical Sample import/})).toBeVisible();await expect(page.getByText('Local formulation',{exact:false}).first()).toBeVisible();
 await page.goto(origin+`/samples?open=${local.sample}`);await page.getByRole('button',{name:'Generate Sample Work Order',exact:true}).click();await expect.poll(async()=>{const e=await (await fetch(origin+'/review/evidence')).json();return e.writes.some(w=>w.name==='sample-pdf-rendered');}).toBeTruthy();
 assert.deepEqual(errors,[]);assert.deepEqual(dialogs,[]);writeFileSync(output+'/browser-refinement-results.json',JSON.stringify({passed:true,origin,errors,checked:['clean optional scope navigation','ordinary Bid save/Updates/Files without material fields','unresolved advisory acceptance','commercial and Production quantities separate','technical overrides collapsed and reset by reference change','issued Blend plan reused without input reentry','canonical Batch requirements with blank technical inputs','prior capture immutable','read-only availability and shortage','mobile containment','atomic current-scope handoff','ordinary conversion with open untouched optional scope and no planning','Sample library/import entry and working PDF action']},null,2));console.log('Focused Intake refinement workflow passed at exact localhost:3000 origin.');
}catch(e){await page.screenshot({path:output+'/refinement-failure.png'}).catch(()=>{});writeFileSync(output+'/refinement-failure.txt',(await page.locator('body').innerText())+'\n'+e.message);throw e;}finally{await browser.close();}
