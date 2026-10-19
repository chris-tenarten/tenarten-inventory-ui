import {chromium} from '@playwright/test';
const browser=await chromium.launch({channel:'chrome',headless:false});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
const report=await context.newPage();await report.goto('http://localhost:3344/manpower-reporting');
const inventory=await context.newPage();await inventory.goto('http://localhost:3344/inventory');
await report.bringToFront();
console.log('Wave 4 local review open: Manpower and Inventory. Ctrl-C closes this review browser.');
await new Promise(resolve=>process.once('SIGINT',resolve));await browser.close();
