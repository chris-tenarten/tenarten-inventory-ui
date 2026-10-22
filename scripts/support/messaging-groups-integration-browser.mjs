/** Actual production app + local Supabase. No HTTP/Realtime/Storage mocks. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {chromium,expect} from '@playwright/test';
import {createClient} from '@supabase/supabase-js';
const cfg=JSON.parse(readFileSync('.tmp-messaging-groups-review/integration-sessions.json','utf8'));
assert.equal(cfg.apiUrl,'http://127.0.0.1:55481');
const browser=await chromium.launch({headless:true}),contexts=[],errors=[],external=[],checks=[];
const folder='docs/project-memory/evidence/2026-10-22-messaging-groups-replies';
async function open(name,path){
 const account=cfg.accounts[name],context=await browser.newContext({viewport:name==='member'?{width:390,height:844}:{width:1440,height:1000}});contexts.push(context);
 await context.addInitScript(({session})=>{localStorage.setItem('sb-127-auth-token',JSON.stringify(session));sessionStorage.setItem('tenops.welcomeHeroPlayed:'+session.user.id,'true');},{session:account.session});
 await context.route('**/*',r=>{const url=new URL(r.request().url());if(['http://localhost:3000',cfg.apiUrl].includes(url.origin))return r.continue();external.push(url.origin);return r.abort();});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 const joined=[];page.on('websocket',socket=>socket.on('framereceived',event=>{try{const frame=JSON.parse(event.payload);const topic=Array.isArray(frame)?frame[2]:frame.topic,eventName=Array.isArray(frame)?frame[3]:frame.event,payload=Array.isArray(frame)?frame[4]:frame.payload;if(eventName==='phx_reply'&&payload?.status==='ok')joined.push(topic);}catch{/* Ignore non-JSON frames. */}}));
 await page.goto('http://localhost:3000'+path);await page.getByRole('button',{name:'Messaging',exact:true}).waitFor();
 return{page,context,joined};
}
const rpcClient=async name=>{const a=cfg.accounts[name],client=createClient(cfg.apiUrl,cfg.anonKey,{auth:{persistSession:false,autoRefreshToken:false}});const r=await client.auth.setSession(a.session);assert.ifError(r.error);return client;};
const admin=await rpcClient('admin');
try{
 const A=await open('admin','/?inboxUserId='+cfg.group),B=await open('member','/?inboxUserId='+cfg.group);
 for(const actor of [A,B]){await actor.page.getByRole('button',{name:'View group participants',exact:true}).waitFor();await expect.poll(()=>actor.joined.some(topic=>topic.endsWith('my-work-inbox:'+cfg.accounts[actor===A?'admin':'member'].id))).toBe(true);}
 const text='Real browser message '+randomUUID();
 await B.page.getByRole('textbox',{name:'Message',exact:true}).fill(text);await B.page.getByRole('button',{name:'Send',exact:true}).click();
 await A.page.getByText(text,{exact:true}).last().waitFor();
 const original=A.page.locator('article').filter({has:A.page.getByText(text,{exact:true})});await original.getByRole('button',{name:'Message actions',exact:true}).click();await A.page.getByRole('button',{name:'Reply',exact:true}).click();
 const reply='Real synchronized reply '+randomUUID();await A.page.getByRole('textbox',{name:'Message',exact:true}).fill(reply);await A.page.getByRole('button',{name:'Send',exact:true}).click();await B.page.getByText(reply,{exact:true}).last().waitFor();
 await B.page.goto('http://localhost:3000/?inboxUserId='+cfg.group);await B.page.getByRole('button',{name:'View group participants',exact:true}).waitFor();await B.page.locator('article').filter({has:B.page.getByText(reply,{exact:true})}).getByRole('button').filter({hasText:text}).click();
 const attachmentBody='Real shared browser attachment '+randomUUID();
 await A.page.getByLabel('Attach files',{exact:true}).setInputFiles({name:'browser-shared.txt',mimeType:'text/plain',buffer:Buffer.from('Real browser upload '+text)});
 await A.page.getByRole('textbox',{name:'Message',exact:true}).fill(attachmentBody);await A.page.getByRole('button',{name:'Send',exact:true}).click();
 await B.page.locator('article').filter({has:B.page.getByText(attachmentBody,{exact:true})}).getByText('browser-shared.txt',{exact:true}).waitFor({timeout:20000});
 const download=B.page.locator('article').filter({has:B.page.getByText(attachmentBody,{exact:true})}).getByRole('button',{name:'Download',exact:true});
 const signedRequest=B.page.waitForResponse(r=>r.url().includes('/storage/v1/object/sign/')&&r.request().method()==='POST');await download.click();assert.equal((await signedRequest).status(),200);
 await A.page.screenshot({path:folder+'/real-desktop.png'});await B.page.screenshot({path:folder+'/real-mobile.png'});
 console.log('PASS actual browser send/reply/reload/TUS/download');
 checks.push('desktop/mobile real-account send, reply, reload/quote navigation and TUS attachment synchronization without API mocks');
 // Receipt RPC responses demonstrate actual state convergence, not just optimistic local UI.
 const summary=await admin.rpc('list_my_work_conversations_v12');assert.ifError(summary.error);assert.equal(summary.data.find(s=>s.groupId===cfg.group).unread,0);
 const removed=await admin.rpc('save_my_work_message_group',{p_id:cfg.group,p_name:cfg.groupName,p_members:[cfg.accounts.admin.id,cfg.accounts.lead.id]});assert.ifError(removed.error);
 await expect(B.page.locator('article').filter({has:B.page.getByText(text,{exact:true})})).toHaveCount(0);
 const again=await admin.rpc('save_my_work_message_group',{p_id:cfg.group,p_name:cfg.groupName,p_members:[cfg.accounts.admin.id,cfg.accounts.member.id]});assert.ifError(again.error);
 console.log('PASS actual browser membership removal and unread convergence');
 checks.push('real receipt convergence and removed-member open conversation clears on Realtime membership event');
 await A.page.goto('http://localhost:3000/?pushNotificationId='+cfg.groupNotification);await A.page.getByRole('button',{name:'View group participants',exact:true}).waitFor();await expect(A.page.getByRole('button',{name:'View group participants',exact:true})).toContainText(cfg.groupName);
 await A.page.goto('http://localhost:3000/?pushNotificationId='+cfg.dmNotification);await A.page.locator('#my-work-inbox-title').waitFor();await A.page.getByText('Preserved DM push',{exact:true}).last().waitFor();assert.equal(await A.page.getByRole('button',{name:'View group participants',exact:true}).count(),0);
 const denied=await open('outsider','/?pushNotificationId='+cfg.groupNotification);await denied.page.getByRole('status').filter({hasText:'This notification is unavailable for this account or its content is no longer accessible.'}).waitFor();
 const mentionDestination=A.page.waitForRequest(r=>r.isNavigationRequest()&&new URL(r.url()).searchParams.get('open-production-job')===cfg.mentionJob);await A.page.goto('http://localhost:3000/?pushNotificationId='+cfg.mentionNotification);await mentionDestination;
 checks.push('real authenticated cold notification deep links open group and DM, deny wrong account, and preserve mention Job destination');
 assert.deepEqual(external,[]);assert.deepEqual(errors,[]);
 writeFileSync(folder+'/integration-browser-results.json',JSON.stringify({checks,origin:'http://localhost:3000',apiMocks:false,realRealtime:true,realStorage:true,externalRequests:0,pageErrors:0},null,2)+'\n');for(const check of checks)console.log('PASS '+check);
}catch(error){for(let i=0;i<contexts.length;i++){const page=contexts[i].pages()[0];console.error('Account '+i+': '+(await page.locator('body').innerText()).slice(-2500));await page.screenshot({path:'.tmp-messaging-groups-review/real-failure-'+i+'.png'});}throw error;}finally{for(const context of contexts)await context.close();await admin.removeAllChannels();await browser.close();}
