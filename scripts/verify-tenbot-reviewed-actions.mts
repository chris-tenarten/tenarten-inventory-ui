/** Offline contract and injected trusted-auth checks only. No network, real
 * password, Supabase, browser, PostgreSQL, role/RLS or business writes. */
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {normalizePreparedAction,parseActionCard,parseActionReference,createReviewedActionService,createTrustedActionPublisher,ReviewedActionError,type ActionCard,type ActionReference,type ActionReceipt,type ActionRpc,type PreparedAction} from '../supabase/functions/_shared/tenbot-actions';
import {confirmReviewedActionPassword,ActionPasswordError,type ActionPasswordDependencies,type PasswordAuthClient} from '../supabase/functions/_shared/tenbot-action-auth';

const now=Date.parse('2026-11-02T18:00:00Z'),iso=(offset:number)=>new Date(now+offset).toISOString();
const id=(n:number)=>'20261102-0000-4000-8000-'+String(n).padStart(12,'0');
const owner=id(1),originalSession=id(2),newSession=id(3),hash='a'.repeat(64);
const reference:ActionReference={id:id(4),revision:1,hash,expiresAt:iso(900000)};
const intent:PreparedAction={operation:'proposal.save_draft',parameters:{p_proposal:{project_name:'Synthetic specification'},p_lines:[],p_estimate_inputs:{},p_estimate_overrides:{}},review:{title:'Save Proposal draft',summary:'Save an unissued standalone Proposal draft.',consequences:['This saves a draft. It does not issue a document.'],fields:[{path:'project_name',label:'Project',value:'Synthetic specification',editable:false}],issues:[],preview:{kind:'proposal_pdf'}},sourceReferences:[{kind:'submitted_source',id:'synthetic-source'}]};
const card:ActionCard={kind:'proposed_action',contract:'tenbot.actions.v1',reference,operation:intent.operation,review:intent.review,confirmation:{kind:'account_password',available:true}};
const receipt:ActionReceipt={contract:'tenbot.actions.v1',kind:'action_result',reference,operation:intent.operation,status:'completed',idempotent:false,result:{proposalId:id(5),status:'draft',url:'/proposals?open='+id(5)},completedAt:iso(1000)};
const secret='SYNTHETIC-password-for-auth-only';
const jwt=(session=originalSession,aal='aal1',subject=owner,exp=Math.floor(now/1000)+3600)=>[Buffer.from('{"alg":"HS256"}').toString('base64url'),Buffer.from(JSON.stringify({sub:subject,role:'authenticated',session_id:session,aal,exp})).toString('base64url'),'offline-signature'].join('.');
const checks:string[]=[];
async function check(name:string,run:()=>unknown|Promise<unknown>){await run();checks.push(name);}
function fixture(){
 const calls:Array<{name:string;args?:Record<string,unknown>}>=[];
 const state={card:structuredClone(card),state:'prepared',passwordError:false,passwordThrow:false,loginOwner:owner,originalToken:jwt(),freshToken:jwt(newSession),verifiedOwner:owner,verifyError:false,stampError:null as {code:string;message:string}|null,stampThrow:false,executeError:null as {code:string;message:string}|null,executeThrow:false,executeData:structuredClone(receipt) as unknown};
 const original:ActionRpc={async rpc(name,args){calls.push({name,args});assert.equal(name,'get_tenbot_reviewed_action');return {data:{contract:'tenbot.actions.v1',card:state.card,state:state.state,receipt:null},error:null};}};
 const fresh:ActionRpc={async rpc(name,args){calls.push({name,args});assert.equal(name,'execute_tenbot_reviewed_action');if(state.executeThrow)throw Error(secret);return {data:state.executeData,error:state.executeError};}};
 const client:PasswordAuthClient={auth:{async signInWithPassword(input){assert.deepEqual(input,{email:'employee@example.invalid',password:secret});calls.push({name:'password-auth-only'});if(state.passwordThrow)throw Error(secret);return {data:{user:{id:state.loginOwner},session:{access_token:state.freshToken,refresh_token:'synthetic-refresh-token',expires_at:Math.floor(now/1000)+3600}},error:state.passwordError?{message:secret}:null};},async getUser(token){calls.push({name:'verify-new-user'});assert.equal(token,state.freshToken);return {data:{user:{id:state.verifiedOwner}},error:state.verifyError?{message:secret}:null};}}};
 const deps:ActionPasswordDependencies={now:()=>now,async authenticate(){calls.push({name:'verify-original-user'});return {user:{id:owner,email:'employee@example.invalid'},token:state.originalToken,caller:original};},createPasswordClient(){calls.push({name:'new-isolated-auth-client'});return client;},callerForToken(token){assert.equal(token,state.freshToken);calls.push({name:'new-employee-caller'});return fresh;},service:{async rpc(name,args){calls.push({name,args});assert.equal(name,'stamp_tenbot_action_password');if(state.stampThrow)throw Error(secret);return {data:{id:reference.id,hash,authorized:true},error:state.stampError};}}};
 return {deps,state,calls,confirm:()=>confirmReviewedActionPassword(deps,{reference,password:secret})};
}
const has=(f:ReturnType<typeof fixture>,name:string)=>f.calls.some(x=>x.name===name);
async function passwordDenied(f:ReturnType<typeof fixture>,code?:string){await assert.rejects(f.confirm(),e=>{assert(e instanceof ActionPasswordError);if(code)assert.equal(e.code,code);assert(!e.message.includes(secret));return true;});assert(!has(f,'stamp_tenbot_action_password'));assert(!has(f,'execute_tenbot_reviewed_action'));}

