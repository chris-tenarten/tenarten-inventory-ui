// Guarded disposable fixture; real participant Auth/RPC/Realtime, actual Inbox.
sql(lifecycle.match(/create table public\.my_work_message_versions \([\s\S]*?\n\);/)[0]);
assert.ifError((await recipient.client.rpc('send_my_work_inbox_message',{p_recipient_user_id:unrelated.id,p_body:'Cold text fixture',p_job_id:null})).error);
const measurements=[];
try {
 for(const [label,peer,hover,unread] of [['text',unrelated.id,false,false],['history-image',sender.id,false,false],['unread',sender.id,false,true],['intent-text',unrelated.id,true,false],['intent-history-image',sender.id,true,false]]){
  sql(`update my_work_messages set read_at=${unread?'null':'now()'} where recipient_user_id='${recipient.id}';`);
  const page=await browser.newPage({viewport:{width:1280,height:900}});const log=[];const errors=[];const storage=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/rpc/list_my_work_message_page_v11',async route=>{await new Promise(r=>setTimeout(r,120));await route.continue();});
  const requests=[];page.on('request',r=>{if(r.url().includes('/storage/v1/'))storage.push(r.url());if(r.url().includes('/rest/v1/'))requests.push({rpc:r.url().split('/').at(-1).split('?')[0],at:Date.now()});});
  page.on('response',async r=>{if(!r.url().includes('/rest/v1/'))return;const body=await r.body().catch(()=>Buffer.alloc(0));let rows;try{const v=JSON.parse(body);rows=Array.isArray(v)?v.length:undefined;}catch{}log.push({rpc:r.url().split('/').at(-1).split('?')[0],bytes:body.length,rows,at:Date.now(),args:r.request().postData()});});
  await page.goto(origin+'/?actor=1&list=1');
  // Summary text for the legacy attachment comes from the fixture itself.
  const summary=(await recipient.client.rpc('list_my_work_conversations_v11')).data.find(x=>x.userId===peer);
  const target=page.locator('aside button').filter({hasText:summary.latest.body});await target.waitFor();await page.waitForTimeout(300);log.length=0;
  await page.evaluate(()=>{
   window.coldEvents=[];
   const original=window.db.channel.bind(window.db);
   window.db.channel=(...args)=>{const channel=original(...args);const subscribe=channel.subscribe.bind(channel);channel.subscribe=(callback,...rest)=>subscribe((status,...values)=>{window.coldEvents.push({kind:'subscription',status,at:Date.now()});callback?.(status,...values);},...rest);return channel;};
   const observer=new MutationObserver(()=>{const count=document.querySelectorAll('article').length;if(count&&!window.coldEvents.some(x=>x.kind==='visible'))window.coldEvents.push({kind:'visible',count,at:Date.now()});});
   observer.observe(document.body,{childList:true,subtree:true});
  });
  if(hover){await target.hover();await page.waitForTimeout(400);}
  assert.equal(storage.length,0,'intent never fetches attachment bytes or signed URLs');
  const preClick=log.slice();const start=Date.now();
  // Programmatic click avoids manufacturing hover intent in no-intent controls.
  await target.evaluate(el=>el.click());
  await page.waitForFunction(()=>document.querySelectorAll('article').length>0);
  const events=await page.evaluate(()=>window.coldEvents);
  const visibleMs=events.find(x=>x.kind==='visible').at-start;
  await page.waitForTimeout(900);
  const result={label,visibleMs,events:(await page.evaluate(()=>window.coldEvents)).map(x=>({...x,afterClickMs:x.at-start})),articles:await page.locator('article').count(),preClick,requests:requests.filter(x=>x.at>=start).map(x=>({...x,afterClickMs:x.at-start})),complete:log.map(x=>({...x,afterClickMs:x.at-start})),channels:await page.evaluate(()=>window.db.getChannels().map(c=>c.state)),scroll:await page.locator('[data-message-history]').evaluate(el=>({bottom:el.scrollHeight-el.clientHeight-el.scrollTop}))};
  assert.equal(errors.length,0,errors.join('\n'));measurements.push(result);await page.close();
 }
 // Hold the first authoritative snapshot after the database read, then send a
 // new message before releasing it. Post-join reconciliation must close the gap.
 const race=await browser.newPage({viewport:{width:1280,height:900}});
 let held;let release;const gate=new Promise(r=>release=r);let reads=0;
 await race.route('**/rpc/list_my_work_message_page_v11',async route=>{
  reads++;const response=await route.fetch();if(reads===1){held=true;await gate;}await route.fulfill({response});
 });
 await race.goto(origin+'/?actor=1&list=1');
 const target=race.locator('aside button').filter({hasText:'Historical private message'});await target.waitFor();
 await target.hover();await race.waitForTimeout(160);
 // Baseline has no prefetch; select first so both implementations exercise the race.
 await target.evaluate(el=>el.click());
 for(let i=0;!held&&i<100;i++)await race.waitForTimeout(20);assert(held);
 assert.ifError((await sender.client.rpc('send_my_work_inbox_message',{p_recipient_user_id:recipient.id,p_body:'Arrival during cold snapshot',p_job_id:null})).error);
 release();await race.getByText('Arrival during cold snapshot',{exact:true}).last().waitFor();
 await race.waitForTimeout(500);
 assert.equal(await race.locator('article').filter({hasText:'Arrival during cold snapshot'}).count(),1);
 assert(reads>=2,'subscription-gap check retained');await race.close();
 await writeFile('.tmp-messaging-v11/cold-results.json',JSON.stringify({method:'Real local Auth/PostgREST/Realtime; 120ms injected history delay; 400ms hover dwell; not Production timing',measurements,coldArrivalGap:true},null,2));
 console.log(JSON.stringify(measurements,null,2));
}finally{await browser.close();await new Promise(r=>server.close(r));}
