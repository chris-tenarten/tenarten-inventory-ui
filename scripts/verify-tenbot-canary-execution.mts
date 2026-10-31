/** Focused offline parser/control/migration checks. Synthetic caller/RPC only;
 * not real JWT/RLS, PostgreSQL, browser, activation or inference evidence. */
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {TENBOT_CANARY_OWNER,TENBOT_CANARY_DOCUMENT_SHA256} from '../src/modules/inventory/tenbot-canary-access';
import {parseTenbotCanaryExecutionWindow,tenbotCanaryExecutionWindowOpen,TENBOT_CANARY_EXECUTION_SOURCE_ID,TENBOT_CANARY_EXECUTION_SOURCE_EVIDENCE_SHA256,TENBOT_CANARY_EXECUTION_PREVIEW_REVISION,TENBOT_CANARY_EXECUTION_PREVIEW_HASH,type TenbotCanaryExecutionWindow} from '../src/modules/inventory/tenbot-canary-execution';
import {createTenbotCanaryControl,type CanaryControlClient,type CanaryControlQuery,CanaryControlError} from '../src/modules/inventory/tenbot-canary-control';
const base=Date.parse('2026-10-31T04:00:00Z'),iso=(n:number)=>new Date(n).toISOString();
const admin='10302026-0000-4000-8000-000000000001',grant='10302026-0000-4000-8000-000000000002';
const window=():TenbotCanaryExecutionWindow=>({schemaVersion:'tenbot-canary-execution.v1',serverNow:iso(base),enabled:true,startsAt:iso(base-1000),expiresAt:iso(base+600000),ownerId:TENBOT_CANARY_OWNER,sourceId:TENBOT_CANARY_EXECUTION_SOURCE_ID,documentSha256:TENBOT_CANARY_DOCUMENT_SHA256,previewRevision:TENBOT_CANARY_EXECUTION_PREVIEW_REVISION,previewHash:TENBOT_CANARY_EXECUTION_PREVIEW_HASH,sourceEvidenceSha256:TENBOT_CANARY_EXECUTION_SOURCE_EVIDENCE_SHA256,grantId:null,inferenceAllowed:false});
const checks:string[]=[];async function check(name:string,work:()=>void|Promise<void>){await work();checks.push(name);}
await check('strict fixed-scope execution projection defaults OFF and accepts no inference authority',()=>{
 const w=window();assert.deepEqual(parseTenbotCanaryExecutionWindow(w),w);const dormant={...w,enabled:false,startsAt:null,expiresAt:null};assert.deepEqual(parseTenbotCanaryExecutionWindow(dormant),dormant);
 for(const changed of [{ownerId:admin},{sourceId:admin},{previewRevision:2},{previewHash:'a'.repeat(64)},{sourceEvidenceSha256:'b'.repeat(64)},{documentSha256:'c'.repeat(64)},{inferenceAllowed:true},{budgetMicrousd:250000},{serverNow:'invalid'},{grantId:'invalid'},{expiresAt:iso(base+900001)},{startsAt:null}])assert.throws(()=>parseTenbotCanaryExecutionWindow({...w,...changed}));
 assert(parseTenbotCanaryExecutionWindow({...w,enabled:false,grantId:grant}));
});
await check('server clock and elapsed time expire independently of cleanup or workstation date',()=>{
 const w=window();assert(tenbotCanaryExecutionWindowOpen(w));assert(!tenbotCanaryExecutionWindowOpen(w,600000));assert(!tenbotCanaryExecutionWindowOpen(w,-1));assert(!tenbotCanaryExecutionWindowOpen(w,Infinity));assert(!tenbotCanaryExecutionWindowOpen({...w,enabled:false}));assert(!tenbotCanaryExecutionWindowOpen({...w,startsAt:iso(base+1)}));
});
function fixture(){
 const state={window:window() as unknown,fundingEnabled:false,role:'admin',active:true,changed:false,calls:[] as {name:string;args:Record<string,unknown>}[]};
 const q=(run:()=>unknown)=>{const builder={abortSignal(){return builder;},then(resolve:unknown,reject:unknown){return Promise.resolve().then(()=>({data:run(),error:null})).then(resolve as (value:unknown)=>unknown,reject as (reason:unknown)=>never);}};return builder as unknown as CanaryControlQuery;};
 const client={auth:{async getUser(){return {data:{user:{id:admin}},error:null};}},rpc(name:string,args:Record<string,unknown>){return q(()=>{state.calls.push({name,args});
  if(name==='get_my_app_access')return [{user_id:admin,role:state.role,is_active:state.active,read_only:false}];
  if(name==='has_app_capability')return state.role==='admin'&&args.p_capability==='manageRolesPermissions';
  if(name==='get_tenbot_chris_dev_canary_control_status')return {schemaVersion:'tenbot-canary-control.v1',serverNow:iso(base),viewer:'admin',ownerId:TENBOT_CANARY_OWNER,subjectEligible:true,completedCanary:false,grantConflict:false,grant:null,database:{pilotEnabled:false,executionEnabled:false,subjectEnrolled:false,enrollmentCount:0},activationBlock:null};
  if(name==='get_tenbot_chris_dev_execution_window_status')return state.window;
  if(name==='get_tenbot_chris_dev_canary_funding_status')return {schemaVersion:'tenbot-canary-funding.v1',serverNow:iso(base),enabled:state.fundingEnabled,startsAt:iso(base-1000),expiresAt:iso(base+600000),fundingId:'10302026-0000-4000-8000-000000000003',grantId:state.fundingEnabled?null:grant,budgetMicrousd:250000,accountedMicrousd:13145,remainingMicrousd:236855,active:false};
  if(name==='activate_tenbot_chris_dev_canary_grant')return grant;
  throw Error('Unexpected synthetic control request');
 });},from(){throw Error('Activation must not read business records');}} as unknown as CanaryControlClient;
 return {state,control:createTenbotCanaryControl(client,{viewerId:admin,currentViewerId:()=>state.changed?null:admin,mode:'enabled',origin:'https://tendev.pages.dev'})};
}
const activation={expiresAt:iso(base+300000),reason:'Synthetic execution-only canary review',confirmed:true};
async function denied(work:Promise<unknown>,code?:string){try{await work;assert.fail('Expected rejection');}catch(error){assert(error instanceof CanaryControlError,String(error));if(code)assert.equal(error.code,code);}}
await check('genuine Admin control loads separate status and activates exact RPC without unavailable inference funding',async()=>{
 const f=fixture(),view=await f.control.load();assert.equal(view.executionWindow?.sourceId,TENBOT_CANARY_EXECUTION_SOURCE_ID);assert.equal(view.executionWindow?.inferenceAllowed,false);f.state.calls=[];assert.deepEqual(await f.control.activate(activation),{grantId:grant});assert(!f.state.calls.some(x=>x.name==='get_tenbot_chris_dev_canary_funding_status'));const call=f.state.calls.find(x=>x.name==='activate_tenbot_chris_dev_canary_grant');assert.deepEqual(call?.args,{p_expires_at:activation.expiresAt,p_reason:activation.reason});assert(!f.state.calls.some(x=>/reserve|settle|prepare|execute/.test(x.name)));
});
await check('bound, disabled and expired execution attempt cannot fall back to available inference funding',async()=>{
 for(const change of [{grantId:grant},{enabled:false,grantId:grant},{expiresAt:iso(base-1),startsAt:iso(base-600001)}]){const f=fixture();f.state.window={...window(),...change};f.state.fundingEnabled=true;await denied(f.control.activate(activation),'execution-window-unavailable');assert(!f.state.calls.some(x=>x.name==='get_tenbot_chris_dev_canary_funding_status'||x.name==='activate_tenbot_chris_dev_canary_grant'));}
 const long=fixture();await denied(long.control.activate({...activation,expiresAt:iso(base+600001)}),'invalid-expiry');assert(!long.state.calls.some(x=>x.name==='activate_tenbot_chris_dev_canary_grant'));
});
await check('authorization/account changes deny before activation and dormant execution preserves legacy funded path',async()=>{
 for(const change of [{active:false},{role:'developer'},{changed:true}]){const f=fixture();Object.assign(f.state,change);await denied(f.control.activate(activation));assert(!f.state.calls.some(x=>x.name==='activate_tenbot_chris_dev_canary_grant'));}
 const f=fixture();f.state.window={...window(),enabled:false,startsAt:null,expiresAt:null};f.state.fundingEnabled=true;assert.deepEqual(await f.control.activate(activation),{grantId:grant});assert(f.state.calls.some(x=>x.name==='get_tenbot_chris_dev_canary_funding_status'));
});
const migration=readFileSync('supabase/migrations/20261031030000_tenbot_execution_only_canary_window.sql','utf8');
await check('migration pins exact predecessor bodies, leaves immutable used allowance/accounting and canonical RPCs intact',()=>{
 for(const pin of ['366162ba4b9d723f965758c57bb4ef72','802f9b0f69a90452620cdee9748ed7dc','c2d6f546fad823a7a4ffdf8dd6cc9b1f','07f4bc465c8db61d4df67cc0896a8f96'])assert(migration.includes(pin));
 assert(!/(?:update|delete from|truncate|insert into) public\.(?:tenbot_openai_(?:usage|policy)|tenbot_chris_dev_canary_(?:funding|usage))\b/i.test(migration));assert(!/create(?: or replace)? function public\.(?:activate|revoke)_tenbot_chris_dev_canary_grant\(/i.test(migration));assert(migration.includes("old.bound_grant_id is not null and new.bound_grant_id is distinct from old.bound_grant_id"));assert(migration.includes("old.starts_at is not null and not old.enabled and new.enabled"));assert(migration.includes("Execution-only authorization never permits inference."));
});
await check('default-OFF window is private, source pinned and exact-grant revocation closes only its binding',()=>{
 assert(migration.includes('enabled boolean not null default false'));assert(migration.includes('inference_allowed boolean not null default false check(not inference_allowed)'));assert(migration.includes('enable row level security'));assert(migration.includes('from public,anon,authenticated,service_role,tenbot_invoice_executor'));assert(migration.includes('where bound_grant_id=new.id and enabled'));assert(migration.includes('create trigger tenbot_close_execution_window_on_revoke after update of revoked_at'));
 for(const value of [TENBOT_CANARY_EXECUTION_SOURCE_ID,TENBOT_CANARY_EXECUTION_SOURCE_EVIDENCE_SHA256,TENBOT_CANARY_EXECUTION_PREVIEW_HASH])assert(migration.includes(value));assert(migration.includes('public.tenbot_execution_original_ready(true)'));assert(migration.includes('public.tenbot_execution_original_ready(false)'));assert(migration.includes('new.source_id<>w.source_id'));
});
await check('all canonical operation guards and finite grant bounds remain independently enforced',()=>{
 for(const kind of ['draft','binding','approval','permit','execution'])assert(migration.includes('create trigger invoice_execution_only_'+kind+' before insert'));
 assert(migration.includes("w.expires_at<=clock_timestamp() or g.expires_at>w.expires_at"));assert(migration.includes('new.expires_at>w.expires_at'));assert(migration.includes('create function public.get_tenbot_chris_dev_execution_window_status()'));assert(migration.includes("actor.role='admin' and public.has_app_capability('manageRolesPermissions')"));
});
const report={passed:true,groups:checks.length,checks,migrationSha256:createHash('sha256').update(migration).digest('hex'),mode:'Offline deterministic parser/control and migration inspection only; no database/JWT/RLS/browser validation',actualNetworkCalls:0,actualDatabase:false,realGrantMutations:0,operationalWrites:0,inferenceCalls:0};
const directory='/private/tmp/tenops-tenbot-execution-only-20261030';mkdirSync(directory,{recursive:true});writeFileSync(directory+'/offline.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
