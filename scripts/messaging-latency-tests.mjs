// Appended to the guarded local fixture by verify-messaging-latency.mjs.
sql(lifecycle.match(/create table public\.my_work_message_versions \([\s\S]*?\n\);/)[0]);
try {
 const page=await browser.newPage({viewport:{width:1280,height:900}});
 page.setDefaultTimeout(15000);
 const responses=[];const requests=[];const errors=[];
 page.on('request',request=>{if(request.url().includes('/rest/v1/')||request.url().includes('/storage/v1/'))requests.push({url:request.url().split('?')[0],method:request.method()});});
 page.on('pageerror',error=>errors.push(error.message));
 // Controlled 120ms service latency makes critical-path dependencies reproducible.
 let delay=120;
 await page.route('**/rpc/list_my_work_message_page_v11',async route=>{await new Promise(r=>setTimeout(r,delay));await route.continue();});
 page.on('response',async response=>{if(response.url().includes('/rest/v1/')){const body=await response.body().catch(()=>Buffer.alloc(0));let rows;try{const value=JSON.parse(body);rows=Array.isArray(value)?value.length:undefined;}catch{}responses.push({url:response.url().split('/').at(-1),bytes:body.length,rows});}});
 const coldStart=Date.now();await page.goto(origin+'/?actor=1');
 await page.waitForFunction(()=>document.querySelectorAll('article').length===40);
 const coldVisibleMs=Date.now()-coldStart;await page.waitForTimeout(700);
 const cold=responses.splice(0);
 // Second real, participant-authorized conversation, short and text only.
 assert.ifError((await recipient.client.rpc('send_my_work_inbox_message',{p_recipient_user_id:unrelated.id,p_body:'Second thread',p_job_id:null})).error);
 const measurements=[];
 for(const [label,peer] of [['first-B',unrelated.id],['return-A',sender.id],['return-B',unrelated.id],['return-A-again',sender.id]]){
  responses.length=0;requests.length=0;
  const start=await page.evaluate(peer=>{window.openPeer(peer);return performance.now();},peer);
  await page.waitForFunction(peer=>[...document.querySelectorAll('article')].some(a=>peer===window.fixture.actors[2].id?a.textContent.includes('Second thread'):a.textContent.includes('History')),peer);
  const visible=await page.evaluate(()=>performance.now());
  const beforeVisible=responses.slice();const requestsBeforeVisible=requests.slice();
  await page.waitForTimeout(800);
  measurements.push({label,visibleMs:Math.round(visible-start),beforeVisible,requestsBeforeVisible,requests:requests.slice(),complete:responses.slice(),channels:await page.evaluate(()=>window.db.getChannels().length)});
 }
 await page.evaluate(()=>window.closeInbox());await page.waitForTimeout(50);
 responses.length=0;const start=await page.evaluate(peer=>{window.openPeer(peer);return performance.now();},sender.id);
 await page.waitForFunction(()=>document.querySelectorAll('article').length===40);
 const reopen=await page.evaluate(()=>performance.now());await page.waitForTimeout(800);
 measurements.push({label:'close-reopen-A',visibleMs:Math.round(reopen-start),complete:responses.slice()});
 // Cached inactive peer receives text/attachments without maintaining a channel.
 await page.evaluate(peer=>window.openPeer(peer),unrelated.id);await page.waitForTimeout(500);
 const fresh=await sender.client.rpc('send_my_work_inbox_message',{p_recipient_user_id:recipient.id,p_body:'Cached arrival',p_job_id:null});assert.ifError(fresh.error);
 const imageId=randomUUID(),images=Array.from({length:3},(_,i)=>({id:randomUUID(),name:`cached-image-${i}.png`,size:png.length,contentType:'image/png'}));
 assert.ifError((await sender.client.rpc('begin_my_work_attachment_transfer',{p_id:imageId,p_recipient:recipient.id,p_body:'Cached images',p_job:null,p_files:images})).error);
 for(const entry of images)assert.ifError((await sender.client.storage.from(bucket).upload(`${imageId}/${entry.id}/file`,png,{contentType:'application/octet-stream'})).error);
 assert.ifError((await sender.client.rpc('finalize_my_work_inbox_message',{p_message_id:imageId,p_expected_attachment_count:3})).error);
 await page.evaluate(peer=>window.openPeer(peer),sender.id);
 await page.getByText('Cached arrival',{exact:true}).last().waitFor();await page.getByText('cached-image-2.png',{exact:true}).waitFor();
 await page.waitForTimeout(300);
 await page.evaluate(peer=>window.openPeer(peer),unrelated.id);await page.waitForTimeout(500);
 responses.length=0;requests.length=0;
 const imageStart=await page.evaluate(peer=>{window.openPeer(peer);return performance.now();},sender.id);
 await page.getByText('cached-image-2.png',{exact:true}).waitFor();const imageVisible=await page.evaluate(()=>performance.now());
 const imageBefore=responses.slice(),imageRequestsBefore=requests.slice();await page.waitForTimeout(800);
 measurements.push({label:'return-A-images',visibleMs:Math.round(imageVisible-imageStart),beforeVisible:imageBefore,requestsBeforeVisible:imageRequestsBefore,requests:requests.slice(),complete:responses.slice()});
 // Edit and delete while cached. Ordinary author edit and privileged deletion stay server-authorized.
 await page.evaluate(peer=>window.openPeer(peer),unrelated.id);await page.waitForTimeout(300);
 assert.ifError((await sender.client.rpc('edit_my_work_inbox_message',{p_message_id:fresh.data,p_body:'Cached edited'})).error);
 await page.evaluate(peer=>window.openPeer(peer),sender.id);await page.getByText('Cached edited',{exact:true}).last().waitFor();
 await page.evaluate(peer=>window.openPeer(peer),unrelated.id);await page.waitForTimeout(300);
 assert.ifError((await admin.client.rpc('admin_permanently_delete_my_work_message',{p_message_id:fresh.data,p_confirmation:'PERMANENTLY_DELETE_MESSAGE'})).error);
 await page.evaluate(peer=>window.openPeer(peer),sender.id);await page.waitForTimeout(900);
 assert.equal(await page.locator('article').filter({hasText:'Cached edited'}).count(),0);
 const expectedHistory=(await recipient.client.rpc('list_my_work_inbox_messages_v2')).data.filter(row=>row.sender_user_id===sender.id||row.recipient_user_id===sender.id).length;
 // Warm page still loads all older history without duplicate rows.
 await page.getByRole('button',{name:'Older messages',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('article').length>=80);
 await page.getByRole('button',{name:'Older messages',exact:true}).click();await page.waitForFunction(expected=>document.querySelectorAll('article').length===expected,expectedHistory);
 assert.equal(await page.locator('article').count(),new Set(await page.locator('article').allTextContents()).size);
 // Inspect the actual loading treatment with retained private content, in both themes.
 delay=1000;
 if(!process.env.MESSAGING_LATENCY_SOURCE_ROOT)for(const dark of [false,true]){
  await page.setViewportSize({width:390,height:844});await page.evaluate(dark=>document.documentElement.dataset.appearance=dark?'dark':'light',dark);
  await page.evaluate(()=>window.closeInbox());await page.waitForTimeout(50);await page.evaluate(peer=>window.openPeer(peer),sender.id);
  await page.getByText('Updating conversation…',{exact:true}).waitFor();await page.screenshot({path:`.tmp-messaging-v11/latency-narrow-${dark?'dark':'light'}.png`});await page.waitForTimeout(1800);
 }
 delay=120;
 // Guessed conversation is authorized by the same RPC, never by cache membership.
 await page.evaluate(peer=>window.openPeer(peer),randomUUID());await page.waitForTimeout(900);assert.equal(await page.locator('article').count(),0);
 await page.evaluate(peer=>window.openPeer(peer),sender.id);await page.waitForFunction(()=>document.querySelectorAll('article').length===40);
 if(!process.env.MESSAGING_LATENCY_SOURCE_ROOT){
 await page.evaluate(()=>window.switchActor(2));await page.waitForTimeout(900);assert.equal(await page.locator('article').count(),0,'old owner content must disappear after identity switch');
 await page.evaluate(()=>window.signOut());await page.waitForTimeout(150);assert.equal(await page.locator('article').count(),0);
 }
 const cacheRegression={cachedTextArrival:true,cachedAttachmentArrival:true,cachedEdit:true,cachedDeletion:true,completeUpwardHistory:true,guessedPeerEmpty:true,accountSwitchClears:true,logoutClears:true};
 assert.equal(errors.length,0,errors.join('\n'));
 const result={method:'Actual Inbox + real disposable Auth/PostgREST/Realtime, 120ms injected message RPC delay; browser polling timing, not Production latency',cold,coldVisibleMs,measurements,cacheRegression:process.env.MESSAGING_LATENCY_SOURCE_ROOT?undefined:cacheRegression};
 await writeFile('.tmp-messaging-v11/latency-results.json',JSON.stringify(result,null,2));
 console.log(JSON.stringify(result,null,2));
} finally {await browser.close();await new Promise(r=>server.close(r));}