await check('strict preparation is JSON-only and credential-free; unknown fields and deep/nonfinite values fail',()=>{
 assert.deepEqual(normalizePreparedAction(intent),intent);assert.deepEqual(parseActionCard(card),card);assert.deepEqual(parseActionReference(reference),reference);
 for(const change of [{password:secret},{operation:'arbitrary.write'},{parameters:{value:Infinity}},{review:{...intent.review,extra:true}},{review:{...intent.review,fields:[{path:'x',label:'X',value:1,password:secret}]}},{sourceReferences:[{kind:'x',id:'y',extra:true}]}])assert.throws(()=>normalizePreparedAction({...intent,...change}),ReviewedActionError);
 let deep:unknown='value';for(let n=0;n<18;n++)deep={value:deep};assert.throws(()=>normalizePreparedAction({...intent,parameters:deep}),ReviewedActionError);
 for(const change of [{revision:0},{hash:'bad'},{expiresAt:'bad'},{password:secret},{id:'wrong'}])assert.throws(()=>parseActionReference({...reference,...change}),ReviewedActionError);
});
await check('trusted-only publication and employee preview/status/cancel bind exact identity without execution',async()=>{
 const calls:Array<{name:string;args:Record<string,unknown>}>=[];
 const caller:ActionRpc={async rpc(name,args){calls.push({name,args});return {data:name==='prepare_tenbot_reviewed_action'?card:name==='preview_tenbot_reviewed_action'?intent:name==='revoke_tenbot_reviewed_action'?{id:reference.id,revoked:true}:{contract:'tenbot.actions.v1',card,state:'prepared',receipt:null},error:null};}};
 const service=createReviewedActionService(caller),publisher=createTrustedActionPublisher({ownerId:owner,sessionId:originalSession,service:caller});
 assert(!('prepare' in service));assert.deepEqual(await publisher.prepare({conversationId:id(6),action:intent}),card);assert.deepEqual(await service.preview(reference),intent);assert.equal((await service.get(reference)).state,'prepared');await service.revoke(reference);
 assert(!calls.some(x=>x.name==='execute_tenbot_reviewed_action'));assert.deepEqual(calls[0].args.p_intent,intent);assert.equal(calls[0].args.p_owner,owner);assert.equal(calls[0].args.p_session_id,originalSession);assert.deepEqual(calls[1].args,{p_action_id:reference.id,p_revision:1,p_expected_hash:hash});
 assert.throws(()=>createTrustedActionPublisher({ownerId:'invalid',sessionId:originalSession,service:caller}),ReviewedActionError);
});
await check('changed reference expiration and wrong receipt identities fail closed',async()=>{
 const f=fixture();await assert.rejects(createReviewedActionService({async rpc(){return {data:{contract:'tenbot.actions.v1',card,state:'prepared',receipt:null},error:null};}}).get({...reference,expiresAt:iso(999999)}),ReviewedActionError);
 f.state.executeData={...receipt,reference:{...reference,hash:'b'.repeat(64)}};assert.equal((await f.confirm()).status,'uncertain');
});
await check('trusted auth derives email from verified caller; exact proof precedes execution and only private handoff has tokens',async()=>{
 const f=fixture(),result=await f.confirm();assert.equal(result.status,'completed');assert.deepEqual(result.receipt,receipt);assert.equal(result.session.access_token,f.state.freshToken);assert.equal(result.session.refresh_token,'synthetic-refresh-token');
 assert.deepEqual(f.calls.find(x=>x.name==='stamp_tenbot_action_password')?.args,{p_owner:owner,p_action_id:reference.id,p_revision:1,p_expected_hash:hash,p_original_session_id:originalSession,p_execution_session_id:newSession,p_aal:'aal1'});
 assert(f.calls.findIndex(x=>x.name==='stamp_tenbot_action_password')<f.calls.findIndex(x=>x.name==='execute_tenbot_reviewed_action'));
 assert(!JSON.stringify(f.calls).includes(secret));assert(!JSON.stringify(result).includes(secret));assert(!('messages' in result));assert(!('answer' in result));
});
await check('invalid password/body rejects without raw auth exceptions, grant or execution',async()=>{
 for(const change of [{passwordError:true},{passwordThrow:true},{loginOwner:id(99)}]){const f=fixture();Object.assign(f.state,change);await passwordDenied(f,'password_rejected');}
 const f=fixture();await assert.rejects(confirmReviewedActionPassword(f.deps,{reference,password:secret,email:'other@example.invalid'}),ActionPasswordError);assert.equal(f.calls.length,0);
});
await check('original MFA, missing session and expired identity stop before password login',async()=>{
 for(const token of [jwt(originalSession,'aal2'),jwt('', 'aal1'),jwt(originalSession,'aal1',owner,Math.floor(now/1000)-1),jwt(originalSession,'aal1',id(99))]){const f=fixture();f.state.originalToken=token;await passwordDenied(f);assert(!has(f,'password-auth-only'));}
});
await check('fresh identity/AAL/session validation cannot mint proof for another or reused session',async()=>{
 for(const token of [jwt(originalSession),jwt(newSession,'aal2'),jwt(newSession,'aal1',id(99)),jwt(newSession,'aal1',owner,Math.floor(now/1000)-1)]){const f=fixture();f.state.freshToken=token;await passwordDenied(f);}
 const f=fixture();f.state.verifiedOwner=id(99);const result=await f.confirm();assert.equal(result.status,'failed');assert(result.session);assert(!has(f,'stamp_tenbot_action_password'));
});
await check('pending capability is nonexecuting even with a forged available projection',async()=>{
 const f=fixture();f.state.card.operation='inventory.create_pending_receivals';f.state.card.review={...f.state.card.review};delete f.state.card.review.preview;await passwordDenied(f,'unavailable');assert(!has(f,'password-auth-only'));
});
await check('blocked, failed, revoked, expired and already-authorized operations never reprompt or reuse proof',async()=>{
 for(const state of ['authorized','completed','failed','revoked','expired']){const f=fixture();f.state.state=state;await passwordDenied(f);assert(!has(f,'password-auth-only'));}
 const f=fixture();f.state.card.review.issues=[{code:'missing_evidence',message:'Review required.',blocking:true}];await passwordDenied(f);assert(!has(f,'password-auth-only'));
});
await check('stamp rejection and uncertainty retain private session and never start business execution',async()=>{
 for(const code of ['42501','22023','P0002','23505','XX000']){const f=fixture();f.state.stampError={code,message:secret};const result=await f.confirm();assert.equal(result.status,code==='XX000'?'uncertain':'failed');assert(result.session);assert(!has(f,'execute_tenbot_reviewed_action'));assert(!JSON.stringify(result).includes(secret));}
 const f=fixture();f.state.stampThrow=true;assert.equal((await f.confirm()).status,'uncertain');assert(!has(f,'execute_tenbot_reviewed_action'));
});
await check('definite business rollback is failed; transport and malformed response are uncertain with status recovery only',async()=>{
 const failed=fixture();failed.state.executeData={contract:'tenbot.actions.v1',kind:'action_failure',id:reference.id,hash,status:'failed'};const result=await failed.confirm();assert.equal(result.status,'failed');assert.equal(result.receipt,null);assert.equal(result.recovery.kind,'refresh_action');
 const lost=fixture();lost.state.executeThrow=true;assert.equal((await lost.confirm()).status,'uncertain');assert.equal(lost.calls.filter(x=>x.name==='execute_tenbot_reviewed_action').length,1);
 const malformed=fixture();malformed.state.executeData={ok:true};assert.equal((await malformed.confirm()).status,'uncertain');
});

