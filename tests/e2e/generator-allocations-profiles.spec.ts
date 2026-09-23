import { expect, test, type Page } from '@playwright/test';
import { mockManpowerAuth } from '../support/manpower-auth';
const baseProfile={revision:1,is_active:true,chip_density:128,dry_pool_rate:2560,filler_rate:512,resin_rate:480,hardener_parts:1,description:'TEST profile'};
async function fixture(page:Page){
 const profiles=[{...baseProfile,id:'mtt',name:'MTT',sort_order:10,resin_parts:5},{...baseProfile,id:'key',name:'Key Resin',sort_order:20,resin_parts:5,chip_density:null,dry_pool_rate:null,filler_rate:null,resin_rate:null},{...baseProfile,id:'terroxy',name:'Terroxy',sort_order:30,resin_parts:5,chip_density:null,dry_pool_rate:null,filler_rate:null,resin_rate:null},{...baseProfile,id:'sherwin',name:'Sherwin',sort_order:40,resin_parts:4,resin_rate:512},{...baseProfile,id:'cement',name:'Cement',sort_order:50,resin_parts:null,hardener_parts:null,chip_density:null,dry_pool_rate:null,filler_rate:null,resin_rate:null}];
 const jobs=[{id:'job-a',name:'TEST Job A',job_number:'26-9001',production_status:'in_production',archived_at:null},{id:'job-b',name:'TEST Job B',job_number:'26-9002',production_status:'in_production',archived_at:null}];
 const writes:Array<{name:string;body:Record<string,unknown>}>=[];
 await page.routeWebSocket('**/realtime/v1/**',()=>{});
 await page.route('**/rest/v1/**',async route=>{const req=route.request(),url=new URL(req.url()),name=url.pathname.split('/').at(-1)!;let body:unknown=[];
 if(name==='sample_operational_profiles')body=profiles;
 if(name==='get_sample_formulation_default')body={version:1};
 if(name==='jobs')body=jobs;
 if(name==='save_sample_operational_profile') { const args=req.postDataJSON();writes.push({name,body:args});const p=profiles.find(p=>p.id===args.p_id);if(p)Object.assign(p,args.p_values,{revision:p.revision+1});else profiles.push({...baseProfile,...args.p_values,id:'new',sort_order:60});body=args.p_id??'new'; }
 await route.fulfill({status:200,contentType:'application/json',headers:{'content-range':`0-${Array.isArray(body)?body.length-1:0}/${Array.isArray(body)?body.length:1}`},body:JSON.stringify(body)});
 });
 await mockManpowerAuth(page,'admin');const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));return{profiles,writes,errors};
}
test('managed Sample vocabulary, incomplete selection, configuration and captured Draft isolation',async({page})=>{
 const f=await fixture(page);await page.goto('/samples');await page.getByRole('button',{name:'New Sample',exact:true}).click();
 await page.getByRole('button',{name:'Adjust Sample Plate Calculation',exact:true}).click();
 const select=page.getByRole('combobox',{name:'Formulation Profile',exact:true});await expect(select).toHaveValue('operational:mtt:1');
 await expect(select).not.toContainText('Tenarten Epoxy');await expect(select).toContainText('Cement — ?');
 await select.selectOption('operational:cement:1');await expect(page.getByText(/Cement — \? has not been applied/)).toBeVisible();
 await expect(page.getByText(/Chip Mix: 64.00 oz/)).toBeVisible();
 await page.getByRole('button',{name:'Configure profiles',exact:true}).click();
 const manager=page.getByRole('region',{name:'Manage formulation profiles'});
 await page.getByRole('button',{name:'Edit Cement',exact:true}).click();
 await page.getByRole('combobox',{name:'Resin:Hardener ratio',exact:true}).selectOption('5');
 for(const [label,value] of [['Chip density (lb/CFT)','128'],['Expected dry-material rate (oz/CFT)','2560'],['Default Filler rate (oz/CFT)','512'],['Resin rate (fl oz/CFT)','480']])await page.getByLabel(label,{exact:true}).fill(value);
 await page.getByRole('button',{name:'Save profile',exact:true}).click();await expect.poll(()=>f.writes.length).toBe(1);
 await page.getByRole('button',{name:'Close profiles',exact:true}).click();
 await expect(page.getByText(/Configuration is ready/)).toBeVisible();await page.getByRole('button',{name:'Apply configured profile',exact:true}).click();
 await expect(select).toHaveValue('operational:cement:2');expect(f.errors).toEqual([]);await expect(manager).toHaveCount(0);
});
test('PO allocation stays compact, supports split Jobs and rejects excess quantity',async({page})=>{
 const f=await fixture(page);await page.goto('/purchasing');await page.getByRole('button',{name:/New Purchase Order/}).click();
 await expect(page.getByRole('button',{name:'Allocate',exact:true}).first()).toBeVisible();
 await page.getByRole('button',{name:'Allocate',exact:true}).first().click();await page.getByRole('button',{name:'Add Job allocation',exact:true}).click();
 await page.getByRole('combobox',{name:'Allocation 1 Job'}).selectOption('job-a');await page.getByRole('spinbutton',{name:'Allocation 1 quantity'}).fill('12');
 await page.getByRole('button',{name:'Add Job allocation',exact:true}).click();await page.getByRole('combobox',{name:'Allocation 2 Job'}).selectOption('job-b');await page.getByRole('spinbutton',{name:'Allocation 2 quantity'}).fill('5');
 await expect(page.getByText('Allocations exceed the PO line quantity.',{exact:true})).toBeVisible();
 await expect(page.getByText(/2 Job reservations/)).toBeVisible();
 await page.getByRole('button',{name:'Remove allocation 2',exact:true}).click();await expect(page.getByRole('combobox',{name:'Allocation 2 Job'})).toHaveCount(0);
 expect(f.errors).toEqual([]);
});
test('narrow profile management keeps unknown values explicit without page overflow',async({page})=>{
 await page.setViewportSize({width:390,height:844});await fixture(page);await page.goto('/samples');await page.getByRole('button',{name:'Formulation Profiles',exact:true}).click();
 await expect(page.getByText('Cement — ?',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Edit Key Resin',exact:true}).click();
 await expect(page.getByLabel('Chip density (lb/CFT)',{exact:true})).toHaveValue('');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('partial receipt sends explicit quantity and reuses its retry identity',async({page})=>{
 const f=await fixture(page);let received=0,attempt=0;
 await page.route('**/rest/v1/pending_receivals?**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify([{id:'receipt',vendor:'TEST Vendor',material_name:'TEST incoming material',quantity_expected:10,quantity_received:received,unit:'lb',status:'pending',is_earmarked:false,created_at:'2026-09-22T12:00:00Z'}])}));
 await page.route('**/rest/v1/rpc/receive_pending_receival_quantity',async route=>{const body=route.request().postDataJSON();f.writes.push({name:'receive_pending_receival_quantity',body});attempt++;if(attempt===1)return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'TEST uncertain response'})});received=Number(body.p_quantity);await route.fulfill({status:200,contentType:'application/json',body:'null'});});
 await page.goto('/inventory');const queue=page.getByRole('button',{name:/Pending Receivals \(/});await expect(queue).toBeVisible();if(await queue.getAttribute('aria-expanded')==='false')await queue.click();
 await page.getByRole('button',{name:'Receive',exact:true}).click();await page.getByPlaceholder('Name',{exact:true}).fill('TEST receiver');await page.getByRole('spinbutton',{name:'Quantity received now (lb)'}).fill('3');
 await page.getByRole('button',{name:'Confirm Receive',exact:true}).click();await expect(page.getByText(/TEST uncertain response/).last()).toBeVisible();await page.getByRole('button',{name:'Confirm Receive',exact:true}).click();
 await expect(page.getByText('Received 3 · Remaining 7',{exact:true})).toBeVisible();expect(f.writes).toHaveLength(2);expect(f.writes[0].body.p_request_id).toBe(f.writes[1].body.p_request_id);expect(f.writes[1].body.p_quantity).toBe(3);expect(f.errors).toEqual([]);
});
