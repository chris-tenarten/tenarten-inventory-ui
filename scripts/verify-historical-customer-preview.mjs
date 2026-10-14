// Pure read-only preview tests. No database mutation or hosted access.
import assert from 'node:assert/strict';
import { buildCustomerImportPreview,loadCompleteCustomerRows } from './support/customer-import.mjs';
const data=Array.from({length:2505},(_,i)=>({id:String(i).padStart(5,'0'),customer:'Customer '+i,archived_at:i%2?'2026-01-01':null}));
let calls=0;
const complete=await loadCompleteCustomerRows(async(from,to)=>{calls++;return {data:data.slice(from,Math.min(to+1,from+137)),count:data.length,error:null};});
assert.equal(complete.rows.length,2505);assert.equal(calls,20);assert.equal(complete.pages.at(-1).rows,0);
await assert.rejects(()=>loadCompleteCustomerRows(async(from)=>({data:from===0?data.slice(0,10):[],count:2505})),/Truncated/);
await assert.rejects(()=>loadCompleteCustomerRows(async(from)=>({data:data.slice(from,from+10),count:from?2506:2505})),/count changed/);
const jobs=[null,'','  ','Superior','SUPERIOR',' Superior ','Superior Construction','Archived','Duplicate','Temporary Customer','INTERNAL TEST — NOT A CUSTOMER'].map((customer,i)=>({id:String(i),customer,archived_at:i%2?'2026-01-01':null}));
const p=buildCustomerImportPreview(jobs,[{id:'existing',name:' superior ',archived_at:null},{id:'archived',name:'ARCHIVED',archived_at:'2026-01-01'},{id:'a',name:'Duplicate'},{id:'b',name:'DUPLICATE'}]);
assert.equal(p.counts.invalidBlankJobs,3);assert.equal(p.identities.find(i=>i.key==='superior').usage,3);assert.equal(p.identities.find(i=>i.key==='superior').status,'already_configured');assert.equal(p.identities.find(i=>i.key==='archived').status,'archived_excluded');assert.equal(p.identities.find(i=>i.key==='duplicate').status,'manual_review');assert.deepEqual(p.proposedNames,['Superior Construction']);assert.equal(p.identities.find(i=>i.key==='superior').caseWhitespaceDuplicate,true);
console.log('PASS: complete pagination over 2,505 rows with server caps, truncation/drift rejection, blanks, case/whitespace normalization, existing/archived conflicts and ambiguity holds. No database writes.');
