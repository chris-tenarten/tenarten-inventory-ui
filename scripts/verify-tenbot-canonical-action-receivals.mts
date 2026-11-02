/** Focused offline orchestration/parser/static migration checks. Real Auth,
 * PostgreSQL/RLS/rollback/concurrency proof belongs to the isolated DB verifier. */
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import ts from 'typescript';
import {createReviewedActionService,parseActionReceipt,ReviewedActionError,type ActionReference,type ActionCard,type ActionRpc} from '../supabase/functions/_shared/tenbot-actions';
import {confirmReviewedActionPassword,type ActionPasswordDependencies} from '../supabase/functions/_shared/tenbot-action-auth';

const id=(n:number)=>'20261102-1300-4000-8000-'+String(n).padStart(12,'0');
const now=Date.parse('2026-11-02T20:00:00Z'),owner=id(1),originalSession=id(2),executionSession=id(3),hash='a'.repeat(64),draftHash='b'.repeat(64);
const reference:ActionReference={id:id(4),revision:2,hash,expiresAt:new Date(now+900000).toISOString()};
const stage={draftId:id(5),hash:draftHash,approvalId:id(6)},createdId=id(7),secret='synthetic-secret-for-auth-only';
const card:ActionCard={kind:'proposed_action',contract:'tenbot.actions.v1',reference,operation:'inventory.create_pending_receivals',review:{title:'Review incoming material',summary:'One material is ready for review.',consequences:['Adds a Pending Receival. Received Inventory quantities do not change.'],fields:[],issues:[]},confirmation:{kind:'account_password',available:true}};
const result={draftId:stage.draftId,hash:draftHash,createdRecordIds:[createdId],createdCatalogRecords:[],idempotent:false,executedAt:new Date(now+1000).toISOString(),onHandChangedByCreation:false,url:'/inventory#pending-receivals'};
const receipt={contract:'tenbot.actions.v1',kind:'action_result',reference,operation:card.operation,status:'completed',idempotent:false,result,completedAt:new Date(now+1000).toISOString()};
const jwt=(session:string)=>[Buffer.from('{"alg":"HS256"}').toString('base64url'),Buffer.from(JSON.stringify({sub:owner,role:'authenticated',session_id:session,aal:'aal1',exp:now/1000+3600})).toString('base64url'),'offline-signature'].join('.');
const permanentOnly=process.argv.includes('--permanent-only');
const checks:string[]=[];async function check(name:string,run:()=>unknown|Promise<unknown>){if(permanentOnly&&!name.startsWith('permanent:'))return;await run();checks.push(name);}

