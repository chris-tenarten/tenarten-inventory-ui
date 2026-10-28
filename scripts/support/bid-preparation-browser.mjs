// Real exported application and existing disposable Intake database; no hosted traffic.
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {chromium,expect} from '@playwright/test';

export async function verifyBidPreparation({origin,output,local,rpc}){
 assert.equal(origin,'http://localhost:3000');
 const artifacts=output+'/bid-preparation-20261028';mkdirSync(artifacts,{recursive:true});
 const get=async path=>{const response=await fetch(origin+path);assert(response.ok);return response.json();};
 const bidRow=async id=>(await get('/rest/v1/bids?select=*&id=eq.'+id))[0];
 const proposalRows=id=>get('/rest/v1/bid_proposal_relationships?bid_id=eq.'+id);
 const samples=id=>rpc('list_samples',{p_bid_id:id});
 const original=await bidRow(local.bid),jobsBefore=await get('/rest/v1/jobs?select=*');
 const suffix=Date.now(),project='Bid preparation review '+suffix,customer='Local preparation customer';
 const preparationBid=await rpc('create_bid',{p_customer:customer,p_project_name:project});
 const conversionProject='Preparation conversion without documents '+suffix;
 const conversionBid=await rpc('create_bid',{p_customer:customer,p_project_name:conversionProject});
 const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1050}});
 page.setDefaultTimeout(20000);
 const errors=[],blocked=[],checks=[];let role='admin',readOnly=false,proposalAccess='allowed';
 page.on('pageerror',error=>errors.push(error.message));
 page.on('dialog',dialog=>dialog.dismiss());
 await page.route('**/*',async route=>{
  const request=route.request(),url=new URL(request.url());
  if(['blob:','data:'].includes(url.protocol))return route.continue();
  if(url.origin!==origin){blocked.push(url.origin+url.pathname);return route.abort('blockedbyclient');}
  // Capability profiles are UI simulations. All actual writes use the existing local Admin fixture.
  if(/\/rpc\/get_my_app_(access|user)$/.test(url.pathname)){
   const response=await route.fetch(),data=await response.json();
   const profile=row=>({...row,role,read_only:readOnly,is_active:true});
   return route.fulfill({response,json:Array.isArray(data)?data.map(profile):profile(data)});
  }
  if(url.pathname.endsWith('/rpc/has_proposal_access')&&proposalAccess!=='allowed')return route.fulfill({
   status:proposalAccess==='error'?500:200,contentType:'application/json',
   body:proposalAccess==='error'?JSON.stringify({message:'Synthetic Proposal access check failure'}):'false',
  });
  return route.continue();
 });
 const preparation=()=>page.getByRole('region',{name:'Bid Preparation',exact:true});
 const link=name=>preparation().getByRole('link',{name,exact:true});
 const dialog=()=>page.locator('[role="dialog"][aria-labelledby="bid-workspace-title"]');
 async function openBid(id=preparationBid){
  await page.goto(origin+'/pre-production?bid='+id);
  await expect(dialog()).toBeVisible();
  await expect(dialog().getByRole('tab',{name:'Overview',exact:true})).toHaveAttribute('aria-selected','true');
  await expect(dialog().getByRole('tab',{name:'Tools',exact:true})).toHaveCount(0);
  await expect(preparation()).toBeVisible();
  await expect(page.locator('[data-welcome-hero]:visible,[data-welcome-hero-cover]:visible')).toHaveCount(0,{timeout:30000});return dialog();
 }
 async function allActions(){for(const name of ['Create Proposal','Create Sample','Open related Proposals','Open related Samples'])await expect(link(name)).toBeVisible();}
 try{
  let inspector=await openBid();await allActions();
  const order=await inspector.locator('[aria-label="Bid Preparation"],[aria-label="Related Records"],#bid-production-handoff').evaluateAll(elements=>elements.map(element=>element.getAttribute('aria-label')||element.id));
  assert.deepEqual(order,['Bid Preparation','Related Records','bid-production-handoff']);
  await expect(link('Create Proposal')).toHaveAttribute('href','/proposals?bid='+preparationBid);
  await expect(link('Create Sample')).toHaveAttribute('href','/samples?bid='+preparationBid+'&open=new');
  await expect(link('Open related Proposals')).toHaveAttribute('href','/proposals?bid='+preparationBid);
  await expect(link('Open related Samples')).toHaveAttribute('href','/samples?bid='+preparationBid);
  await link('Create Proposal').click({trial:true});await link('Create Proposal').focus();await expect(link('Create Proposal')).toBeFocused();await page.keyboard.press('Tab');await expect(link('Create Sample')).toBeFocused();
  await inspector.getByRole('tab',{name:'Updates',exact:true}).click();await expect(preparation()).toHaveCount(0);
  await inspector.getByRole('tab',{name:'Overview',exact:true}).click();await allActions();
  await preparation().scrollIntoViewIfNeeded();await inspector.screenshot({path:artifacts+'/desktop-empty.png'});
  checks.push('Desktop Overview placement, four unchanged Bid URLs, no Tools tab, keyboard focus and tab return');

  await link('Open related Proposals').click();await expect(page).toHaveURL(origin+'/proposals?bid='+preparationBid);
  await expect(page.getByRole('heading',{name:'Proposal history',exact:true})).toBeVisible();
  await expect(page.getByText('No Proposals are linked to this Bid.',{exact:true})).toBeVisible();
  await openBid();await link('Open related Samples').click();await expect(page).toHaveURL(origin+'/samples?bid='+preparationBid);
  await expect(page.getByRole('heading',{name:'Bid-context Samples',exact:true})).toBeVisible();
  await expect(page.getByText('No Samples linked to this Bid yet.',{exact:true})).toBeVisible();
  checks.push('Both related actions open the established Bid-filtered libraries');

  await openBid();await link('Create Proposal').click();
  await page.getByRole('button',{name:'Create Proposal',exact:true}).click();
  await expect(page.getByRole('button',{name:'Save Draft',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Customer Proposal',exact:true}).click();
  await expect(page.getByLabel('Project',{exact:true})).toHaveValue(project);
  await page.getByRole('button',{name:'Save Draft',exact:true}).click();await expect(page.getByText('Draft saved.',{exact:true})).toBeVisible();
  const proposals=await proposalRows(preparationBid);assert.equal(proposals.length,1);
  const proposal=proposals[0].proposal;assert.equal(proposal.customer_name,customer);assert.equal(proposal.project_name,project);assert.equal(proposal.job_id,null);
  checks.push('Canonical Proposal creation/save retains Bid relationship, customer/project and no Production Job');

  await openBid();await link('Create Sample').click();await expect(page).toHaveURL(origin+'/samples?bid='+preparationBid+'&open=new');
  await expect(page.getByRole('combobox',{name:'Bid context',exact:true})).toHaveValue(preparationBid);
  await expect(page.getByLabel('Project Name',{exact:true})).toHaveValue(project);await expect(page.getByLabel('Customer',{exact:true})).toHaveValue(customer);
  await expect(page.getByRole('combobox',{name:'Production Job context',exact:true})).toHaveValue('');
  await page.getByRole('combobox',{name:'Resin System',exact:true}).selectOption({label:'MTT — 5:1'});
  await page.getByRole('button',{name:'Save Sample',exact:true}).click();await expect(page.getByRole('button',{name:'Save Changes',exact:true})).toBeVisible();
  let createdSamples=await samples(preparationBid);assert.equal(createdSamples.length,1);const createdSample=createdSamples[0].sample;
  assert.equal(createdSample.bid_id,preparationBid);assert.equal(createdSample.project_name,project);assert.equal(createdSample.customer_name,customer);assert.equal(createdSample.job_id,null);
  // Reuse the existing reviewed formulation solely as PDF fixture setup after real UI creation/save.
  const seed=(await samples(local.bid)).find(item=>item.sample.id===local.sample).sample;
  await rpc('save_sample_draft',{p_sample:{id:createdSample.id,bid_id:preparationBid,job_id:null,prepared_by:'Local preparation Admin',project_name:project,customer_name:customer,color_plate_number:createdSample.color_plate_number,sample_size:'6 x 6',sample_quantity:'4',formulation_state:seed.formulation_state},
   p_rows:seed.blend_rows.map(row=>Object.fromEntries(['percentage','color','size','material_type','quantity','unit','vendor','component_role','calculation_basis','quantity_provenance'].map(key=>[key,row[key]]))),p_sample_name:'Preparation review Sample'});
  await page.goto(origin+'/samples?bid='+preparationBid+'&open='+createdSample.id);
  const generated=page.waitForResponse(response=>response.url().endsWith('/functions/v1/generate-sample-pdf')&&response.request().postDataJSON()?.action==='generate');
  await page.getByRole('button',{name:'Generate Sample Work Order',exact:true}).click();const pdfResponse=await generated;
  assert(pdfResponse.ok(),await pdfResponse.text());const pdfUrl=(await pdfResponse.json()).url;
  assert.equal(new URL(pdfUrl).origin,origin);const pdf=await fetch(pdfUrl);assert(pdf.ok);assert.equal(Buffer.from(await pdf.arrayBuffer()).subarray(0,4).toString(),'%PDF');
  await expect(page.getByRole('button',{name:'Close document viewer',exact:true})).toBeVisible();await page.getByRole('button',{name:'Close document viewer',exact:true}).click();
  createdSamples=await samples(preparationBid);assert.equal(createdSamples[0].sample.issued_documents.length,1);
  checks.push('Canonical Sample UI creation/save propagates context; reused local formulation generates an actual new Sample Work Order PDF');

  inspector=await openBid();const related=inspector.getByRole('region',{name:'Related Records',exact:true});
  await expect(related.getByRole('link',{name:proposal.estimate_number,exact:true})).toHaveAttribute('href','/proposals?bid='+preparationBid+'&open='+proposal.id);
  await expect(related.getByRole('link',{name:createdSample.color_plate_number,exact:true})).toHaveAttribute('href','/samples?bid='+preparationBid+'&open='+createdSample.id);
  await preparation().evaluate(element=>element.scrollIntoView({block:'start'}));await inspector.screenshot({path:artifacts+'/desktop.png'});
  await link('Open related Proposals').click();await expect(page.getByRole('article').filter({hasText:proposal.estimate_number})).toBeVisible();
  await openBid();await link('Open related Samples').click();await expect(page.getByRole('button').filter({hasText:createdSample.color_plate_number}).first()).toBeVisible();
  assert.equal((await get('/rest/v1/jobs?select=*')).length,jobsBefore.length);
  checks.push('Created records appear in Inspector and both libraries; preparation creates no pseudo Job');

  role='guest';inspector=await openBid();await allActions();await expect(inspector.getByRole('button',{name:'Convert to Production',exact:true})).toHaveCount(0);
  role='admin';proposalAccess='denied';await openBid();await expect(preparation().getByText('Checking access…',{exact:true})).toHaveCount(0);await expect(link('Create Proposal')).toHaveCount(0);await expect(link('Open related Proposals')).toHaveCount(0);await expect(link('Create Sample')).toBeVisible();await expect(link('Open related Samples')).toBeVisible();
  proposalAccess='allowed';readOnly=true;inspector=await openBid();await expect(link('Create Proposal')).toHaveCount(0);await expect(link('Create Sample')).toHaveCount(0);
  await expect(link('Open related Proposals')).toBeVisible();await expect(link('Open related Samples')).toBeVisible();await expect(inspector.getByRole('button',{name:'Convert to Production',exact:true})).toHaveCount(0);
  readOnly=false;proposalAccess='error';inspector=await openBid();await expect(preparation().getByText('Checking access…',{exact:true})).toHaveCount(0);await expect(link('Create Proposal')).toHaveCount(0);await expect(link('Open related Proposals')).toHaveCount(0);await expect(link('Create Sample')).toBeVisible();await expect(link('Open related Samples')).toBeVisible();
  proposalAccess='allowed';await inspector.getByRole('tab',{name:'Updates',exact:true}).click();await inspector.getByRole('tab',{name:'Overview',exact:true}).click();await allActions();
  checks.push('Admin/Guest, denied Proposal and read-only visibility; failed Proposal RPC closes access and Overview reopen recovers (UI profile simulations, no hosted/RLS claim)');

  await page.setViewportSize({width:390,height:844});inspector=await openBid();await allActions();await preparation().evaluate(element=>element.scrollIntoView({block:'start'}));
  await expect(inspector.getByRole('region',{name:'Related Records',exact:true}).getByRole('link',{name:createdSample.color_plate_number,exact:true})).toBeVisible();
  const bounds=await preparation().getByRole('link').evaluateAll(links=>links.map(element=>{const box=element.getBoundingClientRect();return {x:box.x,y:box.y,width:box.width,height:box.height};}));
  assert(bounds.every(box=>box.height>=44&&box.width>=44&&box.x>=0&&box.x+box.width<=390));assert(bounds.every(box=>Math.abs(box.x-bounds[0].x)<1));assert(bounds.every((box,index)=>index===0||box.y>bounds[index-1].y));
  assert(await inspector.evaluate(element=>element.scrollWidth<=element.clientWidth));assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await inspector.screenshot({path:artifacts+'/mobile.png'});await inspector.getByRole('tab',{name:'Updates',exact:true}).click();await inspector.getByRole('tab',{name:'Overview',exact:true}).click();await allActions();
  checks.push('390px mobile single-column actions, 44px minimum targets, no horizontal overflow and Overview return');

  inspector=await openBid(conversionBid);let convert=inspector.getByRole('button',{name:'Convert to Production',exact:true});await expect(convert).toBeDisabled();
  await inspector.getByRole('combobox',{name:'Status',exact:true}).selectOption('won');await inspector.getByRole('button',{name:'Save Bid',exact:true}).click();await expect(inspector.getByText('Bid saved.',{exact:true})).toBeVisible();await expect(convert).toBeDisabled();
  await inspector.getByLabel('Deposit Received Date',{exact:true}).fill('2026-10-28');await expect(convert).toBeDisabled();
  await inspector.getByRole('button',{name:'Save Bid',exact:true}).click();await expect(convert).toBeEnabled();
  assert.deepEqual(await proposalRows(conversionBid),[]);assert.deepEqual(await samples(conversionBid),[]);
  await convert.click();await inspector.getByRole('radio',{name:/Plan in Production Later/}).check();await inspector.getByRole('button',{name:'Confirm conversion',exact:true}).click();
  await expect(inspector.getByText(/Converted to Production. Original projection/)).toBeVisible();const converted=await bidRow(conversionBid);assert(converted.production_job_id);
  const jobsAfter=await get('/rest/v1/jobs?select=*');assert.equal(jobsAfter.length,jobsBefore.length+1);
  const job=jobsAfter.find(row=>row.id===converted.production_job_id);assert(job);assert.equal(job.job_number,null);assert.equal(job.planned_start,null);assert.equal(job.planned_end,null);
  inspector=await openBid(conversionBid);await expect(inspector.getByRole('button',{name:'Convert to Production',exact:true})).toHaveCount(0);assert.equal((await bidRow(conversionBid)).production_job_id,job.id);assert.equal((await get('/rest/v1/jobs?select=*')).length,jobsAfter.length);
  assert.deepEqual(await bidRow(local.bid),original);assert.deepEqual(errors,[]);assert.deepEqual(blocked,[]);
  checks.push('Active/Won/deposit/saved-edit guards unchanged; document-free unscheduled conversion creates one canonical unnumbered Job and reload preserves association; original Bid untouched');
  const report={passed:true,origin,profileVerification:'Browser capability simulations over disposable local Admin fixture; no hosted or SQL actor certification',preparationBid,conversionBid,proposalId:proposal.id,sampleId:createdSample.id,jobId:job.id,checks,errors,blocked};
  writeFileSync(artifacts+'/results.json',JSON.stringify(report,null,2));console.log('PASS Bid Preparation: '+checks.length+' focused browser groups. Evidence: '+artifacts);
 }catch(error){await page.screenshot({path:artifacts+'/failure-'+Date.now()+'.png'}).catch(()=>{});writeFileSync(artifacts+'/failure-'+Date.now()+'.txt',(await page.locator('body').innerText())+'\n'+error.stack);throw error;}
 finally{await browser.close();}
}
