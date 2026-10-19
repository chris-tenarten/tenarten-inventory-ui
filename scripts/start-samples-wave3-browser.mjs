/** Opens only the disposable localhost review with a synthetic session. */
import {chromium} from '@playwright/test';
import {reviewSession} from './support/messaging-draft-review-fixture.mjs';
const browser=await chromium.launch({channel:'chrome',headless:false});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
await context.addInitScript(session=>{
 localStorage.setItem('sb-localhost-auth-token',JSON.stringify(session));
 sessionStorage.setItem('tenops.welcomeHeroPlayed:'+session.user.id,'true');
},reviewSession);
const page=await context.newPage();
await page.goto('http://localhost:3333/samples?open=00000000-0000-4000-8000-000000710001');
console.log('Disposable Samples review open; Ctrl-C closes this browser.');
await new Promise(resolve=>process.once('SIGINT',resolve));
await browser.close();
