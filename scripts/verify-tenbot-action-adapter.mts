/** Focused trusted-action contract/session checks. Synthetic Auth, no network or writes. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,readFileSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
import {ACTION_CONTRACT,actionRecordLink,parseActionCard,parseActionReceipt,parseActionReference,parseActionStatus,type ActionCard,type ActionReceipt,type ActionReference,type JsonValue} from '../src/modules/tenbot/actions/contract';
import {ActionAdapterError,createTrustedActionAdapter,unavailableActionAdapter,type ActionSessionSnapshot,type PrivateActionSession} from '../src/modules/tenbot/actions/adapter';

const owner='00000000-0000-4000-8000-000000000010',other='00000000-0000-4000-8000-000000000011',firstSession='00000000-0000-4000-8000-000000000020',freshSessionId='00000000-0000-4000-8000-000000000021';
const now=Date.parse('2026-11-02T18:00:00Z'),password='Synthetic-credential-never-log',checks:string[]=[];
const reference:ActionReference={id:'00000000-0000-4000-8000-000000000030',revision:1,hash:'a'.repeat(64),expiresAt:'2026-11-02T19:00:00Z'};
const card:ActionCard={kind:'proposed_action',contract:ACTION_CONTRACT,reference,operation:'proposal.save_draft',review:{title:'Save Proposal draft',summary:'Review this synthetic draft.',consequences:['Saves a draft only.'],fields:[{path:'project_name',label:'Project',value:'Synthetic lobby',editable:false}],issues:[],preview:{kind:'proposal_pdf'}},confirmation:{kind:'account_password',available:true}};
const receipt:ActionReceipt={contract:ACTION_CONTRACT,kind:'action_result',reference,operation:'proposal.save_draft',status:'completed',idempotent:false,result:{proposalId:'00000000-0000-4000-8000-000000000040',status:'draft',url:'/proposals?open=00000000-0000-4000-8000-000000000040'},completedAt:'2026-11-02T18:01:00Z'};
const token=(sub=owner,id=firstSession,aal='aal1',exp=now/1000+3600)=>`synthetic.${Buffer.from(JSON.stringify({sub,role:'authenticated',session_id:id,aal,exp})).toString('base64url')}.synthetic-signature`;
const originalToken=token(),renewedToken=token(owner,freshSessionId);
const privateLogin:PrivateActionSession={access_token:renewedToken,refresh_token:'synthetic-private-refresh-never-log',expires_at:now/1000+3600,token_type:'bearer'};
type Options={status?:'completed'|'failed'|'uncertain';statusValue?:unknown;confirmation?:unknown;onFetch?:(action:string)=>void;verifyUserId?:string;readError?:boolean;installError?:boolean;previewHeaders?:Record<string,string>;previewBody?:string};
function harness(options:Options={}){
 let current:ActionSessionSnapshot|null={ownerId:owner,accessToken:originalToken,contextKey:'owner-current-access'};
 const requests:{url:string;body:Record<string,unknown>;headers:Headers;cache:RequestCache|undefined}[]=[],installed:{session:PrivateActionSession;expected:ActionSessionSnapshot}[]=[];
 const adapter=createTrustedActionAdapter({enabled:true,functionUrl:'https://synthetic.supabase.co/functions/v1/tenbot',now:()=>now,session:{
  async read(){if(options.readError)throw Error(password);return current?{...current}:null;},
  async verifyUser(){return {id:options.verifyUserId??owner};},
  async installSession(session,expected){assert.deepEqual(current,expected);if(options.installError)throw Error(privateLogin.refresh_token);installed.push({session:{...session},expected:{...expected}});current={ownerId:owner,accessToken:session.access_token,contextKey:current!.contextKey};},
 },fetch:async(input,init)=>{
  const body=JSON.parse(String(init?.body)) as Record<string,unknown>,action=String(body.action);requests.push({url:String(input),body,headers:new Headers(init?.headers),cache:init?.cache});options.onFetch?.(action);
  if(action==='status')return Response.json(options.statusValue??{contract:ACTION_CONTRACT,card,state:'prepared',receipt:null});
  if(action==='preview')return new Response(options.previewBody??'%PDF-1.4\nSynthetic PDF\n%%EOF',{headers:options.previewHeaders??{'Content-Type':'application/pdf','Cache-Control':'private, no-store'}});
  if(action==='cancel')return Response.json({contract:ACTION_CONTRACT,kind:'action_cancelled',reference});
  const status=options.status??'completed';
  return Response.json(options.confirmation??{contract:ACTION_CONTRACT,reference,status,receipt:status==='completed'?receipt:null,session:privateLogin,recovery:{kind:'refresh_action',reference},...(status==='completed'?{}:{error:{code:'outcome_uncertain',message:'Synthetic unavailable'}})});
 }});
 return {adapter,requests,installed,setCurrent(value:ActionSessionSnapshot|null){current=value;}};
}

// Parse the immutable accepted backend source in scratch, not the concurrently dirty runtime.
const temporary=mkdtempSync(join(tmpdir(),'tenbot-action-contract-'));
const backendCommit='afa4bfa47319f5a74101e202a1b675ecf471a1b3';
const backendSource=execFileSync('git',['show',`${backendCommit}:supabase/functions/_shared/tenbot-actions.ts`],{encoding:'utf8'});
const backendPath=join(temporary,'tenbot-actions.ts');writeFileSync(backendPath,backendSource);
const backend=await import(pathToFileURL(backendPath).href) as {parseActionCard:(value:unknown)=>ActionCard;parseActionReference:(value:unknown)=>ActionReference;parseActionReceipt:(value:unknown,reference:ActionReference)=>ActionReceipt};
assert.deepEqual(parseActionCard(card),backend.parseActionCard(card));assert.deepEqual(parseActionReference(reference),backend.parseActionReference(reference));assert.deepEqual(parseActionReceipt(receipt,reference),backend.parseActionReceipt(receipt,reference));
for(const malformed of [{...card,contract:'other'}, {...card,review:{...card.review,consequences:'save'}}, {...card,confirmation:{kind:'password',available:true}}, {...card,reference:{...reference,revision:0}}, {...card,review:{...card.review,extra:true}}]){
 assert.throws(()=>parseActionCard(malformed));assert.throws(()=>backend.parseActionCard(malformed));
}
checks.push('Frontend card/reference/receipt projections match immutable accepted afa4bfa contract; representative malformed shapes fail');
assert.throws(()=>parseActionStatus({contract:ACTION_CONTRACT,card,state:'completed',receipt:null}));
assert.throws(()=>parseActionStatus({contract:ACTION_CONTRACT,card,state:'prepared',receipt}));
assert.throws(()=>parseActionStatus({contract:ACTION_CONTRACT,card,state:'completed',receipt:{...receipt,operation:'inventory.create_pending_receivals'}}));
assert.throws(()=>parseActionReceipt({...receipt,reference:{...reference,hash:'b'.repeat(64)}},reference));
checks.push('Receipt completion, exact reference and reviewed operation must agree');
assert.deepEqual(actionRecordLink(receipt),{href:receipt.result.url,label:'Open Proposal draft'});
const invalidProposalResults:Record<string,JsonValue>[]=[{}, {ok:true}, {...receipt.result,proposalId:'proposed-id'}, {...receipt.result,url:'https://evil.invalid'}, {...receipt.result,url:'//evil.invalid'}, {...receipt.result,url:'/proposals?open=wrong'}, {...receipt.result,status:'issued'}];
for(const result of invalidProposalResults)assert.equal(actionRecordLink({...receipt,result}),null);
assert.equal(actionRecordLink({...receipt,operation:'inventory.create_pending_receivals'}),null);
// Canonical Pending result is part of the accepted afa4bfa backend contract.
const pendingReceipt:ActionReceipt={...receipt,operation:'inventory.create_pending_receivals',result:{draftId:'00000000-0000-4000-8000-000000000050',hash:'b'.repeat(64),createdRecordIds:['00000000-0000-4000-8000-000000000051'],createdCatalogRecords:[],executedAt:'2026-11-02T18:01:00Z',idempotent:false,onHandChangedByCreation:false,url:'/inventory#pending-receivals'}};
assert.deepEqual(actionRecordLink(pendingReceipt),{href:'/inventory#pending-receivals',label:'Open Pending Receivals'});
assert.deepEqual(parseActionReceipt(pendingReceipt,reference),backend.parseActionReceipt(pendingReceipt,reference));
const invalidPendingResults=[{}, {ok:true}, ...[{url:'https://evil.invalid/inventory#pending-receivals'},{url:'//evil.invalid'},{url:'/inventory?open=proposed-id'},{onHandChangedByCreation:true},{createdRecordIds:[]},{createdRecordIds:['not-an-id']},{createdRecordIds:['00000000-0000-4000-8000-000000000051','00000000-0000-4000-8000-000000000051']},{createdRecordIds:Array(81).fill('00000000-0000-4000-8000-000000000051')},{draftId:'spoofed'},{hash:'bad'},{executedAt:'not-a-date'},{idempotent:'false'},{createdCatalogRecords:null}].map(changes=>({...pendingReceipt.result,...changes}))];
for(const result of invalidPendingResults)assert.equal(actionRecordLink({...pendingReceipt,result} as unknown as ActionReceipt),null);
checks.push('Created-record navigation validates canonical Proposal draft and Pending queue results, including zero on-hand change');
const pendingCard:ActionCard={...card,operation:pendingReceipt.operation,review:{...card.review,preview:undefined}};
for(const [reviewedCard,validReceipt,invalidResults] of [[card,receipt,invalidProposalResults],[pendingCard,pendingReceipt,invalidPendingResults]] as const){
 for(const result of invalidResults){
  const malformed={...validReceipt,result};
  assert.throws(()=>parseActionReceipt(malformed,reference));assert.throws(()=>backend.parseActionReceipt(malformed,reference));
  assert.throws(()=>parseActionStatus({contract:ACTION_CONTRACT,card:reviewedCard,state:'completed',receipt:malformed}));
  const h=harness({statusValue:{contract:ACTION_CONTRACT,card:reviewedCard,state:'prepared',receipt:null},confirmation:{contract:ACTION_CONTRACT,reference,status:'completed',receipt:malformed,session:privateLogin,recovery:{kind:'refresh_action',reference}}});
  await h.adapter.status(reference);
  await assert.rejects(h.adapter.confirm(reference,password),error=>error instanceof ActionAdapterError&&error.code==='invalid_response');
  assert.equal(h.installed.length,1);assert.equal(h.requests.filter(request=>request.body.action==='confirm').length,1);
  await assert.rejects(h.adapter.confirm(reference,password),/changed/);
 }
}
checks.push('Malformed Proposal/Pending canonical results fail backend/frontend parity, completed history and confirmation without success or replay; valid private Auth handoff survives');

await assert.rejects(unavailableActionAdapter.confirm(reference,password),/not connected/);
assert.equal(createTrustedActionAdapter({functionUrl:'https://synthetic.supabase.co/functions/v1/tenbot',session:{read:async()=>null,verifyUser:async()=>null,installSession:async()=>{throw Error('must not run');}}}).availability,'unavailable');
checks.push('No implicit hosted connection or confirmation path; default adapter remains unavailable');
for(const status of ['completed','failed','uncertain'] as const){
 const h=harness({status});await h.adapter.status(reference);const result=await h.adapter.confirm(reference,password);
 assert.equal(result.status,status);assert.equal(h.installed.length,1);assert.equal(h.installed[0].session.access_token,renewedToken);assert.equal(h.installed[0].expected.accessToken,originalToken);
 assert.equal(result.receipt?.kind,status==='completed'?'action_result':undefined);
 for(const secret of [password,originalToken,renewedToken,privateLogin.refresh_token])assert(!JSON.stringify(result).includes(secret));
 assert.equal(h.requests.filter(request=>request.body.action==='confirm').length,1);
 const request=h.requests.at(-1)!;assert.equal(request.body.workspace,ACTION_CONTRACT);assert.equal(request.body.password,password);assert.equal(request.cache,'no-store');assert.equal(request.headers.get('Authorization'),'Bearer '+originalToken);
 assert.deepEqual(Object.keys(request.body).sort(),['action','password','reference','workspace']);
 assert(!JSON.stringify(h.requests[0].body).includes(password));
  await assert.rejects(h.adapter.confirm(reference,password),/changed/);assert.equal(h.requests.filter(request=>request.body.action==='confirm').length,1);
}
checks.push('Successful, failed and uncertain outcomes install the fresh same-owner Auth session; UI results contain no credentials/tokens and cached confirmation is consumed');
const notReviewed=harness();await assert.rejects(notReviewed.adapter.confirm(reference,password),/changed/);assert.equal(notReviewed.requests.length,0);
checks.push('Confirmation requires exact prior status review to bind receipt operation');

for(const changed of [{ownerId:other,accessToken:token(other),contextKey:'other'}, {ownerId:owner,accessToken:token(owner,'00000000-0000-4000-8000-000000000022'),contextKey:'owner-current-access'}, {ownerId:owner,accessToken:originalToken,contextKey:'changed-permissions'}]){
 const h=harness({onFetch(action){if(action==='confirm')h.setCurrent(changed);}});await h.adapter.status(reference);await assert.rejects(h.adapter.confirm(reference,password),/session changed/);assert.equal(h.installed.length,0);
 const before=harness();await before.adapter.status(reference);before.setCurrent(changed);await assert.rejects(before.adapter.confirm(reference,password),/session changed/);assert.equal(before.requests.filter(request=>request.body.action==='confirm').length,0);
}
checks.push('Status review is owner/token/access-bound; changes before confirmation prevent credential transport and changes during it prevent stale session installation');
for(const statusValue of [{contract:ACTION_CONTRACT,card,state:'failed',receipt:null},{contract:ACTION_CONTRACT,card:{...card,confirmation:{...card.confirmation,available:false}},state:'prepared',receipt:null},{contract:ACTION_CONTRACT,card:{...card,review:{...card.review,issues:[{code:'missing',message:'Missing details',blocking:true}]}},state:'prepared',receipt:null}]){
 const h=harness({statusValue});await h.adapter.status(reference);await assert.rejects(h.adapter.confirm(reference,password),/changed/);assert.equal(h.requests.filter(request=>request.body.action==='confirm').length,0);
}
checks.push('Nonprepared, unavailable and blocking-issue status disables confirmation before any credential transport');
for(const session of [{...privateLogin,access_token:token(other,freshSessionId)}, {...privateLogin,access_token:token(owner,freshSessionId,'aal2')}, {...privateLogin,access_token:originalToken}, {...privateLogin,expires_at:now/1000-1}]){
 const h=harness({confirmation:{contract:ACTION_CONTRACT,reference,status:'completed',receipt,session,recovery:{kind:'refresh_action',reference}}});await h.adapter.status(reference);await assert.rejects(h.adapter.confirm(reference,password));assert.equal(h.installed.length,0);
}
const wrongVerified=harness({verifyUserId:other});await wrongVerified.adapter.status(reference);await assert.rejects(wrongVerified.adapter.confirm(reference,password));assert.equal(wrongVerified.installed.length,0);
checks.push('New session claims, freshness, expiry, AAL and verified Auth owner are checked before installation');
for(const confirmation of [receipt,{contract:ACTION_CONTRACT,reference:{...reference,revision:2},status:'completed',receipt,session:privateLogin,recovery:{kind:'refresh_action',reference}}]){
 const h=harness({confirmation});await h.adapter.status(reference);await assert.rejects(h.adapter.confirm(reference,password));assert.equal(h.installed.length,0);
}
for(const invalidReceipt of [{...receipt,operation:'inventory.create_pending_receivals'},null,{...receipt,status:'claimed'}]){
 const h=harness({confirmation:{contract:ACTION_CONTRACT,reference,status:'completed',receipt:invalidReceipt,session:privateLogin,recovery:{kind:'refresh_action',reference}}});await h.adapter.status(reference);await assert.rejects(h.adapter.confirm(reference,password),error=>error instanceof ActionAdapterError&&error.code==='invalid_response');assert.equal(h.installed.length,1);await assert.rejects(h.adapter.confirm(reference,password),/changed/);
}
checks.push('Invalid outer envelopes/reference prevent handoff; valid same-owner fresh Auth session survives malformed business receipt without announcing success');
const refreshOptions:Options={},refresh=harness(refreshOptions);await refresh.adapter.status(reference);refreshOptions.statusValue={contract:ACTION_CONTRACT,kind:'action_error'};await assert.rejects(refresh.adapter.status(reference));await assert.rejects(refresh.adapter.confirm(reference,password),/changed/);assert.equal(refresh.requests.filter(request=>request.body.action==='confirm').length,0);
const cancelled=harness();await cancelled.adapter.status(reference);await cancelled.adapter.cancel(reference);await assert.rejects(cancelled.adapter.confirm(reference,password),/changed/);assert.equal(cancelled.requests.filter(request=>request.body.action==='confirm').length,0);
checks.push('Cancelled actions and failed status refreshes consume stale cached confirmation before any credential call');
for(const options of [{readError:true},{installError:true}]){
 const h=harness(options);if(!options.readError)await h.adapter.status(reference);
 try{if(options.readError)await h.adapter.status(reference);else await h.adapter.confirm(reference,password);assert.fail('must reject');}catch(error){assert(error instanceof ActionAdapterError);assert(!String(error).includes(password));assert(!String(error).includes(privateLogin.refresh_token));}
}
checks.push('Raw Auth/dependency errors never escape as browser diagnostics or credential-bearing messages');
const rejected=createTrustedActionAdapter({enabled:true,functionUrl:'https://synthetic.supabase.co/functions/v1/tenbot',now:()=>now,session:{read:async()=>({ownerId:owner,accessToken:originalToken,contextKey:'current'}),verifyUser:async()=>({id:owner}),installSession:async()=>assert.fail('not installed')},fetch:async()=>Response.json({contract:ACTION_CONTRACT,kind:'action_error',error:{code:'password_rejected',message:password}},{status:401})});
await assert.rejects(rejected.status(reference),error=>error instanceof ActionAdapterError&&error.code==='password_rejected'&&!error.message.includes(password));
checks.push('Only whitelisted safe error messages are shown, even if a backend error body contains submitted secrets');

const h=harness();const blob=await h.adapter.preview(reference);assert.equal(await blob.slice(0,5).text(),'%PDF-');await h.adapter.cancel(reference);
assert.deepEqual(h.requests.map(request=>Object.keys(request.body).sort()),[['action','reference','workspace'],['action','reference','workspace']]);
for(const options of [{previewHeaders:{'Content-Type':'text/html','Cache-Control':'no-store'}},{previewHeaders:{'Content-Type':'application/pdf'}},{previewBody:'not a PDF'}] as Options[]){
 await assert.rejects(harness(options).adapter.preview(reference));
}
checks.push('Preview uses authenticated exact-reference PDF/no-store transport; wrong formats/caching and invalid PDF bytes are rejected');
const expired=harness();await assert.rejects(expired.adapter.preview({...reference,expiresAt:'2026-11-02T17:00:00Z'}),/changed/);assert.equal(expired.requests.length,0);
const aborted=harness(),controller=new AbortController();controller.abort();await assert.rejects(aborted.adapter.preview(reference,controller.signal));assert.equal(aborted.requests.length,0);
checks.push('Expired previews and already-aborted requests do not issue network calls');

const bridge=readFileSync('src/modules/tenbot/actions/ActionWorkspaceBridge.tsx','utf8');
const endpointSource=bridge.slice(bridge.indexOf('export function configuredActionEndpoint()'),bridge.indexOf('/** Decode only an opaque lifecycle discriminator.'));
assert(endpointSource.startsWith('export function configuredActionEndpoint()'));
const endpointCode=ts.transpileModule(endpointSource.replace('export function','function'),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
const endpoint=(origin:string,enabled='true',project='https://synthetic.supabase.co')=>new Function('process','window',endpointCode+'; return configuredActionEndpoint();')({env:{NEXT_PUBLIC_TENBOT_ACTIONS_ENABLED:enabled,NEXT_PUBLIC_SUPABASE_URL:project}},{location:{origin,hostname:new URL(origin).hostname}}) as string|null;
for(const origin of ['https://tenops.pages.dev','https://tendev.pages.dev'])assert.equal(endpoint(origin),'https://synthetic.supabase.co/functions/v1/tenbot');
for(const origin of ['https://tenops.pages.dev:444','https://tenops.pages.dev.evil.test','http://tenops.pages.dev','https://tendev.pages.dev.evil.test'])assert.equal(endpoint(origin),null);
assert.equal(endpoint('https://tenops.pages.dev','false'),null);assert.equal(endpoint('https://tenops.pages.dev','true','http://synthetic.supabase.co'),null);
checks.push('Actual frontend endpoint function enables only exact hosted TenOps/TenDev origins with the existing flag and HTTPS project');
const source=readFileSync('src/modules/tenbot/actions/adapter.ts','utf8');assert(!source.includes('console.'));assert(!source.includes('localStorage'));assert(!source.includes('sessionStorage'));assert(!source.includes('signInWithPassword'));
console.log(JSON.stringify({passed:true,checks,groups:checks.length,backendContract:backendCommit,syntheticAuth:true,hostedCalls:0,createdRecords:0,inferenceCalls:0,scratch:temporary}));
