import { expect, test, type Page } from '@playwright/test';
import { mockManpowerAuth } from '../support/manpower-auth';

const plex = { id:'plex', vendor_name:'Klein & Co / KCI', item_name:'Plex-A-Bond', material_type:'Resin / chemical system', category:'resin', component_type:'Polyacrylate additive', price_unit:'quote', quote_required:true, is_active:true };
const priced = { id:'priced', vendor:'Klein & Co / KCI', item_name:'Maintained Epoxy', vendor_sku:'E-1', category:'resin', unit:'5 GAL Pail', price:42, price_basis:'Pail' };
const regular = [...Array.from({length:270}, (_,i) => ({...priced,id:`a-${String(i).padStart(3,'0')}`,item_name:`Aggregate ${i}`,category:'marble'})),priced];
const specialty = [plex, ...['K-Poxy Acrylic Sealer','K-Poxy Flexible Epoxy','K-Poxy Epoxy Terrazzo Resin','TTC2','XO'].map((name,i)=>({...plex,id:`special-${i}`,item_name:name,material_type:i>2?'Terrazzo filler':plex.material_type,category:i>2?'filler':'resin'}))];
regular.push(
  {...priced,id:'pacific-a',vendor:'T&M',item_name:'Pacific Abalone',category:'marble'},
  {...priced,id:'pacific-g',vendor:'T&M',item_name:'Pacific Clear Glass',category:'glass'},
  {...priced,id:'glass-filler',vendor:'Arim',item_name:'Recycled Clear Glass Filler',category:'glass'},
);
specialty.push({...plex,id:'hardener',item_name:'Component B',component_type:'hardener'});
const rowFor = (page: Page, role: string) => page.locator('article').filter({has:page.locator(`select option:checked[value="${role}"]`)}).first();
async function fixture(page: Page) {
  let failure = false;
  const calls: string[] = [];
  const writes: string[] = [];
  await page.route('**/rest/v1/**', async route => {
    const request=route.request(); const url=new URL(request.url()); const table=url.pathname.split('/').at(-1)!;
    if (request.method() !== 'GET' && !url.pathname.includes('/rpc/')) writes.push(table);
    if (table==='vendor_catalog' || table==='vendor_catalog_v2') {
      const filter=url.searchParams.get('or');
      if (filter) calls.push(table);
      if (failure && filter && table==='vendor_catalog_v2') return route.fulfill({status:503,contentType:'application/json',body:'{"message":"Simulated source failure"}'});
      let rows: Record<string,unknown>[] = table==='vendor_catalog'?regular:specialty;
      if(filter) {
        const terms=[...filter.matchAll(/(\w+)\.ilike\.("(?:[^"\\]|\\.)*")/g)];
        rows=rows.filter(row=>terms.some(([,column,pattern])=>String(row[column]??'').toLowerCase().includes(JSON.parse(pattern).slice(1,-1).toLowerCase())));
      }
      rows=rows.slice().sort((a,b)=>String(a.id).localeCompare(String(b.id)));
      const total=rows.length;const start=Number(url.searchParams.get('offset')??0);const limit=Number(url.searchParams.get('limit')??1000);
      rows=rows.slice(start,start+limit);
      return route.fulfill({status:200,contentType:'application/json',headers:{'content-range':`${start}-${start+rows.length-1}/${total}`,'access-control-expose-headers':'content-range'},body:JSON.stringify(rows)});
    }
    return route.fulfill({status:200,contentType:'application/json',body:'[]'});
  });
  await mockManpowerAuth(page,'admin');
  return {calls,writes,fail:()=>{failure=true;}};
}

test('PO quote selection replaces metadata and errors preserve the draft',async({page})=>{
  const f=await fixture(page);
  await page.goto('/purchasing');
  await page.getByRole('button',{name:'+ New Purchase Order'}).click();
  await page.getByRole('button',{name:'Resin',exact:true}).click();
  const search=page.getByPlaceholder('Search Resin products, SKU, color, or component...');
  await search.fill('Maintained');
  await page.getByRole('button',{name:/Maintained Epoxy/}).click();
  await expect(page.getByLabel('Unit Cost',{exact:true})).toHaveValue('42');
  await expect(page.getByLabel('Vendor SKU',{exact:true})).toHaveValue('E-1');
  await page.getByLabel('Description',{exact:true}).fill('Keep authored note');
  for(const query of ['Plex-A-Bond','Plex','Klein']) {
    await search.fill(query);
    await expect(page.getByRole('button',{name:/Plex-A-Bond.*Specialty · Quote required/})).toBeVisible();
  }
  await page.getByRole('button',{name:/Plex-A-Bond.*Specialty · Quote required/}).click();
  await expect(page.getByLabel('Unit Cost',{exact:true})).toHaveValue('');
  await expect(page.getByLabel('Vendor SKU',{exact:true})).toHaveValue('');
  await expect(page.locator('label').filter({hasText:/^Container Size/}).locator('select')).toHaveValue('');
  await expect(page.getByLabel('Component Type',{exact:true})).toHaveValue('Polyacrylate additive');
  await expect(page.getByLabel('Description',{exact:true})).toHaveValue('Keep authored note');
  await search.fill('Maintained');
  await page.getByRole('button',{name:/Maintained Epoxy/}).click();
  await expect(page.getByLabel('Unit Cost',{exact:true})).toHaveValue('42');
  f.fail(); await search.fill('Plex');
  await expect(page.getByRole('alert').filter({hasText:'Specialty Catalog search is incomplete'})).toBeVisible();
  await expect(page.getByLabel('Product',{exact:true})).toHaveValue('Maintained Epoxy');
  await expect(page.getByRole('button',{name:/Plex-A-Bond/})).toHaveCount(0);
  expect(new Set(f.calls)).toEqual(new Set(['vendor_catalog','vendor_catalog_v2']));expect(f.writes.filter(table=>table!=='my_work_messages')).toEqual([]);
});

for(const width of [1440,390]) test(`Sample complete broad results, selection and failure at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:950});
  const f=await fixture(page);
  await page.goto('/samples');
  await page.getByRole('button',{name:'New Sample',exact:true}).click();
  const search=page.getByPlaceholder('Type or search Catalog').first();
  const start=Date.now();
  await search.fill('Klein');
  await expect(page.getByRole('status').filter({hasText:'1–50 of 278 Catalog matches'})).toBeVisible();
  expect(await page.getByRole('listbox',{name:'Catalog matches'}).getByRole('option').count()).toBe(50);
  for(let i=0;i<5;i++) await page.getByRole('button',{name:'Next results',exact:true}).click();
  await expect(page.getByRole('listbox').getByRole('option',{name:/Aggregate/}).first()).toBeVisible();
  console.log(`Catalog 278-match search and five result-page transitions (${width}px): ${Date.now()-start}ms`);
  const resinSearch=rowFor(page,'resin').getByPlaceholder('Type or search Catalog');
  await resinSearch.fill('Plex');
  await page.getByRole('listbox').getByRole('option',{name:/Plex-A-Bond/}).click();
  await expect(resinSearch).toHaveValue('Plex-A-Bond');
  for(const name of ['K-Poxy Acrylic Sealer','K-Poxy Flexible Epoxy','K-Poxy Epoxy Terrazzo Resin','TTC2','XO']) {
    await rowFor(page, ['TTC2','XO'].includes(name)?'filler':'resin').getByPlaceholder('Type or search Catalog').fill(name);
    await expect(page.getByRole('listbox').getByRole('option',{name:new RegExp(name)})).toContainText('Specialty · Quote required');
  }
  f.fail(); await resinSearch.fill('Plex');
  await expect(page.getByRole('alert').filter({hasText:'Specialty Catalog search is incomplete'})).toBeVisible();
  await expect(resinSearch).toHaveValue('Plex');
  expect(f.writes.filter(table=>table!=='my_work_messages')).toEqual([]);
});

 test('Sample role constraints survive clearing, selection and role changes',async({page})=>{
  await fixture(page); await page.goto('/samples');
  await page.getByRole('button',{name:'New Sample',exact:true}).click();
  const filler=rowFor(page,'filler');
  const search=filler.getByPlaceholder('Type or search Catalog');
  await search.fill('fi');
  await expect(page.getByText('No role-matching results.',{exact:true})).toBeVisible();
  await expect(page.getByText('Other Catalog matches',{exact:true})).toBeVisible();
  const secondary=page.getByRole('listbox').getByRole('option',{name:/Pacific|Recycled Clear Glass Filler/});
  await expect(secondary).toHaveCount(3);
  for (const option of await secondary.all()) await expect(option).toContainText('Not classified for Filler');
  await search.fill('');
  await expect(page.getByRole('listbox').getByRole('option',{name:/TTC2/})).toBeVisible();
  await expect(page.getByRole('listbox').getByRole('option')).toHaveCount(2);
  await page.getByRole('listbox').getByRole('option',{name:/TTC2/}).click();
  await search.fill('');
  await expect(filler.getByLabel('Type',{exact:true})).toHaveValue('');
  await expect(filler.getByText('Catalog-assisted',{exact:false})).toHaveCount(0);
  const id=await filler.getAttribute('data-sample-material-row');
  const stable=page.locator(`[data-sample-material-row="${id}"]`);
  for(const [role, expected] of [['resin','Plex-A-Bond'],['hardener','Component B'],['aggregate','Aggregate 0'],['filler','TTC2']]) {
    await stable.getByLabel('Formula Role').selectOption(role);
    await expect(page.getByRole('listbox').getByRole('option',{name:new RegExp(expected)}).first()).toBeVisible();
    if(role!=='aggregate') await expect(page.getByRole('listbox').getByRole('option',{name:/Pacific|Recycled Clear Glass Filler|Aggregate/})).toHaveCount(0);
    await stable.getByPlaceholder('Type or search Catalog').fill('zz-no-match');
    await expect(page.getByText('No Catalog match.',{exact:false})).toBeVisible();
    await stable.getByPlaceholder('Type or search Catalog').fill('');
    await expect(page.getByRole('listbox').getByRole('option',{name:new RegExp(expected)}).first()).toBeVisible();
  }
  await rowFor(page,'aggregate').getByPlaceholder('Type or search Catalog').fill('Pacific');
  await expect(page.getByRole('listbox').getByRole('option',{name:/Pacific Abalone/})).toBeVisible();
  await expect(page.getByRole('listbox').getByRole('option',{name:/Pacific Clear Glass/})).toBeVisible();
});

test('Typed discovery ranks eligible first and deliberate secondary selection preserves Formula Role',async({page})=>{
  await fixture(page); await page.goto('/samples');
  await page.getByRole('button',{name:'New Sample',exact:true}).click();
  const filler=rowFor(page,'filler'); const search=filler.getByPlaceholder('Type or search Catalog');
  await search.fill('Klein');
  const options=page.getByRole('listbox').getByRole('option');
  await expect(options.first()).toContainText('TTC2');
  await expect(options.nth(1)).toContainText('XO');
  await expect(options.first()).not.toContainText('Not classified');
  await expect(options.nth(2)).toContainText('Not classified for Filler');
  await search.fill('Recycled Clear Glass Filler');
  await expect(page.getByText('Other Catalog matches',{exact:true})).toBeVisible();
  const before=await filler.getByLabel('filler quantity',{exact:true}).inputValue();
  await page.getByRole('listbox').getByRole('option',{name:/Recycled Clear Glass Filler/}).click();
  await expect(filler.getByLabel('Formula Role')).toHaveValue('filler');
  await expect(filler.getByLabel('filler quantity',{exact:true})).toHaveValue(before);
  await expect(filler.getByText('Not classified for Filler. Selected manually; compatibility is not established.',{exact:true})).toBeVisible();
  await expect(search).toHaveValue('Recycled Clear Glass Filler');
  await search.fill('');
  await expect(page.getByRole('listbox').getByRole('option')).toHaveCount(2);
  await expect(page.getByText('Other Catalog matches',{exact:true})).toHaveCount(0);
  for(const role of ['resin','hardener']) {
    await rowFor(page,role).getByPlaceholder('Type or search Catalog').fill('Recycled Clear Glass Filler');
    await expect(page.getByRole('listbox').getByRole('option')).toContainText(`Not classified for ${role[0].toUpperCase()+role.slice(1)}. Compatibility is not established.`);
  }
});
