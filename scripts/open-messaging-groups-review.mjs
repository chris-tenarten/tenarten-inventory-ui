// Ephemeral browser session using the pre-existing local fixture identity.
// No sign-in request, Auth account creation, or Production authentication change.
import {chromium} from '@playwright/test';
import {reviewSession} from './support/messaging-groups-review-fixture.mjs';
const browser=await chromium.launch({headless:false,channel:'chrome'});
const context=await browser.newContext({viewport:null});
await context.addInitScript(({session})=>{localStorage.setItem('sb-127-auth-token',JSON.stringify(session));sessionStorage.setItem('tenops.welcomeHeroPlayed:'+session.user.id,'true');},{session:reviewSession});
await context.grantPermissions(['local-network-access'],{origin:'http://localhost:3000'});
const page=await context.newPage();
await page.goto('http://localhost:3000/');
try{await page.getByRole('button',{name:'Messaging',exact:true}).click();}catch(error){console.error(await page.locator('body').innerText());await browser.close();throw error;}
console.log('Local Messaging review is open. Closing this browser ends the ephemeral fixture session.');
await new Promise(resolve=>browser.on('disconnected',resolve));
