// Production-mode shell loading contract; all external requests are intercepted.
import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import { mockManpowerAuth } from '../tests/support/manpower-auth';
const root=resolve(process.env.PERF_ROOT||'out');
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


try{
 for(const flow of ['', 'setup', 'recovery']){
  const context=await browser.newContext({reducedMotion:'reduce'}),page=await context.newPage();
  let profileReads=0,ensures=0;
  await page.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.fulfill({status:200,contentType:'application/json',body:'[]'}));
  await page.routeWebSocket('**/realtime/v1/**',()=>{});
  await page.route('**/rest/v1/**',route=>route.fulfill({status:200,contentType:'application/json',headers:{'content-range':'0-0/0','access-control-expose-headers':'content-range'},body:'[]'}));
  await mockManpowerAuth(page,'admin');
  page.on('request',r=>{if(r.url().includes('/rpc/get_my_app_user'))profileReads++;if(r.url().includes('/rpc/ensure_my_welcome_notification'))ensures++;});
  await page.goto(base+'/'+(flow?'?account='+flow:''));
  if(flow){await expect(page.getByRole('button',{name:'Set password',exact:true})).toBeVisible();await expect(page.locator('[data-welcome-hero]')).toHaveCount(0);}
  else{
   await expect(page.getByRole('button',{name:'Notifications',exact:true})).toBeVisible();
   await expect(page.locator('[data-welcome-hero]')).toHaveCount(0,{timeout:12000});
   assert.equal(profileReads,1);assert.equal(ensures,1);
   for(const event of ['SIGNED_IN','TOKEN_REFRESHED','USER_UPDATED']){
    const before=profileReads;
    await page.evaluate(event=>{const key=Object.keys(localStorage).find(k=>k.startsWith('sb-')&&k.endsWith('-auth-token'))!;const session=JSON.parse(localStorage.getItem(key)!);const channel=new BroadcastChannel(key);channel.postMessage({event,session});channel.close();},event);
    await expect.poll(()=>profileReads).toBe(before+1);
   }
  }
  await context.close();
 }
 console.log('PASS: one recovered-session profile/welcome bootstrap; later sign-in, token refresh and user update revalidate; setup/recovery retain password gate and suppress welcome.');
}finally{await browser.close();server.close();}
