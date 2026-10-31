/** Offline boundary regressions only. No network, SQL, grant activation, paid
 * inference or database results are simulated as live validation. */
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {TENBOT_CANARY_OWNER as owner,TENBOT_CANARY_CATALOG_ID as catalogId,TENBOT_CANARY_DOCUMENT_SHA256 as documentSha256,TENBOT_CANARY_DOCUMENT_REFERENCE as documentReference,parseTenbotCanaryAccess,tenbotCanaryRemainingMs,tenbotCanaryDraftMatches,tenbotCanaryEditsMatch,type TenbotCanaryAccess} from '../src/modules/inventory/tenbot-canary-access';
import {readHostedCanaryAccess,createHostedReceivalContract} from '../supabase/functions/_shared/tenbot-receival-hosted';
import {TENBOT_CANARY_EXECUTION_SOURCE_ID,TENBOT_CANARY_EXECUTION_SOURCE_EVIDENCE_SHA256,TENBOT_CANARY_EXECUTION_PREVIEW_REVISION,TENBOT_CANARY_EXECUTION_PREVIEW_HASH} from '../src/modules/inventory/tenbot-canary-execution';
const id=(n:number)=>`10302026-0000-4000-8000-${String(n).padStart(12,'0')}`;
const now=Date.parse('2026-10-30T18:00:00Z');
const dormantExecutionWindow=()=>({schemaVersion:'tenbot-canary-execution.v1',serverNow:new Date(now).toISOString(),enabled:false,startsAt:null,expiresAt:null,ownerId:owner,sourceId:TENBOT_CANARY_EXECUTION_SOURCE_ID,documentSha256,previewRevision:TENBOT_CANARY_EXECUTION_PREVIEW_REVISION,previewHash:TENBOT_CANARY_EXECUTION_PREVIEW_HASH,sourceEvidenceSha256:TENBOT_CANARY_EXECUTION_SOURCE_EVIDENCE_SHA256,grantId:null,inferenceAllowed:false});
const access=():TenbotCanaryAccess=>({active:true,grantId:id(1),ownerId:owner,startsAt:new Date(now-1000).toISOString(),expiresAt:new Date(now+14*60*1000).toISOString(),serverNow:new Date(now).toISOString(),documentSha256,documentReference,supplier:'T&M Supply',catalogSource:'standard',catalogId,quantityExpected:'1',unit:'Bag'});
const draft=()=>({id:id(2),hash:'a'.repeat(64),ownerId:owner,expiresAt:new Date(now+20*60*1000).toISOString(),schemaVersion:'invoice-receivals.v2',authorizationVersion:'b'.repeat(64),document:{sha256:documentSha256,supplier:'T&M Supply',reference:documentReference,documentDate:null},metadata:{orderedBy:'Synthetic canary owner',orderDate:'2026-10-30',location:'Denton'},provenance:{model:'OFFLINE fixture, no inference',sourceMediaType:'application/pdf',extractionSha256:documentSha256,toolTraceSha256:'c'.repeat(64)},lines:[{sourceLineId:'L1',catalogSource:'standard' as string|null,catalogId:catalogId as string|null,quantityExpected:'1',unit:'Bag',productionJobId:null as string|null,sourceQuantity:{quantity:'1',unit:'Bag'},sourceText:'Alaska White | #0 | 1 Bag',newMaterial:null as Record<string,unknown>|null,duplicateAcknowledgement:null,vendor:'T&M Supply',material:'Alaska White',size:'#0',category:'marble',jobLabel:null,catalogSnapshot:{id:catalogId},vendorSnapshot:null,duplicateReview:null,quantityBasis:{sourceKind:'package_count',packageCount:'1',perPackage:{quantity:'50',unit:'LB',container:'Bag'},totalMaterial:{quantity:'50',unit:'LB'},receivalQuantity:'1',receivalUnit:'Bag',inventoryStockingUnit:null,calculation:'source_package_count',reasons:[]}}]});
const checks:string[]=[];async function check(name:string,run:()=>void|Promise<void>){await run();checks.push(name);}
const denied=(result:Promise<unknown>)=>assert.rejects(result,e=>e instanceof Error&&'status' in e&&e.status===403);
await check('projection is self-scoped, fixed and max15minutes; inactive has no other account metadata',()=>{
 const value=access();assert.deepEqual(parseTenbotCanaryAccess(value,owner),value);assert.equal(tenbotCanaryRemainingMs(value),14*60*1000);assert.equal(parseTenbotCanaryAccess({active:false,serverNow:value.serverNow},owner),null);
 for(const change of [{ownerId:id(5)},{documentSha256:'f'.repeat(64)},{documentReference:'OTHER'},{supplier:'Different supplier'},{catalogId:id(9)},{catalogSource:'specialty'},{quantityExpected:'2'},{unit:'LB'},{expiresAt:new Date(now+16*60*1000).toISOString()},{expiresAt:new Date(now).toISOString()},{startsAt:new Date(now+1).toISOString()},{extraAuthority:true}])assert.throws(()=>parseTenbotCanaryAccess({...value,...change},owner));
 assert.throws(()=>parseTenbotCanaryAccess(value,id(8)));assert.throws(()=>parseTenbotCanaryAccess({active:false,serverNow:value.serverNow,ownerId:id(8)},owner));
});
await check('current owner RPC is fail-closed and ordinary users never call the new projection',async()=>{
 let calls=0;const caller={async rpc(){calls++;return {data:access(),error:null};}};
 assert.equal(await readHostedCanaryAccess(caller,id(8),now),null);assert.equal(calls,0);assert.deepEqual(await readHostedCanaryAccess(caller,owner,now),access());
 for(const result of [{data:null,error:{code:'42883'}},{data:{active:false,serverNow:new Date(now).toISOString()},error:null},{data:{...access(),ownerId:id(8)},error:null}])await denied(readHostedCanaryAccess({async rpc(){return result;}},owner,now));
 await denied(readHostedCanaryAccess(caller,owner,now+15*60*1000));
});
await check('fixed immutable document and one existing Bag reject alternate documents, Jobs, catalog proposals and quantities',()=>{
 const value=access();assert(tenbotCanaryDraftMatches(value,draft()));
 for(const change of [{catalogId:id(9)},{catalogSource:'specialty'},{quantityExpected:'50'},{unit:'LB'},{productionJobId:id(4)},{newMaterial:{itemName:'New'}}]){const changed=draft();Object.assign(changed.lines[0],change);assert.equal(tenbotCanaryDraftMatches(value,changed),false);}
 const doubled=draft();doubled.lines.push({...doubled.lines[0]});assert.equal(tenbotCanaryDraftMatches(value,doubled),false);const other=draft();other.document.reference='OTHER' as typeof documentReference;assert.equal(tenbotCanaryDraftMatches(value,other),false);
});
await check('review permits excluded nonmaterial evidence but exactly one included approved operation',()=>{
 const value=access(),line={excluded:false,materialId:'standard:'+catalogId,quantity:'1',unit:'Bag',jobId:null,catalogRequest:null};
 assert(tenbotCanaryEditsMatch(value,[{excluded:true},line]));assert.equal(tenbotCanaryEditsMatch(value,[]),false);assert.equal(tenbotCanaryEditsMatch(value,[line,line]),false);assert.equal(tenbotCanaryEditsMatch(value,[{...line,quantity:'2'}]),false);assert.equal(tenbotCanaryEditsMatch(value,[{...line,catalogRequest:{prepared:true}}]),false);
});
function fixture(){
 const calls:string[]=[],value=draft();let active=true,revokeAtApproval=false,revokeAtExecution=false,exhaustedFunding=false;
 const execution={draftId:value.id,hash:value.hash,createdRecordIds:[id(7)],createdCatalogRecords:[],idempotent:false,executedAt:new Date(now).toISOString()};
 const caller={async rpc(name:string){calls.push(name);if(name==='get_my_tenbot_receival_canary_access')return {data:active?access():{active:false,serverNow:new Date(now).toISOString()},error:null};if(name==='get_tenbot_chris_dev_execution_window_status')return {data:dormantExecutionWindow(),error:null};if(name==='get_tenbot_chris_dev_canary_funding_status')return {data:{schemaVersion:'tenbot-canary-funding.v1',serverNow:new Date(now).toISOString(),enabled:true,startsAt:new Date(now-1000).toISOString(),expiresAt:new Date(now+14*60*1000).toISOString(),fundingId:id(90),grantId:id(1),budgetMicrousd:250000,accountedMicrousd:exhaustedFunding?250000:0,remainingMicrousd:exhaustedFunding?0:250000,active},error:null};if(name==='has_app_capability')return {data:true,error:null};if(name==='get_invoice_receival_draft')return {data:value,error:null};if(name==='approve_invoice_receival_draft'){if(revokeAtApproval)active=false;return {data:{id:id(3),draftId:value.id,hash:value.hash,expiresAt:new Date(now+60000).toISOString()},error:null};}if(name==='execute_invoice_receival_draft'){if(revokeAtExecution)active=false;return {data:execution,error:null};}throw Error('Unexpected RPC');}};
 const handler=createHostedReceivalContract({owner,origin:'https://tendev.pages.dev',config:{enabled:true,executionEnabled:true,origins:['https://tendev.pages.dev'],employeeIds:[owner],expiresAt:new Date(now+60000).toISOString()},caller,now:()=>now,service:async(name)=>{calls.push(name);return{data:{ok:true,alreadyExecuted:false,permitId:id(4),draftId:value.id,hash:value.hash,approvalId:id(3),policyVersion:1,expiresAt:new Date(now+30000).toISOString()},error:null};}});
 return {calls,value,handler,exhaustFunding:()=>{exhaustedFunding=true;},revoked:()=>{active=false;},revokeAtApproval:()=>{revokeAtApproval=true;},revokeAtExecution:()=>{revokeAtExecution=true;}};
}
const body=(value:ReturnType<typeof draft>)=>({workspace:'invoice-receivals.v1',action:'approve',draftId:value.id,hash:value.hash,confirmation:true});
await check('scope mismatch and grant revocation deny before approval, permit or canonical execution',async()=>{
 const wrong=fixture();wrong.value.lines[0].quantityExpected='2';await denied(wrong.handler(body(wrong.value)));assert(!wrong.calls.some(n=>/approve|mint|execute/.test(n)));
 const revoked=fixture();revoked.revoked();await denied(revoked.handler(body(revoked.value)));assert.deepEqual(revoked.calls,['get_my_tenbot_receival_canary_access']);
 const concurrent=fixture();concurrent.revokeAtApproval();await denied(concurrent.handler(body(concurrent.value)));assert(concurrent.calls.includes('approve_invoice_receival_draft'));assert(!concurrent.calls.some(n=>/mint|execute/.test(n)));
});
await check('valid exact scope still uses existing caller approval and business RPC; fixed service only mints metadata',async()=>{
 const f=fixture(),result=await f.handler(body(f.value)) as {createdRecordIds:string[]};assert.deepEqual(result.createdRecordIds,[id(7)]);assert.deepEqual(f.calls.filter(n=>!['get_my_tenbot_receival_canary_access','get_tenbot_chris_dev_canary_funding_status','get_tenbot_chris_dev_execution_window_status','has_app_capability'].includes(n)),['get_invoice_receival_draft','approve_invoice_receival_draft','tenbot_receival_mint_execution_permit','execute_invoice_receival_draft']);
});
await check('a valid funding window with its allowance fully accounted still permits deterministic canonical approval without new inference',async()=>{
 const f=fixture();f.exhaustFunding();const result=await f.handler(body(f.value)) as {createdRecordIds:string[]};assert.deepEqual(result.createdRecordIds,[id(7)]);assert(f.calls.includes('execute_invoice_receival_draft'));assert(!f.calls.some(name=>/openai_.*reserve/.test(name)));
});
await check('a committed caller receipt remains readable when temporary adjustment access ends immediately afterward',async()=>{
 const f=fixture();f.revokeAtExecution();const result=await f.handler(body(f.value)) as {createdRecordIds:string[]};assert.deepEqual(result.createdRecordIds,[id(7)]);assert.equal(f.calls.filter(n=>n==='execute_invoice_receival_draft').length,1);
 const previous=f.calls.length;await denied(f.handler(body(f.value)));assert(!f.calls.slice(previous).includes('execute_invoice_receival_draft'));
});
const report={passed:true,groups:checks.length,checks,scope:'Offline projection/runtime exact-scope and revocation wiring only; not real JWT/RLS/transaction validation',actualInference:false,actualDatabase:false,grantActivations:0,networkCalls:0,productionMutations:0};
const directory='/private/tmp/tenops-tenbot-chris-dev-grant-20261030';mkdirSync(directory,{recursive:true});writeFileSync(directory+'/runtime-offline-results.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
