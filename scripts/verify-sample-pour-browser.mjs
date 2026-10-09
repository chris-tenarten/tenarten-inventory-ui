import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
const url=process.env.POUR_REVIEW_URL;
if(!url||new URL(url).hostname!=='localhost')throw new Error('POUR_REVIEW_URL must be the disposable localhost Sample route');
const browser=await chromium.launch();const page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(15000);
const writes=[];page.on('request',r=>{if(/\/rpc\/(save_sample_draft|create_sample|issue_sample_form)$/.test(r.url()))writes.push(r.url());});
try {
 await page.goto(url);const planner=page.getByTestId('sample-pour-planner');await expect(planner).toBeVisible();
 const percentages=page.locator('[data-sample-material-row][data-role=aggregate] .blend-percent input');
 const initial=await percentages.evaluateAll(es=>es.map(e=>e.value));const percent=percentages.first();
 await percent.focus();await percent.press('ControlOrMeta+a');await percent.press('Backspace');await expect(percent).toHaveValue('');
 await percent.pressSequentially('17.125');await expect(percent).toHaveValue('17.125');
 await expect(page.locator('[data-sample-material-row][data-role=aggregate]').first()).toContainText('30.825 lb');
 assert.deepEqual((await percentages.evaluateAll(es=>es.map(e=>e.value))).slice(1),initial.slice(1));
 assert.equal(await percent.evaluate(e=>getComputedStyle(e).appearance),'textfield');
 await percent.click();await percent.hover();await page.mouse.wheel(0,100);await expect(percent).toHaveValue('17.125');
 await percent.dispatchEvent('wheel',{deltaY:100});await expect(percent).not.toBeFocused();
 await percent.click();await percent.press('ControlOrMeta+a');await percent.press('Delete');await expect(percent).toHaveValue('');await percent.fill(initial[0]);

 const field=name=>planner.getByRole('spinbutton',{name,exact:true});
 await expect(planner.getByTestId('finished-geometry')).toHaveText('1 SF · 0.03125 CFT finished');await expect(planner.getByTestId('pour-fraction')).toContainText('1/45 Batch');
 await field('Finished Plate Width').fill('12');await expect(planner.getByTestId('finished-geometry')).toContainText('0.0625 CFT');await expect(planner.getByRole('status')).toContainText('less than');await expect(page.getByTestId('working-pour-chip-mix')).toHaveText('64 oz');await field('Finished Plate Width').fill('6');
 await field('Finished Pieces').fill('8');await expect(planner.getByTestId('finished-geometry')).toContainText('2 SF');await field('Finished Pieces').fill('4');
 await field('Thickness').fill('.75');await expect(planner.getByTestId('working-geometry')).toContainText('0.0625 CFT');await expect(page.getByTestId('working-pour-chip-mix')).toHaveText('128 oz');await expect(planner).toContainText(/18 oz at 0?\.03125 CFT/);await field('Thickness').fill('.375');
 await field('Working Pour Width').fill('24');await expect(page.getByTestId('working-pour-chip-mix')).toHaveText('128 oz');await field('Working Pour Width').fill('12');
 await planner.getByRole('combobox',{name:'Working Pour Units'}).selectOption('ft');await expect(field('Working Pour Width')).toHaveValue('1');await expect(page.getByTestId('working-pour-chip-mix')).toHaveText('64 oz');await planner.getByRole('combobox',{name:'Working Pour Units'}).selectOption('in');await expect(field('Working Pour Width')).toHaveValue('12');
 await planner.getByRole('button',{name:'Suggest Working Pour',exact:true}).click();await expect(planner.getByTestId('pour-suggestion')).toHaveCount(0);
 await expect(planner.getByRole('checkbox',{name:/Allow thicker Working Pour/})).toBeDisabled();
 await planner.getByRole('button',{name:'Calculate Suggestions',exact:true}).click();await expect(planner.getByTestId('pour-suggestion')).toHaveCount(3);
 await field('Finished Pieces').fill('5');await expect(planner.getByTestId('pour-suggestion')).toHaveCount(0);await expect(planner).toContainText('Inputs changed — recalculate suggestions.');await field('Finished Pieces').fill('4');
 await planner.getByRole('spinbutton',{name:'Maximum pour width (in)'}).fill('5');await planner.getByRole('button',{name:'Calculate Suggestions',exact:true}).click();await expect(planner).toContainText('No modeled rectangular arrangement');
 await planner.getByRole('spinbutton',{name:'Maximum pour width (in)'}).fill('');
 await planner.getByRole('checkbox',{name:'Allow width adjustment'}).uncheck();await planner.getByRole('button',{name:'Calculate Suggestions',exact:true}).click();await expect(planner.getByTestId('pour-suggestion').first()).toContainText('12″ × 12″');
 await planner.getByRole('checkbox',{name:'Allow width adjustment'}).check();await planner.getByRole('button',{name:'Calculate Suggestions',exact:true}).click();
 await expect(planner.getByTestId('pour-suggestion').first()).toContainText('12″ × 12″ × 0.375″');
 await planner.getByRole('checkbox',{name:'Include edge allowance'}).check();await planner.getByRole('checkbox',{name:'Include separation / cutting allowance'}).check();
 await planner.getByRole('spinbutton',{name:'Edge allowance (in)'}).fill('1');await planner.getByRole('spinbutton',{name:'Separation / cutting allowance (in)'}).fill('.125');await expect(planner.getByTestId('pour-suggestion')).toHaveCount(0);await planner.getByRole('button',{name:'Calculate Suggestions',exact:true}).click();await expect(planner.getByTestId('pour-suggestion').first()).toContainText('14.125″ × 14.125″');await expect(field('Working Pour Width')).toHaveValue('12');
 await planner.getByRole('button',{name:'Apply Alternative 1 to Working Pour'}).click();await expect(field('Working Pour Width')).toHaveValue('14.125');assert.equal(writes.length,0,'geometry actions must not save');
 await page.getByRole('group',{name:'View quantities as'}).getByRole('button',{name:'Sample Plate',exact:true}).click();
 const filler=page.getByRole('spinbutton',{name:'filler quantity',exact:true});const fillerCard=page.locator('#sample-plate').locator('div.grid').filter({has:filler}).last();
 await fillerCard.getByRole('button',{name:/Enter manually/}).click();await filler.fill('22');await field('Working Pour Width').fill('12');await expect(filler).toHaveValue('22');await planner.getByRole('combobox',{name:'Working Pour Units'}).selectOption('ft');await expect(filler).toHaveValue('22');await planner.getByRole('button',{name:'Calculate Suggestions',exact:true}).click();await planner.getByRole('button',{name:'Apply Alternative 2 to Working Pour'}).click();await expect(filler).toHaveValue('22');await expect(planner).toContainText('Manual shop quantities are preserved');
 assert.equal(writes.length,0);
 mkdirSync('/tmp/tenops-pour-browser',{recursive:true});await planner.scrollIntoViewIfNeeded();await page.screenshot({path:'/tmp/tenops-pour-browser/desktop.png'});
 await page.setViewportSize({width:390,height:844});await planner.scrollIntoViewIfNeeded();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:'/tmp/tenops-pour-browser/mobile.png'});
 // Reopen the saved fixture: unsaved planning actions must not reinterpret it.
 await page.reload();await expect(field('Working Pour Width')).toHaveValue(/^12(?:\.0+)?$/);await expect(planner.getByTestId('finished-geometry')).toHaveText('1 SF · 0.03125 CFT finished');await expect(page.getByTestId('working-pour-chip-mix')).toHaveText('64 oz');
 console.log('PASS explicit constraints/calculation/invalidation/locked width/impossible maxima/deferred thickness; percentage keyboard/blank/replacement/wheel/no redistribution; actual localhost UI: live geometry, warning, units, suggestions/allowances/apply, manual shop preservation, no implicit writes, unchanged saved fixture on reopen, desktop/mobile overflow.');
} catch(e) {console.error((await page.locator('body').innerText()).slice(-1800));throw e;} finally {await browser.close();}
