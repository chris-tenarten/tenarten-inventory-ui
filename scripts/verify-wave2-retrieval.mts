/* eslint-disable @typescript-eslint/no-explicit-any -- Synthetic heterogeneous PostgREST contracts. */
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {wave2Tables,wave2Response,uuid} from './support/wave2-fixture.mjs';
let tables:Record<string,any[]>=wave2Tables(),cap=Number(process.env.WAVE2_CAP||137),failure='',drift=false,duplicate=false,missing=false;
let calls:any[]=[];
const userId=uuid(9999);
globalThis.fetch=async(input:any,init?:RequestInit)=>{const url=new URL(typeof input==='string'?input:input.url??String(input));assert.equal(url.hostname,'wave2-fixture.invalid','No external connections');
 if(url.pathname.startsWith('/auth/'))return Response.json({id:userId,aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{}});
 const result=wave2Response(url,tables,cap),offset=Number(url.searchParams.get('offset')||0);
 if(failure===result.table)return Response.json({message:'Fixture denied',code:'42501'},{status:403});
 if(drift&&offset)result.headers['content-range']=`0-0/${result.count+1}`;
 if(duplicate&&offset&&result.rows.length)result.rows[0].id=uuid(10000);
 if(missing&&offset)result.rows=[];
 const accept=new Headers(init?.headers).get('accept')||'';const data=JSON.stringify(accept.includes('vnd.pgrst.object')?result.rows[0]??null:result.rows);calls.push({table:result.table,rows:result.rows.length,bytes:Buffer.byteLength(data),url:url.pathname+url.search});return new Response(data,{headers:result.headers});};
