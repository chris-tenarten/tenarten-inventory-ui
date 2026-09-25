// Production-mode shell loading contract; all external requests are intercepted.
import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, writeFileSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import { mockManpowerAuth } from '../tests/support/manpower-auth';
const root=resolve(process.env.PERF_ROOT||'out');
const output=process.env.PERF_OUTPUT||'/private/tmp/tenops-shell-loading.json';
const server=createServer((req,res)=>{
  const path=new URL(req.url!,'http://localhost').pathname;
  const local=path==='/'?'index':decodeURIComponent(path.slice(1));
  const file=[local,`${local}.html`,`${local}/index.html`].map(p=>resolve(root,p)).find(p=>p.startsWith(root+'/')&&existsSync(p)&&statSync(p).isFile());
  if(!file)return void res.writeHead(404).end();
  res.writeHead(200,{'content-type':({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.txt':'text/plain'} as Record<string,string>)[extname(file)]||'application/octet-stream'}).end(readFileSync(file));
});
await new Promise<void>(done=>server.listen(0,'127.0.0.1',done));
const address=server.address() as {port:number};const base=`http://127.0.0.1:${address.port}`;
const browser=await chromium.launch({headless:true});

const context=await browser.newContext({reducedMotion:'reduce'});
const page=await context.newPage();
const calls:{name:string;bytes:number;rows:number;at:number}[]=[];
const errors:string[]=[];
let failHistory=false;
let activeUser='00000000-0000-0000-0000-000000000004';
let holdNextHistory=false;
let releaseHistory:(()=>void)|undefined;
let rows=Array.from({length:100},(_,i)=>({id:`notification-${i}`,notification_type:i===0?'welcome':'fixture',title:i===0?'Welcome fixture':`Notice ${i}`,body:'Fixture content '.repeat(20),metadata:{},read_at:i===0?null:'2026-09-01T00:00:00Z',created_at:'2026-09-25T00:00:00Z'}));
page.on('pageerror',e=>errors.push(e.message));
await page.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.fulfill({status:200,contentType:'application/json',body:'[]'}));
await page.routeWebSocket('**/realtime/v1/**',()=>{});
await page.route('**/rest/v1/**',async route=>{
 const name=new URL(route.request().url()).pathname.split('/').at(-1)!;
 let data:unknown=[];
 if(name==='list_my_account_notification_history')data=rows.map(x=>({...x}));
 if(name==='mark_all_my_account_notifications_read')rows=rows.map(x=>({...x,read_at:'2026-09-25T01:00:00Z'}));
 const body=JSON.stringify(data);calls.push({name,at:Date.now(),bytes:Buffer.byteLength(body),rows:Array.isArray(data)?data.length:0});
 if(name==='list_my_account_notification_history'&&holdNextHistory){holdNextHistory=false;await new Promise<void>(done=>{releaseHistory=done;});}
 await new Promise(done=>setTimeout(done,30));
 await route.fulfill({status:failHistory&&name==='list_my_account_notification_history'?500:200,contentType:'application/json',headers:{'content-range':'0-0/0','access-control-expose-headers':'content-range'},body:failHistory&&name==='list_my_account_notification_history'?JSON.stringify({message:'Fixture failure'}):body});
});
await mockManpowerAuth(page,'admin');
await page.route('**/rest/v1/rpc/get_my_app_user',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify([{user_id:activeUser,display_name:activeUser.endsWith('5')?'Second fixture':'Browser fixture',role:'admin',is_active:true}])}));
await page.addInitScript(()=>{window.addEventListener('tenops:critical-app-ready',()=>{document.documentElement.dataset.firstUsefulAt??=String(Date.now());document.documentElement.dataset.firstUsefulMs??=String(performance.now());},{once:true});window.addEventListener('tenops:start-notification-onboarding',()=>{document.documentElement.dataset.onboardingEvents=String(Number(document.documentElement.dataset.onboardingEvents||0)+1);});});
const count=()=>calls.filter(c=>c.name==='list_my_account_notification_history').length;
try{
 await page.goto(base+'/',{waitUntil:'load'});
 await expect(page.getByLabel('1 unread notifications',{exact:true})).toBeVisible();
 await expect.poll(()=>page.evaluate(()=>Number(document.documentElement.dataset.onboardingEvents||0)),{timeout:12000}).toBe(1);
 const ready=await page.evaluate(()=>({at:Number(document.documentElement.dataset.firstUsefulAt),ms:Number(document.documentElement.dataset.firstUsefulMs)}));
 const toUseful=calls.filter(c=>c.at<=ready.at);
 const firstUseful={ms:Math.round(ready.ms),dataRequests:toUseful.length,notificationRequests:toUseful.filter(c=>c.name==='list_my_account_notification_history').length};
 const cold={requests:count(),rows:calls.filter(c=>c.name==='list_my_account_notification_history').reduce((n,c)=>n+c.rows,0),bytes:calls.filter(c=>c.name==='list_my_account_notification_history').reduce((n,c)=>n+c.bytes,0)};
 await page.keyboard.press('Escape');
 let before=count();
 await page.evaluate(()=>window.dispatchEvent(new Event('tenops:notifications-changed')));
 await expect.poll(()=>count()-before).toBe(process.env.PERF_BASELINE==='1'?2:1);
 await expect(page.getByLabel('1 unread notifications',{exact:true})).toBeVisible();
 // Wait for the controlled refresh to finish before exercising the next event.
 await page.waitForTimeout(100);
 const changeRequests=count()-before;
 before=count();await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
 await expect.poll(()=>count()-before).toBe(1);await page.waitForTimeout(100);
 await page.getByRole('button',{name:'Notifications',exact:true}).click();
 await expect(page.getByText('Welcome fixture',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Mark all as read',exact:true}).click();
 await expect(page.getByLabel('1 unread notifications',{exact:true})).toHaveCount(0);
 await page.getByRole('tab',{name:'all',exact:true}).click();
 await expect(page.getByText('Notice 99',{exact:true})).toBeVisible();
 await expect(page.getByText('Unable to verify complete planning data. Refresh and retry.',{exact:true})).toHaveCount(0);
 await page.screenshot({path:output.replace(/\.json$/,'.png')});
 failHistory=true;await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
 await expect(page.getByRole('dialog',{name:'Notifications',exact:true}).getByRole('alert')).toContainText('Unable to load Notifications');
 failHistory=false;await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
 await expect(page.getByRole('dialog',{name:'Notifications',exact:true}).getByRole('alert')).toHaveCount(0);
 if(process.env.PERF_BASELINE!=='1'){
 // An old in-flight response must not publish welcome status into another account.
 await page.getByRole('button',{name:'Close Notifications',exact:true}).click();
 rows[0].read_at=null;
 holdNextHistory=true;
 await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
 await expect.poll(()=>Boolean(releaseHistory)).toBe(true);
 activeUser='00000000-0000-0000-0000-000000000005';
 rows=[{...rows[1],id:'second-account',title:'Second account only'}];
 const peer=await context.newPage();await peer.goto(base+'/favicon.ico');
 await peer.evaluate(userId=>{
   const key=Object.keys(localStorage).find(key=>key.startsWith('sb-')&&key.endsWith('-auth-token'))!;
   const session=JSON.parse(localStorage.getItem(key)!);
   session.user.id=userId;
   const parts=session.access_token.split('.');
   const claims=JSON.parse(atob(parts[1]));claims.sub=userId;
   parts[1]=btoa(JSON.stringify(claims)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
   session.access_token=parts.join('.');
   localStorage.setItem(key,JSON.stringify(session));
   const channel=new BroadcastChannel(key);channel.postMessage({event:'SIGNED_IN',session});channel.close();
 },activeUser);
 await expect(page.getByRole('button',{name:'Account menu for Second fixture, Admin',exact:true})).toBeVisible();
 releaseHistory?.();await peer.close();
 await expect(page.locator('[data-welcome-hero]')).toHaveCount(0,{timeout:12000});
 await page.getByRole('button',{name:'Notifications',exact:true}).click();
 await page.getByRole('tab',{name:'all',exact:true}).click();
 await expect(page.getByText('Second account only',{exact:true})).toBeVisible();
 await expect(page.getByText('Welcome fixture',{exact:true})).toHaveCount(0);
 assert.equal(await page.evaluate(()=>Number(document.documentElement.dataset.onboardingEvents||0)),1,'old account welcome must not restart onboarding');
 }
 assert.deepEqual(errors,[]);
 const result={accountSwitchVerified:process.env.PERF_BASELINE!=='1',firstUseful,cold,changeRequests,focusRequests:1,assertions:'unread welcome onboarding, 100-row history, mark-all-read, focus freshness, failed refresh recovery, no client errors',synthetic:true};
 writeFileSync(output,JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{await context.close();await browser.close();server.close();}
