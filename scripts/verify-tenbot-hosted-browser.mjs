// Focused actual Messaging component check at localhost:3000. Candidate static
// export + synthetic RPC/API transports; no hosted auth/database/inference claim.
import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs';import path from 'node:path';
import {tsImport} from 'tsx/esm/api';
import {session} from './support/wave4-fixture.mjs';
import {uuid} from './support/wave2-fixture.mjs';
const {createHostedTenbotFixture}=await tsImport('./support/tenbot-hosted-fixture.mts',import.meta.url);
const origin='http://localhost:3000',dir='/private/tmp/tenops-tenbot-hosted-adapter-20261029';
const output=process.env.TENBOT_HOSTED_BROWSER_EXPORT||dir+'/source/out';
const browser=await chromium.launch({headless:true}),checks=[],errors=[];
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.txt':'text/plain','.svg':'image/svg+xml','.woff2':'font/woff2'};
try{
 for(const [name,mobile,statusFailure] of [['desktop',false,false],['mobile',true,false],['status-recovery',false,true]]){
  const f=createHostedTenbotFixture(uuid(900021)),context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:1000}}),page=await context.newPage();page.setDefaultTimeout(12000);page.on('pageerror',error=>errors.push(error.message));
  const calls=[];let failStatus=statusFailure,failHistory=false;
  await context.addInitScript(({key,value,owner})=>{localStorage.setItem(key,JSON.stringify(value));sessionStorage.setItem('tenops.welcomeHeroPlayed:'+owner,'true');},{key:'sb-localhost-auth-token',value:session(uuid(900021)),owner:uuid(900021)});
  await page.route('**/*',async route=>{
   const req=route.request(),url=new URL(req.url());
   if(url.origin!==origin){if(['data:','blob:'].includes(url.protocol))return route.continue();return route.abort();}
   if(url.pathname==='/functions/v1/tenbot'){
    const body=req.postDataJSON();calls.push(body.action);
    if(body.action==='status'&&failStatus){failStatus=false;return route.fulfill({status:503,json:{error:'Synthetic transient status failure'}});}
    if(body.action==='history'&&failHistory){failHistory=false;return route.fulfill({status:409,json:{error:'A request is already running in this conversation.'}});}
    try{return route.fulfill({json:await f.handler(origin)(body)});}catch(error){return route.fulfill({status:error.status||500,json:{error:error.message}});}
   }
   if(req.method()==='GET'&&!/^\/(auth|rest|storage|realtime)\//.test(url.pathname)){
    const relative=decodeURIComponent(url.pathname).replace(/^\//,'')||'index';
    const file=[relative,relative+'.html',relative+'/index.html'].map(p=>path.resolve(output,p)).find(p=>p.startsWith(output+'/')&&fs.existsSync(p)&&fs.statSync(p).isFile());
    if(file)return route.fulfill({contentType:mime[path.extname(file)]||'application/octet-stream',body:fs.readFileSync(file)});
   }
   return route.continue();
  });
  const inbox=()=>page.getByRole('dialog',{name:'Inbox',exact:true});
  async function open(){await page.getByRole('button',{name:'Messaging',exact:true}).click();await expect(inbox()).toBeVisible();await inbox().locator('aside').getByRole('button').filter({has:page.getByText('TenBot',{exact:true})}).click();await expect(inbox().getByRole('textbox',{name:'Message',exact:true})).toBeEnabled();}
  await page.goto(origin+'/my-work');await open();
  await inbox().getByRole('textbox',{name:'Message',exact:true}).fill(f.archived.question);await inbox().getByRole('button',{name:'Send',exact:true}).click();await expect(inbox().locator('[data-tenbot-answer]')).toContainText(f.archived.expectedMessage);
  assert.equal(f.state.providerCalls,3);await expect(inbox().getByText('Local Agent Experiment',{exact:true})).toHaveCount(0);await expect(inbox().getByRole('button',{name:/attach/i})).toHaveCount(0);
  const saved=await page.evaluate(()=>sessionStorage.getItem('tenops.tenbot.experimental-conversation.v1'));assert(saved&&JSON.parse(saved).mode==='hosted');assert(!saved.includes(f.archived.expectedMessage));
  await page.evaluate(()=>{window.dispatchEvent(new Event('blur'));window.dispatchEvent(new Event('focus'));});await expect(inbox().locator('[data-tenbot-answer]')).toContainText(f.archived.expectedMessage);
  await page.reload();await open();await expect(inbox().locator('[data-tenbot-answer]')).toContainText(f.archived.expectedMessage);assert.equal(f.state.providerCalls,3);
  if(name==='desktop'){
   failHistory=true;await page.reload();await open();await expect(inbox().getByText(/history is temporarily unavailable/)).toBeVisible();assert(await page.evaluate(()=>sessionStorage.getItem('tenops.tenbot.experimental-conversation.v1')));
   await page.reload();await open();await expect(inbox().locator('[data-tenbot-answer]')).toContainText(f.archived.expectedMessage);assert.equal(f.state.providerCalls,3);
  }
  await page.screenshot({path:dir+'/'+name+'.png',fullPage:true});checks.push({name,passed:true,historyRequests:calls.filter(x=>x==='history').length,inferenceReplayCalls:0,experimentalControls:false});await context.close();
 }
 assert.deepEqual(errors,[]);const report={passed:true,checks,mode:'Candidate localhost Messaging, synthetic backend and archived provider transport',actualInference:false,actualDatabase:false};fs.writeFileSync(dir+'/browser.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}finally{await browser.close();}
