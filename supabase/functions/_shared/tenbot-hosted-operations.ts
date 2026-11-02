/** Per-request composition of existing caller-authorized operations. No model,
 * inference/extraction, upload, business execution or conversation store lives here. */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- shared Edge/Node source
// @ts-ignore -- explicit Edge extension.
import {validateStrictSchema,type AgentTool,type AgentResult,type JsonValue} from './tenbot-agent.ts';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- shared Edge/Node source
// @ts-ignore -- explicit Edge extension.
import {AgentToolError} from './tenbot-investigation-diagnostics.ts';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- shared Edge/Node source
// @ts-ignore -- explicit Edge extension.
import {createCallerReviewedOperations} from './tenbot-reviewed-operations.ts';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- shared Edge/Node source
// @ts-ignore -- explicit Edge extension.
import {callerBusinessDependencies} from './tenbot-business-operations.ts';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- shared Edge/Node source
// @ts-ignore -- explicit Edge extension.
import {createTrustedActionPublisher,createReviewedActionService,type ActionReference,type ActionRpc} from './tenbot-actions.ts';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- shared Edge/Node source
// @ts-ignore -- explicit Edge extension.
import type {JobToolCaller} from './tenbot-job-tools.ts';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- shared Edge/Node source
// @ts-ignore -- reuse existing owner/RLS/original-byte integrity checks.
import {createInvoiceReceivalAttachmentService,type InvoiceReceivalStorageCaller} from '../../../src/modules/inventory/invoice-receival-attachments.ts';