function fixture(){
 const calls:Array<{name:string;args?:unknown}>=[];
 const state={stage:stage as unknown,stageError:null as {code:string;message:string}|null,permitThrow:false,stageThrow:false,receipt:receipt as unknown};
 const caller:ActionRpc={async rpc(name,args){calls.push({name,args});if(name==='get_tenbot_reviewed_action')return {data:{contract:'tenbot.actions.v1',card,state:'prepared',receipt:null},error:null};if(name==='stage_tenbot_reviewed_receivals'){if(state.stageThrow)throw Error(secret);return {data:state.stage,error:state.stageError};}if(name==='execute_tenbot_reviewed_action')return {data:state.receipt,error:null};throw Error('Unexpected offline RPC');}};
 const deps:ActionPasswordDependencies={now:()=>now,async authenticate(){return {user:{id:owner,email:'synthetic@example.invalid'},token:jwt(originalSession),caller};},createPasswordClient(){return {auth:{async signInWithPassword(input){assert.equal(input.email,'synthetic@example.invalid');assert.equal(input.password,secret);calls.push({name:'auth-password-only'});return {data:{user:{id:owner},session:{access_token:jwt(executionSession),refresh_token:'synthetic-refresh',expires_at:now/1000+3600}},error:null};},async getUser(){return {data:{user:{id:owner}},error:null};}}};},callerForToken(token){assert.equal(token,jwt(executionSession));return caller;},service:{async rpc(name,args){calls.push({name,args});assert.equal(name,'stamp_tenbot_action_password');return {data:{id:reference.id,hash,authorized:true},error:null};}},async beforeExecute(input){assert.equal(input.operation,'inventory.create_pending_receivals');assert.equal(input.ownerId,owner);assert.deepEqual(input.reference,reference);const staged=await createReviewedActionService(input.caller).stageReceivals(input.reference);calls.push({name:'unchanged-trusted-pilot-permit',args:staged});if(state.permitThrow)throw Error(secret);}};
 return {state,calls,deps,confirm:()=>confirmReviewedActionPassword(deps,{reference,password:secret})};
}
await check('metadata stage has exact reviewed identity and is never a created-record receipt',async()=>{
 const f=fixture(),staged=await createReviewedActionService({async rpc(name,args){assert.equal(name,'stage_tenbot_reviewed_receivals');assert.deepEqual(args,{p_action_id:reference.id,p_revision:2,p_expected_hash:hash});return {data:stage,error:null};}}).stageReceivals(reference);
 assert.deepEqual(staged,stage);assert(!('createdRecordIds' in staged));assert(!f.calls.length);
});
await check('password, canonical stage, unchanged trusted permit and exact execution remain separate and ordered',async()=>{
 const f=fixture(),confirmed=await f.confirm();assert.equal(confirmed.status,'completed');assert.deepEqual(confirmed.receipt?.result,result);assert.deepEqual(f.calls.map(c=>c.name),['get_tenbot_reviewed_action','auth-password-only','stamp_tenbot_action_password','stage_tenbot_reviewed_receivals','unchanged-trusted-pilot-permit','execute_tenbot_reviewed_action']);assert(!JSON.stringify(f.calls).includes(secret));assert(!JSON.stringify(confirmed).includes(secret));
});
await check('definite stage-failure response cannot reach permit or execute',async()=>{
 const f=fixture();f.state.stage={contract:'tenbot.actions.v1',kind:'action_failure',id:reference.id,hash,status:'failed'};const confirmed=await f.confirm();assert.equal(confirmed.status,'failed');assert.equal(confirmed.receipt,null);assert(!f.calls.some(c=>['unchanged-trusted-pilot-permit','execute_tenbot_reviewed_action'].includes(c.name)));assert(confirmed.session);
});
await check('uncertain stage/permit never retries or reports business success and retains private session',async()=>{
 for(const change of [{stageThrow:true},{permitThrow:true}]){const f=fixture();Object.assign(f.state,change);const confirmed=await f.confirm();assert.equal(confirmed.status,'uncertain');assert.equal(confirmed.receipt,null);assert.equal(confirmed.recovery.kind,'refresh_action');assert(confirmed.session);assert(!f.calls.some(c=>c.name==='execute_tenbot_reviewed_action'));assert.equal(f.calls.filter(c=>c.name==='stage_tenbot_reviewed_receivals').length,1);}
});
await check('malformed metadata/committed identities cannot become employee success',async()=>{
 const malformed=fixture();malformed.state.stage={...stage,approvalId:'invalid'};assert.equal((await malformed.confirm()).status,'uncertain');
 assert.deepEqual(parseActionReceipt(receipt,reference).result,result);
 for(const change of [{createdRecordIds:[]},{createdRecordIds:[createdId,createdId]},{createdRecordIds:['proposed-id']},{onHandChangedByCreation:true},{draftId:'invalid'},{executedAt:'invalid'},{url:'/inventory/unknown'}])assert.throws(()=>parseActionReceipt({...receipt,result:{...result,...change}},reference),ReviewedActionError);
 assert.throws(()=>parseActionReceipt({...receipt,result:{ok:true}},reference),ReviewedActionError);
});

