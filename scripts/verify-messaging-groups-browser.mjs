import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {chromium} from '@playwright/test';
import {reviewSession} from './support/messaging-groups-review-fixture.mjs';
const browser=await chromium.launch({headless:true});
const dir='.tmp-messaging-groups-review';mkdirSync(dir,{recursive:true});
try{
for(const mobile of [false,true]){
 const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:1000},isMobile:mobile,hasTouch:mobile});
 const errors=[],external=[];await context.addInitScript(({session})=>{localStorage.setItem('sb-127-auth-token',JSON.stringify(session));sessionStorage.setItem('tenops.welcomeHeroPlayed:'+session.user.id,'true');},{session:reviewSession});
 await context.route('**/*',r=>{if(['localhost','127.0.0.1'].includes(new URL(r.request().url()).hostname))return r.continue();external.push(r.request().url());return r.abort();});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 const box=page.getByRole('textbox',{name:'Message',exact:true});
 async function open(){await page.getByRole('button',{name:'Messaging',exact:true}).click();await page.locator('#my-work-inbox-title').waitFor();}
 async function back(){if(mobile)await page.getByRole('button',{name:'Back to conversations',exact:true}).click();}
 async function choose(name){await page.getByRole('button').filter({has:page.getByText(name,{exact:true})}).last().click();await box.waitFor();}
 async function send(text){await box.fill(text);await page.getByRole('button',{name:'Send',exact:true}).click();await page.getByText(text,{exact:true}).last().waitFor();}
 try{
 await page.goto('http://localhost:3000/');await open();await choose('Draft Review Bob');
 await page.getByText('Original message unavailable',{exact:true}).waitFor();
 const original=page.locator('article').filter({has:page.getByText('Synthetic conversation',{exact:true})}).first();
 await original.getByRole('button',{name:'Message actions',exact:true}).click();await page.getByRole('button',{name:'Reply',exact:true}).click();
 await page.getByText('Replying to Draft Review Bob',{exact:true}).waitFor();
 await send(mobile?'Mobile DM reply':'Desktop DM reply');
 await page.locator('article').filter({has:page.getByText(mobile?'Mobile DM reply':'Desktop DM reply',{exact:true})}).getByRole('button').filter({hasText:'Draft Review Bob'}).click();
 await back();await choose('Draft Review Carol');
 const historicalReply=page.locator('article').filter({has:page.getByText('Reply pointing beyond latest page',{exact:true})});
 await historicalReply.getByRole('button').filter({hasText:'Older original outside latest page'}).click();
 await page.waitForFunction(()=>document.activeElement?.id==='message-00000000-0000-4000-8000-000000940000');
 await page.locator('#message-00000000-0000-4000-8000-000000940000').waitFor();
 await back();await page.getByRole('button',{name:'New group',exact:true}).click();
 const name=mobile?'Mobile shop team':'Desktop shop team';
 await page.getByRole('textbox',{name:'Group name',exact:true}).fill(name);
 await page.getByLabel('Draft Review Bob',{exact:true}).check();await page.getByLabel('Draft Review Carol',{exact:true}).check();
 await page.getByRole('button',{name:'Create group',exact:true}).click();await page.getByText(name,{exact:true}).last().waitFor();
 await send(name+' first message');
 const first=page.locator('article').filter({has:page.getByText(name+' first message',{exact:true})});
 await first.getByRole('button',{name:'Message actions',exact:true}).click();await page.getByRole('button',{name:'Reply',exact:true}).click();await send(name+' reply');
 await page.getByRole('button',{name:'Participants',exact:true}).click();await page.getByRole('textbox',{name:'Group name',exact:true}).fill(name+' renamed');
 await page.getByLabel('Draft Review Carol',{exact:true}).uncheck();await page.getByRole('button',{name:'Save group',exact:true}).click();
 await page.getByText(name+' renamed',{exact:true}).last().waitFor();
 await page.getByLabel('Attach files',{exact:true}).setInputFiles({name:'shared-note.txt',mimeType:'text/plain',buffer:Buffer.from('Local fixture only')});
 await box.fill('Shared attachment '+name);await page.getByRole('button',{name:'Send',exact:true}).click();
 await page.locator('article').filter({has:page.getByText('Shared attachment '+name,{exact:true})}).getByText('shared-note.txt',{exact:true}).waitFor({timeout:20000});
 await page.reload();await open();await choose(name+' renamed');
 const reply=page.locator('article').filter({has:page.getByText(name+' reply',{exact:true})});
 await reply.getByRole('button').filter({hasText:name+' first message'}).click();
 await page.screenshot({path:dir+`/${mobile?'mobile':'desktop'}.png`,fullPage:true});
 assert(await page.locator('body').evaluate(el=>el.scrollWidth<=window.innerWidth),'No viewport overflow');
 assert.deepEqual(external,[]);assert.deepEqual(errors,[]);
 console.log(`PASS ${mobile?'mobile 390px':'desktop 1440px'} actual localhost:3000: DM reply + original navigation, deleted fallback, group creation/name/participants, send/reply, shared attachment through TUS fixture, reload persistence, quote navigation, no page errors/outbound requests.`);
 }catch(e){console.error((await page.locator('body').innerText()).slice(-5000));await page.screenshot({path:dir+'/failure.png'});throw e;}
 finally{await context.close();}
}
}finally{await browser.close();}