export type HostedOperationAccess={documentIds:string[];proposalAccess:boolean};
export type HostedOperationsDependencies={
 owner:string;question:string;documentIds:string[];caller:JobToolCaller&InvoiceReceivalStorageCaller;
 service:ActionRpc;sessionId:string;can(capability:string):Promise<boolean>;
};
type Row=Record<string,unknown>;
type Fact={id:string;text:string;kind?:string};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const object=(value:unknown):value is Row=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const json=(value:unknown)=>JSON.parse(JSON.stringify(value)) as JsonValue;
const copy=<T,>(value:T):T=>structuredClone(value);
function denied():never{throw new AgentToolError('unknown-capability');}
function accessValid(value:unknown):value is HostedOperationAccess{
 return object(value)&&Object.keys(value).every(key=>['documentIds','proposalAccess'].includes(key))&&Array.isArray(value.documentIds)&&value.documentIds.length<=8&&value.documentIds.every(id=>typeof id==='string'&&uuid.test(id))&&new Set(value.documentIds).size===value.documentIds.length&&typeof value.proposalAccess==='boolean';
}
async function proposalAllowed(caller:JobToolCaller){try{const result=await caller.rpc('has_proposal_access',{});return !result.error&&result.data===true;}catch{return false;}}
/** Reauthorization for saved display only. Never returns original bytes/text. */
export async function authorizeHostedOperationHistory(deps:Pick<HostedOperationsDependencies,'caller'|'owner'|'can'>,refs:HostedOperationAccess):Promise<boolean>{
 if(!uuid.test(deps.owner)||!accessValid(refs))return false;
 try{
  if(!await deps.can('readOperationalData')||refs.proposalAccess&&!await proposalAllowed(deps.caller))return false;
  const originals=createInvoiceReceivalAttachmentService(deps.caller);
  for(const id of refs.documentIds){
   const {source}=await originals.download(id);
   if(source.id!==id||source.ownerId!==deps.owner||!['ready','retained'].includes(source.state)||source.state!=='retained'&&Date.parse(source.expiresAt)<=Date.now())return false;
  }
  return await deps.can('readOperationalData')&&(!refs.proposalAccess||await proposalAllowed(deps.caller));
 }catch{return false;}
}
const phrase=(value:unknown,max=160)=>typeof value==='string'?value.replace(/\s+/g,' ').trim().replace(/\b[0-9a-f]{8}-[0-9a-f-]{27,}\b/gi,'[record reference]').slice(0,max):'';
function facts(name:string,data:Row):Fact[]{
 const fact=(id:string,text:string,kind?:string):Fact=>({id,text,...(kind?{kind}:{})});
 if(Array.isArray(data.answer_facts))return data.answer_facts as Fact[];
 const result:Fact[]=[];
 if(name==='read_supplied_document'){
  result.push(fact('document_read','I read the supplied document. Its contents are source evidence for your review.'));
  if(Array.isArray(data.sources))for(const [index,line]of data.sources.slice(0,4).entries())if(object(line)&&phrase(line.text,400))result.push(fact('document_excerpt_'+index,'The supplied document says: '+phrase(line.text,400)));
 }else if(name==='search_material_catalog'){
  const offers=Array.isArray(data.offers)?data.offers:[];
  result.push(fact('catalog_matches',`I found ${offers.length} current catalog ${offers.length===1?'offer':'offers'} for review.`));
  for(const [index,offer]of offers.slice(0,4).entries())if(object(offer)&&phrase(offer.material))result.push(fact('catalog_offer_'+index,`${phrase(offer.material)}${phrase(offer.size)?' ('+phrase(offer.size)+')':''} is offered by ${phrase(offer.supplier)||'the listed supplier'}${phrase(offer.order_unit)?' in '+phrase(offer.order_unit):''}.`));
  result.push(fact('quote_price_limit','Catalog purchase information does not establish a customer quote price.','limitation'));
 }else if(name==='find_receivals'){
  const rows=Array.isArray(data.receivals)?data.receivals:[];
  result.push(fact('receival_matches',`I found ${rows.length} matching ${rows.length===1?'receival':'receivals'} in the current authorized records.`));
  for(const [index,row]of rows.slice(0,3).entries())if(object(row))result.push(fact('receival_'+index,`${phrase(row.material_name)||'The listed material'} has ${phrase(String(row.quantity_expected??''))} ${phrase(row.unit)} expected and ${phrase(String(row.quantity_received??''))} recorded as received.`));
  result.push(fact('duplicate_limit','Supplier and material matches are possible duplicates; they do not prove whether an invoice was entered.','limitation'));
 }else if(name==='find_suppliers'){
  const rows=Array.isArray(data.suppliers)?data.suppliers:[];
  result.push(fact('supplier_matches',`I found ${rows.length} matching active ${rows.length===1?'supplier':'suppliers'}.`));
  for(const [index,row]of rows.slice(0,4).entries())if(object(row)&&phrase(row.name))result.push(fact('supplier_'+index,'A matching supplier is '+phrase(row.name)+'.'));
 }else if(name==='get_order'){
  if(data.status==='not_found_or_not_authorized')result.push(fact('order_unavailable','The requested Purchase Order was not found in your authorized records.'));
  else if(object(data.order)){
   const order=data.order;
   result.push(fact('order_identity',`The saved Purchase Order${phrase(order.po_number)?' '+phrase(order.po_number):''}${phrase(order.vendor_name_snapshot)?' is for '+phrase(order.vendor_name_snapshot):' is available'}${phrase(order.status)?' with status '+phrase(order.status):''}.`));
   result.push(fact('order_lines',`It contains ${Array.isArray(data.lines)?data.lines.length:0} saved material lines.`));
   result.push(fact('order_receipt_limit','A saved Purchase Order does not establish that its materials have physically arrived.','limitation'));
  }
 }else if(name==='prepare_pending_receivals'&&object(data.review)){
  const review=data.review;
  result.push(fact('receivals_prepared',phrase(review.summary,1200)+' Nothing has been created yet.'));
  if(Array.isArray(review.issues))for(const [index,issue]of review.issues.slice(0,4).entries())if(object(issue)&&phrase(issue.message,600))result.push(fact('review_issue_'+index,phrase(issue.message,600),'limitation'));
  result.push(fact('receiving_separate','Adding Pending Receivals does not increase Inventory quantities; receiving remains a separate operation.','limitation'));
 }
 return result.length?result:[fact('review_result','The authorized information is ready for review. No business records were changed.')];
}
async function bounded<T>(promise:Promise<T>,signal:AbortSignal):Promise<T>{
 if(signal.aborted)denied();
 return new Promise<T>((resolve,reject)=>{
  const aborted=()=>reject(new AgentToolError('tool-failed'));signal.addEventListener('abort',aborted,{once:true});
  promise.then(value=>{signal.removeEventListener('abort',aborted);resolve(value);},error=>{signal.removeEventListener('abort',aborted);reject(error);});
 });
}

