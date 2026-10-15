/** Focused browser boundary check. Synthetic auth/read responses; real local guard for every denial. */
import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {startMessagingDraftFixture} from './support/messaging-draft-review-fixture.mjs';
import {PREFIX,planRequest} from './support/read-only-review-guard.mjs';
const fixture=startMessagingDraftFixture();
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
const page=await context.newPage(),external=[],errors=[],denied=[];
page.on('pageerror',e=>errors.push(e.message));
await context.route('**/*',async route=>{
 const request=route.request(),url=new URL(request.url());
 if(url.hostname!=='localhost'){external.push(url.origin);return route.abort();}
 if(url.pathname.startsWith(PREFIX+'/')){
  const body=request.postDataJSON()??{};
  if(planRequest(url.href,request.method(),body)){
   // No test credentials/session leave the local fixture.
   const upstream=await fetch('http://127.0.0.1:55592'+url.pathname.slice(PREFIX.length)+url.search,{method:request.method(),headers:{'content-type':'application/json'},body:request.method()==='POST'?JSON.stringify(body):undefined});
   let responseBody=await upstream.text();
   if(url.pathname.endsWith('/list_my_work_message_page_v11'))responseBody=JSON.stringify(JSON.parse(responseBody).map(row=>({...row,read_at:null})));
   return route.fulfill({status:upstream.status,contentType:'application/json',body:responseBody});
  }
 }
 return route.continue();
});
page.on('response',r=>{if(r.status()===403&&r.url().includes(PREFIX))denied.push(new URL(r.url()).pathname);});
const box=page.getByRole('textbox',{name:'Message',exact:true});
async function open(){await page.getByRole('button',{name:'Messaging',exact:true}).click();await page.locator('#my-work-inbox-title').waitFor();}
async function bob(){await page.getByRole('button').filter({has:page.getByText('Draft Review Bob',{exact:true})}).last().click();await box.waitFor();}
async function value(text){await page.waitForFunction(t=>document.querySelector('textarea[aria-label="Message"]')?.value===t,text);}
try{
 await page.goto('http://localhost:3000/');
 await page.getByLabel('Email',{exact:true}).fill('local-guard-test@example.invalid');await page.getByLabel('Password',{exact:true}).fill('synthetic-only');await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await page.getByRole('button',{name:'Messaging',exact:true}).waitFor();
 assert((await page.evaluate(()=>getComputedStyle(document.body,'::before').content)).includes('READ-ONLY REVIEW'));
 await open();await bob();await box.fill('Read-only local draft');
 await page.getByRole('button',{name:'Close Inbox',exact:true}).click();await page.goto('http://localhost:3000/my-work');await open();await bob();await value('Read-only local draft');
 await page.reload();await open();await bob();await value('Read-only local draft');
 await page.getByRole('button',{name:'Send',exact:true}).click();await page.getByRole('alert').filter({hasText:'Unable to send message'}).waitFor();await value('Read-only local draft');
 const checks=await page.evaluate(async({prefix})=>{
  const paths=['/rest/v1/rpc/ensure_my_welcome_notification','/rest/v1/rpc/mark_my_work_inbox_conversation_read','/rest/v1/rpc/send_my_work_inbox_message','/rest/v1/rpc/unknown_mutation','/storage/v1/object/test/file','/storage/v1/upload/resumable','/functions/v1/generate-sample-pdf','/functions/v1/unknown','/realtime/v1/api/broadcast'];
  const result=[];for(const path of paths){const response=await fetch(prefix+path,{method:'POST',headers:{'content-type':'application/json'},body:'{}'});result.push([path,response.status]);}
  result.push(['local-api',(await fetch('/api/delete-transaction',{method:'POST',body:'{}'})).status]);
  let cspBlocked=false;try{await fetch('https://example.invalid/blocked',{method:'POST',body:'blocked'});}catch{cspBlocked=true;}
  let workerBlocked=false;try{const worker=new Worker(URL.createObjectURL(new Blob(['postMessage(1)'],{type:'text/javascript'})));worker.terminate();}catch{workerBlocked=true;}
  return {result,cspBlocked,workerBlocked};
 },{prefix:PREFIX});
 for(const [path,status] of checks.result)assert.equal(status,403,path);assert(checks.cspBlocked);
 assert(denied.some(p=>p.endsWith('ensure_my_welcome_notification')));assert(denied.some(p=>p.endsWith('send_my_work_inbox_message')));assert(denied.some(p=>p.endsWith('mark_my_work_inbox_conversation_read')));
 const response=await context.request.get('http://localhost:3000/');assert(response.headers()['content-security-policy'].includes("worker-src 'none'"));
 assert.deepEqual(external,[]);assert.deepEqual(errors,[]);
 console.log('PASS real guarded app: synthetic login/read transport, pre-init CSP/banner, automatic welcome blocked, send blocked/draft retained, navigation/refresh draft restoration, explicit receipt/upload/unknown RPC/Edge/Realtime/local API denials and direct external fetch blocked.');
 console.log('Production-account login remains a manual Chris check; no synthetic credentials were sent to hosted Auth.');
}catch(error){console.error((await page.locator('body').innerText()).slice(0,3000));throw error;}finally{await context.close();await browser.close();await new Promise(resolve=>fixture.close(resolve));}
