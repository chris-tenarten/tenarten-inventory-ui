/** Real TenOps app and real isolated local Supabase. No API mocks or hosted source. */
import assert from 'node:assert/strict';
import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
const cfg=JSON.parse(await readFile('.tmp-permission-review/config.json','utf8'));
assert.equal(new URL(cfg.apiUrl).origin,'http://127.0.0.1:55481');
const origin='http://localhost:3000',errors=[],unexpected=[];
const browser=await chromium.launch({headless:true});
const pages={};
async function login(name,path='/my-work'){
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();pages[name]=page;
 page.on('pageerror',e=>errors.push(name+': '+e.message));page.on('request',r=>{if(r.url().includes('supabase.co'))unexpected.push(r.url());});
 await page.goto(origin+path);await page.getByLabel('Email',{exact:true}).fill(cfg.actors[name].email);await page.getByLabel('Password',{exact:true}).fill(cfg.actors[name].password);await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await page.getByRole('button',{name:'Messaging',exact:true}).waitFor();return page;
}
async function openMessaging(page){await page.getByRole('button',{name:'Messaging',exact:true}).click();await page.getByRole('dialog').filter({has:page.locator('#my-work-inbox-title')}).waitFor();}
async function conversation(page,name){await page.getByRole('button').filter({has:page.getByText('Local '+name,{exact:true})}).last().click();await page.getByRole('textbox',{name:'Message',exact:true}).waitFor();}
try{
 await mkdir('.tmp-permission-review/screenshots',{recursive:true});
 const support=await login('support');await support.getByRole('heading',{name:'My Work',exact:true}).waitFor();
 assert(await support.getByRole('textbox',{name:'Task title',exact:true}).isDisabled());
 assert(await support.getByRole('button',{name:'Add task',exact:true}).first().isDisabled());
 await openMessaging(support);await conversation(support,'member');
 assert(await support.getByRole('textbox',{name:'Message',exact:true}).isEnabled());
 const body='Browser support message '+Date.now();await support.getByRole('textbox',{name:'Message',exact:true}).fill(body);await support.getByRole('button',{name:'Send',exact:true}).click();await support.getByText(body,{exact:true}).last().waitFor();
 await support.waitForFunction(()=>!document.querySelector('input[aria-label="Attach files"]').disabled);
 await support.getByLabel('Attach files',{exact:true}).setInputFiles({name:'browser-local.txt',mimeType:'text/plain',buffer:Buffer.from('local browser attachment')});await support.getByRole('button',{name:'Send',exact:true}).click();await support.getByText('browser-local.txt',{exact:true}).first().waitFor();
 await support.screenshot({path:'.tmp-permission-review/screenshots/support-messaging.png',fullPage:true});
 const member=await login('member');const task='Browser Member task '+Date.now();await member.getByRole('textbox',{name:'Task title',exact:true}).fill(task);assert(await member.getByRole('button',{name:'Add task',exact:true}).first().isEnabled());await member.getByRole('button',{name:'Add task',exact:true}).first().click();await member.getByText(task,{exact:true}).waitFor();await openMessaging(member);await conversation(member,'support');await member.getByText(body,{exact:true}).last().waitFor();
 const reply='Browser member reply '+Date.now();await member.getByRole('textbox',{name:'Message',exact:true}).fill(reply);await member.getByRole('button',{name:'Send',exact:true}).click();await support.getByText(reply,{exact:true}).last().waitFor();
 const reader=await login('reader');await openMessaging(reader);await conversation(reader,'member');assert(await reader.getByRole('textbox',{name:'Message',exact:true}).isDisabled());assert(await reader.getByRole('button',{name:'Send',exact:true}).isDisabled());
 const admin=await login('admin','/settings');await admin.getByRole('heading',{name:'Users & Access',exact:true}).waitFor();
 const row=admin.getByText(cfg.actors.reader.email,{exact:true}).locator('..');await row.getByLabel('Read-only outside Messaging',{exact:true}).check();await row.getByLabel('Allow Messaging write',{exact:true}).check();await row.getByRole('button',{name:'Save',exact:true}).click();await admin.getByText('User access updated.',{exact:true}).waitFor();
 await reader.reload();await openMessaging(reader);await conversation(reader,'member');assert(await reader.getByRole('textbox',{name:'Message',exact:true}).isEnabled());
 await row.getByLabel('Allow Messaging write',{exact:true}).uncheck();await row.getByRole('button',{name:'Save',exact:true}).click();
 await admin.waitForFunction(()=>document.querySelector('[role=status]')?.textContent?.includes('User access updated.')||Array.from(document.querySelectorAll('[role=status]')).some(e=>e.textContent.includes('User access updated.')));
 await reader.reload();await openMessaging(reader);await conversation(reader,'member');assert(await reader.getByRole('textbox',{name:'Message',exact:true}).isDisabled());
 await admin.screenshot({path:'.tmp-permission-review/screenshots/admin-assignment.png',fullPage:true});
 await support.goto(origin+'/settings');assert.equal(await support.getByRole('heading',{name:'Users & Access',exact:true}).count(),0);
 await support.getByText('Local review phase',{exact:true}).first().waitFor();assert(await support.getByRole('button',{name:'Add definition',exact:true}).isDisabled());
 // Direct Edge actions with genuine JWTs: restricted business writes fail before
 // privileged Storage/record mutation; ordinary preview generation remains usable.
 const client=createClient(cfg.apiUrl,cfg.anonKey,{auth:{persistSession:false}});await client.auth.setSession(cfg.actors.support.session);
 for(const action of ['generate','delete']){const response=await fetch(cfg.apiUrl+'/functions/v1/generate-sample-pdf',{method:'POST',headers:{authorization:'Bearer '+cfg.actors.support.session.access_token,apikey:cfg.anonKey,'content-type':'application/json',origin},body:JSON.stringify({action,documentId:'00000000-0000-0000-0000-000000000000',sampleId:'00000000-0000-0000-0000-000000000000'})});assert.equal(response.status,403,await response.text());}
 for(const action of ['generate','delete']){const response=await fetch(cfg.apiUrl+'/functions/v1/generate-proposal-pdf',{method:'POST',headers:{authorization:'Bearer '+cfg.actors.support.session.access_token,apikey:cfg.anonKey,'content-type':'application/json',origin},body:JSON.stringify({action,proposalId:'00000000-0000-0000-0000-000000000000'})});assert.equal(response.status,403,await response.text());}
 for(const token of [cfg.actors.support.session.access_token,null]){const response=await fetch(origin+'/api/delete-transaction',{method:'POST',headers:{'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})},body:JSON.stringify({transactionId:'00000000-0000-0000-0000-000000000000'})});assert.equal(response.status,token?403:401,await response.text());}
 const preview=await fetch(cfg.apiUrl+'/functions/v1/generate-sample-pdf',{method:'POST',headers:{authorization:'Bearer '+cfg.actors.support.session.access_token,apikey:cfg.anonKey,'content-type':'application/json',origin},body:JSON.stringify({action:'preview',snapshot:{project_name:'Local permission review',customer_name:'Local only',color_plate_number:'LOCAL-READ',blend_rows:[{percentage:100,color:'White',vendor:'Local'}]}})});assert.equal(preview.status,200,await preview.clone().text());assert.match(preview.headers.get('content-type'),/application\/pdf/);await writeFile('.tmp-permission-review/readonly-preview.pdf',Buffer.from(await preview.arrayBuffer()));
 assert.deepEqual(unexpected,[]);assert.deepEqual(errors,[]);
 const evidence={origin,actualApp:true,noApiMocks:true,localDataOnly:true,myWorkCreateDisabled:true,messagingSendReplyAttachment:true,readerComposerDisabled:true,memberCreateUnchanged:true,adminAssignmentAndRevocationUi:true,adminHiddenForReadOnly:true,sampleEdgeWriteDenied:true,proposalEdgeWriteDenied:true,nextServerWriteDenied:true,phaseLibraryReadOnly:true,readonlyPdfPreview:true,pageErrors:errors,hostedRequests:unexpected};
 await writeFile('.tmp-permission-review/browser-results.json',JSON.stringify(evidence,null,2));console.log('PASS actual localhost TenOps: business controls; Messaging send/reply/attachment; read-only composer; normal Member; Admin assignment/revocation; direct Edge denial and PDF preview.');
}catch(error){for(const [name,page] of Object.entries(pages)){await page.screenshot({path:'.tmp-permission-review/screenshots/failure-'+name+'.png',fullPage:true}).catch(()=>{});await writeFile('.tmp-permission-review/failure-'+name+'.txt',await page.locator('body').innerText()).catch(()=>{});}throw error;}finally{await browser.close();}
