import assert from 'node:assert/strict';import {mkdirSync,writeFileSync} from 'node:fs';import {chromium,expect} from '@playwright/test';import {PDFDocument} from 'pdf-lib';
const browser=await chromium.launch(),dir='output/pdf/gio';mkdirSync(dir,{recursive:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1100}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:3000/samples');await expect(page.locator('[data-welcome-hero="true"]')).toBeHidden({timeout:30000});
 const routes=[];
 for(const name of ['MTT','Key Resin','Terroxy','Sherwin']){
  await page.goto('http://localhost:3000/samples');await page.getByRole('button',{name:'New Sample',exact:false}).click();
  const selector=page.getByLabel('Resin System',{exact:true});
  if(name!=='MTT'){const value=await selector.locator('option').filter({hasText:new RegExp('^'+name+' —')}).first().getAttribute('value');await selector.selectOption(value);await page.getByRole('button',{name:'Apply configured profile',exact:true}).click();}
  await page.getByLabel('Sample Name',{exact:false}).fill(name+' — Gio review');await page.getByLabel('Prepared By',{exact:true}).fill('Marcos');
  await expect(page.getByLabel('Resin Supplier',{exact:true})).toHaveValue(name);
  const rows=page.locator('[data-sample-material-row]'),resin=rows.nth(2),hardener=rows.nth(3);
  await expect(resin.getByLabel('Vendor',{exact:true})).toHaveValue(name);await expect(hardener.getByLabel('Vendor',{exact:true})).toHaveValue(name);
  await expect(resin.getByPlaceholder('Material description')).toHaveValue(name.replace(/ Resin$/,'')+' Resin');await expect(hardener.getByPlaceholder('Material description')).toHaveValue(name.replace(/ Resin$/,'')+' Hardener');
  assert.equal(await resin.getByPlaceholder('Material description').getAttribute('role'),null); // Vendor suggestions and Formula Role may still be comboboxes.
  await expect(resin.getByPlaceholder('Type or search Catalog')).toHaveCount(0);await expect(hardener.getByPlaceholder('Type or search Catalog')).toHaveCount(0);
  const setup=page.getByLabel('Resin Color and #',{exact:true});await setup.fill(name+' White 123');await expect(resin.getByPlaceholder('Material description')).toHaveValue(name+' White 123');
  await resin.getByPlaceholder('Material description').fill(name+' Ivory 456');await expect(setup).toHaveValue(name+' Ivory 456');
  for(const [i,term] of [[0,'Blanco'],[1,'ATF']]){const r=rows.nth(i);await r.getByPlaceholder('Type or search Catalog').fill(term);await r.getByRole('listbox',{name:'Catalog matches'}).getByRole('option').first().click();}
  await rows.first().getByLabel('%',{exact:true}).fill('100');
  await expect(page.getByLabel('Batch Filler (lb)',{exact:true})).toHaveValue('50');await expect(page.getByTestId('batch-summary')).toContainText(name==='Sherwin'?'150 lb':'180 lb');
  await page.getByLabel('Batch Filler (lb)',{exact:true}).fill('100');await expect(page.getByTestId('batch-summary')).toContainText(name==='Sherwin'?'100 lb':'130 lb');await expect(rows.first().getByLabel('%',{exact:true})).toHaveValue('100');await page.getByRole('button',{name:'Restore Profile Default',exact:true}).click();
  const response=page.waitForResponse(r=>r.url().includes('/rpc/save_sample_draft'));await page.getByRole('button',{name:'Save',exact:true}).click();const saved=await response;assert.equal(saved.status(),200,await saved.text());const id=saved.request().postDataJSON().p_sample.id;routes.push({name,id,url:'http://localhost:3000/samples?open='+id});
  await page.goto(routes.at(-1).url);await expect(setup).toHaveValue(name+' Ivory 456');await expect(resin.getByPlaceholder('Material description')).toHaveValue(name+' Ivory 456');
  await expect(page.getByRole('button',{name:'Generate Production Batch Blend Sheet',exact:true})).toHaveCount(1);
  if(name==='Sherwin')await expect(page.getByRole('button',{name:'Generate Production Batch Blend Sheet',exact:true})).toBeDisabled();
  const pdfResponse=page.waitForResponse(r=>r.url().includes('/functions/v1/generate-sample-pdf')&&r.request().postDataJSON()?.action==='working');await page.getByRole('button',{name:'Generate Working Sheet',exact:true}).click();const pdf=await pdfResponse;assert.equal(pdf.status(),200);await expect(page.getByRole('button',{name:'Close document viewer',exact:true})).toBeVisible();const href=await page.getByRole('link',{name:/Download/i}).getAttribute('href');const bytes=Buffer.from(await page.evaluate(async u=>Array.from(new Uint8Array(await(await fetch(u)).arrayBuffer())),href));assert.equal((await PDFDocument.load(bytes)).getPageCount(),1);writeFileSync(`${dir}/${name.replaceAll(' ','-')}-working-review.pdf`,bytes);await page.getByRole('button',{name:'Close document viewer',exact:true}).click();
 }
 await page.goto(routes[1].url);const selector=page.getByLabel('Resin System',{exact:true});const mtt=await selector.locator('option').filter({hasText:/^MTT —/}).first().getAttribute('value');await selector.selectOption(mtt);await page.getByRole('button',{name:'Apply configured profile',exact:true}).click();await expect(page.getByLabel('Resin Color and #',{exact:true})).toHaveValue('Key Resin Ivory 456');await expect(page.getByLabel('Resin Supplier',{exact:true})).toHaveValue('MTT');
 const cement=await selector.locator('option').filter({hasText:/^Cement/}).first().getAttribute('value');await selector.selectOption(cement);await expect(page.getByRole('button',{name:'Apply configured profile',exact:true})).toBeDisabled();await page.getByRole('button',{name:'Cancel selection',exact:true}).click();
 await page.goto(routes[0].url);await page.setViewportSize({width:390,height:1000});await page.getByLabel('Resin System',{exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:dir+'/mobile.png'});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 const member=await browser.newContext({extraHTTPHeaders:{'x-review-role':'member'}});const memberPage=await member.newPage();await memberPage.goto(routes[0].url);await expect(memberPage.getByRole('button',{name:'Generate Working Sheet',exact:true})).toBeVisible();await expect(memberPage.getByRole('button',{name:'Generate Production Batch Blend Sheet',exact:true})).toHaveCount(0);assert.equal((await member.request.post('http://localhost:3000/functions/v1/generate-sample-pdf',{data:{action:'batch-working',sampleId:routes[0].id}})).status(),403);
 assert.deepEqual(errors,[]);writeFileSync(dir+'/review-routes.json',JSON.stringify(routes,null,2));console.log('PASS actual localhost: profiles/vendor/text sync/save/reopen, catalog split, Filler restore, compact PDFs, Admin/member visibility and denial. '+JSON.stringify(routes));
}finally{await browser.close();}
