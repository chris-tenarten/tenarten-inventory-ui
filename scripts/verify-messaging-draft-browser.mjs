import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {reviewSession} from './support/messaging-draft-review-fixture.mjs';
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
await context.addInitScript(({session})=>{if(!localStorage.getItem('sb-127-auth-token'))localStorage.setItem('sb-127-auth-token',JSON.stringify(session));sessionStorage.setItem('tenops.welcomeHeroPlayed:'+session.user.id,'true');},{session:reviewSession});
const page=await context.newPage(),errors=[],external=[];
page.on('pageerror',e=>errors.push(e.message));
await context.route('**/*',r=>{if(['localhost','127.0.0.1'].includes(new URL(r.request().url()).hostname))return r.continue();external.push(r.request().url());return r.abort();});
const box=page.getByRole('textbox',{name:'Message',exact:true});
async function open(){await page.getByRole('button',{name:'Messaging',exact:true}).click();await page.locator('#my-work-inbox-title').waitFor();}
async function choose(name){await page.getByRole('button').filter({has:page.getByText('Draft Review '+name,{exact:true})}).last().click();await box.waitFor();}
async function value(text){await page.waitForFunction(t=>document.querySelector('textarea[aria-label="Message"]')?.value===t,text);}
try{
 await page.goto('http://localhost:3000/');await open();await choose('Bob');await box.fill('Bob unfinished');
 await page.getByRole('button',{name:'Close Inbox',exact:true}).click();
 await page.goto('http://localhost:3000/my-work');await open();await choose('Bob');await value('Bob unfinished');
 await choose('Carol');await box.fill('Carol independent');await choose('Bob');await value('Bob unfinished');
 await page.reload();await open();await choose('Bob');await value('Bob unfinished');
 await box.fill('FAIL');await page.getByRole('button',{name:'Send',exact:true}).click();await page.getByRole('alert').filter({hasText:'Unable to send message.'}).waitFor();await value('FAIL');
 await box.fill('Sent snapshot');await page.getByRole('button',{name:'Send',exact:true}).click();await box.fill('Newer draft');await page.getByText('Sent snapshot',{exact:true}).last().waitFor();await value('Newer draft');
 await page.getByRole('button',{name:'Send',exact:true}).click();await value('');await choose('Carol');await value('Carol independent');
 await page.getByLabel('Attach files',{exact:true}).setInputFiles({name:'screenshot.png',mimeType:'image/png',buffer:Buffer.from('synthetic selection only')});await page.getByText('screenshot.png',{exact:true}).waitFor();
 assert.deepEqual(external,[]);assert.deepEqual(errors,[]);
 console.log('PASS actual localhost:3000 app: module navigation, independent conversations, refresh, failed send, successful send, send typing race, attach after return; no external requests or page errors.');
}catch(e){console.error((await page.locator('body').innerText()).slice(-5000));throw e;}finally{await browser.close();}
