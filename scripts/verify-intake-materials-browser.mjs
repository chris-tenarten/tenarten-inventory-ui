import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {PDFDocument} from 'pdf-lib';
const origin='http://localhost:3000',output='/private/tmp/tenops-intake-materials-review';mkdirSync(output,{recursive:true});
const local=JSON.parse(readFileSync(output+'/server.json','utf8'));
async function post(path,body){const response=await fetch(origin+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await response.json();assert(response.ok,JSON.stringify(data));return data;}
const rpc=(name,body={})=>post('/rest/v1/rpc/'+name,body);
const action=body=>post('/functions/v1/generate-sample-pdf',body);
if(process.argv.includes('--bid-preparation')){
 const {verifyBidPreparation}=await import('./support/bid-preparation-browser.mjs');
 await verifyBidPreparation({origin,output,local,rpc});
 process.exit(0);
}
const captures=async()=>await (await fetch(origin+'/rest/v1/bid_scope_captures?select=*')).json();
const sources=await rpc('list_bid_scope_sources',{p_bid_id:local.bid}),version=sources.find(source=>source.kind==='version');
const linked=await (await fetch(origin+'/rest/v1/bid_proposal_relationships?bid_id=eq.'+local.bid)).json();
const retained=(await captures())[0]||await action({action:'scope-accept',bidId:local.bid,proposalId:linked[0].proposal_id,expectedScopeId:null,evidence:'Earlier candidate snapshot retained; no Intake designation workflow.',lines:[{planningBasis:'reference',productionBatches:'3',label:'Finish A',sourceKind:'version',sourceId:version.id,quantity:'150',unit:'pieces',yieldPerBatch:'',batchRounding:'',plannedQuantity:'',blendSize:'',thickness:'',overage:'',assumptions:'Reviewed earlier plan',consumables:[],mappings:{'0:aggregate:0':{vendor:'Local supplier',color:'Local White',size:'#1',category:'chip',unit:'Bags',factor:'50',evidence:'Reviewed exact 50 lb package',leadTimeDays:'14',supplier:'Local supplier'}}}]});
if(!(await rpc('list_bids')).some(bid=>bid.project_name==='Alpha fixture'))await rpc('create_bid',{p_customer:'Acme synthetic customer',p_project_name:'Alpha fixture'});
const browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1440,height:1050}}),errors=[],dialogs=[];
let acceptDialog=false,failUpdate=false,delayUpdate=false,denyProposals=false,failPlanning=false,emptyPlanning=false,failProduction=false,slowPath='';
page.on('pageerror',error=>errors.push(error.message));page.on('dialog',async dialog=>{dialogs.push(dialog.message());if(acceptDialog)await dialog.accept();else await dialog.dismiss();});
await page.route('**/*',async route=>{
 const request=route.request(),url=new URL(request.url());
 if(['blob:','data:'].includes(url.protocol))return route.continue();
 if(url.origin!==origin)return route.abort('blockedbyclient');
 const fail=message=>route.fulfill({status:500,contentType:'application/json',body:JSON.stringify({message})});
 if(url.pathname.endsWith('/rpc/intake_workflow_summaries'))return fail('Optional scope summary unavailable');
 if(denyProposals&&url.pathname.endsWith('/rpc/has_proposal_access'))return route.fulfill({status:200,contentType:'application/json',body:'false'});
 if(url.pathname.endsWith('/rpc/create_bid_update')){
  if(failUpdate){failUpdate=false;return fail('Synthetic Update failure');}
  if(delayUpdate)await new Promise(resolve=>setTimeout(resolve,700));
 }
 if(url.pathname==='/rest/v1/bids'&&url.searchParams.get('select')?.startsWith('id,updated_at')){
  if(failPlanning)return fail('Synthetic planning failure');
  if(emptyPlanning)return route.fulfill({status:200,contentType:'application/json',headers:{'Content-Range':'0-0/0'},body:'[]'});
 }
 if(failProduction&&url.pathname==='/rest/v1/jobs')return fail('Synthetic Production planning failure');
 if(slowPath&&decodeURIComponent(url.pathname).includes(slowPath))await new Promise(resolve=>setTimeout(resolve,700));
 return route.continue();
});
async function openSeed(){await page.goto(origin+'/pre-production');await page.getByRole('tab',{name:'All',exact:true}).click();await page.getByRole('button',{name:/Local review customer/}).first().click();return page.getByRole('dialog',{name:/Intake graduation/});}
try{
 await page.goto(origin+'/pre-production');
 await expect(page.getByRole('button',{name:/Local review customer/}).first()).toBeVisible();
 await expect(page.getByRole('dialog',{name:'TenOps startup presentation'})).toBeHidden({timeout:20000});
 await page.getByLabel('Search Bids').fill('no matching synthetic record');await expect(page.getByText('No Bids match your search.')).toBeVisible();
 await page.getByLabel('Search Bids').fill('Alpha fixture');await expect(page.getByRole('button',{name:/Acme synthetic customer/})).toBeVisible();await expect(page.getByRole('button',{name:/Local review customer/})).toHaveCount(0);await page.getByLabel('Search Bids').fill('');
 await page.getByLabel('Sort Bids').selectOption('customer');await expect(page.getByRole('button',{name:/Acme synthetic customer/})).toBeVisible();await page.getByRole('button',{name:'Refresh Bids',exact:true}).click();
 let dialog=await openSeed();const related=dialog.getByRole('region',{name:'Related Records',exact:true});
 await expect(related.getByText('Accepted revision',{exact:true})).toBeVisible();await expect(related.locator('input,select,textarea')).toHaveCount(0);await expect(dialog.getByText(/governing|immutable scope|material requirements|EARLY ACCESS/i)).toHaveCount(0);
 await dialog.getByLabel(/^Notes/).fill('Unsaved CRM note '+Date.now());
 await dialog.getByRole('button',{name:'Close Bid workspace'}).click();await expect(dialog).toBeVisible();assert(dialogs.some(text=>text.includes('Discard unsaved')));
 await dialog.getByRole('button',{name:'Save Bid',exact:true}).click();await expect(dialog.getByRole('status').filter({hasText:'Bid saved.'})).toBeVisible();
 await dialog.getByRole('tab',{name:'Updates',exact:true}).click();
 failUpdate=true;await dialog.getByRole('textbox',{name:'Add Update',exact:true}).fill('Follow-up with the local customer');await dialog.getByRole('button',{name:'Add Update',exact:true}).click();await expect(dialog.getByRole('alert')).toContainText('Unable to add Update.');await expect(dialog.getByRole('textbox',{name:'Add Update',exact:true})).toHaveValue('Follow-up with the local customer');
 delayUpdate=true;await dialog.getByRole('button',{name:'Add Update',exact:true}).click();await expect(dialog.getByRole('textbox',{name:'Add Update',exact:true})).toBeDisabled();await expect(dialog.getByText('Follow-up with the local customer',{exact:true})).toBeVisible();delayUpdate=false;
 await dialog.getByRole('textbox',{name:'Add Update',exact:true}).fill('Unfinished update retained across tabs');await dialog.getByRole('tab',{name:'Files',exact:true}).click();await dialog.getByRole('tab',{name:'Updates',exact:true}).click();await expect(dialog.getByRole('textbox',{name:'Add Update',exact:true})).toHaveValue('Unfinished update retained across tabs');await dialog.getByRole('textbox',{name:'Add Update',exact:true}).fill('');
 await dialog.getByRole('tab',{name:'Files',exact:true}).click();
 const pdf=await PDFDocument.create();pdf.addPage().drawText('Local synthetic Bid file');const bytes=Buffer.from(await pdf.save());
 await dialog.getByLabel('Add Files',{exact:true}).setInputFiles([{name:'Local-A.pdf',mimeType:'application/pdf',buffer:bytes},{name:'Local-B.pdf',mimeType:'application/pdf',buffer:bytes}]);await expect(dialog.getByText('Local-A.pdf',{exact:true})).toBeVisible();await expect(dialog.getByText('Local-B.pdf',{exact:true})).toBeVisible();
 const files=await rpc('list_bid_files',{p_bid_id:local.bid});slowPath=files.find(file=>file.original_filename==='Local-A.pdf').storage_path;
 await dialog.getByRole('button',{name:/Local-A.pdf/}).first().click();await dialog.getByRole('button',{name:/Local-B.pdf/}).first().click();await expect(dialog.getByRole('region',{name:/Local-B.pdf/})).toBeVisible();await page.waitForTimeout(800);await expect(dialog.getByRole('region',{name:/Local-A.pdf/})).toHaveCount(0);slowPath='';
 await dialog.getByRole('button',{name:'Close attachment preview'}).click();await dialog.getByRole('button',{name:/Local-A.pdf/}).first().click();await expect(dialog.getByRole('region',{name:/Local-A.pdf/})).toBeVisible();
 await dialog.getByRole('button',{name:'Open Full Screen'}).click();await expect(page.getByRole('button',{name:'Close document viewer'})).toBeVisible();await page.getByRole('button',{name:'Close document viewer'}).click();
 acceptDialog=true;await dialog.getByRole('button',{name:'Remove Local-A.pdf',exact:true}).click();acceptDialog=false;await expect(dialog.getByText('Local-A.pdf',{exact:true})).toHaveCount(0);
 await dialog.getByRole('tab',{name:'Overview',exact:true}).click();await expect(dialog.getByText('added a Bid File',{exact:false}).first()).toBeVisible();await expect(dialog.getByText('removed a Bid File',{exact:false})).toBeVisible();
 await dialog.getByRole('tab',{name:'Overview',exact:true}).click();const tools=dialog.getByRole('region',{name:'Bid Preparation'});
 await expect(tools.getByRole('link',{name:/Create Proposal/})).toHaveAttribute('href','/proposals?bid='+local.bid);await expect(tools.getByRole('link',{name:/Open related Proposals/})).toHaveAttribute('href','/proposals?bid='+local.bid);await expect(tools.getByRole('link',{name:/Open related Samples/})).toHaveAttribute('href','/samples?bid='+local.bid);
 await tools.getByRole('link',{name:/Create Proposal/}).click();await expect(page.getByRole('heading',{name:'Proposal Generator',exact:true,level:1})).toBeVisible();await page.getByRole('button',{name:'Create Proposal',exact:true}).click();await expect(page.getByRole('button',{name:'Save Draft',exact:true})).toBeVisible();
 const proposalLinks=await (await fetch(origin+'/rest/v1/bid_proposal_relationships?bid_id=eq.'+local.bid)).json();assert.equal(proposalLinks.length,2);
 dialog=await openSeed();await dialog.getByRole('tab',{name:'Overview',exact:true}).click();await dialog.getByRole('link',{name:/Create Sample/}).click();await expect(page.getByLabel('Project Name',{exact:true})).toHaveValue('Intake graduation — two finishes');await expect(page.getByLabel('Customer',{exact:true})).toHaveValue('Local review customer');await page.getByRole('combobox',{name:'Resin System',exact:true}).selectOption({label:'MTT — 5:1'});await page.getByRole('button',{name:'Save Sample',exact:true}).click();await expect(page.getByRole('button',{name:'Save Changes',exact:true})).toBeVisible();
 const samples=await rpc('list_samples',{p_bid_id:local.bid});assert(samples.some(row=>row.sample.bid_id===local.bid&&row.sample.project_name==='Intake graduation — two finishes'));
 dialog=await openSeed();await expect(dialog.getByRole('region',{name:'Related Records'}).getByText('Draft',{exact:false}).first()).toBeVisible();await expect(dialog.getByRole('region',{name:'Related Records'}).getByText('Working',{exact:false}).first()).toBeVisible();
 await dialog.getByRole('button',{name:'Close Bid workspace'}).click();failPlanning=true;await page.getByRole('button',{name:'Planning',exact:true}).click();await expect(page.getByRole('alert').filter({hasText:'Projected windows could not be loaded'})).toBeVisible();await expect(page.getByText('Loading projected windows…',{exact:true})).toHaveCount(0);
 failPlanning=false;await page.getByRole('button',{name:'Refresh planning',exact:true}).click();await expect(page.locator('[data-intake-planning-row]').first()).toBeVisible();await expect(page.getByRole('alert').filter({hasText:/could not be loaded/})).toHaveCount(0);
 await page.getByRole('button',{name:'Fit',exact:true}).click();await page.getByRole('button',{name:'Zoom in',exact:true}).click();await page.getByRole('button',{name:'Today',exact:true}).click();
 failProduction=true;await page.getByRole('button',{name:'Production',exact:true}).click();await expect(page.getByRole('alert').filter({hasText:'Production planning could not be loaded'})).toBeVisible();failProduction=false;await page.getByRole('button',{name:'Refresh planning',exact:true}).click();await expect(page.getByText('No Production Jobs to show in planning.',{exact:true})).toBeVisible();await expect(page.getByRole('alert').filter({hasText:/could not be loaded/})).toHaveCount(0);
 // Browser Back, safe-area chrome and mobile creation use the same detail conventions as Production.
 await page.setViewportSize({width:390,height:844});dialog=await openSeed();await expect(dialog.getByRole('button',{name:'Close Bid workspace'})).toHaveText('BackClose');assert((await dialog.boundingBox()).width<=390);
 await dialog.getByLabel(/^Notes/).fill('Mobile unsaved note');await page.goBack();await expect(dialog).toBeVisible();await expect(dialog.getByLabel(/^Notes/)).toHaveValue('Mobile unsaved note');
 await dialog.getByRole('button',{name:'Save Bid',exact:true}).click();await dialog.getByRole('tab',{name:'Overview',exact:true}).click();await expect(dialog.getByRole('region',{name:'Bid Preparation'}).getByRole('link',{name:/Create Proposal/})).toBeVisible();await dialog.screenshot({path:output+'/reconciled-mobile-preparation.png'});await dialog.getByRole('button',{name:'Close Bid workspace'}).click();await expect(dialog).toHaveCount(0);
 await page.getByRole('button',{name:'New Bid',exact:true}).click();const create=page.getByRole('dialog',{name:'New Bid',exact:true});await create.getByLabel('Customer',{exact:true}).fill('Mobile synthetic customer');await create.getByLabel('Project Name',{exact:true}).fill('Ordinary Bid without documents');await create.getByRole('button',{name:'Create Bid',exact:true}).click();dialog=page.getByRole('dialog',{name:/Ordinary Bid without documents/});await expect(dialog).toBeVisible();
 await dialog.getByLabel('Status',{exact:false}).selectOption('won');await dialog.getByLabel('Deposit Received Date').fill('2026-10-27');await dialog.getByRole('button',{name:'Save Bid',exact:true}).click();await dialog.getByRole('button',{name:'Convert to Production',exact:true}).click();await dialog.getByRole('button',{name:'Confirm conversion',exact:true}).click();await expect(dialog.getByText(/Converted to Production. Original projection/)).toBeVisible();await expect(dialog.getByRole('region',{name:'Related Records'}).getByRole('button',{name:/Open Production Job/})).toBeVisible();
 await dialog.getByRole('button',{name:'Close Bid workspace'}).click();await expect(dialog).toHaveCount(0);
 await page.setViewportSize({width:1440,height:1050});dialog=await openSeed();await expect(dialog.getByText('Loading related records…',{exact:true})).toHaveCount(0);await dialog.screenshot({path:output+'/reconciled-desktop-inspector.png'});
 assert.deepEqual((await captures()).find(capture=>capture.id===retained.id),retained);assert.equal((await captures()).length,1);
 const assessment=await action({action:'scope-assess',scopeId:retained.id});assert.equal(assessment.assessment[0].shortage,124);
 const record=await rpc('list_bids');const bid=record.find(bid=>bid.id===local.bid);await dialog.getByLabel('Status',{exact:false}).selectOption('won');await dialog.getByLabel('Deposit Received Date').fill('2026-10-27');await dialog.getByRole('button',{name:'Save Bid',exact:true}).click();await dialog.getByRole('button',{name:'Convert to Production',exact:true}).click();await dialog.getByRole('button',{name:'Confirm conversion',exact:true}).click();await expect(dialog.getByText(/Converted to Production. Original projection/)).toBeVisible();assert.equal(bid.project_name,'Intake graduation — two finishes');
 const handoffs=await (await fetch(origin+'/rest/v1/job_bid_scope_handoffs?select=*')).json();assert(handoffs.some(row=>row.scope_id===retained.id));
 denyProposals=true;dialog=await openSeed();await dialog.getByRole('tab',{name:'Overview',exact:true}).click();await expect(dialog.getByRole('region',{name:'Bid Preparation'}).getByRole('link',{name:/Create Proposal/})).toHaveCount(0);await expect(dialog.getByRole('region',{name:'Bid Preparation'}).getByRole('link',{name:/Create Sample/})).toBeVisible();denyProposals=false;
 await page.goto(origin+'/samples');await expect(page.getByRole('button',{name:/Historical Sample import/})).toBeVisible();await page.goto(origin+'/samples?open='+local.sample);await page.getByRole('button',{name:'Generate Sample Work Order',exact:true}).click();await expect.poll(async()=>{const evidence=await (await fetch(origin+'/review/evidence')).json();return evidence.writes.some(write=>write.name==='sample-pdf-rendered');}).toBeTruthy();
 assert.deepEqual(errors,[]);writeFileSync(output+'/browser-reconciliation-results.json',JSON.stringify({passed:true,origin,errors,checked:['optional metadata cannot block CRM','queue search/sort/refresh','readonly records and no governing/approval/editor workflow','Bid save and unsaved protections','Update failure/retry and posting protection','file upload/preview/race/fullscreen/removal and lifecycle refresh','Overview preparation launches established generators','actual Bid-context Proposal creation','actual Sample creation with Bid/project/customer','Timeline loading/failure/retry/empty and viewport controls','shared mobile Back/safe areas and touch creation','ordinary conversion without documents','retained snapshot unchanged and atomic handoff','Inventory assessment preserved off-Inspector','Proposal preparation access gate','historical importer and Sample PDF retained']},null,2));console.log('Focused Intake Product reconciliation browser checks passed at localhost:3000.');
}catch(error){await page.screenshot({path:output+'/reconciliation-failure.png'}).catch(()=>{});writeFileSync(output+'/reconciliation-failure.txt',(await page.locator('body').innerText())+'\n'+error.message);throw error;}finally{await browser.close();}
