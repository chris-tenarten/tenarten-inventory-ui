// Focused UI/locator regression only. No provider, credentials, server, database
// or approvals. Transport denials below are explicit synthetic responses.
import assert from 'node:assert/strict';
import {clearPreparedDraftLocator,preparedDraftResumeFailure,proposedCanaryOrderDetails,readPreparedDraftLocator,resumePreparedReceival,savePreparedDraftLocator} from '../src/modules/tenbot/prepared-draft-resume';
import {TENBOT_CANARY_OWNER} from '../src/modules/inventory/tenbot-canary-access';
import {TENBOT_CANARY_EXECUTION_PREVIEW_HASH,TENBOT_CANARY_EXECUTION_SOURCE_ID} from '../src/modules/inventory/tenbot-canary-execution';
import {approvalForCurrentReview,editableRows,reviewChanged,type LocalDemoStatus,type LocalReceivalDraft} from '../src/modules/tenbot/live-review';
const now=Date.parse('2026-10-31T04:00:00Z'),owner=TENBOT_CANARY_OWNER,sourceId=TENBOT_CANARY_EXECUTION_SOURCE_ID;
const stranger='11111111-1111-4111-8111-111111111111';
const draft:LocalReceivalDraft={id:sourceId,revision:1,hash:TENBOT_CANARY_EXECUTION_PREVIEW_HASH,simulation:false,status:'review_required',attachmentId:sourceId,orderDetails:{orderedBy:'',orderDate:'',location:''},missingFields:['orderedBy','orderDate','location'],canApprove:false,executionEnabled:false,rows:[{lineId:sourceId+':L8',sourceText:'Alaska White | #0 | 1 Bag',sourceQuantity:{quantity:'1',unit:'Bag'},materialId:'standard:ba6a3690-0886-4f72-9f86-581bcc1f3b44',materialName:'Alaska White',size:'#0',quantity:'1',unit:'Bag',jobId:null,excluded:false,reasons:[]}]};
const response=()=>({attachment:{attachmentId:sourceId,sourceId,filename:'synthetic-tendev-receival-20261030-01.pdf',mediaType:'application/pdf',expiresAt:new Date(now+3600000).toISOString(),simulation:false},draft:structuredClone(draft),simulation:false});
const status:LocalDemoStatus={mode:'authenticated-receivals',simulation:false,requiresPrivateOriginal:true,executionOnly:true,resumableSourceId:sourceId,executionEnabled:false,catalog:[],jobs:[],maxAttachmentBytes:90000,mediaTypes:['image/png']};
const values=new Map<string,string>(),storage={getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value);},removeItem:(key:string)=>{values.delete(key);}};
const checks:string[]=[];
async function check(name:string,work:()=>void|Promise<void>){await work();checks.push(name);}
await check('locator retains only source/owner IDs across remount or mode changes',()=>{
 savePreparedDraftLocator(owner,sourceId,storage);assert.equal(readPreparedDraftLocator(owner,storage),sourceId);
 const saved=JSON.parse([...values.values()][0]);assert.deepEqual(saved,{owner,sourceId});
 assert.equal(readPreparedDraftLocator(stranger,storage),null);assert.equal(values.size,1);
 clearPreparedDraftLocator(stranger,storage);assert.equal(readPreparedDraftLocator(owner,storage),sourceId);
 clearPreparedDraftLocator(owner,storage);assert.equal(values.size,0);
});
await check('malformed or content-bearing locators and unavailable storage fail safely',()=>{
 savePreparedDraftLocator(owner,sourceId,storage);const key=[...values.keys()][0];storage.setItem(key,JSON.stringify({owner,sourceId,invoice:'sensitive test marker'}));assert.equal(readPreparedDraftLocator(owner,storage),null);assert.equal(values.size,0);
 const denied={getItem(){throw Error('storage disabled');},setItem(){throw Error('storage disabled');},removeItem(){throw Error('storage disabled');}};
 savePreparedDraftLocator(owner,sourceId,denied);assert.equal(readPreparedDraftLocator(owner,denied),null);clearPreparedDraftLocator(owner,denied);
});
await check('resume performs exactly one model-free request and preserves source identity/revision/hash/quantity',async()=>{
 const calls:unknown[]=[],original=JSON.stringify(draft);
 for(const mode of ['preparation','execution']){
  const result=await resumePreparedReceival(sourceId,async body=>{calls.push({...body,mode});return response();},now);
  assert.deepEqual(result.draft,draft);assert.equal(JSON.stringify(draft),original);assert.equal(result.draft.rows[0].quantity,'1');assert.deepEqual(result.draft.rows[0].sourceQuantity,{quantity:'1',unit:'Bag'});
 }
 assert.deepEqual(calls,[{action:'resume',sourceId,mode:'preparation'},{action:'resume',sourceId,mode:'execution'}]);
});
await check('owner/permission denial has no model retry, alternate source or approval fallback',async()=>{
 let attempts=0;const denied=Object.assign(Error('synthetic permission denial'),{status:403});
 await assert.rejects(resumePreparedReceival(sourceId,async body=>{attempts++;assert.deepEqual(body,{action:'resume',sourceId});throw denied;},now),error=>error===denied);
 assert.equal(attempts,1);assert.match(preparedDraftResumeFailure(denied),/current permissions/);
});
await check('expired, changed and mismatched responses are never displayed as a valid resumed draft',async()=>{
 const old=response();old.attachment.expiresAt=new Date(now).toISOString();await assert.rejects(resumePreparedReceival(sourceId,async()=>old,now),/expired/);
 const wrong=response();wrong.draft.id=stranger;await assert.rejects(resumePreparedReceival(sourceId,async()=>wrong,now),/could not be restored/);
 const version=response();version.draft.revision=0;await assert.rejects(resumePreparedReceival(sourceId,async()=>version,now),/could not be restored/);
 assert.match(preparedDraftResumeFailure({status:410}),/expired, changed or unavailable/);
});
await check('canary metadata proposal is owner/source scoped, editable and unsaved against unchanged source evidence',()=>{
 const original=JSON.stringify(draft),proposal=proposedCanaryOrderDetails(owner,draft,status)!;
 assert.deepEqual(proposal,{orderedBy:'chris developer',orderDate:'2026-10-30',location:'Denton'});
 assert.equal(proposedCanaryOrderDetails(stranger,draft,status),undefined);assert.equal(proposedCanaryOrderDetails(owner,{...draft,id:stranger},status),undefined);assert.equal(proposedCanaryOrderDetails(owner,draft,{...status,executionOnly:false}),undefined);
 const saved={...draft,orderDetails:{orderedBy:'Corrected Employee',orderDate:'2026-10-29',location:'Corrected location'}};assert.deepEqual(proposedCanaryOrderDetails(owner,saved,status),saved.orderDetails);
 proposal.location='Corrected location';assert.equal(reviewChanged(draft,editableRows(draft),proposal),true);assert.equal(approvalForCurrentReview(draft,editableRows(draft),proposal,true,false),false);assert.equal(JSON.stringify(draft),original);
});
console.log(JSON.stringify({passed:true,groups:checks.length,checks,inferenceCalls:0,databaseRequests:0,approvalsSubmitted:0,operationalWrites:0},null,2));
