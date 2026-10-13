import {chromium,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
const {route}=JSON.parse(readFileSync('/private/tmp/tenops-shop-review-data/server.json','utf8'));
if(new URL(route).hostname!=='localhost')throw Error('Disposable localhost required');
const browser=await chromium.launch();const page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(15000);
const qty=role=>page.getByRole('spinbutton',{name:role+' quantity',exact:true});
const card=role=>page.locator('#sample-plate div.grid').filter({has:qty(role)}).last();
const working=()=>page.getByRole('group',{name:'View quantities as'}).getByRole('button',{name:'Sample Plate',exact:true}).click();
const selectProfile=async name=>{const select=page.getByRole('combobox',{name:'Resin System',exact:true});const option=await select.locator('option').filter({hasText:name}).last().getAttribute('value');await select.selectOption(option);await page.getByRole('button',{name:'Apply configured profile',exact:true}).click();};
try{
 await page.goto(route);await working();await expect(qty('filler')).toHaveValue('36');await expect(qty('resin')).toHaveValue('30');await expect(qty('hardener')).toHaveValue('6');await expect(card('filler')).toContainText('Exact Batch projection: ≈ 35.56 oz');await expect(card('filler')).toContainText('Scaled from captured reference preparation.');
 await page.getByRole('button',{name:'Save Changes',exact:true}).click();await expect(page.getByText('Sample saved.',{exact:true})).toBeVisible();await page.reload();await working();await expect(qty('filler')).toHaveValue('36');
 await page.getByRole('button',{name:'Generate Sample Work Order',exact:true}).click();await expect(page.getByText('Sample Work Order generated.',{exact:true})).toBeVisible();
 // Close any PDF surface by reopening the saved route.
 await page.goto(route);await working();
 for(const [role,value] of [['filler','21'],['resin','22']]){await card(role).getByRole('button',{name:'Enter manually',exact:true}).click();await qty(role).fill(value);}
 const planner=page.getByTestId('sample-pour-planner');await planner.getByRole('spinbutton',{name:'Working Pour Width',exact:true}).fill('48');await expect(qty('filler')).toHaveValue('21');await expect(qty('resin')).toHaveValue('22');await expect(qty('hardener')).toHaveValue('4.4');
 await page.getByRole('spinbutton',{name:'Batch Filler (lb)',exact:true}).fill('100');await expect(qty('filler')).toHaveValue('21');await expect(qty('resin')).toHaveValue('22');
 await selectProfile('Sherwin');await expect(qty('filler')).toHaveValue('21');await expect(qty('resin')).toHaveValue('22');await expect(qty('hardener')).toHaveValue('5.5');await expect(page.getByText(/Manual preparation quantities remain fixed/)).toBeVisible();
 await page.getByRole('button',{name:'Save Changes',exact:true}).click();await expect(page.getByText('Sample saved.',{exact:true})).toBeVisible();await page.reload();await working();await expect(qty('filler')).toHaveValue('21');await expect(qty('resin')).toHaveValue('22');
 // Restore representative review state through explicit UI actions.
 await selectProfile('Key Resin');for(const role of ['filler','resin'])await card(role).getByRole('button',{name:'Use profile default',exact:true}).click();await planner.getByRole('spinbutton',{name:'Working Pour Width',exact:true}).fill('24');await expect(qty('filler')).toHaveValue('36');
 // Existing per-component policy is editable and survives a managed-profile save.
 await page.getByRole('button',{name:'Configure profiles',exact:true}).click();await page.getByRole('button',{name:'Edit MTT',exact:true}).click();const policy=page.getByRole('combobox',{name:'Filler preparation policy',exact:true});await expect(policy).toHaveValue('historical_volume_rate');await policy.selectOption('at_volume');await page.getByRole('button',{name:'Save profile',exact:true}).click();await page.getByRole('button',{name:'Edit MTT',exact:true}).click();await expect(policy).toHaveValue('at_volume');await policy.selectOption('historical_volume_rate');await page.getByRole('button',{name:'Save profile',exact:true}).click();await page.getByRole('button',{name:'Close profiles',exact:true}).click();
 await page.getByRole('button',{name:'Save Changes',exact:true}).click();await expect(page.getByText('Sample saved.',{exact:true})).toBeVisible();
 await card('filler').scrollIntoViewIfNeeded();await page.screenshot({path:'/private/tmp/tenops-shop-review-data/desktop.png'});
 await page.setViewportSize({width:390,height:844});await card('filler').scrollIntoViewIfNeeded();await expect(qty('filler')).toBeVisible();await page.screenshot({path:'/private/tmp/tenops-shop-review-data/mobile.png'});
 console.log('PASS actual localhost UI: proportional preview, exact annotation, save/reopen, generated PDF, manual Filler/Resin survive geometry + Batch + profile changes and reopen, 4:1 derived Hardener, managed policy save/reopen, desktop/mobile.');
}finally{await browser.close();}
