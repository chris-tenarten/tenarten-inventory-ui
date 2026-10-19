import {chromium} from '@playwright/test';
const browser=await chromium.launch({channel:'chrome',headless:false});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
const page=await context.newPage();await page.goto('http://localhost:3355/');
console.log('Integrated TenOps review: Production, Proposals, Samples, Messaging, Manpower and Inventory share http://localhost:3355. Ctrl-C closes this isolated review browser.');
await new Promise(resolve=>process.once('SIGINT',resolve));await browser.close();
