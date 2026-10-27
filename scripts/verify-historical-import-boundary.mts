import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {handleBidScope} from '../supabase/functions/_shared/bid-scope-handler';
import {startIntakeDatabase,sql,docker,value,asUser,literal,json,admin,member} from './support/intake-materials-database.mjs';

// Exercise the real Edge handler, including its privileged RPC sink. No hosted requests.
const originalBytes=new Blob(['Synthetic historical original; never a business document.']);
const digest=createHash('sha256').update(Buffer.from(await originalBytes.arrayBuffer())).digest('hex');
const originalId='10000000-0000-4000-8000-000000000001';
const untrustedId='10000000-0000-4000-8000-000000000002';
const editable={p_sample:{color_plate_number:'T26-098-B',project_name:'Synthetic historical fixture'},p_rows:[],p_sample_name:'Historical fixture'};
const injected={...editable,...JSON.parse(`{"p_actor":"${member}","p_import_id":"${untrustedId}","p_sha256":"${'b'.repeat(64)}","unexpected_rpc_argument":true,"__proto__":{"p_actor":"spoof"}}`)};
const parameterKeys=['p_actor','p_import_id','p_rows','p_sample','p_sample_name','p_sha256'].sort();
type Params=Record<string,unknown>;
type Original={id:string;created_by:string;storage_path:string;byte_size:number};
const original:Original={id:originalId,created_by:admin,storage_path:originalId+'/original',byte_size:originalBytes.size};
let cases=0;

async function exercise(options:{authError?:boolean;unauthenticated?:boolean;readError?:boolean;owner?:string;size?:number;downloadError?:boolean;rpcError?:boolean;rpcThrows?:boolean;payload?:unknown}={}){
 const calls:{name:string;params:Params}[]=[];let downloads=0,reads=0;
 const user={
  auth:{getUser:async()=>({data:{user:options.unauthenticated?null:{id:admin}},error:options.authError?{message:'expired'}:null})},
  from:(table:string)=>{assert.equal(table,'historical_sample_imports');return {select:(columns:string)=>{assert.equal(columns,'*');return {eq:(field:string,id:string)=>{assert.equal(field,'id');assert.equal(id,untrustedId);return {single:async()=>{reads++;return {data:{...original,created_by:options.owner??admin,byte_size:options.size??originalBytes.size},error:options.readError?{message:'denied'}:null};}};}};}};},
  storage:{from:(bucket:string)=>{assert.equal(bucket,'historical-samples');return {download:async(path:string)=>{downloads++;assert.equal(path,original.storage_path);return {data:originalBytes,error:options.downloadError?{message:'Download denied'}:null};}};}},
 };
 const service={rpc:async(name:string,params:Params)=>{calls.push({name,params});if(options.rpcThrows)throw Error('Synthetic RPC exception');return {data:'saved-sample',error:options.rpcError?{message:'Synthetic RPC denial'}:null};}};
 const response=await handleBidScope({user,service,body:{action:'historical-complete',importId:untrustedId,p_actor:member,p_sha256:'client digest',payload:options.payload??injected},headers:{}});
 assert.equal(response.headers.get('cache-control'),'no-store');cases++;
 return {response,data:await response.json(),calls,downloads,reads};
}