const migrationPath='supabase/migrations/20261102120000_tenbot_reviewed_actions.sql',sql=readFileSync(migrationPath,'utf8');
await check('static migration safety: default OFF, private metadata, existing permissions and immutable exact intent',()=>{
 assert(sql.includes('proposal_enabled boolean not null default false'));assert(sql.includes('receivals_enabled boolean not null default false check(not receivals_enabled)'));
 assert(!/\b(?:create|alter|grant)\s+role\b/i.test(sql));assert(!/create or replace function/i.test(sql));assert(!/grant\s+(?:insert|update|delete|all)\b/i.test(sql));
 assert(sql.includes('enable row level security'));assert(sql.includes('from public,anon,authenticated,service_role'));
 for(const term of ['prepare_session_id','execution_session_id','conversation_id','content_hash','revision','invoice_receival_permission_epochs','not_after','auth.sessions','authorization_expires_at','policy_version'])assert(sql.includes(term));
 assert(sql.includes('tenbot_action_proposal_access_epoch after insert or update or delete'));assert(sql.includes('completed_at is null and failed_at is null and revoked_at is null'));
 assert(sql.includes("grant execute on function public.prepare_tenbot_reviewed_action(uuid,uuid,uuid,jsonb,uuid,text),public.stamp_tenbot_action_password(uuid,uuid,integer,text,uuid,uuid,text) to service_role"));
 const employeeGrant=sql.split('\n').find(line=>line.startsWith('grant execute on function')&&line.endsWith('to authenticated;'))!;assert(!employeeGrant.includes('prepare_tenbot_reviewed_action'));assert(!employeeGrant.includes('stamp_tenbot_action_password'));
 const prepare=sql.slice(sql.indexOf('create function public.prepare_tenbot_reviewed_action'),sql.indexOf('create function public.get_tenbot_reviewed_action'));assert(prepare.includes("auth.role() is distinct from 'service_role'"));assert(prepare.includes('tenbot_action_require_verified_owner(p_owner,p_session_id'));assert(!/set_config|set role/i.test(sql));
});
await check('static transaction boundary: canonical Proposal save, failure consumes proof, completed retry returns actual receipt',()=>{
 const execute=sql.slice(sql.indexOf('create function public.execute_tenbot_reviewed_action'),sql.indexOf('revoke all on function public.tenbot_action_control_changed'));
 assert(execute.includes('for update'));assert(execute.includes('proposal_id:=public.create_proposal()'));assert(execute.includes('public.save_proposal_v2_draft('));assert(execute.includes("if action.completed_at is not null then return public.tenbot_action_receipt(action,true)"));
 assert(execute.includes("exception when others then\n  update public.tenbot_reviewed_actions set failed_at="));assert(execute.includes("failure_code='business_rejected',authorization_consumed_at="));assert(execute.includes('committed_result=result'));
 assert(!/prepare_invoice_receival|approve_invoice_receival|mint_execution_permit|execute_invoice_receival|stage_tenbot_reviewed_receivals/.test(sql));
 assert(execute.indexOf("action.operation is distinct from 'proposal.save_draft'")<execute.indexOf('public.create_proposal()'));
 const auth=readFileSync('supabase/functions/_shared/tenbot-action-auth.ts','utf8');assert(!/console\.|JSON\.stringify|\.signOut\(|\.updateUser\(/.test(auth));
});
const report={passed:true,groups:checks.length,checks,mode:'Offline injected Auth/RPC contract tests and static SQL review only',actualNetworkCalls:0,actualDatabase:false,realPasswords:0,businessWrites:0,inferenceCalls:0,migration:{path:migrationPath,sha256:createHash('sha256').update(sql).digest('hex'),applied:false},requiredGate:'Actual isolated PostgreSQL role/RLS/lifecycle/concurrency/rollback validation remains required. Docker daemon unavailable in this pass.'};
const directory='/private/tmp/tenops-tenbot-reviewed-actions-20261102';mkdirSync(directory,{recursive:true,mode:0o700});writeFileSync(directory+'/offline.json',JSON.stringify(report,null,2)+'\n',{mode:0o600});console.log(JSON.stringify(report,null,2));
