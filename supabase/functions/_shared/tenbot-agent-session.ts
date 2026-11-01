// Server-owned, bounded assistant state. Only proven static workflow/scope turns
// and lookup selectors may reach model context. Short-lived operational display
// receipts remain separate, owner-bound, and reauthorized before publication.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- shared Deno/Node source
// @ts-ignore -- explicit extensions for Edge compatibility.
import {runTenbotAgent,type AgentProvider,type AgentStep,type JsonValue} from './tenbot-agent.ts';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- shared Deno/Node source
// @ts-ignore -- explicit extensions for Edge compatibility.
import type {InvestigationDiagnosticSink} from './tenbot-investigation-diagnostics.ts';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- shared Deno/Node source
// @ts-ignore -- explicit extensions for Edge compatibility.
import {createTenbotAgentJobTools,createTenbotAgentKnowledgeTools,createTenbotAgentScopeTool} from './tenbot-agent-operations.ts';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- shared Deno/Node source
// @ts-ignore -- explicit extensions for Edge compatibility.
import {createTenbotInvoiceTools,type TenbotInvoiceDocument,type TenbotInvoiceReader,type InvoiceConfirmation} from './tenbot-invoice.ts';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- shared Deno/Node source
// @ts-ignore -- explicit extensions for Edge compatibility.
import {resolveInput,TenbotError} from './tenbot-core.ts';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- shared Deno/Node source
// @ts-ignore -- explicit extensions for Edge compatibility.
import type {JobTools} from './tenbot-job-session.ts';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- shared Deno/Node source
// @ts-ignore -- explicit extensions for Edge compatibility.
import {hasGuidePermission,publishedKnowledgeSource,knowledgeProofValue} from './tenbot-knowledge.ts';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- shared Node/Deno source
// @ts-ignore -- explicit extensions for Edge compatibility.
import {agentKnowledgeEntries,agentKnowledgeSnapshot as snapshot} from './tenbot-agent-knowledge.ts';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- shared Deno/Node source
// @ts-ignore -- explicit extensions for Edge compatibility.
import {type AgentSessionStore,type AgentSessionLease,type StoredAgentState,validateStoredAgentState} from './tenbot-agent-history-store.ts';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- shared Edge/Node source
// @ts-ignore -- explicit extension required by Deno.
import {contextFromReads,currentConversationContext,conversationContextHint,workflowConversationContext,type ConversationContext} from './tenbot-conversation-context.ts';

// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- Edge/Node shared source
// @ts-ignore -- explicit Edge extension.
import {operationalReceipt,operationalHistoryMeta,restoreOperationalHistory,type OperationalReceipt} from './tenbot-operational-history.ts';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- shared Edge/Node source
// @ts-ignore -- explicit extension for Deno.
import {resolveJobIntent,isJobFollowupReference} from './tenbot-job-routing.ts';
export type AgentDemoScenario='job-investigation'|'invoice-preparation'|'tool-recovery';
export type AgentSessionDependencies={
 can(owner:string,capability:string):Promise<boolean>;
 jobTools(owner:string):JobTools;
 provider(scenario:AgentDemoScenario):AgentProvider;
 mode:'offline-scripted'|'openai';
 invoice?:{document:TenbotInvoiceDocument;reader(owner:string):TenbotInvoiceReader};
 readOnlyHosted?:boolean;
 /** Server-only staged transport gate; legacy clients never receive private live history. */
 operationalHistory?:boolean;
 sessionStore?:AgentSessionStore;
 now?:()=>number;
 onDiagnostic?:InvestigationDiagnosticSink;
 /** Server-only preparation authority. Grants no durable approval or execution. */
 canPrepareInvoice?(owner:string):Promise<boolean>;
 /** Existing Qwen path, inside the same claimed owner conversation. */
 fallback?(body:Record<string,unknown>,tools:JobTools,context:ConversationContext|null,history:string[]):Promise<unknown>;
};
type KnowledgeProof={id:string;digest:string};
type GuidanceTurn={question:string;answer:string;sources:KnowledgeProof[]};
type DisplayAnswer={conversationId:string;mode:'agent-experiment'|'assistant';contentScope:'workflow'|'scope';message:string;sources:never[];snapshot:{revision:string;verifiedAt:string};summary:null;suggestionAllowed:false;notices:never[]};
type DisplayTurn={id:string;question:string;createdAt:string;answeredAt:string;answer:DisplayAnswer;sources:KnowledgeProof[];scopeDigest:string};
type Session={owner:string;touched:number;questions:string[];guidance:GuidanceTurn[];display:DisplayTurn[];jobIds:string[];context:ConversationContext|null;operational:OperationalReceipt[];invoiceAttached:boolean;confirmation:InvoiceConfirmation;busy:boolean};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const record=(value:unknown):value is Record<string,unknown>=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const json=(value:unknown)=>JSON.parse(JSON.stringify(value)) as JsonValue;
async function sourceDigest(source:unknown,version:unknown){
 const bytes=new TextEncoder().encode(JSON.stringify({snapshot:version,source}));
 const digest=await crypto.subtle.digest('SHA-256',bytes);
 return Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
}
export class HostedAgentUnavailable extends Error {
 constructor(public readonly conversationId:string,public readonly reason:string){super('TenBot primary provider is unavailable.');this.name='HostedAgentUnavailable';}
}
export function createTenbotAgentSessions(deps:AgentSessionDependencies){
 if(deps.sessionStore&&!deps.readOnlyHosted)throw new Error('Durable assistant sessions require read-only hosted mode.');
 if(deps.readOnlyHosted&&!deps.sessionStore)throw new Error('Hosted assistant sessions require durable storage.');
 const responseMode=deps.readOnlyHosted?'assistant':'agent-experiment';
 const operationalEnabled=deps.operationalHistory!==false;
 // Keep unexpired private receipts from a newer client without publishing them
 // to the old UI. This gate grants no read, tool or storage authority.
 const restoreHistory:typeof restoreOperationalHistory=(...args)=>operationalEnabled?restoreOperationalHistory(...args):Promise.resolve({kept:args[0].filter(t=>Date.parse(t.expiresAt)>args[2]),turns:[]});
 const storedState=(session:Session):StoredAgentState=>({guidance:structuredClone(session.guidance),display:structuredClone(session.display),...(session.operational.length?{operational:structuredClone(session.operational)}:{}),...(session.context?{context:structuredClone(session.context)}:{})});
 const sessions=new Map<string,Session>(),now=deps.now??Date.now;
 const publicationAllowed=async(check:()=>Promise<boolean>)=>{
  let timer:ReturnType<typeof setTimeout>|undefined;
  try{return await Promise.race([check().catch(()=>false),new Promise<boolean>(resolve=>{timer=setTimeout(()=>resolve(false),15000);})]);}
  finally{if(timer!==undefined)clearTimeout(timer);}
 };
 const sourceIsCurrent=async(proof:KnowledgeProof,owner:string)=>{
  const entry=agentKnowledgeEntries().find(item=>item.id===proof.id);
  if(!entry||entry.status!=='deployed'||await sourceDigest(knowledgeProofValue(entry),snapshot)!==proof.digest)return false;
  const permissions=new Set<string>();
  for(const capability of [entry.permission,...entry.additionalPermissions??[]])if(await deps.can(owner,capability))permissions.add(capability);
  return hasGuidePermission(entry,permissions);
 };
 // Registry descriptors and hard limits are host data, not a Job/catalog read.
 // The same proof is bound to every retained display turn and checked on load.
 const scopeDigest=async(owner:string)=>{
  const tools=[...createTenbotAgentJobTools(deps.jobTools(owner)).tools,...createTenbotAgentKnowledgeTools(capability=>deps.can(owner,capability))];
  const scope=createTenbotAgentScopeTool(tools);
  return sourceDigest((await scope.execute({}, {callerId:owner,signal:new AbortController().signal})).data,'tenbot-agent-display-scope.v1');
 };
 return async(body:Record<string,unknown>,owner:string)=>{
  if(!owner||!await deps.can(owner,'readOperationalData'))throw new TenbotError('Your account is not authorized.',403);
  for(const [id,session] of sessions)if(now()-session.touched>3600000&&!session.busy)sessions.delete(id);
  if(Object.keys(body).some(key=>!(deps.readOnlyHosted?['action','question','context','conversationId']:['action','question','context','conversationId','invoiceId','orderDetails','demoScenario']).includes(key)))throw new TenbotError('Invalid experimental request.');
  if(!['ask','clear','history'].includes(String(body.action)))throw new TenbotError('The experiment supports questions, history and clearing only. No execution action exists.');
  const supplied=body.conversationId;
  if(supplied!==undefined&&(typeof supplied!=='string'||!uuid.test(supplied)))throw new TenbotError('Invalid conversation request.');
  if(deps.readOnlyHosted){
   if(body.action==='ask')resolveInput(body);
   else if(Object.keys(body).some(key=>!['action','conversationId'].includes(key))||!supplied)throw new TenbotError('Invalid conversation request.');
  }
  if(deps.sessionStore&&body.action==='clear'){
   if(typeof supplied!=='string')throw new TenbotError('Invalid conversation request.');
   await deps.sessionStore.clear(owner,supplied);return {cleared:true};
  }
  let lease:AgentSessionLease|undefined,committed=false,fallbackAttempted=false;
  if(deps.sessionStore){
   lease=await deps.sessionStore.claim(owner,typeof supplied==='string'?supplied:undefined);
   if(!validateStoredAgentState(lease.state))throw new TenbotError('Conversation storage is unavailable.',503);
   sessions.set(lease.id,{owner,touched:lease.expiresAt-3600000,questions:lease.state.guidance.map(turn=>turn.question),guidance:structuredClone(lease.state.guidance),display:structuredClone(lease.state.display),jobIds:[],context:lease.state.context??null,operational:structuredClone(lease.state.operational??[]),invoiceAttached:false,confirmation:{},busy:false});
  }
  try{
  let session=lease?sessions.get(lease.id):typeof supplied==='string'?sessions.get(supplied):undefined;
  if(supplied&&(!session||session.owner!==owner))throw new TenbotError('Conversation unavailable. Reopen TenBot and retry.',403);
  if(body.action==='clear'){
   if(session?.busy)throw new TenbotError('Conversation changed. Retry after the current request.',409);
   if(typeof supplied==='string')sessions.delete(supplied);
   return {cleared:true};
  }
  if(body.action==='history'){
   if(Object.keys(body).some(key=>!['action','conversationId'].includes(key))||!supplied)throw new TenbotError('Invalid experimental history request.');
   if(!session)throw new TenbotError('Conversation unavailable. Reopen TenBot and retry.',403);
   if(session.busy)throw new TenbotError('A request is already running in this conversation.',409);
   session.busy=true;
   try{
    session.context=await currentConversationContext(session.context,now(),deps.jobTools(owner),proof=>sourceIsCurrent(proof,owner));
    const currentScope=await scopeDigest(owner),retained:DisplayTurn[]=[];
    for(const turn of session.display){
     if(turn.scopeDigest!==currentScope)continue;
     let current=true;for(const proof of turn.sources)if(!await sourceIsCurrent(proof,owner)){current=false;break;}
     if(current)retained.push(turn);
    }
    // Recheck immediately before publication. Hydration never renews expiry,
    // invokes a provider or resurrects records excluded from display history.
    const finalScope=await scopeDigest(owner),published:DisplayTurn[]=[];
    for(const turn of retained){
     if(turn.scopeDigest!==finalScope)continue;
     let current=true;for(const proof of turn.sources)if(!await sourceIsCurrent(proof,owner)){current=false;break;}
     if(current)published.push(turn);
    }
    if(!await deps.can(owner,'readOperationalData'))throw new TenbotError('Your account is not authorized.',403);
    if(now()-session.touched>3600000||sessions.get(supplied as string)!==session)throw new TenbotError('Conversation unavailable. Reopen TenBot and retry.',403);
    session.display=published;
    const restored=await restoreHistory(session.operational,deps.jobTools(owner),now(),finalScope,String(supplied),responseMode,p=>sourceIsCurrent(p,owner));
    session.operational=restored.kept;
    let operationalTurns=restored.turns;
    if(lease){await deps.sessionStore!.commit(lease,storedState(session),false);committed=true;}
    // Storage is asynchronous. A successful commit is not evidence that source
    // grants or account access remained current while it was pending.
    if(deps.readOnlyHosted&&!await publicationAllowed(async()=>{
     if(!await deps.can(owner,'readOperationalData')||lease&&now()>=lease.expiresAt||await scopeDigest(owner)!==finalScope)return false;
     for(const turn of published)for(const proof of turn.sources)if(!await sourceIsCurrent(proof,owner))return false;
     operationalTurns=(await restoreHistory(restored.kept,deps.jobTools(owner),now(),finalScope,String(supplied),responseMode,p=>sourceIsCurrent(p,owner))).turns.concat(restored.turns.filter(t=>t.answer.history.state==='redacted'));
     return await scopeDigest(owner)===finalScope&&deps.can(owner,'readOperationalData');
    }))throw new TenbotError('Your access or the underlying records changed. No answer was published.',403);
    return {conversationId:supplied,mode:responseMode,turns:[...published.map(({id,question,createdAt,answeredAt,answer})=>({id,question,createdAt,answeredAt,answer:structuredClone(answer)})),...operationalTurns].sort((a,b)=>a.createdAt.localeCompare(b.createdAt)).slice(-8)};
   }finally{session.busy=false;}
  }
  // Preserve the existing input/privacy contract without using its intent router.
  const {question}=resolveInput(body);
  const scenario=body.demoScenario??'job-investigation';
  if(!['job-investigation','invoice-preparation','tool-recovery'].includes(String(scenario)))throw new TenbotError('Invalid demonstration scenario.');
  if(body.invoiceId!==undefined&&body.invoiceId!==deps.invoice?.document.id)throw new TenbotError('Only the supplied synthetic invoice is available.');
  let details:InvoiceConfirmation|undefined;
  if(body.orderDetails!==undefined){
   if(!record(body.orderDetails)||Object.keys(body.orderDetails).some(key=>!['orderedBy','orderDate','location'].includes(key)))throw new TenbotError('Invalid order details.');
   for(const value of Object.values(body.orderDetails))if(typeof value!=='string'||value.length>120||/[\u0000-\u001f\u007f]/.test(value))throw new TenbotError('Invalid order details.');
   details=body.orderDetails as InvoiceConfirmation;
  }
  if(session?.busy)throw new TenbotError('A request is already running in this conversation.',409);
  if(!session){
   // Bound in-memory owner sessions; do not evict another account's active work.
   if(sessions.size>=100)throw new TenbotError('Local experiment session limit reached.',429);
   session={owner,touched:now(),questions:[],guidance:[],display:[],jobIds:[],context:null,operational:[],invoiceAttached:false,confirmation:{},busy:false};
  }
  const id=lease?.id??(typeof supplied==='string'?supplied:crypto.randomUUID());sessions.set(id,session);
  session.operational=session.operational.filter(t=>Date.parse(t.expiresAt)>now());
  session.touched=now();session.busy=true;
  const createdAt=new Date(now()).toISOString();
  try{
   if(body.invoiceId!==undefined){session.invoiceAttached=true;session.guidance=[];session.context=null;}
   if(details)session.confirmation={...session.confirmation,...details};
   const can=(capability:string)=>deps.can(owner,capability);
   session.context=await currentConversationContext(session.context,now(),deps.jobTools(owner),proof=>sourceIsCurrent(proof,owner));
   const priorContext=session.context;
   const followup=deps.readOnlyHosted&&session.context?.subject==='Production'&&isJobFollowupReference(question)?resolveJobIntent(question,{jobId:'',continuity:session.context},new Date(now())):null;
   const job=createTenbotAgentJobTools(deps.jobTools(owner),followup?.kind==='search'?{intent:followup,question}:undefined);
   const mayPrepareNow=()=>deps.canPrepareInvoice?deps.canPrepareInvoice(owner):(async()=>await can('writeBusinessData')&&await can('adjustInventory'))();
   const mayPrepare=!deps.readOnlyHosted&&await mayPrepareNow();
   const sourceReader=deps.readOnlyHosted?undefined:deps.invoice?.reader(owner),invoiceReads=new Map<string,string>();let inconsistentInvoice=false;
   const remember=(query:string,value:unknown)=>{const serialized=JSON.stringify(value),previous=invoiceReads.get(query);if(previous!==undefined&&previous!==serialized)inconsistentInvoice=true;if(previous===undefined)invoiceReads.set(query,serialized);};
   const reader:TenbotInvoiceReader={async searchCatalog(query,signal){if(!sourceReader)throw new TenbotError('Invoice tools are unavailable.');const value=await sourceReader.searchCatalog(query,signal);remember(query,value);return value;},async readReceivals(signal){if(!sourceReader)throw new TenbotError('Invoice tools are unavailable.');const value=await sourceReader.readReceivals(signal);remember('',value);return value;}};
   const invoice=session.invoiceAttached&&deps.invoice&&!deps.readOnlyHosted?createTenbotInvoiceTools({callerId:owner,document:deps.invoice.document,reader,confirmation:session.confirmation}):[];
   let prepared=false;
   for(const tool of invoice)if(tool.kind==='prepare'){
    const execute=tool.execute;tool.execute=async(args,context)=>{const value=await execute(args,context);prepared=true;return value;};
   }
   const knowledgeGrants=new Set<string>(),knowledgeProofs=new Map<string,KnowledgeProof>();
   const proofIsCurrent=async(proof:KnowledgeProof)=>{
    const entry=agentKnowledgeEntries().find(item=>item.id===proof.id);
    if(!entry||!await sourceIsCurrent(proof,owner))return false;
    const permissions=new Set<string>();
    for(const capability of [entry.permission,...entry.additionalPermissions??[]])if(await can(capability)){permissions.add(capability);knowledgeGrants.add(capability);}
    return hasGuidePermission(entry,permissions);
   };
   // Reauthorize and compare sources before any old assistant prose reaches a model.
   const retainedGuidance:GuidanceTurn[]=[];
   const checkedSources=new Map<string,boolean>();
   for(const turn of session.guidance){
    let current=true;for(const proof of turn.sources){const key=proof.id+':'+proof.digest;if(!checkedSources.has(key))checkedSources.set(key,await proofIsCurrent(proof));if(!checkedSources.get(key)){current=false;break;}}
    if(current)retainedGuidance.push(turn);
   }
   session.guidance=retainedGuidance;
   if(deps.readOnlyHosted)session.questions=retainedGuidance.map(turn=>turn.question);
   const knowledge=createTenbotAgentKnowledgeTools(can,()=>[...job.tools,...invoice.filter(tool=>tool.kind==='read'||mayPrepare)]);
   for(const tool of knowledge){
    const execute=tool.execute;tool.execute=async(args,context)=>{
     const value=await execute(args,context);
     if(record(value.data)&&Array.isArray(value.data.sources))for(const source of value.data.sources){
      if(record(source)&&typeof source.id==='string'){
       const entry=agentKnowledgeEntries().find(item=>item.id===source.id);
       if(!entry||JSON.stringify(publishedKnowledgeSource(entry))!==JSON.stringify(source))throw new TenbotError('Knowledge evidence changed. Please retry.',409);
       for(const capability of [entry.permission,...entry.additionalPermissions??[]]){
        if(!await can(capability))throw new TenbotError('Knowledge access changed. Please retry.',403);
        knowledgeGrants.add(capability);
       }
       knowledgeProofs.set(source.id,{id:source.id,digest:await sourceDigest(knowledgeProofValue(entry,source),value.data.snapshot)});
      }
     }
     return value;
    };
   }
   const tools=[...job.tools,...knowledge,...invoice.filter(tool=>tool.kind==='read'||mayPrepare)];
   tools.push(createTenbotAgentScopeTool(tools));
   const provider=deps.provider(scenario as AgentDemoScenario);
   const modelSteps:{calls:AgentStep['calls'];final?:JsonValue;usage:AgentStep['usage'];durationMs:number}[]=[];
   const measured:AgentProvider={name:provider.name,model:provider.model,async step(request){
    const start=now(),step=await provider.step(request);
    modelSteps.push({calls:step.calls,...(step.final===undefined?{}:{final:json(step.final)}),usage:step.usage,durationMs:now()-start});
    return step;
   }};
   const before=now();
   const retainedContext=session.questions.slice(-3).map(previous=>{
    const turn=[...session!.guidance].reverse().find(item=>item.question===previous);
    return {question:previous,answer:turn?'Prior assistant workflow guidance, retained only as conversation context. Re-fetch current knowledge and cite newly issued evidence IDs before giving guidance: '+turn.answer:'Previous live answer omitted. Reauthorize and reread all operational facts. Canonical lookup seeds: '+session!.jobIds.join(', ')};
   });
   if(session.context)retainedContext.push({question:'Current conversation subject',answer:conversationContextHint(session.context)});
   if(session.invoiceAttached&&deps.invoice)retainedContext.push({question:'Employee explicitly attached '+deps.invoice.document.filename,answer:(deps.invoice.document.extraction?'Actual OpenAI image preprocessing produced this transcription. Check read_invoice extraction provenance and compare it against the original image. ':'Synthetic text fixture only. ')+'Order details explicitly supplied by this employee: '+JSON.stringify(session.confirmation)+'. Invoice date is not order date. Missing fields remain unknown.'});
   const result=await runTenbotAgent({question,serverContext:retainedContext},{callerId:owner,provider:measured,tools,onDiagnostic:deps.onDiagnostic,...(deps.readOnlyHosted?{limits:{maxDurationMs:75000}}:{}),async authorize(check){
    if(!await can('readOperationalData'))return false;
    // Do not retransmit retained guidance after a grant/version changes mid-turn.
    if(check.phase==='before_model'){
     const proofs=new Map(session!.guidance.flatMap(turn=>turn.sources).map(proof=>[proof.id+':'+proof.digest,proof]));
     for(const proof of proofs.values())if(!await proofIsCurrent(proof))return false;
    }
    if(check.tool==='prepare_pending_receivals'&&!await mayPrepareNow())return false;
    if(check.phase==='publish'){
     if(inconsistentInvoice)return false;
     for(const capability of knowledgeGrants)if(!await can(capability))return false;
     const proofs=new Map([...knowledgeProofs.values(),...session!.guidance.flatMap(turn=>turn.sources)].map(proof=>[proof.id+':'+proof.digest,proof]));
     for(const proof of proofs.values())if(!await proofIsCurrent(proof))return false;
     if(prepared&&!await mayPrepareNow())return false;
     if(!await job.fresh())return false;
     const deadline=new AbortController(),timer=setTimeout(()=>deadline.abort(),4000);
     try{for(const [query,previous] of invoiceReads){if(!sourceReader)return false;const fresh=query?await sourceReader.searchCatalog(query,deadline.signal):await sourceReader.readReceivals(deadline.signal);if(JSON.stringify(fresh)!==previous)return false;}}catch{return false;}finally{clearTimeout(timer);deadline.abort();}
     if(!await can('readOperationalData')||prepared&&!await mayPrepareNow())return false;
     for(const capability of knowledgeGrants)if(!await can(capability))return false;
    }
    return true;
   }});
   if(deps.readOnlyHosted&&(result.status==='provider-unavailable'||result.status==='limit'&&result.reason==='cost-limit')){
    if(!deps.fallback)throw new HostedAgentUnavailable(id,result.reason??'provider-unavailable');
    const fallbackProofs=session.guidance.flatMap(t=>t.sources);
    const history=session.guidance.length?['Conversation context:\n'+session.guidance.map(t=>`Employee: ${t.question}\nTenBot: ${t.answer}`).join('\n')]:[];
    fallbackAttempted=true;
    const fallback=await deps.fallback({...body,conversationId:id},{execute:job.execute},session.context,history);
    // The canonical legacy handler appended exactly one turn and advanced the
    // shared conversation revision under our existing claim. Never reclaim or
    // guess another caller's revision; a stale commit fails its original CAS.
    if(lease)lease={...lease,revision:lease.revision+1};
    if(!record(fallback)||typeof fallback.message!=='string'||!Array.isArray(fallback.sources))throw new TenbotError('Invalid fallback answer.',503);
    const sourceProofs:KnowledgeProof[]=[];let sourceReviewFailed=false;
    if(!job.reads().length&&!fallback.operational)for(const source of fallback.sources){
     if(!record(source)||typeof source.id!=='string'){sourceReviewFailed=true;break;}
     const entry=agentKnowledgeEntries().find(x=>x.id===source.id),published=entry?publishedKnowledgeSource(entry):null;
     if(!entry||!published||source.guidance!==published.guidance||source.route!==published.route){sourceReviewFailed=true;break;}
     const proof={id:entry.id,digest:await sourceDigest(knowledgeProofValue(entry),snapshot)};
     if(!await sourceIsCurrent(proof,owner)){sourceReviewFailed=true;break;}sourceProofs.push(proof);
    }
    if(sourceReviewFailed)throw new TenbotError('Your access or the underlying records changed. No answer was published.',403);
    const workflow=sourceProofs.length>0&&!job.reads().length&&!fallback.operational;
    const message=String(workflow&&fallback.mode==='guide'&&record(fallback.sources[0])?fallback.sources[0].guidance:fallback.message).slice(0,2400);
    const answeredAt=new Date(now()).toISOString();let historyTurnId:string|undefined;
    if(workflow){
     const ancestry=new Map([...session.guidance.flatMap(x=>x.sources),...sourceProofs].map(x=>[x.id+':'+x.digest,x]));
     if(ancestry.size>12)throw new TenbotError('Conversation source limit reached. Clear the conversation to continue.',409);
     const proofs=[...ancestry.values()];historyTurnId=crypto.randomUUID();
     session.guidance=[...session.guidance,{question,answer:message,sources:proofs}].slice(-3);
     const savedAnswer:DisplayAnswer={conversationId:id,mode:responseMode,contentScope:'workflow',message,sources:[],snapshot:{revision:'tenbot-agent-poc.v1',verifiedAt:answeredAt},summary:null,suggestionAllowed:false,notices:[]};
     session.display=[...session.display,{id:historyTurnId,question,createdAt,answeredAt,answer:savedAnswer,sources:proofs,scopeDigest:await scopeDigest(owner)}].slice(-8);
     const entry=agentKnowledgeEntries().find(x=>x.id===sourceProofs[0].id);session.context=workflowConversationContext(entry?.modules[0]??'TenOps',proofs,false,now());
    }else{session.guidance=[];session.context=contextFromReads(job.reads(),question,now(),session.context)??(!job.reads().length&&session.context&&!/\b(?:new topic|switch(?:ing)? to)\b/i.test(question)?{...session.context,awaitingClarification:true,resultType:'clarification'}:null);}
    const savedOperational=operationalEnabled&&!workflow?await operationalReceipt(job.reads(),question,String(fallback.message),createdAt,now(),await scopeDigest(owner),fallbackProofs):null;
    if(savedOperational){session.operational=[...session.operational.filter(t=>Date.parse(t.expiresAt)>now()),savedOperational].slice(-4);historyTurnId=savedOperational.id;}
    if(!await job.fresh()||!await can('readOperationalData'))throw new TenbotError('Your access or the underlying records changed. No answer was published.',403);
    if(lease){await deps.sessionStore!.commit(lease,storedState(session),true);committed=true;}
    if(!await publicationAllowed(async()=>{if(!await can('readOperationalData')||!await job.fresh())return false;for(const p of sourceProofs)if(!await sourceIsCurrent(p,owner))return false;for(const t of session!.guidance)for(const p of t.sources)if(!await sourceIsCurrent(p,owner))return false;return deps.can(owner,'readOperationalData');}))throw new TenbotError('Your access or the underlying records changed. No answer was published.',403);
    const rechecked=await restoreHistory(session.operational,deps.jobTools(owner),now(),await scopeDigest(owner),id,responseMode,p=>sourceIsCurrent(p,owner));
    if(!await can('readOperationalData')||savedOperational&&!rechecked.kept.some(t=>t.id===savedOperational.id))throw new TenbotError('Your access or the underlying records changed. No answer was published.',403);
    return {...fallback,conversationId:id,contentScope:savedOperational?'operational-history':workflow?'workflow':'volatile',fallback:true,...(operationalEnabled?{historyTurns:rechecked.turns}:{}),...(savedOperational?{history:operationalHistoryMeta(savedOperational,now(),false)}:{}),...(historyTurnId?{historyTurnId,createdAt,answeredAt}:{})};
   }
   session.questions=[...session.questions,question].slice(-3);
   // Failed/attempted operational tools make a turn ineligible even if no result
   // was published. No invoice, live-record prose, tool payload or provider-native
   // continuation is retained as model context. Private display receipts are separate.
   // The new prose can depend on every old source that reached this model, not
   // only the newly cited source. Preserve transitive provenance or discard it.
   const ancestry=new Map([...session.guidance.flatMap(turn=>turn.sources),...knowledgeProofs.values()].map(proof=>[proof.id+':'+proof.digest,proof]));
   const knowledgeOnly=result.status==='completed'&&result.final!==null&&!session.invoiceAttached&&result.proposals.length===0&&knowledgeProofs.size>0&&ancestry.size<=12&&result.evidence.length>0&&result.evidence.every(item=>item.tool==='search_workflow_knowledge')&&result.trace.every(item=>item.event!=='tool'||item.name==='discover_capabilities'||item.name==='search_workflow_knowledge');
   const scopeOnly=result.status==='completed'&&result.final!==null&&!session.invoiceAttached&&result.proposals.length===0&&ancestry.size<=12&&result.evidence.length>0&&result.evidence.every(item=>item.tool==='describe_assistant_scope')&&result.trace.every(item=>item.event!=='tool'||item.name==='discover_capabilities'||item.name==='describe_assistant_scope')&&result.final.questions.length===0&&result.final.observations.length===1&&result.final.observations[0].text===result.final.answer&&result.final.inferences.length===0&&result.final.recommendations.length===0&&result.final.completed_actions.length===0;
   if(!session.invoiceAttached&&result.status==='completed'){
    if(knowledgeOnly){const entry=agentKnowledgeEntries().find(x=>x.id===[...knowledgeProofs.keys()][0]);session.context=workflowConversationContext(entry?.modules[0]??'TenOps',[...ancestry.values()],Boolean(result.final?.questions.length),now());}
    else if(scopeOnly)session.context={...workflowConversationContext('TenOps',[],false,now()),operation:'scope',resultType:'scope'};
    else session.context=contextFromReads(job.reads(),question,now(),session.context)??(!job.reads().length&&result.final?.questions.length&&session.context?{...session.context,awaitingClarification:true,resultType:'clarification'}:null);
   }
   if(followup?.kind==='search'&&!job.scoped())session.context=priorContext;
   session.guidance=knowledgeOnly?[...session.guidance,{question,answer:result.final!.answer,sources:[...ancestry.values()]}].slice(-3):[];
   // IDs are lookup seeds only; future requests receive no retained facts/prose.
   session.jobIds=[...new Set(result.evidence.flatMap(item=>{
    if(!record(item.data)||!record(item.data.data))return [];
    const jobData=item.data.data;
    return record(jobData.job)&&typeof jobData.job.job_id==='string'&&uuid.test(jobData.job.job_id)?[jobData.job.job_id]:[];
   }))].slice(0,4);
   const message=followup?.kind==='search'?(job.scoped()?.message??'The authorized Job list was not retrieved. I cannot establish a matching count or enumerate those Jobs. Please retry the list.'):(result.final?.answer??(result.reason==='authorization-denied'?'Your access or the underlying records changed. No experimental answer or draft was published.':'The experimental investigation stopped safely. No database changes were made. Try a narrower request.'));
   const answeredAt=new Date(now()).toISOString(),contentScope=knowledgeOnly?'workflow':scopeOnly?'scope':'volatile';
   let historyTurnId:string|undefined;
   if(contentScope!=='volatile'){
    historyTurnId=crypto.randomUUID();
    const answer:DisplayAnswer={conversationId:id,mode:responseMode,contentScope,message,sources:[],snapshot:{revision:'tenbot-agent-poc.v1',verifiedAt:answeredAt},summary:null,suggestionAllowed:false,notices:[]};
    session.display=[...session.display,{id:historyTurnId,question,createdAt,answeredAt,answer,sources:[...ancestry.values()],scopeDigest:await scopeDigest(owner)}].slice(-8);
   }
   const savedOperational=operationalEnabled&&deps.readOnlyHosted&&contentScope==='volatile'&&result.status==='completed'?await operationalReceipt(job.reads(),question,message,createdAt,now(),await scopeDigest(owner),[...ancestry.values()]):null;
   if(savedOperational){session.operational=[...session.operational.filter(t=>Date.parse(t.expiresAt)>now()),savedOperational].slice(-4);historyTurnId=savedOperational.id;}
   if(lease){await deps.sessionStore!.commit(lease,storedState(session),true);committed=true;}
   if(deps.readOnlyHosted&&!await publicationAllowed(async()=>{
    if(!await can('readOperationalData')||!await job.fresh())return false;
    for(const capability of knowledgeGrants)if(!await can(capability))return false;
    for(const proof of ancestry.values())if(!await proofIsCurrent(proof))return false;
    const retained=historyTurnId?session!.display.find(turn=>turn.id===historyTurnId):undefined;
    if(retained&&retained.scopeDigest!==await scopeDigest(owner))return false;
    for(const capability of knowledgeGrants)if(!await can(capability))return false;
    return can('readOperationalData');
   }))throw new TenbotError('Your access or the underlying records changed. No answer was published.',403);
   if(deps.readOnlyHosted){const rechecked=await restoreHistory(session.operational,deps.jobTools(owner),now(),await scopeDigest(owner),id,responseMode,p=>sourceIsCurrent(p,owner));
   if(!await can('readOperationalData')||savedOperational&&!rechecked.kept.some(t=>t.id===savedOperational.id))throw new TenbotError('Your access or the underlying records changed. No answer was published.',403);
   return {conversationId:id,mode:responseMode,contentScope:savedOperational?'operational-history':contentScope,...(operationalEnabled?{historyTurns:rechecked.turns}:{}),...(savedOperational?{history:operationalHistoryMeta(savedOperational,now(),false)}:{}),message,sources:[],snapshot:{revision:'tenbot-agent-poc.v1',verifiedAt:answeredAt},summary:null,suggestionAllowed:false,notices:[],...(historyTurnId?{historyTurnId,createdAt,answeredAt}:{})};}
   return {conversationId:id,mode:'agent-experiment',contentScope,message,sources:[],snapshot:{revision:'tenbot-agent-poc.v1',verifiedAt:answeredAt},summary:null,suggestionAllowed:false,...(historyTurnId?{historyTurnId,createdAt,answeredAt}:{}),
    notices:[deps.mode==='offline-scripted'?'Local scripted transport demonstration. This is not an OpenAI or Qwen reasoning result.':'Local OpenAI experiment. Review evidence and proposals; no execution capability exists.'],
    agent:{mode:deps.mode,provider:provider.name,model:provider.model,...result,modelSteps:result.status==='completed'?modelSteps:modelSteps.map(step=>({callCount:step.calls.length,usage:step.usage,durationMs:step.durationMs})),durationMs:now()-before,invoiceAttached:session.invoiceAttached,executionAvailable:false}};
  }finally{session.busy=false;session.touched=now();}
  }finally{
   if(lease){
    sessions.delete(lease.id);
    if(!committed){try{await deps.sessionStore!.release(lease);}catch(error){if(!fallbackAttempted)throw error;await deps.sessionStore!.release({...lease,revision:lease.revision+1});}}
   }
  }
 };
}
