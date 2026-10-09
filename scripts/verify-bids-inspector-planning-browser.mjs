// Real exported application with an in-memory REST fixture; never contacts hosted services.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {chromium} from '@playwright/test';
const origin='http://localhost:3107';
const userId='00000000-0000-4000-8000-000000000001';
const id='10000000-0000-4000-8000-000000000001';
const user={id:userId,email:'review@example.invalid',aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{},created_at:'2026-10-09T00:00:00Z'};
const token=`${Buffer.from('{"alg":"HS256"}').toString('base64url')}.${Buffer.from(JSON.stringify({sub:userId,exp:4102444800})).toString('base64url')}.fixture`;
const session={access_token:token,refresh_token:'fixture',expires_at:4102444800,expires_in:3600,token_type:'bearer',user};
const bid={id,customer:'Fixture Customer',project_name:'CRM review',creator_user_id:userId,creator_name:'Review Admin',owner_user_id:userId,owner_name:'Review Admin',status:'active',notes:'',created_at:'2026-10-09T00:00:00Z',updated_at:'2026-10-09T00:00:00Z',projected_production_start:'2026-10-12',projected_production_end:'2026-10-20'};
const writes=[];
const server=spawn(process.execPath,['tests/support/static-server.mjs'],{env:{...process.env,PORT:'3107'},stdio:'inherit'});
let browser;
try{
 for(let i=0;i<50;i++){try{if((await fetch(origin)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 await page.addInitScript(s=>localStorage.setItem('sb-127-auth-token',JSON.stringify(s)),session);
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url());
  if(url.origin===origin)return route.continue();
  assert.equal(url.origin,'http://127.0.0.1:54321','Unexpected external request');
  const name=url.pathname.split('/').at(-1);let data=[];
  if(url.pathname.startsWith('/auth/'))data=user;
  else if(name==='get_my_app_access')data=[{user_id:userId,display_name:'Review Admin',role:'admin',is_active:true}];
  else if(name==='list_bids'||name==='bids')data=[bid];
  else if(name==='list_bid_owners')data=[{user_id:userId,display_name:'Review Admin'}];
  else if(name==='set_bid_projected_window') {const body=route.request().postDataJSON();writes.push(body);bid.projected_production_start=body.p_start;bid.projected_production_end=body.p_end;data=null;}
  await route.fulfill({status:200,contentType:'application/json',headers:{'access-control-expose-headers':'content-range','content-range':Array.isArray(data)?`0-${Math.max(0,data.length-1)}/${data.length}`:'0-0/1'},body:JSON.stringify(data)});
 });
 page.on('pageerror',e=>console.error(e.message));
 await page.goto(origin+'/pre-production');

 const opener=page.getByRole('button',{name:/Fixture Customer/});await opener.click();
 const dialog=page.locator('[role="dialog"][aria-labelledby="bid-workspace-title"]');await dialog.waitFor();
 assert.equal(await page.evaluate(()=>document.body.style.overflow),'hidden');
 await dialog.getByRole('heading',{name:/Fixture Customer/}).click();assert.equal(await dialog.count(),1);
 await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});assert(await opener.evaluate(el=>el===document.activeElement));
 await opener.click();await dialog.getByLabel('Customer',{exact:true}).fill('Unsaved customer');
 page.once('dialog',d=>d.dismiss());await page.keyboard.press('Escape');assert.equal(await dialog.count(),1);
 page.once('dialog',d=>d.accept());await page.mouse.click(10,300);await dialog.waitFor({state:'hidden'});
 await opener.click();await dialog.getByLabel('Projected start',{exact:true}).fill('2026-10-13');
 page.once('dialog',d=>d.dismiss());await page.getByRole('tab',{name:'Updates',exact:true}).click();assert(await dialog.getByLabel('Projected start',{exact:true}).isVisible());
 page.once('dialog',d=>d.accept());await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});
 await page.getByRole('button',{name:'Planning',exact:true}).click();
 await page.getByRole('button',{name:'Zoom in',exact:true}).click();await page.getByRole('button',{name:'Reset zoom',exact:true}).click();assert(await page.getByRole('button',{name:'Reset zoom',exact:true}).isDisabled());
 await page.getByRole('button',{name:'Comfortable rows',exact:true}).click();assert.equal(await page.getByRole('button',{name:'Compact rows',exact:true}).getAttribute('aria-pressed'),'true');
 await page.getByRole('button',{name:'Fit',exact:true}).click();
 const edge=page.getByRole('button',{name:'Edit projected end for CRM review'});await edge.scrollIntoViewIfNeeded();const box=await edge.boundingBox();
 await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+50,box.y+box.height/2);await page.getByRole('status').filter({hasText:'Proposed window:'}).waitFor();await page.keyboard.press('Escape');await page.mouse.up();assert.equal(writes.length,0);
 await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'CRM review INTAKE',exact:false}).first().click();await dialog.waitFor();assert((await dialog.boundingBox()).width<=390);
 await page.screenshot({path:'/private/tmp/tenops-bids-crm-mobile.png'});
 console.log('PASS Inspector inside/outside/Escape, discard guards, focus restoration, scroll lock, planning draft tab guard, zoom reset, density, drag preview/cancellation, mobile width. Fixture REST only; zero hosted traffic.');
}finally{await browser?.close();server.kill('SIGTERM');}
