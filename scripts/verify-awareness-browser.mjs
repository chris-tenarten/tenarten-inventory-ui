/** Actual app with synthetic API interception; no hosted business traffic. */
import assert from 'node:assert/strict';
import {writeFileSync,mkdirSync} from 'node:fs';
import {chromium,expect} from '@playwright/test';
import {reviewSession} from './support/messaging-draft-review-fixture.mjs';
const origin=process.env.AWARENESS_ORIGIN||'http://localhost:3000',output=process.env.AWARENESS_OUTPUT||'output/awareness-after.json';
const browser=await chromium.launch({headless:!process.argv.includes('--review'),...(process.argv.includes('--review')?{channel:'chrome'}:{})}),context=await browser.newContext({viewport:{width:1440,height:1000}});
const owner=reviewSession.user.id,peer='00000000-0000-4000-8000-000000900022',other='00000000-0000-4000-8000-000000900023',stamp='2026-10-19T12:00:00Z';
const session=id=>({...reviewSession,user:{...reviewSession.user,id},access_token:Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:id,role:'authenticated',exp:4102444800,session_id:id})).toString('base64url')+'.fixture'});
const peers=[peer,other].map((id,i)=>({user_id:id,display_name:i?'Wave Carol':'Wave Bob',role:'member'}));
let messages=peers.map((p,i)=>({id:'00000000-0000-4000-8000-00000091000'+i,sender_user_id:p.user_id,sender_name:p.display_name,recipient_user_id:owner,recipient_name:'Wave Owner',body:'Wave conversation '+i,created_at:stamp,read_at:stamp,attachments:[]}));
let notices=[],denied=false,holdHistory=null,heldHistory=null,holdSummary=null,heldSummary=null,summaryDenied=false,active=0;
const calls=[],errors=[],external=[],measurements=[],sockets=[];
await context.addInitScript(({session})=>{for(const key of ['sb-localhost-auth-token','sb-127-auth-token'])localStorage.setItem(key,JSON.stringify(session));sessionStorage.setItem('tenops.welcomeHeroPlayed:'+session.user.id,'true');window.restorationEntrances=0;let previous=false;new MutationObserver(()=>{const current=!!document.body?.innerText.includes('Restoring your TenOps session');if(current&&!previous)window.restorationEntrances++;previous=current;}).observe(document,{childList:true,subtree:true});},{session:session(owner)});
await context.routeWebSocket('**/realtime/v1/**',ws=>{const joined=new Map();sockets.push({ws,joined});ws.onMessage(raw=>{let m;try{m=JSON.parse(raw);}catch{return;}if(Array.isArray(m)) {const [join_ref,ref,topic,event,payload]=m;m={join_ref,ref,topic,event,payload,array:true};}const reply=value=>ws.send(JSON.stringify(m.array?[m.join_ref,value.ref,value.topic,value.event,value.payload]:value));if(m.event==='phx_join'){joined.set(m.topic,m.payload?.config);joined.set(m.topic,{...m.payload?.config,join_ref:m.join_ref,array:m.array});reply({event:'phx_reply',topic:m.topic,ref:m.ref,payload:{status:'ok',response:{postgres_changes:(m.payload?.config?.postgres_changes||[]).map((x,i)=>({...x,id:i+1}))}}});}else if(m.event==='heartbeat'||m.event==='phx_leave')reply({event:'phx_reply',topic:m.topic,ref:m.ref,payload:{status:'ok',response:{}}});});});
const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
await context.route('**/*',async route=>{
 const req=route.request(),url=new URL(req.url());
 if(url.pathname.startsWith('/rest/v1/')||url.pathname.startsWith('/auth/v1/')){
  active++;const name=url.pathname.split('/').at(-1),start=Date.now();let body={};try{body=req.postDataJSON()||{};}catch{}
  let id=owner;try{id=JSON.parse(Buffer.from(req.headers().authorization.slice(7).split('.')[1],'base64url')).sub;}catch{}
  let data=[],status=200,headers={'content-range':'0-0/0','access-control-expose-headers':'content-range'};
  if(url.pathname.startsWith('/auth/v1/'))data=url.pathname.endsWith('/token')?session(id):session(id).user;
  else if(name==='get_my_app_access')data=[{user_id:id,display_name:'Wave Owner',role:'admin',is_active:!denied,read_only:false,messaging_write:true}];
  else if(name==='get_my_account_preferences')data={};
  else if(name==='list_my_work_inbox_recipients')data=peers;
  else if(name==='list_my_work_conversations_v11')data=id===owner?peers.map(p=>{const rows=messages.filter(m=>m.sender_user_id===p.user_id||m.recipient_user_id===p.user_id),last=rows.at(-1);return{userId:p.user_id,name:p.display_name,role:p.role,unread:rows.filter(m=>m.recipient_user_id===id&&!m.read_at).length,latest:{id:last.id,body:last.body,createdAt:last.created_at}};}):[];
  else if(name==='my_work_messages')headers['content-range']='0-0/'+messages.filter(m=>m.recipient_user_id===id&&!m.read_at).length;
  else if(name==='list_my_work_message_page_v11')data=id===owner?messages.filter(m=>(m.sender_user_id===body.p_peer||m.recipient_user_id===body.p_peer)&&(!body.p_ids||body.p_ids.includes(m.id))):[];
  else if(name==='mark_my_work_inbox_conversation_read')messages=messages.map(m=>m.sender_user_id===body.p_other_user_id?{...m,read_at:stamp}:m);
  else if(name==='send_my_work_inbox_message'){const next={id:'00000000-0000-4000-8000-'+String(920000+messages.length).padStart(12,'0'),sender_user_id:id,sender_name:'Wave Owner',recipient_user_id:body.p_recipient_user_id,recipient_name:'Peer',body:body.p_body,created_at:new Date().toISOString(),read_at:stamp,attachments:[]};messages.push(next);data=next.id;}
  else if(name==='mark_all_my_account_notifications_read')notices=notices.map(n=>({...n,read_at:stamp}));
  else if(name==='list_my_account_notification_history')data=id===owner?structuredClone(notices):[];
  if(name==='list_my_account_notification_history'&&holdHistory){const resolve=holdHistory;holdHistory=null;await new Promise(done=>{heldHistory=done;resolve();});}
  if(name==='list_my_work_conversations_v11'&&holdSummary){const resolve=holdSummary;holdSummary=null;await new Promise(done=>{heldSummary=done;resolve();});}
  if(name==='list_my_work_conversations_v11'&&summaryDenied){status=403;data={message:'Synthetic summary denial',code:'42501'};}
  await new Promise(resolve=>setTimeout(resolve,35));const payload=JSON.stringify(data);calls.push({name,id,bytes:Buffer.byteLength(payload),start,done:Date.now()});
  try{await route.fulfill({status,contentType:'application/json',headers,body:req.method()==='HEAD'?'':payload});}finally{active--;}return;
 }
 if(url.pathname.startsWith('/realtime/'))return route.fulfill({status:200,contentType:'application/json',body:'{}'});
 if(url.origin!==origin||!['GET','HEAD'].includes(req.method())||url.pathname.startsWith('/functions/')||url.pathname.startsWith('/storage/')){external.push(url.href);return route.abort();}
 return route.continue();
});
async function settle(){await expect.poll(()=>active).toBe(0);await page.waitForTimeout(180);await expect.poll(()=>active).toBe(0);}
async function scenario(name,fn){console.log('CHECK '+name);await settle();const from=calls.length,start=Date.now();await fn();await settle();const rows=calls.slice(from);measurements.push({name,ms:Date.now()-start,requests:rows.length,bytes:rows.reduce((s,r)=>s+r.bytes,0),counts:Object.fromEntries([...new Set(rows.map(r=>r.name))].map(n=>[n,rows.filter(r=>r.name===n).length]))});}
async function open(){await page.getByRole('button',{name:'Messaging',exact:true}).click();await expect(page.locator('#my-work-inbox-title')).toBeVisible();}
async function choose(name){await page.getByRole('button').filter({has:page.getByText(name,{exact:true})}).last().click();await expect(page.getByRole('textbox',{name:'Message',exact:true})).toBeVisible();}
function sendEvent(s,topic,event,payload){const cfg=s.joined.get(topic);s.ws.send(JSON.stringify(cfg?.array?[cfg.join_ref,null,topic,event,payload]:{topic,event,payload}));}
async function broadcast(kind,id){for(const s of sockets)for(const topic of s.joined.keys())if(topic.startsWith('realtime:my-work-typing:'))sendEvent(s,topic,'broadcast',{event:'message_changed',payload:{id,kind},type:'broadcast'});}
async function emitAuth(id,event='SIGNED_IN'){await page.evaluate(({session,event})=>{localStorage.setItem('sb-localhost-auth-token',JSON.stringify(session));const c=new BroadcastChannel('sb-localhost-auth-token');c.postMessage({event,session});c.close();},{session:session(id),event});}
try{
 if(process.argv.includes('--review')){notices=[{id:'wave-review-notice',notification_type:'fixture',title:'Local Wave 1 review',body:'Disposable synthetic notification',metadata:{},read_at:null,created_at:stamp}];await page.goto(origin+'/my-work');await open();console.log('Actual localhost:3000 candidate with synthetic Wave Bob/Carol conversations. No hosted traffic. Close this browser to stop the review.');await new Promise(resolve=>browser.on('disconnected',resolve));process.exit(0);}
 const start=Date.now();await page.goto(origin+'/my-work');await expect(page.getByRole('button',{name:'Messaging',exact:true})).toBeVisible();await settle();measurements.push({name:'initial shell',ms:Date.now()-start,requests:calls.length,bytes:calls.reduce((s,r)=>s+r.bytes,0),counts:Object.fromEntries([...new Set(calls.map(r=>r.name))].map(n=>[n,calls.filter(r=>r.name===n).length]))});
 await scenario('first Messaging open',open);
 await scenario('reopen Messaging',async()=>{await page.getByRole('button',{name:'Close Inbox',exact:true}).click();await open();});
 await scenario('switch conversations',async()=>{await choose('Wave Bob');await choose('Wave Carol');});
 await scenario('send message',async()=>{await page.getByRole('textbox',{name:'Message',exact:true}).fill('Wave sent text');await page.getByRole('button',{name:'Send',exact:true}).click();await expect(page.getByText('Wave sent text',{exact:true}).last()).toBeVisible();});
 await scenario('receive and mark read',async()=>{const m={...messages[0],id:'00000000-0000-4000-8000-000000930001',sender_user_id:other,body:'Wave incoming',read_at:null};messages.push(m);await broadcast('new',m.id);await expect(page.getByText('Wave incoming',{exact:true}).last()).toBeVisible();await expect.poll(()=>messages.find(x=>x.id===m.id).read_at).not.toBe(null);});
 await scenario('edited message event',async()=>{messages=messages.map(m=>m.body==='Wave incoming'?{...m,body:'Wave edited',edited_at:stamp}:m);await broadcast('update','00000000-0000-4000-8000-000000930001');await expect(page.getByText('Wave edited',{exact:true}).last()).toBeVisible();});
 await scenario('deleted message event',async()=>{messages=messages.filter(m=>m.id!=='00000000-0000-4000-8000-000000930001');await broadcast('delete','00000000-0000-4000-8000-000000930001');await expect(page.getByText('Wave edited',{exact:true})).toHaveCount(0);});
 await scenario('overlapping notification triggers',()=>page.evaluate(()=>{window.dispatchEvent(new Event('focus'));for(let i=0;i<5;i++)window.dispatchEvent(new Event('tenops:notifications-changed'));}));
 await scenario('notification event during delayed read',async()=>{const held=new Promise(resolve=>{holdHistory=resolve;});await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await Promise.race([held,new Promise((_,reject)=>setTimeout(()=>reject(new Error('Fixture request was not started')),8000))]);notices=[{id:'wave-notice',notification_type:'fixture',title:'Wave late notice',body:'Synthetic only',metadata:{},read_at:null,created_at:stamp}];await page.evaluate(()=>window.dispatchEvent(new Event('tenops:notifications-changed')));heldHistory();await expect(page.getByLabel('1 unread notifications',{exact:true})).toBeVisible();});
 await scenario('focus after completed refresh',()=>page.evaluate(()=>window.dispatchEvent(new Event('focus'))));
 const restorations=await page.evaluate(()=>window.restorationEntrances);
 await scenario('continuing session refocus',async()=>{await page.getByRole('textbox',{name:'Message',exact:true}).fill('Preserved Wave draft');await emitAuth(owner);await expect(page.getByRole('textbox',{name:'Message',exact:true})).toHaveValue('Preserved Wave draft');});assert.equal(await page.evaluate(()=>window.restorationEntrances),restorations);
 await scenario('reconnect',async()=>{const before=calls.filter(c=>c.name==='list_my_work_message_page_v11').length;for(const s of sockets)for(const topic of s.joined.keys())sendEvent(s,topic,'phx_error',{});await expect.poll(()=>calls.filter(c=>c.name==='list_my_work_message_page_v11').length,{timeout:10000}).toBeGreaterThan(before);});
 if(process.env.AWARENESS_SAFETY==='1'){
  await scenario('Realtime notification co-arrivals retain attention and unread state',async()=>{
   const held=new Promise(resolve=>{holdHistory=resolve;});await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await Promise.race([held,new Promise((_,reject)=>setTimeout(()=>reject(new Error('Fixture request was not started')),8000))]);
   for(let i=0;i<2;i++){const note={id:'wave-live-'+i,user_id:owner,notification_type:'shared_task_assigned',title:'Wave live '+i,body:'Synthetic live event',metadata:{},read_at:null,created_at:stamp};notices.push(note);for(const socket of sockets)for(const topic of socket.joined.keys())if(topic.includes('account-notifications:'))sendEvent(socket,topic,'postgres_changes',{ids:[1],data:{schema:'public',table:'account_notifications',type:'INSERT',columns:[],record:note,old_record:{},commit_timestamp:stamp,errors:[]}});}
   await page.evaluate(()=>window.dispatchEvent(new Event('tenops:notifications-changed')));heldHistory();await expect(page.getByLabel('3 unread notifications',{exact:true})).toBeVisible();await page.keyboard.press('Escape');
   await page.getByRole('button',{name:'Notifications',exact:true}).click();await expect(page.getByRole('dialog',{name:'Notifications',exact:true})).toBeVisible();await page.getByRole('button',{name:'Mark all as read',exact:true}).click();await expect(page.getByLabel('3 unread notifications',{exact:true})).toHaveCount(0);await page.getByRole('button',{name:'Close Notifications',exact:true}).click();
  });
  await scenario('draft and attachment queue survive thread switch and reopen',async()=>{
   if(!await page.locator('#my-work-inbox-title').isVisible())await open();
   await choose('Wave Bob');const input=page.getByRole('textbox',{name:'Message',exact:true});await input.fill('Bob retained draft');await choose('Wave Carol');await input.fill('Carol retained draft');await choose('Wave Bob');await expect(input).toHaveValue('Bob retained draft');
   await page.getByLabel('Attach files',{exact:true}).setInputFiles({name:'wave-test.txt',mimeType:'text/plain',buffer:Buffer.from('synthetic queue only')});await expect(page.getByText('wave-test.txt',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Remove wave-test.txt',exact:true}).click();
   await page.getByRole('button',{name:'Close Inbox',exact:true}).click();await open();await choose('Wave Bob');await expect(input).toHaveValue('Bob retained draft');
  });
  await scenario('summary denial and retry',async()=>{summaryDenied=true;await page.evaluate(()=>window.dispatchEvent(new Event('tenops:messaging-changed')));await expect(page.getByRole('alert').filter({hasText:'Unable to load Inbox.'})).toBeVisible();summaryDenied=false;await page.getByRole('button',{name:'Close Inbox',exact:true}).click();await open();await expect(page.getByText('Wave Bob',{exact:true}).last()).toBeVisible();await expect(page.getByRole('alert').filter({hasText:'Unable to load Inbox.'})).toHaveCount(0);});
  await scenario('account switch rejects old summary and notification responses',async()=>{
   notices=[{id:'owner-a-private',notification_type:'fixture',title:'Owner A private notice',body:'Synthetic A only',metadata:{},read_at:null,created_at:stamp}];
   const historyHeld=new Promise(resolve=>{holdHistory=resolve;}),summaryHeld=new Promise(resolve=>{holdSummary=resolve;});
   await page.evaluate(()=>{window.dispatchEvent(new Event('focus'));window.dispatchEvent(new Event('tenops:messaging-changed'));});await Promise.race([Promise.all([historyHeld,summaryHeld]),new Promise((_,reject)=>setTimeout(()=>reject(new Error('Delayed owner requests were not started')),8000))]);
   await emitAuth(other);await expect(page.getByRole('button',{name:'Messaging',exact:true})).toBeVisible();await open();await expect.poll(()=>calls.filter(c=>c.name==='list_my_work_conversations_v11'&&c.id===other).length).toBeGreaterThan(0);
   heldHistory();heldSummary();await settle();await expect(page.getByLabel('1 unread notifications',{exact:true})).toHaveCount(0);await expect(page.getByText('Wave sent text',{exact:true})).toHaveCount(0);await expect(page.getByText('Wave Bob',{exact:true})).toHaveCount(0);
  });
  denied=true;await emitAuth(other,'TOKEN_REFRESHED');await expect(page.getByRole('button',{name:'Messaging',exact:true})).toHaveCount(0);
 }
 assert.deepEqual(external,[]);assert.deepEqual(errors,[]);mkdirSync(output.slice(0,output.lastIndexOf('/')),{recursive:true});writeFileSync(output,JSON.stringify({origin,environment:'actual app with browser-routed synthetic API; not Production timings',measurements,calls,errors,external,restorationEntrances:restorations},null,2));console.log(JSON.stringify(measurements,null,2));
} catch(e){console.error({sockets:sockets.map(s=>[...s.joined.keys()])});console.error((await page.locator('body').innerText()).slice(-1800));throw e;}finally{await browser.close();}
