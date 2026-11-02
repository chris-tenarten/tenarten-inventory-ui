/** Assembly for the existing TenBot registry; no provider, workflow router or
 * credential capability is created here. The host supplies caller-scoped tools. */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- Edge/Node shared source
// @ts-ignore -- explicit Edge import
import {validateStrictSchema,type AgentTool,type AgentResult,type JsonValue} from './tenbot-agent.ts';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- Edge/Node shared source
// @ts-ignore -- explicit Edge import
import {normalizePreparedAction,ReviewedActionError,type PreparedAction,type ActionCard,type ActionReference} from './tenbot-actions.ts';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- Edge/Node source
// @ts-ignore -- explicit Edge extension
import {createProposalOperations,type ProposalOperationDependencies} from './tenbot-proposal-operations.ts';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- Edge/Node source
// @ts-ignore -- explicit Edge extension
import {createBusinessOperations,type BusinessOperationsDependencies} from './tenbot-business-operations.ts';

export type ReviewedActionPublisher={prepare(input:{conversationId:string;action:PreparedAction;supersedes?:ActionReference}):Promise<ActionCard>;revoke?(reference:ActionReference):Promise<void>};

/** Construct once for a single authorized investigation. Shared document text
 * remains host evidence, scoped to this employee/run; never model-authored or
 * retained as conversation state. Each source lookup rechecks current access. */
export function createCallerReviewedOperations(deps:{proposal:ProposalOperationDependencies;business:BusinessOperationsDependencies}){
 if(deps.proposal.callerId!==deps.business.ownerId)throw new ReviewedActionError('invalid_action');
 const sources=new Map<string,{sourceId:string;text:string}>();
 const business=createBusinessOperations({...deps.business,onDocumentRead(input){
  if(input.ownerId!==deps.business.ownerId)throw new ReviewedActionError('rejected');
  for(const line of input.lines)sources.set(line.source_ref,{sourceId:input.sourceId,text:line.text});
  deps.business.onDocumentRead?.(input);
 }});
 const proposal=createProposalOperations({...deps.proposal,async resolveSource(sourceRef,signal){
  if(signal.aborted||!await deps.business.can('readOperationalData'))return null;
  const entry=sources.get(sourceRef);
  if(!entry)return deps.proposal.resolveSource?deps.proposal.resolveSource(sourceRef,signal):null;
  // Re-download by the original owner-bound service: source deletion, expiry,
  // revocation and original-byte integrity cannot be hidden by this run's map.
  const current=await deps.business.originals.download(entry.sourceId);
  if(current.source.ownerId!==deps.business.ownerId||!['ready','retained'].includes(current.source.state)||current.source.state!=='retained'&&Date.parse(current.source.expiresAt)<=Date.now()||!await deps.business.can('readOperationalData')||signal.aborted)return null;
  return entry.text;
 }});
 return createReviewedOperationRegistry([business,proposal]);
}

/** Reuses runTenbotAgent's discovery, evidence, limits and authorization phases.
 * The returned registry cannot execute a business mutation or reauthenticate. */
export function createReviewedOperationRegistry(groups:readonly (readonly AgentTool[])[]) {
 const tools=groups.flatMap(group=>[...group]);
 const names=new Set<string>();
 for(const tool of tools){
  if(names.has(tool.name)||!['read','prepare'].includes(tool.kind))throw new ReviewedActionError('invalid_action');
  names.add(tool.name);
 }
 return {
  tools,
  /** Employee edits use the same strict domain preparation and fresh lookups as
   * model preparation. Nothing accepts a client-authored review or SQL params. */
  async prepareRevision(input:{name:string;arguments:Record<string,JsonValue>;callerId:string;signal:AbortSignal}):Promise<PreparedAction>{
   const tool=tools.find(item=>item.name===input.name&&item.kind==='prepare');
   if(!tool||!validateStrictSchema(input.arguments,tool.parameters))throw new ReviewedActionError('invalid_action');
   const result=await tool.execute(input.arguments,{callerId:input.callerId,signal:input.signal});
   if(result.proposal===undefined)throw new ReviewedActionError('rejected');
   return normalizePreparedAction(result.proposal);
  },
  /** Called only after the existing runtime's publication authorization. Raw
   * tool calls/proposals never cross into Workspace. A failed run publishes none. */
  async publish(result:AgentResult,conversationId:string,publisher:ReviewedActionPublisher,reauthorize:()=>Promise<boolean>,supersedes?:ActionReference) {
   if(result.status!=='completed'||!result.final||!await reauthorize())return [] as ActionCard[];
   const actions=result.proposals.map(item=>{
    if(!tools.some(tool=>tool.kind==='prepare'&&tool.name===item.tool)||!result.evidence.some(e=>e.id===item.evidenceId&&e.tool===item.tool))throw new ReviewedActionError('rejected');
    return normalizePreparedAction(item.proposal);
   });
   // Keep one review operation per turn: no partial publication of a compound
   // write request. Terra can investigate multiple domains and prepare one next.
   if(actions.length>1)throw new ReviewedActionError('invalid_action');
   const cards:ActionCard[]=[];
   try{
    for(const action of actions){
     if(!await reauthorize())throw new ReviewedActionError('rejected');
     cards.push(await publisher.prepare({conversationId,action,...(supersedes?{supersedes}:{})}));
    }
    if(!await reauthorize())throw new ReviewedActionError('rejected');
    return cards;
   }catch(error){
    let uncertain=false;
    for(const card of cards)try{if(publisher.revoke)await publisher.revoke(card.reference);else uncertain=true;}catch{uncertain=true;}
    if(uncertain)throw new ReviewedActionError('uncertain');
    throw error;
   }
  },
 };
}
