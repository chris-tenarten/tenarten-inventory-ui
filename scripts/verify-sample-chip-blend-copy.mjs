import assert from 'node:assert/strict';
import {readFileSync,mkdirSync} from 'node:fs';
import {chromium,expect} from '@playwright/test';
const output='/private/tmp/tenops-sample-batch-review';
const fixture=JSON.parse(readFileSync(`${output}/server.json`));
const route=process.env.SAMPLE_REVIEW_URL||`http://localhost:3000/samples?open=${fixture.sampleId}`;
const browser=await chromium.launch();
try {
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(route);
 await expect(page.getByRole('button',{name:'Batch',exact:true})).toHaveAttribute('aria-pressed','true');
 const section=page.locator('[data-sample-tutorial="aggregate-section"]');
 const helper=section.getByText('Set the aggregate percentages. The blend must total 100%.',{exact:true});
 mkdirSync(`${output}/chip-blend-copy`,{recursive:true});
 for(const width of [1440,768,390,320]) {
  await page.setViewportSize({width,height:1000});
  for(const [view,status] of [['Working Pour','Working Pour: 100% = 64 oz Chip Mix'],['Batch','Batch: 100% = 180 lb Chip Mix']]) {
   await page.getByRole('button',{name:view,exact:true}).click();
   await expect(section.getByRole('heading',{name:'Chip Blend',exact:true})).toBeVisible();
   await expect(section.getByText(status,{exact:true})).toBeVisible();
   await section.locator(':scope > div').first().evaluate(e=>e.scrollIntoView({block:'center'}));await expect(helper).toBeVisible();
   const layout=await helper.evaluate(e=>{const s=getComputedStyle(e);return {whiteSpace:s.whiteSpace,overflow:s.overflow,textOverflow:s.textOverflow,lineClamp:s.webkitLineClamp,width:e.clientWidth,scrollWidth:e.scrollWidth,height:e.clientHeight,scrollHeight:e.scrollHeight};});
   assert.equal(layout.whiteSpace,'normal');assert.notEqual(layout.textOverflow,'ellipsis');assert.ok(['none',''].includes(layout.lineClamp));assert.ok(layout.scrollWidth<=layout.width);assert.ok(layout.scrollHeight<=layout.height);
   const bounds=await helper.boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=width,`helper outside viewport at ${width}px: ${JSON.stringify(bounds)}`);
   await section.locator(':scope > div').first().screenshot({path:`${output}/chip-blend-copy/${width}-${view.replaceAll(' ','-')}.png`});
  }
 }
 await page.getByRole('button',{name:'Working Pour',exact:true}).click();
 await page.reload();
 await expect(page.getByRole('button',{name:'Batch',exact:true})).toHaveAttribute('aria-pressed','true');
 await page.goto('http://localhost:3000/samples');
 await page.getByRole('button',{name:'New Sample',exact:false}).click();
 await expect(page.getByRole('button',{name:'Batch',exact:true})).toHaveAttribute('aria-pressed','true');
 assert.deepEqual(errors,[]);console.log('Batch defaults for existing/reloaded/new Samples; toggle, Chip Blend scale labels and wrapping passed at 1440/768/390/320px on localhost:3000.');
}finally{await browser.close();}