const root=process.env.WAVE2_SOURCE_ROOT||process.cwd();
const q=await import(root+'/src/modules/proposals/queries.ts'),po=await import(root+'/src/modules/purchasing/queries.ts'),mu=await import(root+'/src/modules/material-usage/actions.ts'),p=await import(root+'/src/modules/production/jobs.ts'),c=await import(root+'/src/modules/purchasing/catalog.ts');
const {supabase}=await import(root+'/src/lib/supabase.ts');
const jwt=Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:userId,exp:4102444800,role:'authenticated'})).toString('base64url')+'.fixture';await supabase.auth.setSession({access_token:jwt,refresh_token:'fixture'});
const scope=[tables.jobs[0].id,tables.jobs[1].id];const measurementCap=cap;const baseline=process.env.WAVE2_BASELINE==='1',measurements:any[]=[],checks:string[]=[];
async function measure(name:string,work:()=>Promise<any>){calls=[];const started=performance.now(),data=await work();measurements.push({name,requests:calls.length,rows:calls.reduce((n,c)=>n+c.rows,0),bytes:calls.reduce((n,c)=>n+c.bytes,0),elapsedMs:performance.now()-started,calls:[...calls]});return data;}
const proposals=await measure('Proposal history',()=>q.loadProposals());
const orders=await measure('Purchase Order summaries',()=>po.loadPurchaseOrderSummaries());
const materials=await measure('Material Usage history',()=>mu.getMaterialUsageReports());
const counts=await measure('Production attachment summaries',()=>p.loadJobAttachmentCounts(...(baseline?[]:[scope])));
const updates=await measure('Production update summaries',()=>p.loadJobUpdateSummaries(...(baseline?[]:[scope])));
const vendors=await measure('Vendor options',()=>po.loadVendors());
const options=await measure('Container-size options',()=>c.loadPurchasingContainerSizeOptions('chip'));
if(!baseline){
 assert.equal(vendors.length,1201);assert.equal(vendors.at(-1).contacts.length,1);assert.equal((await p.loadJobUpdates(scope[0])).length,1201);assert.equal((await p.loadJobAttachmentCounts([tables.jobs[8].id]))[tables.jobs[8].id],1201);
 assert.equal(proposals.length,1201);assert.equal(orders.length,1201);assert.equal(orders.find((r:any)=>r.id===uuid(20000)).lineCount,1201);assert.equal(materials.length,1201);assert.equal(counts[scope[0]],1201);assert.equal(updates[scope[0]].total,1201);assert.equal(updates[scope[0]].hasUnseenActivity,true);assert.equal(updates[scope[0]].openFollowUpCount,tables.job_updates.filter(r=>r.job_id===scope[0]&&r.requires_follow_up&&!r.resolved_at).length);assert(!counts[tables.jobs[8].id]);assert(!updates[tables.jobs[8].id]);assert.equal(options.length,1201);
 assert.equal((await q.loadLinkableProposals()).length,1200);assert(!(await q.loadLinkableProposals()).some((r:any)=>r.id===tables.proposals.at(-1).id));assert.equal((await q.loadBidProposals(uuid(888))).length,1);
 checks.push('1,201 parents, child-line counts, updates, attachments and catalog options with bounded pages; tail linkability; scoped unseen state');
 calls=[];await p.loadJobAttachmentCounts([]);await p.loadJobUpdateSummaries([]);assert.equal(calls.length,0);checks.push('empty Production scope performs no requests');
 cap=137;calls=[];await p.loadJobAttachmentCounts([scope[0],scope[0]]);assert.equal(calls.length,9);checks.push('duplicate scope deduplicated');
 const saved=tables;tables={...tables,job_attachments:[]};calls=[];await p.loadJobAttachmentCounts(Array.from({length:205},(_,i)=>uuid(i)));assert.equal(calls.length,2);tables=saved;checks.push('205 Job IDs use bounded 200-ID batches');
 for(const [table,work] of [['proposals',()=>q.loadProposals()],['purchase_orders',()=>po.loadPurchaseOrderSummaries()],['material_usage_reports',()=>mu.getMaterialUsageReports()],['job_updates',()=>p.loadJobUpdateSummaries(scope)],['job_attachments',()=>p.loadJobAttachmentCounts(scope)],['list_my_unseen_job_update_jobs',()=>p.loadJobUpdateSummaries(scope)],['vendor_catalog',()=>c.loadPurchasingContainerSizeOptions('chip')],['vendors',()=>po.loadVendors()],['vendor_contacts',()=>po.loadVendors()]] as const){failure=table;await assert.rejects(work(),/Fixture denied/);failure='';}checks.push('permission failures reject complete reads without retry loops or partial success');
 drift=true;await assert.rejects(q.loadProposals(),/changed/);drift=false;duplicate=true;await assert.rejects(q.loadProposals(),/changed/);duplicate=false;missing=true;await assert.rejects(q.loadProposals(),/incomplete/);missing=false;checks.push('count drift, duplicate page and missing page rejected');
 for(const size of [0,1,137,500,501,1000,1001]){tables=wave2Tables(size);cap=137;assert.equal((await q.loadProposals()).length,size);assert.equal((await po.loadPurchaseOrderSummaries()).length,size);assert.equal((await mu.getMaterialUsageReports()).length,size);}tables=wave2Tables();checks.push('empty and pagination boundary matrices');
 // A complete summary must be the same as independently reducing the whole authorized scope.
 const poDetail=await po.loadPurchaseOrder(uuid(20000));assert.equal(poDetail.lines.length,1201);const materialDetail=await mu.getMaterialUsageReport(uuid(30000));assert.equal(materialDetail.lines.length,1201);
 const detail=await q.loadProposal(tables.proposals[0].id);assert.equal(detail.notes,tables.proposals[0].notes);assert.equal(detail.lines.length,1201);checks.push('complete Proposal, PO and Material detail children, Job Update Inspector history, vendor/contact choices and archived Job scope remain accessible');
}
const output=process.env.WAVE2_OUTPUT||'output/wave2-retrieval-after.json';mkdirSync(output.slice(0,output.lastIndexOf('/')),{recursive:true});writeFileSync(output,JSON.stringify({environment:'Synthetic actual-loader execution; no SQL/production/network timing',sourceRoot:root,measurementCap,stressCap:cap,measurements,checks},null,2));console.log(JSON.stringify({measurements:measurements.map(m=>({name:m.name,requests:m.requests,rows:m.rows,bytes:m.bytes,elapsedMs:m.elapsedMs})),checks},null,2));await supabase.auth.signOut({scope:'local'});
