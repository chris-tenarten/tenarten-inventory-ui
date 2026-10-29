// Server-owned local experiment state. Never retains operational answers or tool
// results between requests. Only bounded, source-checked knowledge-only dialogue
// may survive for a walkthrough. The hosted entry point does not construct this dependency.
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
import {hasGuidePermission,type CapabilityEntry} from './tenbot-knowledge.ts';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- shared Node/Deno source
// @ts-ignore -- explicit extensions for Edge compatibility.
import {agentKnowledgeEntries,agentKnowledgeSnapshot as snapshot} from './tenbot-agent-knowledge.ts';

export type AgentDemoScenario='job-investigation'|'invoice-preparation'|'tool-recovery';
export type AgentSessionDependencies={
 can(owner:string,capability:string):Promise<boolean>;
 jobTools(owner:string):JobTools;
 provider(scenario:AgentDemoScenario):AgentProvider;
 mode:'offline-scripted'|'openai';
 invoice:{document:TenbotInvoiceDocument;reader(owner:string):TenbotInvoiceReader};
 now?:()=>number;
};
type KnowledgeProof={id:string;digest:string};
type GuidanceTurn={question:string;answer:string;sources:KnowledgeProof[]};
type Session={owner:string;touched:number;questions:string[];guidance:GuidanceTurn[];jobIds:string[];invoiceAttached:boolean;confirmation:InvoiceConfirmation;busy:boolean};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const record=(value:unknown):value is Record<string,unknown>=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const json=(value:unknown)=>JSON.parse(JSON.stringify(value)) as JsonValue;
const publishedSource=(entry:CapabilityEntry)=>({id:entry.id,title:entry.title,status:entry.status,availability:entry.availability??'available',guidance:entry.guidance,path:entry.path,route:entry.route});
async function sourceDigest(source:unknown,version:unknown){
 const bytes=new TextEncoder().encode(JSON.stringify({snapshot:version,source}));
 const digest=await crypto.subtle.digest('SHA-256',bytes);
 return Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
}
export function createTenbotAgentSessions(deps:AgentSessionDependencies){
 const sessions=new Map<string,Session>(),now=deps.now??Date.now;
 return async(body:Record<string,unknown>,owner:string)=>{
  if(!owner||!await deps.can(owner,'readOperationalData'))throw new TenbotError('Your account is not authorized.',403);
  for(const [id,session] of sessions)if(now()-session.touched>3600000&&!session.busy)sessions.delete(id);
  if(Object.keys(body).some(key=>!['action','question','context','conversationId','invoiceId','orderDetails','demoScenario'].includes(key)))throw new TenbotError('Invalid experimental request.');
  if(!['ask','clear'].includes(String(body.action)))throw new TenbotError('The experiment supports questions and clearing only. No execution action exists.');
  const supplied=body.conversationId;
  if(supplied!==undefined&&(typeof supplied!=='string'||!uuid.test(supplied)))throw new TenbotError('Invalid conversation request.');
  let session=typeof supplied==='string'?sessions.get(supplied):undefined;
  if(supplied&&(!session||session.owner!==owner))throw new TenbotError('Conversation unavailable. Reopen TenBot and retry.',403);
  if(body.action==='clear'){
   if(session?.busy)throw new TenbotError('Conversation changed. Retry after the current request.',409);
   if(typeof supplied==='string')sessions.delete(supplied);
   return {cleared:true};
  }
  // Preserve the existing input/privacy contract without using its intent router.
  const {question}=resolveInput(body);
  const scenario=body.demoScenario??'job-investigation';
  if(!['job-investigation','invoice-preparation','tool-recovery'].includes(String(scenario)))throw new TenbotError('Invalid demonstration scenario.');
  if(body.invoiceId!==undefined&&body.invoiceId!==deps.invoice.document.id)throw new TenbotError('Only the supplied synthetic invoice is available.');
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
   session={owner,touched:now(),questions:[],guidance:[],jobIds:[],invoiceAttached:false,confirmation:{},busy:false};
  }
  const id=typeof supplied==='string'?supplied:crypto.randomUUID();sessions.set(id,session);
  session.touched=now();session.busy=true;
  try{
   if(body.invoiceId!==undefined){session.invoiceAttached=true;session.guidance=[];}
   if(details)session.confirmation={...session.confirmation,...details};
   const can=(capability:string)=>deps.can(owner,capability);
   const job=createTenbotAgentJobTools(deps.jobTools(owner));
   const mayPrepare=await can('writeBusinessData')&&await can('adjustInventory');
   const sourceReader=deps.invoice.reader(owner),invoiceReads=new Map<string,string>();let inconsistentInvoice=false;
   const remember=(query:string,value:unknown)=>{const serialized=JSON.stringify(value),previous=invoiceReads.get(query);if(previous!==undefined&&previous!==serialized)inconsistentInvoice=true;if(previous===undefined)invoiceReads.set(query,serialized);};
   const reader:TenbotInvoiceReader={async searchCatalog(query,signal){const value=await sourceReader.searchCatalog(query,signal);remember(query,value);return value;},async readReceivals(signal){const value=await sourceReader.readReceivals(signal);remember('',value);return value;}};
   const invoice=session.invoiceAttached?createTenbotInvoiceTools({callerId:owner,document:deps.invoice.document,reader,confirmation:session.confirmation}):[];
   let prepared=false;
   for(const tool of invoice)if(tool.kind==='prepare'){
    const execute=tool.execute;tool.execute=async(args,context)=>{const value=await execute(args,context);prepared=true;return value;};
   }
   const knowledgeGrants=new Set<string>(),knowledgeProofs=new Map<string,KnowledgeProof>();
   const proofIsCurrent=async(proof:KnowledgeProof)=>{
    const entry=agentKnowledgeEntries().find(item=>item.id===proof.id);
    if(!entry||entry.status!=='deployed'||await sourceDigest(publishedSource(entry),snapshot)!==proof.digest)return false;
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
   const knowledge=createTenbotAgentKnowledgeTools(async capability=>{const allowed=await can(capability);if(allowed)knowledgeGrants.add(capability);return allowed;});
   for(const tool of knowledge){
    const execute=tool.execute;tool.execute=async(args,context)=>{
     const value=await execute(args,context);
     if(record(value.data)&&Array.isArray(value.data.sources))for(const source of value.data.sources){
      if(record(source)&&typeof source.id==='string')knowledgeProofs.set(source.id,{id:source.id,digest:await sourceDigest(source,value.data.snapshot)});
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
   if(session.invoiceAttached)retainedContext.push({question:'Employee explicitly attached '+deps.invoice.document.filename,answer:(deps.invoice.document.extraction?'Actual OpenAI image preprocessing produced this transcription. Check read_invoice extraction provenance and compare it against the original image. ':'Synthetic text fixture only. ')+'Order details explicitly supplied by this employee: '+JSON.stringify(session.confirmation)+'. Invoice date is not order date. Missing fields remain unknown.'});
   const result=await runTenbotAgent({question,serverContext:retainedContext},{callerId:owner,provider:measured,tools,async authorize(check){
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
     try{for(const [query,previous] of invoiceReads){const fresh=query?await sourceReader.searchCatalog(query,deadline.signal):await sourceReader.readReceivals(deadline.signal);if(JSON.stringify(fresh)!==previous)return false;}}catch{return false;}finally{clearTimeout(timer);deadline.abort();}
     if(!await can('readOperationalData')||prepared&&(!await can('writeBusinessData')||!await can('adjustInventory')))return false;
     for(const capability of knowledgeGrants)if(!await can(capability))return false;
    }
    return true;
   }});
   session.questions=[...session.questions,question].slice(-3);
   // Failed/attempted operational tools make a turn ineligible even if no result
   // was published. No invoice, live-record prose, tool payload or provider-native
   // continuation is retained as assistant conversation memory.
   // The new prose can depend on every old source that reached this model, not
   // only the newly cited source. Preserve transitive provenance or discard it.
   const ancestry=new Map([...session.guidance.flatMap(turn=>turn.sources),...knowledgeProofs.values()].map(proof=>[proof.id+':'+proof.digest,proof]));
   const knowledgeOnly=result.status==='completed'&&result.final!==null&&!session.invoiceAttached&&result.proposals.length===0&&knowledgeProofs.size>0&&ancestry.size<=12&&result.evidence.length>0&&result.evidence.every(item=>item.tool==='search_workflow_knowledge')&&result.trace.every(item=>item.event!=='tool'||item.name==='discover_capabilities'||item.name==='search_workflow_knowledge');
   session.guidance=knowledgeOnly?[...session.guidance,{question,answer:result.final!.answer,sources:[...ancestry.values()]}].slice(-3):[];
   // IDs are lookup seeds only; future requests receive no retained facts/prose.
   session.jobIds=[...new Set(result.evidence.flatMap(item=>{
    if(!record(item.data)||!record(item.data.data))return [];
    const jobData=item.data.data;
    return record(jobData.job)&&typeof jobData.job.job_id==='string'&&uuid.test(jobData.job.job_id)?[jobData.job.job_id]:[];
   }))].slice(0,4);
   const message=result.final?.answer??(result.reason==='authorization-denied'?'Your access or the underlying records changed. No experimental answer or draft was published.':'The experimental investigation stopped safely. No database changes were made. Try a narrower request.');
   return {conversationId:id,mode:'agent-experiment',contentScope:knowledgeOnly?'workflow':'volatile',message,sources:[],snapshot:{revision:'tenbot-agent-poc.v1',verifiedAt:new Date(now()).toISOString()},summary:null,suggestionAllowed:false,
    notices:[deps.mode==='offline-scripted'?'Local scripted transport demonstration. This is not an OpenAI or Qwen reasoning result.':'Local OpenAI experiment. Review evidence and proposals; no execution capability exists.'],
    agent:{mode:deps.mode,provider:provider.name,model:provider.model,...result,modelSteps:result.status==='completed'?modelSteps:modelSteps.map(step=>({callCount:step.calls.length,usage:step.usage,durationMs:step.durationMs})),durationMs:now()-before,invoiceAttached:session.invoiceAttached,executionAvailable:false}};
  }finally{session.busy=false;session.touched=now();}
 };
}