export function createHostedOperations(deps:HostedOperationsDependencies){
 if(!uuid.test(deps.owner)||!uuid.test(deps.sessionId)||typeof deps.question!=='string'||!deps.question.trim()||deps.question.length>1200||!accessValid({documentIds:deps.documentIds,proposalAccess:false}))throw new Error('Invalid hosted operation dependencies.');
 const selected=new Set(deps.documentIds),documents=new Map<string,string>();let needsProposal=false;
 const actionCaller:ActionRpc={async rpc(name,args){const result=await deps.caller.rpc(name,args);return {data:result.data,error:result.error?{code:object(result.error)&&typeof result.error.code==='string'?result.error.code:'unavailable'}:null};}};
 const revoke=(reference:ActionReference)=>createReviewedActionService(actionCaller).revoke(reference);
 const business=callerBusinessDependencies(deps.caller,deps.owner),download=business.originals.download;
 business.can=deps.can;
 business.originals={async download(id){
  if(!selected.has(id))denied();
  const result=await download(id);
  if(result.source.ownerId!==deps.owner||!['ready','retained'].includes(result.source.state))denied();
  const prior=documents.get(id);if(prior!==undefined&&prior!==result.source.sha256)denied();
  documents.set(id,result.source.sha256);return result;
 }};
 const registry=createCallerReviewedOperations({business,proposal:{callerId:deps.owner,sources:[{id:'employee',text:deps.question}],async rpc(name,args,signal){
  const result=await bounded(Promise.resolve(deps.caller.rpc(name,args)),signal);return {data:result.data,error:result.error};
 }}});
 const observed:Array<{tool:AgentTool;args:Record<string,JsonValue>;snapshot:string}>=[];
 const access=():HostedOperationAccess=>({documentIds:[...documents.keys()],proposalAccess:needsProposal});
 const tools=registry.tools.map(tool=>({...tool,async execute(args:Record<string,JsonValue>,context:Parameters<AgentTool['execute']>[1]){
  if(context.callerId!==deps.owner||!validateStrictSchema(args,tool.parameters))denied();
  if((tool.name==='read_supplied_document'||tool.name==='prepare_pending_receivals')&&!selected.has(String(args.source_id)))denied();
  const value=await tool.execute(args,context);
  if(tool.name==='prepare_proposal_draft')needsProposal=true;
  if(observed.length>=20)denied();
  observed.push({tool,args:copy(args),snapshot:JSON.stringify(value)});
  return {...value,data:object(value.data)?json({...value.data,answer_facts:facts(tool.name,value.data)}):value.data};
 }}));
 const fresh=async()=>{
  const signal=AbortSignal.timeout(4000);
  try{
   if(!await bounded(authorizeHostedOperationHistory(deps,access()),signal))return false;
   for(const [id,sha]of documents){const result=await bounded(download(id),signal);if(result.source.ownerId!==deps.owner||result.source.sha256!==sha)return false;}
   for(const operation of observed){
    const value=await bounded(operation.tool.execute(copy(operation.args),{callerId:deps.owner,signal}),signal);
    if(JSON.stringify(value)!==operation.snapshot)return false;
   }
   return await bounded(authorizeHostedOperationHistory(deps,access()),signal);
  }catch{return false;}
 };
 return {
  tools,access,fresh,revoke,
  async publish(result:AgentResult,conversationId:string,supersedes?:ActionReference){
   return registry.publish(result,conversationId,{...createTrustedActionPublisher({ownerId:deps.owner,sessionId:deps.sessionId,service:deps.service}),revoke},fresh,supersedes);
  },
 };
}