const migrationPath='supabase/migrations/20261102130000_tenbot_action_canonical_receivals.sql',sql=readFileSync(migrationPath,'utf8');
await check('forward migration changes no old roles/capabilities, funding, original canonical function or activation row',()=>{
 assert(!/\b(?:create|alter|grant)\s+role\b/i.test(sql));assert(!/\b(?:insert into|update|delete from)\s+public\.(?:app_users|app_role_capabilities|tenbot_action_control|tenbot_receival_pilot_policy|tenbot_receival_pilot_employees|tenbot_receival_execution_control)\b/i.test(sql));assert(!/create or replace function public\.(?:execute_invoice_receival_draft|tenbot_receival_mint_execution_permit|prepare_invoice_receival_draft_with_source|approve_invoice_receival_draft)\(/.test(sql));assert(!/set_config|set role/i.test(sql));assert(!/tenbot_openai|funding|budget/.test(sql.slice(sql.indexOf('begin;'))));
 assert(sql.includes('enable row level security'));assert(sql.includes('from public,anon,authenticated,service_role'));assert(sql.includes('drop constraint tenbot_action_control_receivals_enabled_check'));
});
await check('private transaction dispatch guard seals linked legacy execution and leaves unrelated canonical flow intact',()=>{
 const guard=sql.slice(sql.indexOf('create function public.tenbot_action_guard_receival_execution'),sql.indexOf('create or replace function public.execute_tenbot_reviewed_action'));
 assert(guard.includes('if stage.action_id is null then return new'));assert(guard.includes('dispatch.transaction_id<>txid_current()'));assert(guard.includes("dispatch.session_id is distinct from nullif(auth.jwt()->>'session_id','')::uuid"));assert(guard.includes('stage.approval_id is distinct from new.approval_id'));assert(guard.includes('stage.content_hash is distinct from new.content_hash'));assert(guard.includes('action.revision is distinct from dispatch.revision'));assert(guard.includes('action.content_hash is distinct from dispatch.content_hash'));assert(guard.includes('public.tenbot_action_require_authorized(action)'));assert(guard.includes('before insert on public.invoice_receival_executions'));
 const execute=sql.slice(sql.indexOf('create or replace function public.execute_tenbot_reviewed_action'));assert(execute.indexOf('insert into public.tenbot_reviewed_action_dispatches')<execute.indexOf('result:=public.execute_invoice_receival_draft'));assert(execute.includes("exception when others then\n  -- Domain writes"));assert(execute.includes("failure_code='business_rejected',authorization_consumed_at="));assert(execute.includes("jsonb_build_object('onHandChangedByCreation',false"));assert(execute.includes('public.tenbot_action_receipt(action,true)'));
});
await check('canonical stage rechecks source, human-reviewed material and package before approval without business writes',()=>{
 const stageSql=sql.slice(sql.indexOf('create function public.stage_tenbot_reviewed_receivals'),sql.indexOf('create function public.tenbot_action_guard_receival_execution'));
 assert(stageSql.includes('public.prepare_invoice_receival_draft_with_source'));assert(stageSql.includes('public.approve_invoice_receival_draft'));assert(stageSql.includes("reviewed->'sourceQuantity' is distinct from line->'sourceQuantity'"));assert(stageSql.includes("reviewed->'package'->>'quantity'"));assert(stageSql.includes("reviewed->>'vendorSku'"));assert(stageSql.includes('public.tenbot_action_require_authorized(action)'));assert(!/insert into public\.(?:pending_receivals|inventory_items|inventory_transactions)/i.test(stageSql));
});
const permanentPath='supabase/migrations/20261102170000_tenbot_permanent_reviewed_pending.sql',permanentSql=readFileSync(permanentPath,'utf8');
await check('permanent: forward correction replaces exactly the new-execution Pending call; reconciliation and every other source byte stay intact',()=>{
 const body=sql.slice(sql.indexOf('create or replace function public.execute_tenbot_reviewed_action')).split('as $$')[1].split('$$;')[0];
 assert(permanentSql.includes(createHash('md5').update(body).digest('hex')));
 const oldClause=permanentSql.split('old_clause:=$old$')[1].split('$old$;')[0],newClause=permanentSql.split('new_clause:=$new$')[1].split('$new$;')[0];
 assert.equal(body.split(oldClause).length,2);const changed=body.replace(oldClause,newClause);
 assert.equal(changed.match(/result:=public.tenbot_execute_invoice_receival_core\(/g)?.length,1);
 assert.equal(changed.match(/perform public.execute_invoice_receival_draft\(/g)?.length,1);
 assert.equal(body.split('result:=public.execute_invoice_receival_draft')[0].split('perform public.tenbot_action_require_authorized(action)').length,2);
 assert(changed.indexOf('insert into public.tenbot_reviewed_action_dispatches')<changed.indexOf('result:=public.tenbot_execute_invoice_receival_core'));
 assert.equal(changed.match(/perform public.tenbot_action_require_authorized\(action\)/g)?.length,2);
 assert(changed.includes("failure_code='business_rejected',authorization_consumed_at="));assert(changed.includes("jsonb_build_object('onHandChangedByCreation',false"));assert(changed.includes('public.tenbot_action_receipt(action,true)'));
 assert(permanentSql.includes('proowner=original.proowner and proacl is not distinct from original.proacl'));
 assert(permanentSql.includes('prosrc=replacement_source'));assert(permanentSql.includes('original.proconfig'));
});
await check('permanent: application requires exact owner/ACL/predecessor, live commit guard and disabled controls without changing roles, tables, grants or activation',()=>{
 assert(permanentSql.includes("array['authenticated=X/postgres','postgres=X/postgres']"));assert(permanentSql.includes("original.proowner<>'postgres'::regrole"));
 assert(permanentSql.includes("tgenabled='O'"));assert(permanentSql.includes("tgfoid='public.tenbot_action_guard_receival_execution()'::regprocedure"));
 assert(permanentSql.includes('where singleton and not receivals_enabled for share'));assert(permanentSql.includes('where singleton and not execution_enabled for share'));
 const commands=permanentSql.split('\n').filter(line=>!line.trimStart().startsWith('--')).join('\n');
 assert(!/\b(?:create|alter|grant|revoke)\s+(?:table|role|policy)\b/i.test(commands));assert(!/\b(?:grant|revoke)\b/i.test(commands));
 assert(!/\b(?:insert into|update|delete from)\s+public\.(?:app_users|app_role_capabilities|tenbot_action_control|tenbot_receival_pilot_policy|tenbot_receival_pilot_employees|tenbot_receival_execution_control)\b/i.test(commands));
 assert(!/set_config|set role|tenbot_openai/i.test(commands));
});
const edge=readFileSync('supabase/functions/tenbot/index.ts','utf8');
const beforeExecute=edge.slice(edge.indexOf('async beforeExecute(input){'),edge.indexOf('\n    }},\n   async preview(reference)'));
assert(beforeExecute.startsWith('async beforeExecute(input){'));
const edgeMethod=ts.transpileModule('const handler={'+beforeExecute+'\n}};',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
async function edgeBefore(options:{normal?:boolean;acceptance?:boolean;execution?:boolean;pilot?:boolean;operation?:string;stageFails?:boolean}={}){
 const calls:string[]=[];
 const run=new Function('createReviewedActionService','reviewedAuthorized','employeeModeAuthorized','Deno','hostedReceivalPilotEnabled','origin','mintHostedReceivalExecutionPermit','metadata','ReviewedActionError',edgeMethod+';return handler.beforeExecute;')(
  ()=>({async revoke(value:ActionReference){assert.deepEqual(value,reference);calls.push('revoke');},async stageReceivals(value:ActionReference){assert.deepEqual(value,reference);calls.push('stage');if(options.stageFails)throw new ReviewedActionError('rejected');return stage;}}),
  ()=>options.normal===true||options.acceptance===true,options.normal===true,{env:{get:(name:string)=>name==='TENBOT_RECEIVAL_EXECUTION_ENABLED'&&options.execution===true?'true':''}},
  ()=>{calls.push('pilot-check');return options.pilot===true;},options.normal?'https://tenops.pages.dev':'https://tendev.pages.dev',async()=>{calls.push('pilot-permit');},null,ReviewedActionError) as (input:unknown)=>Promise<void>;
 let rejected=false;try{await run({caller:{},reference,ownerId:owner,operation:options.operation??'inventory.create_pending_receivals'});}catch(error){assert(error instanceof ReviewedActionError);rejected=true;}
 return {calls,rejected};
}
await check('permanent: actual Edge branch stages normal eligible exact actions without pilot/enrollment/window/permit and retains execution disablement',async()=>{
 assert.deepEqual(await edgeBefore({normal:true,execution:true}),{calls:['stage'],rejected:false});
 for(const options of [{normal:true,execution:false},{normal:false,acceptance:false,execution:true}])assert.deepEqual(await edgeBefore(options),{calls:['revoke'],rejected:true});
 assert.deepEqual(await edgeBefore({normal:true,execution:true,stageFails:true}),{calls:['stage'],rejected:true});
 assert.deepEqual(await edgeBefore({normal:true,execution:false,operation:'proposal.save_draft'}),{calls:[],rejected:false});
});
await check('permanent: actual Edge finite acceptance retains pilot denial and permit ordering; it cannot enter the normal branch',async()=>{
 assert.deepEqual(await edgeBefore({acceptance:true,execution:true,pilot:false}),{calls:['pilot-check','revoke'],rejected:true});
 assert.deepEqual(await edgeBefore({acceptance:true,execution:true,pilot:true}),{calls:['pilot-check','stage','pilot-permit'],rejected:false});
 assert.deepEqual(await edgeBefore({acceptance:true,execution:false,pilot:true}),{calls:['revoke'],rejected:true});
});
const report={passed:true,groups:checks.length,checks,mode:'Offline injected trusted-auth/RPC and static forward-migration checks only',actualNetworkCalls:0,actualDatabase:false,businessWrites:0,inferenceCalls:0,migration:{path:permanentOnly?permanentPath:migrationPath,sha256:createHash('sha256').update(permanentOnly?permanentSql:sql).digest('hex'),appliedByThisVerifier:false},requiredGate:'Separate real isolated canonical PostgreSQL/Auth/RLS/lifecycle/concurrency evidence required.'};
const directory='/private/tmp/tenops-tenbot-canonical-action-receivals-20261102';mkdirSync(directory,{recursive:true,mode:0o700});writeFileSync(directory+(permanentOnly?'/permanent-offline.json':'/offline.json'),JSON.stringify(report,null,2)+'\n',{mode:0o600});console.log(JSON.stringify(report,null,2));