const originalFetch=globalThis.fetch;let networkCalls=0;
globalThis.fetch=async()=>{networkCalls++;throw Error('Network forbidden in historical-import boundary verifier');};
let started=false;
const container='tenops-historical-boundary-'+process.pid;
try{
 for(const payload of [editable,injected]){
  const checked=await exercise({payload});assert.equal(checked.response.status,200);assert.equal(checked.data,'saved-sample');
  assert.equal(checked.calls.length,1);assert.equal(checked.calls[0].name,'persist_historical_sample');
  assert.deepEqual(Object.keys(checked.calls[0].params).sort(),parameterKeys);
  assert.deepEqual(checked.calls[0].params,{p_actor:admin,p_import_id:originalId,p_sha256:digest,...editable});
  assert.equal(checked.downloads,1);assert.equal(checked.reads,1);
 }
 for(const options of [{authError:true},{unauthenticated:true},{readError:true},{owner:member},{size:originalBytes.size+1},{downloadError:true}]){
  const checked=await exercise(options);assert.equal(checked.response.status,422);assert.equal(checked.calls.length,0,'denials must never reach service credentials');
  if('authError' in options||'unauthenticated' in options){assert.equal(checked.reads,0);assert.equal(checked.downloads,0);}
 }
 for(const options of [{rpcError:true},{rpcThrows:true}]){
  const checked=await exercise(options);assert.equal(checked.response.status,422);assert.match(checked.data.error,/Synthetic RPC/);assert.equal(checked.calls.length,1);
 }
 // Use the existing disposable canonical fixture, not another database harness.
 started=true;startIntakeDatabase(container);
 const seed=value(container,'create_sample()');
 const seedBefore=value(container,`to_jsonb(s) from samples s where id=${literal(seed)}`);
 const sample={...JSON.parse(seedBefore),id:'',job_id:null,bid_id:null,color_plate_number:'T26-098-B',project_name:editable.p_sample.project_name};
 const rows=[{percentage:'100',color:'Synthetic chip',size:'0',vendor:'Synthetic vendor',unit:'lb',component_role:'aggregate',calculation_basis:'target_total',quantity_provenance:'calculated'}];
 function begin(hash=digest){
  const record=JSON.parse(value(container,`to_jsonb(begin_historical_sample_import('synthetic.pdf','application/pdf',${originalBytes.size},${literal(hash)},'{}'))`));
  sql(container,asUser(`insert into storage.objects(bucket_id,name) values('historical-samples',${literal(record.storage_path)})`));return record;
 }
 const target=begin(),decoy=begin('b'.repeat(64));
 const serviceCalls:Params[]=[];
 const user={
  auth:{getUser:async()=>({data:{user:{id:admin}}})},
  from:(table:string)=>{assert.equal(table,'historical_sample_imports');return {select:()=>({eq:(field:string,id:string)=>{assert.equal(field,'id');return {single:async()=>({data:JSON.parse(value(container,`to_jsonb(i) from historical_sample_imports i where id=${literal(id)}`))})};}})};},
  storage:{from:(bucket:string)=>{assert.equal(bucket,'historical-samples');return {download:async(path:string)=>{assert.equal(value(container,`count(*) from storage.objects where bucket_id='historical-samples' and name=${literal(path)}`),'1');return {data:originalBytes};}};}},
 };
 const service={rpc:async(name:string,params:Params)=>{
  assert.equal(name,'persist_historical_sample');assert.deepEqual(Object.keys(params).sort(),parameterKeys);serviceCalls.push(params);
  const args=Object.entries(params).map(([key,val])=>`${key}=>${key==='p_sample'||key==='p_rows'?json(val):literal(val)}`).join(',');
  try{return {data:value(container,`persist_historical_sample(${args})`,admin,'service_role')};}catch(error){return {error:{message:(error as Error).message}};}
 }};
 const body={action:'historical-complete',importId:target.id,payload:{...injected,p_sample:sample,p_rows:rows,p_actor:member,p_import_id:decoy.id}};
 const response=await handleBidScope({user,service,body,headers:{}});assert.equal(response.status,200,await response.clone().text());
 const imported=await response.json();assert.ok(imported);
 assert.deepEqual(serviceCalls[0],{p_actor:admin,p_import_id:target.id,p_sha256:digest,p_sample:sample,p_rows:rows,p_sample_name:editable.p_sample_name});
 assert.equal(value(container,`sample_id from historical_sample_imports where id=${literal(target.id)}`),imported);
 assert.equal(value(container,`sample_id is null from historical_sample_imports where id=${literal(decoy.id)}`),'t');
 assert.equal(value(container,`created_by_user_id=${literal(admin)} from samples where id=${literal(imported)}`),'t');
 assert.equal(value(container,`sample_name from samples where id=${literal(imported)}`),editable.p_sample_name);
 assert.equal(value(container,`project_name from samples where id=${literal(imported)}`),editable.p_sample.project_name);
 assert.equal(value(container,`count(*) from sample_blend_rows where sample_id=${literal(imported)} and color='Synthetic chip'`),'1');
 const retry=await handleBidScope({user,service,body,headers:{}});assert.equal(retry.status,200);assert.equal(await retry.json(),imported);
 // A malicious digest cannot rescue mismatched bytes, even at the actual SECURITY DEFINER RPC.
 const mismatch=await handleBidScope({user,service,body:{...body,importId:decoy.id},headers:{}});assert.equal(mismatch.status,422);assert.match((await mismatch.json()).error,/Original digest does not match evidence/);
 assert.equal(value(container,`sample_id is null from historical_sample_imports where id=${literal(decoy.id)}`),'t');
 assert.equal(value(container,`to_jsonb(s) from samples s where id=${literal(seed)}`),seedBefore);
 assert.equal(value(container,'count(*) from sample_issued_documents'),'0');assert.equal(value(container,'count(*) from inventory_items'),'0');
 assert.equal(networkCalls,0);
 console.log(`PASS: ${cases} real-handler allowlist/auth/ownership/size/download/RPC-error cases; actual privileged PostgreSQL RPC preserved trusted actor/import/digest, editable transcription, retry and original records; mismatched digest denied. No hosted traffic.`);
}finally{
 globalThis.fetch=originalFetch;if(started)docker(['stop',container]);
}
