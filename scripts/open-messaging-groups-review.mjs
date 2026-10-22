// Ephemeral browser session using the existing fixture or --integration local identity.
// No sign-in request, Auth account creation, or Production authentication change.
import {readFileSync} from 'node:fs';
import {chromium} from '@playwright/test';
import {reviewSession} from './support/messaging-groups-review-fixture.mjs';
const integration=process.argv.includes('--integration')?JSON.parse(readFileSync('.tmp-messaging-groups-review/integration-sessions.json','utf8')):null;
const selectedSession=integration?.accounts.admin.session??reviewSession;
const browser=await chromium.launch({headless:false,channel:'chrome'});
const context=await browser.newContext({viewport:null});
await context.addInitScript(({session})=>{localStorage.setItem('sb-127-auth-token',JSON.stringify(session));sessionStorage.setItem('tenops.welcomeHeroPlayed:'+session.user.id,'true');},{session:selectedSession});
await context.grantPermissions(['local-network-access'],{origin:'http://localhost:3000'});
const page=await context.newPage();
await page.goto('http://localhost:3000/'+(integration?'?inboxUserId='+integration.group:''));
try{if(integration)await page.getByRole('button',{name:'View group participants',exact:true}).waitFor();else await page.getByRole('button',{name:'Messaging',exact:true}).click();}catch(error){console.error(await page.locator('body').innerText());await browser.close();throw error;}
console.log('Local Messaging review is open. Closing this browser ends the ephemeral fixture session.');
await new Promise(resolve=>browser.on('disconnected',resolve));
