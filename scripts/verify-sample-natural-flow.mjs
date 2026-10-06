import assert from 'node:assert/strict';
import {readFileSync,mkdirSync} from 'node:fs';
import {chromium,expect} from '@playwright/test';
const fixture=JSON.parse(readFileSync('/private/tmp/tenops-production-blend-v11-review/server.json'));
const browser=await chromium.launch();const failures=[];
const page=await browser.newPage({viewport:{width:1440,height:1100}});page.setDefaultTimeout(15000);
const writes=[];page.on('request',r=>{if(/\/rpc\/(create_sample|save_sample_draft)$/.test(r.url())||r.url().includes('generate-sample-pdf')&&['blend-issue','generate'].includes(r.postDataJSON()?.action))writes.push(r.url());});
async function check(name,fn){try{await fn();console.log(`PASS ${name}`);}catch(e){failures.push(name);console.error(`GAP ${name}: ${e.message.split('Call log:')[0]}`);}}
try{
 await check('new Sample explicit profile selection',async()=>{
  await page.goto('http://localhost:3000/samples?open=new');
  const selector=page.getByRole('combobox',{name:'Resin System',exact:true});
  await expect(selector).toHaveValue('');await expect(page.getByRole('combobox',{name:'Resin Supplier',exact:true})).toHaveValue('');
  await selector.selectOption({label:'MTT — 5:1'});
  await expect(page.getByRole('combobox',{name:'Resin Supplier',exact:true})).toHaveValue('MTT');
  await expect(page.locator('#batch-formulation')).toContainText('100% = 180 lb Chip Mix');
  assert.equal(writes.length,0);
 });
 await page.goto(fixture.route);await expect(page.getByRole('button',{name:'Save Changes',exact:true})).toBeVisible();
 await check('existing captured MTT, natural order, compact editor',async()=>{
  await expect(page.getByRole('combobox',{name:'Resin System',exact:true})).toContainText('MTT — 5:1');
  await expect(page.getByRole('navigation',{name:'Workspace sections'})).toHaveCount(0);await expect(page.getByRole('tab')).toHaveCount(0);
  const ids=['formulation-setup','sample-context','formulation-materials','batch-formulation','sample-plate','production-planning','sample-documents'];
  const tops=[];for(const id of ids){const el=page.locator(`#${id}`);await expect(el).toBeVisible();tops.push(await el.evaluate(e=>e.getBoundingClientRect().top));}assert.deepEqual(tops,[...tops].sort((a,b)=>a-b));
  const roles=await page.locator('[data-sample-material-row]').evaluateAll(rows=>rows.map(r=>r.dataset.role));assert.deepEqual(roles,['aggregate','aggregate','aggregate','aggregate','aggregate','filler','resin','hardener']);
  const h=await page.locator('[data-sample-material-row]').first().evaluate(e=>e.getBoundingClientRect().height);assert.ok(h<70,`row height ${h}`);console.log(`Aggregate row: ${h}px`);
  await expect(page.getByRole('combobox',{name:'Customer',exact:true})).toHaveValue('Tenarten');
 });
 const production=page.getByRole('region',{name:'Production Blend Sheet',exact:true});
 const batches=page.getByRole('spinbutton',{name:'ADJD Batches',exact:true}),adj=page.getByRole('spinbutton',{name:'ADJ (lb)',exact:true}),size=page.getByRole('spinbutton',{name:'Blend Size (lb)',exact:true});
 await check('three-column layout and live Production feedback',async()=>{
  await expect(batches).toHaveValue('1');await expect(production).toContainText('1 Batch = 180 lb chips');
  const cards=production.locator('fieldset > div');const bounds=await cards.evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y};}));assert.equal(bounds.length,3);assert.ok(bounds.every(b=>Math.abs(b.y-bounds[0].y)<2));assert.ok(bounds[0].x<bounds[1].x&&bounds[1].x<bounds[2].x);
  async function values(calculated,total,blends){await expect(cards.nth(0)).toContainText(`Calculated Chips: ${calculated} lb`);await expect(cards.nth(1).locator('strong')).toHaveText(`${total} lb`);await expect(cards.nth(2).locator('strong')).toHaveText(blends);}
  await values(180,180,'0.18');await batches.fill('2');await values(360,360,'0.36');
  await expect(production).toContainText('100 lb (50 lb/Batch × 2 Batches)');await expect(production).toContainText('Part A: 10 US gal');await expect(production).toContainText('Part B: 2 US gal');
  await adj.fill('40');await values(360,400,'0.4');await size.fill('500');await values(360,400,'0.8');
  await expect(batches).toHaveValue('2');await expect(adj).toHaveValue('40');await expect(production).toContainText('100 lb (50 lb/Batch × 2 Batches)');await expect(production).toContainText('Part A: 10 US gal');await expect(production).toContainText('Part B: 2 US gal');
  await size.fill('0');await expect(production).toContainText('Blend Size must be greater than 0 lb.');await expect(page.getByRole('button',{name:'Generate Blend Sheet',exact:true})).toBeDisabled();
  await size.fill('500');await adj.fill('');await values(360,360,'0.72');await expect(production.getByRole('alert')).toHaveCount(0);await expect(page.getByRole('button',{name:'Generate Blend Sheet',exact:true})).toBeEnabled();
 });
 await check('shortcut and downstream generation paths',async()=>{
  await page.getByRole('button',{name:'Plan Production Blend →',exact:true}).click();await expect(production).toBeFocused();
  await page.getByRole('button',{name:'Sample Plate',exact:true}).click();await expect(page.locator('#sample-plate')).toContainText('Exact Working projection:');
  await expect(page.getByRole('button',{name:'Generate Sample Work Order',exact:true})).toBeEnabled();await expect(page.getByRole('button',{name:'Generate Blend Sheet',exact:true})).toBeEnabled();
  await expect(page.locator('#sample-documents')).not.toHaveAttribute('open','');assert.equal(writes.length,0);
 });
 mkdirSync('output/pdf/natural-flow',{recursive:true});await production.scrollIntoViewIfNeeded();await page.screenshot({path:'output/pdf/natural-flow/production.png'});await page.locator('#formulation-setup').scrollIntoViewIfNeeded();await page.screenshot({path:'output/pdf/natural-flow/context.png'});
}finally{await browser.close();}
if(failures.length)process.exitCode=1;
