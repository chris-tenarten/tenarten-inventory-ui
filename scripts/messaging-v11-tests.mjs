// Appended to the guarded disposable fixture by verify-messaging-v11.mjs. Never run standalone.
sql("alter table my_work_messages add column sender_kind text default 'user',add column edited_at timestamptz,add column edit_count integer default 0; alter table my_work_message_deletion_audit add column id uuid default gen_random_uuid(),add column actor_user_id uuid,add column original_sender_user_id uuid,add column original_recipient_user_id uuid,add column attachment_count integer,add column deleted_at timestamptz default now();");
for(const name of ['prepare_admin_delete_my_work_message','admin_permanently_delete_my_work_message','edit_my_work_inbox_message'])sql(lifecycle.match(new RegExp('create function public.'+name+'[\\s\\S]*?end;\\$\\$;'))[0]);
sql(lifecycle.match(/create function public.list_my_work_inbox_messages_v2[\s\S]*?\n\$\$;/)[0]);
sql(await read('supabase/migrations/20260831_019_private_my_work_typing_broadcast.sql'));
// Mirror provider CRLF normalization: guard still checks the exact function content.
sql(await read('supabase/migrations/20260925200000_messaging_v11.sql'));
sql("grant select on app_users,my_work_messages,my_work_message_deletion_audit to service_role; notify pgrst,'reload schema';");
await new Promise(r=>setTimeout(r,1200));
console.log('PASS migration guards on released baseline.');
const job=randomUUID();sql(`insert into jobs values('${job}','TEST-ONLY','Disposable job');`);
assert((await sender.client.rpc('send_my_work_inbox_message',{p_recipient_user_id:recipient.id,p_body:'forbidden job',p_job_id:job})).error);
assert((await sender.client.rpc('begin_my_work_attachment_transfer',{p_id:randomUUID(),p_recipient:recipient.id,p_body:'forbidden job',p_job:job,p_files:[{id:randomUUID(),name:'x',size:1,contentType:'application/octet-stream'}]})).error);
assert.equal(sql(`select md5(row_to_json(a)::text) from my_work_message_attachments a where message_id='${old.data}';`),historyBefore);
sql(`insert into my_work_messages(sender_user_id,recipient_user_id,body,created_at) select '${sender.id}','${recipient.id}','History '||i,now()-interval '2 days'+i*interval '1 minute' from generate_series(1,85) i;`);
const before=(await recipient.client.rpc('list_my_work_inbox_messages_v2')).data;assert.equal(before.length,86);
const page1=await recipient.client.rpc('list_my_work_message_page_v11',{p_peer:sender.id});assert.ifError(page1.error);assert.equal(page1.data.length,40);
const page2=await recipient.client.rpc('list_my_work_message_page_v11',{p_peer:sender.id,p_before_time:page1.data[0].created_at,p_before_id:page1.data[0].id});assert.ifError(page2.error);assert.equal(page2.data.length,40);
assert.equal(new Set([...page1.data,...page2.data].map(m=>m.id)).size,80);
for(const who of [unrelated,admin,inactive])assert.deepEqual((await who.client.rpc('list_my_work_message_page_v11',{p_peer:sender.id})).data,[]);
const historical=page1.data.find(m=>m.id===old.data);assert.equal(historical.attachments[0].preview,null);
const cfg={base,key,actors:await Promise.all(actors.map(async a=>({id:a.id,role:a.role,session:(await a.client.auth.getSession()).data.session})))};
await mkdir('.tmp-messaging-v11',{recursive:true});
await writeFile('.tmp-messaging-v11/config.json',JSON.stringify(cfg),{mode:0o600});
const source=`import React,{useState} from 'react';import {createRoot} from 'react-dom/client';import Inbox from './src/modules/my-work/InboxDialog';import {supabase} from '@/lib/supabase';import {transport} from './src/modules/my-work/messaging/client';import * as previews from './src/modules/my-work/messaging/preview';
window.db=supabase;window.transport=transport;window.previews=previews;
const cfg=window.fixture;const actor=cfg.actors[Number(new URLSearchParams(location.search).get('actor')||0)];window.actor=actor;
await supabase.auth.setSession(actor.session);
function App(){const[open,setOpen]=useState(true);const noop=React.useCallback(()=>{},[]);return <><button onClick={()=>setOpen(true)}>Open</button><Inbox open={open} onClose={()=>setOpen(false)} currentUserId={actor.id} collaborators={cfg.actors.filter(a=>a.id!==actor.id).map((a,i)=>({userId:a.id,displayName:'Person '+a.id.slice(0,4),role:a.role}))} initialUserId={cfg.actors[Number(new URLSearchParams(location.search).get('actor')||0)===0?1:0].id} onUnreadChange={noop}/></>};createRoot(document.getElementById('root')).render(<App/>);`;
await build({stdin:{contents:source,loader:'tsx',resolveDir:process.cwd()},bundle:true,platform:'browser',format:'esm',define:{'process.env.NODE_ENV':'"production"','process.env.NEXT_PUBLIC_SUPABASE_URL':JSON.stringify(base),'process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY':JSON.stringify(key)},plugins:[{name:'local-auth-shell',setup(b){b.onResolve({filter:/^@\/lib\/auth$/},()=>({path:'auth',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:`export const useAuth=()=>({profile:{userId:window.actor.id,role:window.actor.role,isActive:true},isAuthenticated:true});`,loader:'js'}));b.onResolve({filter:/^next\/image$/},()=>({path:'image',namespace:'fixture-image'}));b.onLoad({filter:/.*/,namespace:'fixture-image'},()=>({contents:`import React from 'react';export default function Image({unoptimized,...props}){return React.createElement('img',props)}`,loader:'js',resolveDir:process.cwd()}));}}],outfile:'.tmp-messaging-v11/app.js'});
// Compile the actual app's Tailwind classes for light/dark/mobile screenshots.
const postcss=(await import('postcss')).default;const tailwind=(await import('@tailwindcss/postcss')).default;
const css=await postcss([tailwind()]).process(await read('src/app/globals.css'),{from:process.cwd()+'/src/app/globals.css'});
await writeFile('.tmp-messaging-v11/style.css',css.css);
const app=await readFile('.tmp-messaging-v11/app.js');
const server=createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/app.js'?'text/javascript':req.url==='/style.css'?'text/css':'text/html');res.end(req.url==='/app.js'?app:req.url==='/style.css'?css.css:'<!doctype html><link rel="stylesheet" href="/style.css"><div id="root"></div><script>window.fixture='+JSON.stringify(cfg)+'</script><script type="module" src="/app.js"></script>');});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true});
try{
 const contexts=await Promise.all([0,1].map(()=>browser.newContext({viewport:{width:1280,height:900},permissions:['clipboard-read','clipboard-write']})));
 const [alice,bob]=await Promise.all(contexts.map(c=>c.newPage()));const logs={alice:[],bob:[]};const errors=[];
 for(const [name,page] of [['alice',alice],['bob',bob]]){page.on('pageerror',e=>{errors.push(e.message);console.log(name+' browser error: '+e.message);});page.on('request',r=>logs[name].push({url:r.url().replace(/\?token=.*/,''),method:r.method(),body:r.url().includes('/rpc/')?r.postData():undefined}));}
 await Promise.all([alice.goto(origin+'/?actor=0'),bob.goto(origin+'/?actor=1')]);
 await Promise.all([alice,bob].map(page=>page.getByRole('textbox',{name:'Message',exact:true}).waitFor()));
 await Promise.all([alice,bob].map(page=>page.waitForFunction(()=>document.querySelectorAll('article').length===40)));
 await Promise.all([alice,bob].map(page=>page.waitForFunction(()=>window.db.getChannels().some(c=>c.state==='joined'))));
 assert.equal(await bob.getByRole('button',{name:'Link a Job',exact:true}).count(),0);
 await new Promise(r=>setTimeout(r,400));
 const initial={rpcRequests:logs.bob.filter(r=>r.url.includes('/rpc/')).map(r=>({rpc:r.url.split('/').at(-1),ids:r.body?JSON.parse(r.body).p_ids?.length:undefined})),rows:await bob.locator('article').count(),requests:logs.bob.length,attachmentMetadataRequests:logs.bob.filter(r=>r.url.includes('/my_work_message_attachments')).length,originalRequests:logs.bob.filter(r=>/\/file$|\/old.png$/.test(r.url)).length,previewRequests:logs.bob.filter(r=>r.url.includes('/preview.jpg')).length,channels:await bob.evaluate(()=>window.db.getChannels().map(c=>c.topic))};
 assert.equal(initial.rows,40);assert(initial.requests<30,'Read-event burst must remain coalesced');
 const text=alice.getByRole('textbox',{name:'Message',exact:true});
 await alice.evaluate(async()=>{const c=document.createElement('canvas');c.width=1800;c.height=1100;const ctx=c.getContext('2d');ctx.fillStyle='#dde8ff';ctx.fillRect(0,0,c.width,c.height);ctx.fillStyle='#153366';ctx.font='48px sans-serif';ctx.fillText('Disposable Messaging screenshot',60,120);const blob=await new Promise(r=>c.toBlob(r));window.originalFixtureBytes=blob.size;await navigator.clipboard.write([new ClipboardItem({'image/png':blob})]);});
 await text.focus();await alice.keyboard.press(process.platform==='darwin'?'Meta+V':'Control+V');await alice.getByRole('button',{name:/Remove Screenshot/}).waitFor();
 // attachment-only native screenshot paste; Bob is already open.
 await alice.getByRole('button',{name:'Send',exact:true}).click();
 await bob.getByRole('button',{name:/Open full image Screenshot/}).waitFor({timeout:30000});
 await alice.getByRole('button',{name:/Open full image Screenshot/}).waitFor({timeout:30000});
 await bob.waitForFunction(()=>document.querySelector('[data-message-history] img')?.src.startsWith('blob:'));
 await bob.screenshot({path:'.tmp-messaging-v11/inline-screenshot.png'});
 const mid=await alice.evaluate(()=>window.db.from('my_work_messages').select('id').eq('sender_user_id',window.actor.id).eq('body','').order('created_at',{ascending:false}).limit(1).then(r=>r.data[0].id));
 const metadata=(await recipient.client.rpc('list_my_work_message_page_v11',{p_peer:sender.id,p_ids:[mid]})).data[0];
 assert.equal(metadata.attachments.length,1);assert(metadata.attachments[0].preview);const preview=metadata.attachments[0].preview;
 assert(preview.bytes<=196608&&Math.max(preview.width,preview.height)<=1280);
 assert.equal(await bob.getByRole('button',{name:/Open full image Screenshot/}).count(),1);
 assert.equal(await alice.getByRole('button',{name:/Open full image Screenshot/}).count(),1);
 assert.ifError((await sender.client.rpc('finalize_my_work_inbox_message',{p_message_id:mid,p_expected_attachment_count:1})).error);
 // Read update/repeated finalization never erases attachment state.
 await new Promise(r=>setTimeout(r,500));assert.equal(await bob.getByRole('button',{name:/Open full image Screenshot/}).count(),1);
 assert.equal(logs.bob.filter(r=>r.method==='GET'&&r.url.includes('/file')).length,0);
 for(const actor of [unrelated,admin,inactive])assert((await actor.client.storage.from(bucket).createSignedUrl(preview.path,30)).error);
 const anonymous=createClient(base,key,{auth:{persistSession:false}});assert((await anonymous.storage.from(bucket).createSignedUrl(preview.path,30)).error);
 assert.ifError((await recipient.client.storage.from(bucket).createSignedUrl(preview.path,30)).error);
 // Browser's explicit original preview is the first original-byte request.
 await bob.getByRole('button',{name:/Open full image Screenshot/}).click();await bob.getByRole('dialog',{name:/Preview Screenshot/}).waitFor();
 await bob.waitForFunction(()=>[...document.images].some(i=>i.src.includes('/file')&&i.complete));assert(logs.bob.some(r=>r.method==='GET'&&r.url.includes('/file')));
 await bob.getByRole('button',{name:'Close image preview'}).click();
 await alice.getByRole('button',{name:'Dismiss transfer',exact:true}).click().catch(()=>{});
 await text.fill('Two-session text regression');await alice.getByRole('button',{name:'Send',exact:true}).click();await bob.getByText('Two-session text regression',{exact:true}).last().waitFor();
 // Bounded reconnect catches messages missed offline; no periodic reload timer.
 await contexts[1].setOffline(true);await text.fill('Sent while recipient offline');await alice.getByRole('button',{name:'Send',exact:true}).click();await contexts[1].setOffline(false);
 await bob.getByText('Sent while recipient offline',{exact:true}).last().waitFor({timeout:45000});
 // Pagination is upward-only and duplicate-free.
 const anchor=await bob.locator('[data-message-history]').evaluate(el=>{el.scrollTop=0;const first=el.querySelector('article');const value={text:first.textContent,top:first.getBoundingClientRect().top};el.dispatchEvent(new Event('scroll'));return value;});
 await bob.waitForFunction(()=>document.querySelectorAll('article').length>=80);
 await bob.waitForFunction(anchor=>{const a=[...document.querySelectorAll('article')].find(a=>a.textContent===anchor.text);return a&&Math.abs(a.getBoundingClientRect().top-anchor.top)<3;},anchor);
 assert.equal(await bob.locator('article').count(),new Set(await bob.locator('article').allTextContents()).size);
 // Multiple attachments and generic binary remain on the shared drag/drop queue.
 await text.fill('Mixed attachments');
 await text.evaluate(el=>{const d=new DataTransfer();const canvas=document.createElement('canvas');canvas.width=32;canvas.height=24;canvas.getContext('2d').fillStyle='#426ac4';canvas.getContext('2d').fillRect(0,0,32,24);return new Promise(resolve=>canvas.toBlob(async blob=>{d.items.add(new File([blob],'drop-image.png',{type:'image/png'}));d.items.add(new File([blob],'second-image.png',{type:'image/png'}));d.items.add(new File(['arbitrary'],'drawing.unknown',{type:'application/octet-stream'}));el.dispatchEvent(new DragEvent('drop',{dataTransfer:d,bubbles:true,cancelable:true}));resolve();}));});
 await alice.getByRole('button',{name:'Send',exact:true}).click();await bob.getByText('drawing.unknown',{exact:true}).waitFor();
 assert.equal(await bob.getByRole('button',{name:'Open full image drop-image.png'}).count(),1);assert.equal(await bob.getByRole('button',{name:'Open full image second-image.png'}).count(),1);
 await alice.getByRole('button',{name:'Dismiss transfer',exact:true}).click();
 await bob.locator('[data-message-history]').evaluate(el=>{el.scrollTop=el.scrollHeight;});
 await bob.waitForFunction(()=>[...document.querySelectorAll('[data-message-history] img')].filter(img=>img.src.startsWith('blob:')).length>=2);
 await bob.screenshot({path:'.tmp-messaging-v11/light.png'});
 await bob.evaluate(()=>document.documentElement.dataset.appearance='dark');await bob.screenshot({path:'.tmp-messaging-v11/dark.png'});
 await bob.setViewportSize({width:390,height:844});await bob.screenshot({path:'.tmp-messaging-v11/mobile.png'});
 await bob.getByRole('button',{name:'Close Inbox'}).click();await bob.waitForFunction(()=>window.db.getChannels().length===0);
 // Put one valid preview above the recent viewport and one outside the first page.
 const jpeg=Buffer.from(await (await fetch((await recipient.client.storage.from(bucket).createSignedUrl(preview.path,30)).data.signedUrl)).arrayBuffer());
 const makeImage=async(name,when,derivative=true)=>{
  const id=randomUUID(),entry={id:randomUUID(),name,size:png.length,contentType:'image/png'};
  assert.ifError((await sender.client.rpc('begin_my_work_attachment_transfer',{p_id:id,p_recipient:recipient.id,p_body:'Lazy fixture '+name,p_job:null,p_files:[entry]})).error);
  assert.ifError((await sender.client.storage.from(bucket).upload(id+'/'+entry.id+'/file',png,{contentType:'application/octet-stream'})).error);
  if(derivative){assert.ifError((await sender.client.rpc('reserve_my_work_attachment_preview',{p_attachment:entry.id,p_bytes:jpeg.length,p_width:preview.width,p_height:preview.height})).error);assert.ifError((await sender.client.storage.from(bucket).upload(id+'/'+entry.id+'/preview.jpg',jpeg,{contentType:'application/octet-stream'})).error);}
  assert.ifError((await sender.client.rpc('finalize_my_work_inbox_message',{p_message_id:id,p_expected_attachment_count:1})).error);
  if(when)sql(`update my_work_messages set created_at=now()-interval '2 days'+interval '${when} minutes' where id='${id}';`);
  return {id,entry,path:id+'/'+entry.id+'/preview.jpg'};
 };
 const offscreen=await makeImage('offscreen.png',60),unloaded=await makeImage('unloaded.png',10),failure=await makeImage('failed-preview.png',null);
 const beforeLazy=logs.bob.length;await bob.setViewportSize({width:1280,height:900});
 await bob.route('**/object/sign/**/'+failure.id+'/**',route=>route.fulfill({status:503,body:'Injected preview failure'}));
 await bob.getByRole('button',{name:'Open',exact:true}).click();await bob.getByRole('button',{name:'Open full image failed-preview.png'}).waitFor();
 await bob.getByText('Preview unavailable · use Download',{exact:true}).waitFor();
 assert.equal(await bob.getByRole('button',{name:'Open full image offscreen.png'}).count(),1);
 assert.equal(await bob.getByRole('button',{name:'Open full image unloaded.png'}).count(),0);
 await new Promise(r=>setTimeout(r,350));
 const lazyRequests=logs.bob.slice(beforeLazy);
 assert.equal(lazyRequests.filter(r=>r.url.includes(offscreen.id)&&r.url.includes('preview.jpg')).length,0,'offscreen bytes and signing must stay lazy');
 assert.equal(lazyRequests.filter(r=>r.url.includes(unloaded.id)&&r.url.includes('preview.jpg')).length,0,'unloaded history must not request previews');
 assert.equal(lazyRequests.filter(r=>r.method==='GET'&&r.url.includes('/file')).length,0,'opening remains original-free');
 await bob.getByRole('button',{name:'Open full image offscreen.png'}).scrollIntoViewIfNeeded();
 await bob.waitForFunction(()=>[...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-label')==='Open full image offscreen.png')?.querySelector('img')?.src.startsWith('blob:'));
 assert(logs.bob.slice(beforeLazy).some(r=>r.method==='GET'&&r.url.includes(offscreen.id)));
 // Switch peer: only the new active topic remains; unrelated history and images disappear.
 const thirdId=(await recipient.client.rpc('send_my_work_inbox_message',{p_recipient_user_id:unrelated.id,p_body:'Other conversation',p_job_id:null})).data;
 assert(thirdId);await bob.getByRole('button',{name:'New message',exact:true}).click();await bob.getByRole('combobox').selectOption(unrelated.id);
 await bob.getByRole('textbox',{name:'Message',exact:true}).fill('Switch conversation');await bob.getByRole('button',{name:'Send',exact:true}).click();
 await bob.waitForFunction(peer=>window.db.getChannels().length===1&&window.db.getChannels()[0].topic.includes(peer),unrelated.id);
 assert.equal(await bob.getByRole('button',{name:'Open full image offscreen.png'}).count(),0);
 await bob.getByRole('button',{name:'Close Inbox'}).click();await bob.waitForFunction(()=>window.db.getChannels().length===0);
 // Derivative deletion and abandoned cleanup use the existing authoritative parent lifecycle.
 const deleteTarget=await makeImage('delete-preview.png',null);
 for(const actor of [recipient,unrelated,admin,inactive])assert((await actor.client.rpc('reserve_my_work_attachment_preview',{p_attachment:deleteTarget.entry.id,p_bytes:jpeg.length,p_width:preview.width,p_height:preview.height})).error);
 const paths=await admin.client.rpc('prepare_admin_delete_my_work_message',{p_message_id:deleteTarget.id});assert.ifError(paths.error);assert.equal(paths.data.length,2);
 assert((await admin.client.rpc('admin_permanently_delete_my_work_message',{p_message_id:deleteTarget.id,p_confirmation:'PERMANENTLY_DELETE_MESSAGE'})).error);
 assert.ifError((await service.storage.from(bucket).remove(paths.data.map(p=>p.storage_path))).error);
 assert.ifError((await admin.client.rpc('admin_permanently_delete_my_work_message',{p_message_id:deleteTarget.id,p_confirmation:'PERMANENTLY_DELETE_MESSAGE'})).error);
 assert.equal(sql(`select count(*) from my_work_attachment_previews where message_id='${deleteTarget.id}';`).trim(),'0');
 const draft=randomUUID(),entry={id:randomUUID(),name:'abandoned.png',size:png.length,contentType:'image/png'};
 assert.ifError((await sender.client.rpc('begin_my_work_attachment_transfer',{p_id:draft,p_recipient:recipient.id,p_body:'',p_job:null,p_files:[entry]})).error);
 assert((await sender.client.rpc('reserve_my_work_attachment_preview',{p_attachment:entry.id,p_bytes:196609,p_width:1280,p_height:720})).error);
 assert((await sender.client.rpc('reserve_my_work_attachment_preview',{p_attachment:entry.id,p_bytes:100,p_width:1281,p_height:720})).error);
 assert.ifError((await sender.client.rpc('reserve_my_work_attachment_preview',{p_attachment:entry.id,p_bytes:jpeg.length,p_width:preview.width,p_height:preview.height})).error);
 assert.ifError((await sender.client.storage.from(bucket).upload(draft+'/'+entry.id+'/preview.jpg',jpeg,{contentType:'application/octet-stream'})).error);
 assert.equal(sql('select count(*) from claim_abandoned_my_work_transfers(50);').trim(),'0','fresh recoverable draft must remain protected');
 sql(`update my_work_messages set upload_touched_at=now()-interval '8 days' where id='${draft}';`);
 const claimed=await service.rpc('claim_abandoned_my_work_transfers',{p_limit:50});assert.ifError(claimed.error);assert.equal(claimed.data.length,1);
 assert.ifError((await service.storage.from(bucket).remove([draft+'/'+entry.id+'/preview.jpg'])).error);
 assert.ifError((await service.rpc('finish_abandoned_my_work_transfer',{p_id:draft})).error);
 assert.equal(sql(`select count(*) from my_work_attachment_previews where message_id='${draft}';`).trim(),'0');
 assert.equal(sql(`select md5(row_to_json(a)::text) from my_work_message_attachments a where message_id='${old.data}';`),historyBefore);
 assert.deepEqual(errors,[]);
 const result={passed:true,before:{rows:before.length,jsonBytes:Buffer.byteLength(JSON.stringify(before)),metadataSeparate:true},after:{rows:page1.data.length,jsonBytes:Buffer.byteLength(JSON.stringify(page1.data)),metadataSeparate:false},initial,preview,originalSourceBytes:await alice.evaluate(()=>window.originalFixtureBytes),originalStoredBytes:metadata.attachments[0].byte_size,nativePasteAttachmentOnly:true,twoIndependentSessions:true,readRaceAndRetry:true,privatePreview:true,noOriginalBeforeExplicit:true,reconnect:true,pagination:true,stablePrependAnchor:true,closeUnsubscribed:true,jobLinksDenied:true,offscreenLazy:true,unloadedLazy:true,multipleAndGeneric:true,previewFailureFallback:true,conversationSwitch:true,derivativeDeletion:true,derivativeAbandonedCleanup:true,historicalMetadataUnchanged:true,largeTransfers:false};
 await writeFile('.tmp-messaging-v11/results.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}catch(error){for(const p of browser.contexts().flatMap(c=>c.pages())){await p.screenshot({path:'.tmp-messaging-v11/failure-'+new URL(p.url()).searchParams.get('actor')+'.png'});console.log((await p.locator('body').innerText()).slice(-1600));}throw error;}finally{await browser.close();await new Promise(r=>server.close(r));}
