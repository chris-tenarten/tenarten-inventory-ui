// Appended to the localhost-only disposable fixture; never run standalone.
try{
 const contexts=await Promise.all([0,1].map(()=>browser.newContext({viewport:{width:1280,height:900},permissions:['clipboard-read','clipboard-write']})));
 const [alice,bob]=await Promise.all(contexts.map(c=>c.newPage()));const errors=[];
 for(const page of [alice,bob])page.on('pageerror',e=>errors.push(e.message));
 await Promise.all([alice.goto(origin+'/?actor=0'),bob.goto(origin+'/?actor=1')]);
 const text=alice.getByRole('textbox',{name:'Message',exact:true});await text.waitFor();
 await Promise.all([alice,bob].map(p=>p.waitForFunction(()=>window.db.getChannels().some(c=>c.state==='joined'))));
 await new Promise(r=>setTimeout(r,500));
 const send=()=>alice.getByRole('button',{name:'Send',exact:true}).click();
 const status=alice.getByRole('region',{name:'Attachment transfer'});
 const add=async(method,name)=>{
  if(method==='picker')return alice.getByLabel('Attach files',{exact:true}).setInputFiles({name,mimeType:'application/x-unknown',buffer:Buffer.from('small disposable file')});
  if(method==='paste'){
   await alice.evaluate(async()=>{const c=document.createElement('canvas');c.width=320;c.height=200;const ctx=c.getContext('2d');ctx.fillStyle='#345';ctx.fillRect(0,0,320,200);const blob=await new Promise(r=>c.toBlob(r));await navigator.clipboard.write([new ClipboardItem({'image/png':blob})]);});
   await text.focus();await alice.keyboard.press(process.platform==='darwin'?'Meta+V':'Control+V');
  }else await text.evaluate((el,name)=>{const dt=new DataTransfer();dt.items.add(new File(['small drop'],name,{type:'application/x-unknown'}));el.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:dt}));},name);
  await alice.getByRole('button',{name:/^Remove /}).first().waitFor();
 };
 const ready=async(value)=>{
  await alice.waitForFunction(()=>{const el=document.querySelector('textarea[aria-label="Message"]');return el&&!el.disabled&&el.value==='';});
  assert.equal(await text.evaluate(el=>el===document.activeElement),true,'Terminal transition returns keyboard focus');
  assert.equal(await alice.getByRole('button',{name:/^Remove /}).count(),0,'Terminal queue cleared');
  assert.equal(await alice.evaluate(()=>sessionStorage.getItem('tenops-messaging-transfer:'+window.actor.id)),null,'Terminal recovery ID cleared without dismissal');
  await alice.keyboard.type(value);assert.equal(await text.inputValue(),value);
  await text.click();await alice.keyboard.type(' pointer');assert.equal(await text.inputValue(),value+' pointer');
 };
 const completed=[];
 for(const [i,method] of ['paste','picker','drop','paste','multiple'].entries()){
  await text.fill(i===3?'text plus image':'');
  if(method==='multiple'){await add('picker','multi-a.unknown');await add('drop','multi-b.unknown');}else await add(method,method+'.unknown');
  await send();await status.getByText('Message sent',{exact:true}).waitFor({timeout:30000});
  await ready('next '+i);
  assert.equal(await status.getByText('Message sent',{exact:true}).isVisible(),true,'Informational banner remains while typing');
  const latest=(await sender.client.from('my_work_messages').select('id').eq('sender_user_id',sender.id).order('created_at',{ascending:false}).limit(1)).data[0].id;
  const metadata=(await recipient.client.rpc('list_my_work_message_page_v11',{p_peer:sender.id,p_ids:[latest]})).data[0];
  assert.equal(metadata.attachments.length,method==='multiple'?2:1);
  const article=bob.locator("article").filter({has:bob.getByText(metadata.attachments[0].original_filename,{exact:true})});
  await article.waitFor({timeout:15000});assert.equal(await article.count(),1);
  if(method==='paste'){
   assert(metadata.attachments[0].preview);
   await article.locator("img").waitFor();
   await article.locator("img").evaluate(img=>img.decode());
   assert((await article.locator("img").getAttribute("src")).startsWith("blob:"));
  }
  // Successful banner must neither block next text send nor reset its body on rerenders.
  await send();await bob.locator('article').getByText('next '+i+' pointer',{exact:true}).waitFor({timeout:15000});
  completed.push(method);
 }
 await alice.getByRole('button',{name:'Dismiss transfer'}).click();await text.fill('after dismiss');assert.equal(await text.inputValue(),'after dismiss');
 // Preserve recoverable failure and original draft identity. Fault only the local transport.
 await alice.evaluate(()=>{window.realUpload=window.transport.upload;window.transport.upload=async()=>{throw Error('Injected local transfer failure');};});
 await text.fill('retain on failure');await add('picker','retry.unknown');await send();await status.getByText('Transfer needs attention',{exact:true}).waitFor();
 assert.equal(await text.isDisabled(),true);assert.equal(await text.inputValue(),'retain on failure');
 const failedId=await alice.evaluate(()=>sessionStorage.getItem('tenops-messaging-transfer:'+window.actor.id));
 await alice.evaluate(()=>window.transport.upload=window.realUpload);await alice.getByRole('button',{name:'Retry transfer',exact:true}).click();await status.getByText('Message sent',{exact:true}).waitFor({timeout:30000});await ready('retry done');
 assert.equal((await sender.client.from('my_work_messages').select('id').eq('id',failedId)).data.length,1);
 // Failure -> cancellation keeps unsent text but releases files and recovery lock.
 await alice.evaluate(()=>window.transport.upload=async()=>{throw Error('Injected local transfer failure');});
 await text.fill('retain after cancel');await add('drop','cancel.unknown');await send();await status.getByText('Transfer needs attention',{exact:true}).waitFor();
 await alice.getByRole('button',{name:'Cancel transfer',exact:true}).click();await status.getByText('Transfer canceled',{exact:true}).waitFor();
 assert.equal(await text.isEnabled(),true);assert.equal(await text.inputValue(),'retain after cancel');assert.equal(await alice.getByRole('button',{name:/^Remove /}).count(),0);
 assert.equal(await text.evaluate(el=>el===document.activeElement),true);
 await alice.evaluate(()=>window.transport.upload=window.realUpload);
 await add('picker','after-cancel.unknown');await send();await status.getByText('Message sent',{exact:true}).waitFor({timeout:30000});await ready('after cancel');
 // Same completed banner stays present through keyboard/pointer and theme/viewport changes.
 for(const appearance of ['light','dark'])for(const width of [1280,390]){
  await alice.evaluate(a=>document.documentElement.dataset.appearance=a,appearance);await alice.setViewportSize({width,height:844});
  await text.click();await text.fill('layout '+appearance+width);await alice.keyboard.type(' ready');assert.equal(await text.inputValue(),'layout '+appearance+width+' ready');
  await alice.screenshot({path:`.tmp-messaging-completion/${appearance}-${width}.png`});
 }
 await alice.getByRole('button',{name:'Close Inbox'}).click();await alice.getByRole('button',{name:'Open',exact:true}).click();
 await text.fill('reopened ready');await alice.getByRole('button',{name:'Dismiss transfer'}).click();assert.equal(await text.inputValue(),'reopened ready','Dismissal must not clear the next draft');
 // Cancel an active upload, not just a failed upload.
 await alice.evaluate(()=>window.transport.upload=(_id,_entry,_file,signal)=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new DOMException('Canceled','AbortError')),{once:true})));
 await add('picker','active-cancel.unknown');await send();await status.getByText('Uploading file 1 of 1',{exact:true}).waitFor();assert.equal(await text.isDisabled(),true);
 await alice.getByRole('button',{name:'Cancel transfer',exact:true}).click();await status.getByText('Transfer canceled',{exact:true}).waitFor();assert.equal(await text.isEnabled(),true);assert.equal(await text.inputValue(),'reopened ready');
 await alice.evaluate(()=>window.transport.upload=window.realUpload);
 assert.equal(sql(`select md5(row_to_json(a)::text) from my_work_message_attachments a where message_id='${old.data}';`),historyBefore);
 assert.equal(errors.length,0,errors.join('\n'));
 const result={passed:true,completed,successBannerNonblocking:true,terminalRecoveryCleared:true,retrySameDraft:true,cancelPreservesText:true,terminalCanStartNextAttachment:true,twoUserRealtime:true,inlinePreview:true,noDuplicateMessages:true,lightDarkDesktopMobile:true,historicalFixtureUnchanged:true,largeTransfers:false};
 await writeFile('.tmp-messaging-completion/results.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{await browser.close();await new Promise(r=>server.close(r));}
