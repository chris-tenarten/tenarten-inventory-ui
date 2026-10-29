// Server-owned, bounded assistant state. Only proven static workflow/scope turns
// may survive requests. Hosted storage uses owner-bound atomic claims; local
// experiments retain the existing in-memory lifecycle. No live tool facts persist.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- shared Deno/Node source
// @ts-ignore -- explicit extensions for Edge compatibility.
import {runTenbotAgent,type AgentProvider,type AgentStep,type JsonValue} from './tenbot-agent.ts';
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

export type AgentDemoScenario='job-investigation'|'invoice-preparation'|'tool-recovery';
export type AgentSessionDependencies={
 can(owner:string,capability:string):Promise<boolean>;
 jobTools(owner:string):JobTools;
 provider(scenario:AgentDemoScenario):AgentProvider;
 mode:'offline-scripted'|'openai';
 invoice?:{document:TenbotInvoiceDocument;reader(owner:string):TenbotInvoiceReader};
 readOnlyHosted?:boolean;
 sessionStore?:AgentSessionStore;
 now?:()=>number;
};
type KnowledgeProof={id:string;digest:string};
type GuidanceTurn={question:string;answer:string;sources:KnowledgeProof[]};
type DisplayAnswer={conversationId:string;mode:'agent-experiment'|'assistant';contentScope:'workflow'|'scope';message:string;sources:never[];snapshot:{revision:string;verifiedAt:string};summary:null;suggestionAllowed:false;notices:never[]};
type DisplayTurn={id:string;question:string;createdAt:string;answeredAt:string;answer:DisplayAnswer;sources:KnowledgeProof[];scopeDigest:string};
type Session={owner:string;touched:number;questions:string[];guidance:GuidanceTurn[];display:DisplayTurn[];jobIds:string[];invoiceAttached:boolean;confirmation:InvoiceConfirmation;busy:boolean};
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
 const storedState=(session:Session):StoredAgentState=>({guidance:structuredClone(session.guidance),display:structuredClone(session.display)});
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
  let lease:AgentSessionLease|undefined,committed=false;
  if(deps.sessionStore){
   lease=await deps.sessionStore.claim(owner,typeof supplied==='string'?supplied:undefined);
   if(!validateStoredAgentState(lease.state))throw new TenbotError('Conversation storage is unavailable.',503);
   sessions.set(lease.id,{owner,touched:lease.expiresAt-3600000,questions:lease.state.guidance.map(turn=>turn.question),guidance:structuredClone(lease.state.guidance),display:structuredClone(lease.state.display),jobIds:[],invoiceAttached:false,confirmation:{},busy:false});
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
    if(lease){await deps.sessionStore!.commit(lease,storedState(session),false);committed=true;}
    // Storage is asynchronous. A successful commit is not evidence that source
    // grants or account access remained current while it was pending.
    if(deps.readOnlyHosted&&!await publicationAllowed(async()=>{
     if(!await deps.can(owner,'readOperationalData')||lease&&now()>=lease.expiresAt||await scopeDigest(owner)!==finalScope)return false;
     for(const turn of published)for(const proof of turn.sources)if(!await sourceIsCurrent(proof,owner))return false;
     return deps.can(owner,'readOperationalData');
    }))throw new TenbotError('Your access or the underlying records changed. No answer was published.',403);
    return {conversationId:supplied,mode:responseMode,turns:published.map(({id,question,createdAt,answeredAt,answer})=>({id,question,createdAt,answeredAt,answer:structuredClone(answer)}))};
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
   session={owner,touched:now(),questions:[],guidance:[],display:[],jobIds:[],invoiceAttached:false,confirmation:{},busy:false};
  }
  const id=lease?.id??(typeof supplied==='string'?supplied:crypto.randomUUID());sessions.set(id,session);
  session.touched=now();session.busy=true;
  const createdAt=new Date(now()).toISOString();
  try{
   if(body.invoiceId!==undefined){session.invoiceAttached=true;session.guidance=[];}
   if(details)session.confirmation={...session.confirmation,...details};
   const can=(capability:string)=>deps.can(owner,capability);
   const job=createTenbotAgentJobTools(deps.jobTools(owner));
   const mayPrepare=!deps.readOnlyHosted&&await can('writeBusinessData')&&await can('adjustInventory');
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
   if(session.invoiceAttached&&deps.invoice)retainedContext.push({question:'Employee explicitly attached '+deps.invoice.document.filename,answer:(deps.invoice.document.extraction?'Actual OpenAI image preprocessing produced this transcription. Check read_invoice extraction provenance and compare it against the original image. ':'Synthetic text fixture only. ')+'Order details explicitly supplied by this employee: '+JSON.stringify(session.confirmation)+'. Invoice date is not order date. Missing fields remain unknown.'});
   const result=await runTenbotAgent({question,serverContext:retainedContext},{callerId:owner,provider:measured,tools,...(deps.readOnlyHosted?{limits:{maxDurationMs:75000}}:{}),async authorize(check){
    if(!await can('readOperationalData'))return false;
    // Do not retransmit retained guidance after a grant/version changes mid-turn.
    if(check.phase==='before_model'){
     const proofs=new Map(session!.guidance.flatMap(turn=>turn.sources).map(proof=>[proof.id+':'+proof.digest,proof]));
     for(const proof of proofs.values())if(!await proofIsCurrent(proof))return false;
    }
    if(check.tool==='prepare_pending_receivals'&&(!await can('writeBusinessData')||!await can('adjustInventory')))return false;
    if(check.phase==='publish'){
     if(inconsistentInvoice)return false;
     for(const capability of knowledgeGrants)if(!await can(capability))return false;
     const proofs=new Map([...knowledgeProofs.values(),...session!.guidance.flatMap(turn=>turn.sources)].map(proof=>[proof.id+':'+proof.digest,proof]));
     for(const proof of proofs.values())if(!await proofIsCurrent(proof))return false;
     if(prepared&&(!await can('writeBusinessData')||!await can('adjustInventory')))return false;
     if(!await job.fresh())return false;
     const deadline=new AbortController(),timer=setTimeout(()=>deadline.abort(),4000);
     try{for(const [query,previous] of invoiceReads){if(!sourceReader)return false;const fresh=query?await sourceReader.searchCatalog(query,deadline.signal):await sourceReader.readReceivals(deadline.signal);if(JSON.stringify(fresh)!==previous)return false;}}catch{return false;}finally{clearTimeout(timer);deadline.abort();}
     if(!await can('readOperationalData')||prepared&&(!await can('writeBusinessData')||!await can('adjustInventory')))return false;
     for(const capability of knowledgeGrants)if(!await can(capability))return false;
    }
    return true;
   }});
   if(deps.readOnlyHosted&&(result.status==='provider-unavailable'||result.status==='limit'&&result.reason==='cost-limit'))throw new HostedAgentUnavailable(id,result.reason??'provider-unavailable');
   session.questions=[...session.questions,question].slice(-3);
   // Failed/attempted operational tools make a turn ineligible even if no result
   // was published. No invoice, live-record prose, tool payload or provider-native
   // continuation is retained as assistant conversation memory.
   // The new prose can depend on every old source that reached this model, not
   // only the newly cited source. Preserve transitive provenance or discard it.
   const ancestry=new Map([...session.guidance.flatMap(turn=>turn.sources),...knowledgeProofs.values()].map(proof=>[proof.id+':'+proof.digest,proof]));
   const knowledgeOnly=result.status==='completed'&&result.final!==null&&!session.invoiceAttached&&result.proposals.length===0&&knowledgeProofs.size>0&&ancestry.size<=12&&result.evidence.length>0&&result.evidence.every(item=>item.tool==='search_workflow_knowledge')&&result.trace.every(item=>item.event!=='tool'||item.name==='discover_capabilities'||item.name==='search_workflow_knowledge');
   const scopeOnly=result.status==='completed'&&result.final!==null&&!session.invoiceAttached&&result.proposals.length===0&&ancestry.size<=12&&result.evidence.length>0&&result.evidence.every(item=>item.tool==='describe_assistant_scope')&&result.trace.every(item=>item.event!=='tool'||item.name==='discover_capabilities'||item.name==='describe_assistant_scope')&&result.final.questions.length===0&&result.final.observations.length===1&&result.final.observations[0].text===result.final.answer&&result.final.inferences.length===0&&result.final.recommendations.length===0&&result.final.completed_actions.length===0;
   session.guidance=knowledgeOnly?[...session.guidance,{question,answer:result.final!.answer,sources:[...ancestry.values()]}].slice(-3):[];
   // IDs are lookup seeds only; future requests receive no retained facts/prose.
   session.jobIds=[...new Set(result.evidence.flatMap(item=>{
    if(!record(item.data)||!record(item.data.data))return [];
    const jobData=item.data.data;
    return record(jobData.job)&&typeof jobData.job.job_id==='string'&&uuid.test(jobData.job.job_id)?[jobData.job.job_id]:[];
   }))].slice(0,4);
   const message=result.final?.answer??(result.reason==='authorization-denied'?'Your access or the underlying records changed. No experimental answer or draft was published.':'The experimental investigation stopped safely. No database changes were made. Try a narrower request.');
   const answeredAt=new Date(now()).toISOString(),contentScope=knowledgeOnly?'workflow':scopeOnly?'scope':'volatile';
   let historyTurnId:string|undefined;
   if(contentScope!=='volatile'){
    historyTurnId=crypto.randomUUID();
    const answer:DisplayAnswer={conversationId:id,mode:responseMode,contentScope,message,sources:[],snapshot:{revision:'tenbot-agent-poc.v1',verifiedAt:answeredAt},summary:null,suggestionAllowed:false,notices:[]};
    session.display=[...session.display,{id:historyTurnId,question,createdAt,answeredAt,answer,sources:[...ancestry.values()],scopeDigest:await scopeDigest(owner)}].slice(-8);
   }
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
   if(deps.readOnlyHosted)return {conversationId:id,mode:responseMode,contentScope,message,sources:[],snapshot:{revision:'tenbot-agent-poc.v1',verifiedAt:answeredAt},summary:null,suggestionAllowed:false,notices:[],...(historyTurnId?{historyTurnId,createdAt,answeredAt}:{})};
   return {conversationId:id,mode:'agent-experiment',contentScope,message,sources:[],snapshot:{revision:'tenbot-agent-poc.v1',verifiedAt:answeredAt},summary:null,suggestionAllowed:false,...(historyTurnId?{historyTurnId,createdAt,answeredAt}:{}),
    notices:[deps.mode==='offline-scripted'?'Local scripted transport demonstration. This is not an OpenAI or Qwen reasoning result.':'Local OpenAI experiment. Review evidence and proposals; no execution capability exists.'],
    agent:{mode:deps.mode,provider:provider.name,model:provider.model,...result,modelSteps:result.status==='completed'?modelSteps:modelSteps.map(step=>({callCount:step.calls.length,usage:step.usage,durationMs:step.durationMs})),durationMs:now()-before,invoiceAttached:session.invoiceAttached,executionAvailable:false}};
  }finally{session.busy=false;session.touched=now();}
  }finally{
   if(lease){
    sessions.delete(lease.id);
    if(!committed)await deps.sessionStore!.release(lease);
   }
  }
 };
}
