/** Built TenOps UI against network-intercepted fixtures only. Run after npm run build
 * with NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 and a disposable anon key.
 */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from '@playwright/test';
await mkdir('.tmp-messaging',{recursive:true});
const server=spawn(process.execPath,['tests/support/static-server.mjs'],{env:{...process.env,PORT:'3197'},stdio:'ignore'});
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:900}});
 const uid='10000000-0000-0000-0000-000000000001',peer='10000000-0000-0000-0000-000000000002',mid='20000000-0000-0000-0000-000000000001';
 const user={id:uid,aud:'authenticated',role:'authenticated',email:'messaging@example.invalid',app_metadata:{},user_metadata:{},created_at:'2026-09-25T00:00:00Z'};
 const token=`${Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url')}.${Buffer.from(JSON.stringify({sub:uid,role:'authenticated',aud:'authenticated',exp:4102444800})).toString('base64url')}.fixture`;
 await page.addInitScript(({user,token})=>localStorage.setItem('sb-127-auth-token',JSON.stringify({access_token:token,refresh_token:'fixture',expires_at:4102444800,expires_in:3600,token_type:'bearer',user})),{user,token});
 let signs=0,bytes=0,begins=0,pending=null;
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('http://127.0.0.1:54321/**',async route=>{
  const req=route.request(),url=new URL(req.url());let data=[];
  if(url.pathname.startsWith('/auth/'))data=user;
  else if(url.pathname.endsWith('/get_my_app_user'))data=[{user_id:uid,display_name:'Fixture Sender',role:'admin',is_active:true}];
  else if(url.pathname.endsWith('/list_my_work_inbox_recipients'))data=[{user_id:peer,display_name:'Fixture Recipient',role:'lead'}];
  else if(url.pathname.endsWith('/list_my_work_inbox_messages_v2'))data=[{id:mid,sender_user_id:peer,sender_name:'Fixture Recipient',recipient_user_id:uid,recipient_name:'Fixture Sender',body:'Historical attachment message',job_id:null,job_number:null,job_name:null,read_at:'2026-09-25T00:00:00Z',created_at:'2026-09-25T00:00:00Z',edited_at:null}];
  else if(url.pathname.endsWith('/my_work_message_attachments'))data=[{id:'a',message_id:mid,storage_path:'historical/image.png',original_filename:'image.png',content_type:'image/png',byte_size:70,created_at:'2026-09-25T00:00:00Z'},{id:'b',message_id:mid,storage_path:'historical/file',original_filename:'project & #.dwg',content_type:'application/octet-stream',byte_size:50000000,created_at:'2026-09-25T00:00:00Z'}];
  else if(url.pathname.includes('/object/sign/')&&req.method()==='POST'){signs++;data={signedURL:url.pathname.replace('/storage/v1','')+'?token=fixture'};}
  else if(url.pathname.includes('/object/')){bytes++;return route.fulfill({status:200,contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7l8AAAAASUVORK5CYII=','base64')});}
  else if(url.pathname.endsWith('/recover_my_work_attachment_transfer'))data=pending;
  else if(url.pathname.endsWith('/my_work_attachment_transfer_status'))data={status:'active',completed:[]};
  else if(url.pathname.endsWith('/begin_my_work_attachment_transfer')){begins++;const input=req.postDataJSON();pending={id:input.p_id,recipient:input.p_recipient,body:input.p_body,job:input.p_job||'',entries:input.p_files};return route.fulfill({status:503,contentType:'application/json',body:'{"message":"Disposable offline fixture"}'});}
  return route.fulfill({status:200,headers:{'content-type':'application/json','content-range':'0-0/0'},body:JSON.stringify(data)});
 });
 for(let i=0;i<30;i++){try{await page.goto('http://localhost:3197');break;}catch{await new Promise(r=>setTimeout(r,100));}}
 await page.getByRole('button',{name:'Open Messaging menu',exact:true}).waitFor();
 await page.evaluate(peer=>window.dispatchEvent(new CustomEvent('tenops:open-inbox',{detail:{userId:peer}})),peer);
 await page.getByRole('dialog',{name:'Inbox',exact:true}).waitFor();
 // Event detail format may select via conversation control; use its visible canonical name.
 const conversation=page.getByRole('button').filter({hasText:'Historical attachment message'});if(await conversation.count())await conversation.first().click();
 await page.getByRole('button',{name:'Download',exact:true}).first().waitFor();assert.equal(await page.getByRole('button',{name:'Download',exact:true}).count(),2);assert.equal(signs,0);assert.equal(bytes,0);
 await page.getByRole('button',{name:'Preview image',exact:true}).click();await page.waitForFunction(()=>document.querySelector('[aria-label="Preview image.png"]'));assert.equal(signs,1);await page.getByRole('button',{name:'Close image preview'}).click();
 assert.match(await page.locator('#messaging-attachment-help').innerText(),/50 MB per file · 200 MB per message/);
 await page.getByLabel('Message',{exact:true}).fill('Send arbitrary files');
 await page.getByLabel('Attach files').setInputFiles({name:'arbitrary.exe',mimeType:'application/x-msdownload',buffer:Buffer.from('binary')});assert.equal(begins,0);
 await page.getByLabel('Message',{exact:true}).evaluate(el=>{const data=new DataTransfer();data.items.add(new File(['clip'],'clipboard.bin'));el.dispatchEvent(new ClipboardEvent('paste',{clipboardData:data,bubbles:true,cancelable:true}));});
 await page.locator('[data-messaging-composer]').evaluate(el=>{const data=new DataTransfer();data.items.add(new File(['drop'],'design.dxf'));el.dispatchEvent(new DragEvent('drop',{dataTransfer:data,bubbles:true,cancelable:true}));});
 assert.equal(await page.getByRole('button',{name:/^Remove (arbitrary|clipboard|design)/}).count(),3);assert.equal(begins,0);
 await page.screenshot({path:'.tmp-messaging/messaging-queue-desktop.png'});await page.setViewportSize({width:390,height:844});await page.screenshot({path:'.tmp-messaging/messaging-queue-mobile.png'});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false);await page.setViewportSize({width:1280,height:900});
 await page.getByRole('button',{name:'Send',exact:true}).click();await page.getByRole('button',{name:'Retry transfer'}).waitFor();assert.equal(begins,1);
 await page.getByRole('button',{name:'Close Inbox'}).click();
 await page.evaluate(()=>window.dispatchEvent(new CustomEvent('tenops:open-inbox')));
 await page.getByRole('button',{name:'Retry transfer'}).waitFor();assert.equal(begins,1,'reopening must not create a new transfer');
 await page.screenshot({path:'.tmp-messaging/messaging-desktop.png'});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'.tmp-messaging/messaging-mobile.png'});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false);
 const stored=await page.evaluate(()=>Object.entries(sessionStorage).filter(([key])=>key.startsWith('tenops-messaging-transfer:')));assert.equal(stored.length,1);assert.equal(stored[0][1],pending.id);
 await page.reload();await page.getByRole('button',{name:'Open Messaging menu',exact:true}).waitFor();await page.evaluate(()=>window.dispatchEvent(new CustomEvent('tenops:open-inbox')));await page.getByLabel('Reselect original attachments').waitFor();assert.equal((await page.evaluate(()=>Object.entries(sessionStorage).find(([key])=>key.startsWith('tenops-messaging-transfer:'))))[1],pending.id);
 assert.deepEqual(errors,[]);await writeFile('.tmp-messaging/ui-results.json',JSON.stringify({noEagerSigning:true,noEagerBytes:true,historicalCardDownload:true,historicalPreview:true,arbitraryPicker:true,failedTransferRetainedAcrossClose:true,mobileNoHorizontalOverflow:true,pageErrors:errors},null,2));
 console.log('PASS: built Messaging historical cards, explicit preview, no eager bytes/signing, arbitrary picker, transfer error/retry retention on reopen, desktop/mobile layout.');
}finally{await browser.close();server.kill('SIGTERM');}
