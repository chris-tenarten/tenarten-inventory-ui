// Focused browser fixture: real editor/save/load/preview code, local fake Supabase.
// No hosted requests, issuance, or user data are involved.
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {chromium} from '@playwright/test';
import {createServer} from 'node:http';
import {readFileSync, readdirSync, mkdirSync} from 'node:fs';
const fake = `
window.poEvents=[];
export const supabase={
 from(table){let single=false;const q=new Proxy({}, {get(_,key){if(key==='then')return resolve=>{const row=JSON.parse(localStorage.getItem('po-fixture')||'null');if(table==='purchase_orders')window.poEvents.push(['reload',row?.pdf_text_size]);resolve({data:table==='purchase_orders'&&single?row:[],error:null});};return()=>{if(key==='single')single=true;return q;};}});return q;},
 async rpc(name,args){window.poEvents.push([name,args]);if(name==='save_chip_purchase_order_draft_v2'){localStorage.setItem('po-fixture',JSON.stringify({...args.p_order,id:'fixture',po_number:'PO-FIXTURE',status:'draft',revision_number:1,created_by:args.p_actor,lines:args.p_lines.map(l=>({...l,details:[l]})),issuances:[]}));return {data:'fixture'};}return {data:null};},
 functions:{async invoke(name,{body}){window.poEvents.push(['preview',body.orderSnapshot.pdf_text_size]);return {data:new Blob(['fixture PDF'],{type:'application/pdf'})};}}
};`;
const result=await build({stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';import {PurchaseOrderEditor} from './src/modules/purchasing/PurchaseOrderEditor';import {createPurchaseOrderDraft} from './src/modules/purchasing/defaults';import {loadPurchaseOrder} from './src/modules/purchasing/queries';
async function start(){let draft=createPurchaseOrderDraft();draft.vendorNameSnapshot='Fixture vendor';draft.lines[0].materialType='chip';Object.assign(draft.lines[0].details,{materialNameSnapshot:'White',chipSize:'#1',quantityOrdered:'1',orderUnit:'Bag'});if(localStorage.getItem('po-fixture'))draft={...draft,...await loadPurchaseOrder('fixture')};createRoot(document.getElementById('root')).render(<PurchaseOrderEditor initial={draft} onClose={()=>{}} onSaved={()=>{}} onPersisted={()=>{}} onDeleted={()=>{}} onIssued={()=>{}}/>);}start();`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"development"'},plugins:[{name:'local-boundaries',setup(b){b.onResolve({filter:/supabase$/},()=>({path:'supabase',namespace:'fixture'}));b.onResolve({filter:/^@\/lib\/language$/},()=>({path:'language',namespace:'fixture'}));b.onResolve({filter:/DocumentViewer$/},()=>({path:'viewer',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},({path})=>({contents:path==='supabase'?fake:path==='language'?`export const useLanguage=()=>({tr:s=>s});`:`import React from 'react';export default function Viewer({onClose}){return <div role="dialog" aria-label="PDF fixture"><button onClick={onClose}>Close fixture preview</button></div>}`,loader:'tsx',resolveDir:process.cwd()}));}}]});
const cssFiles=readdirSync('.next/static/chunks').filter(f=>f.endsWith('.css'));
const css=cssFiles.map(f=>readFileSync(`.next/static/chunks/${f}`,'utf8')).join('\n');
const server=createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/bundle.js'?'text/javascript':'text/html');res.end(req.url==='/bundle.js'?result.outputFiles[0].text:`<html><head><style>${css}</style></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>`);});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,channel:'chrome'});
try {
 const page=await browser.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${server.address().port}`);
 await page.getByRole('button',{name:'Standard',exact:true}).waitFor();
 assert.equal(await page.getByRole('button',{name:'Standard',exact:true}).getAttribute('aria-pressed'),'true');
 mkdirSync('tmp/pdfs/ui',{recursive:true});
 for(const [width,height] of [[1440,1000],[375,812]]) {
  await page.setViewportSize({width,height});
  for(const preset of ['Large','Compact','Standard']) {
   const button=page.getByRole('button',{name:preset,exact:true});await button.click();
   assert.equal(await button.getAttribute('aria-pressed'),'true');
   const box=await button.boundingBox();assert.ok(box.height>=44&&box.x>=0&&box.x+box.width<=width,'Usable control inside viewport');
   await page.getByRole('button',{name:'Preview Draft PDF',exact:true}).click();
   await page.getByRole('dialog',{name:'PDF fixture'}).waitFor();
   const events=await page.evaluate(()=>window.poEvents);
   assert.equal(events.at(-1)[0],'preview');assert.equal(events.at(-1)[1],preset.toLowerCase());
   const saveIndex=events.findLastIndex(e=>e[0]==='save_chip_purchase_order_draft_v2');
   assert.equal(events[saveIndex][1].p_order.pdf_text_size,preset.toLowerCase());
   assert.ok(events.slice(saveIndex+1,-1).some(e=>e[0]==='reload'&&e[1]===preset.toLowerCase()),'Saved preference reloaded before preview');
   await page.getByRole('button',{name:'Close fixture preview'}).click();
   await page.reload();
   assert.equal(await page.getByRole('button',{name:preset,exact:true}).getAttribute('aria-pressed'),'true');
  }
  if(width===1440){
   for(const preset of ['Compact','Large']){
    await page.getByRole('button',{name:preset,exact:true}).click();
    await page.getByRole('button',{name:'Preview Draft PDF',exact:true}).click();
    await page.getByRole('dialog',{name:'PDF fixture'}).waitFor();
    await page.getByRole('button',{name:'Close fixture preview'}).click();
   }
   const beforeReuse=await page.evaluate(()=>window.poEvents.length);
   await page.getByRole('button',{name:'Compact',exact:true}).click();
   await page.getByRole('button',{name:'Preview Draft PDF',exact:true}).click();
   await page.getByRole('dialog',{name:'PDF fixture'}).waitFor();
   const afterReuse=await page.evaluate(()=>window.poEvents.length);
   assert.equal(afterReuse,beforeReuse,'Switching back to an unchanged preset must reuse its cached preview');
   await page.getByRole('button',{name:'Close fixture preview'}).click();
  }
  await page.screenshot({path:`tmp/pdfs/ui/editor-${width}.png`});
 }
 assert.deepEqual(errors,[]);
 console.log('PO editor desktop/mobile selection, save-before-preview, payload, and reload passed (local fake Supabase; PDF renderer tested separately).');
} finally {await browser.close();await new Promise(r=>server.close(r));}
