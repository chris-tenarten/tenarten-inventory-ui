/** Reviewed business operations. These values contain no passwords or sessions.
 * Preparation is a preview; only the caller-authorized transaction may commit. */
export type JsonValue = null | boolean | number | string | JsonValue[] | {[key:string]:JsonValue};
export type ActionOperation = 'proposal.save_draft' | 'inventory.create_pending_receivals';
export type ActionReview = {
 title:string; summary:string; consequences:string[];
 fields:Array<{path:string;label:string;value:JsonValue;editable?:boolean}>;
 issues:Array<{code:string;message:string;blocking:boolean}>;
 preview?:{kind:'proposal_pdf'};
};
export type PreparedAction = {
 operation:ActionOperation; parameters:Record<string,JsonValue>; review:ActionReview;
 sourceReferences?:Array<{kind:string;id:string}>;
};
export type ActionReference = {id:string;revision:number;hash:string;expiresAt:string};
export type ActionCard = {
 kind:'proposed_action'; contract:'tenbot.actions.v1'; reference:ActionReference;
 operation:ActionOperation; review:ActionReview;
 confirmation:{kind:'account_password';available:boolean};
};
export type ActionReceipt = {
 contract:'tenbot.actions.v1';kind:'action_result';reference:ActionReference;
 operation:ActionOperation;status:'completed';idempotent:boolean;
 result:Record<string,JsonValue>;completedAt:string;
};
export type ActionStatus = {contract:'tenbot.actions.v1';card:ActionCard;state:'prepared'|'authorized'|'completed'|'failed'|'revoked'|'expired';receipt:ActionReceipt|null};
export type ActionRpc = {rpc(name:string,args:Record<string,unknown>):PromiseLike<{data:unknown;error:{code?:string;message?:string}|null}>};
export class ReviewedActionError extends Error {
 constructor(readonly code:'invalid_action'|'not_available'|'rejected'|'uncertain') {super({invalid_action:'Review the complete proposed changes before continuing.',not_available:'This operation is not available for this account.',rejected:'The reviewed operation changed or is no longer authorized. Refresh it before continuing.',uncertain:'The operation could not be reconciled. Check its saved status before trying again.'}[code]);this.name='ReviewedActionError';}
}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const digest=/^[a-f0-9]{64}$/;
const object=(v:unknown):v is Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const keys=(v:Record<string,unknown>,allowed:string[])=>Object.keys(v).every(k=>allowed.includes(k));
const str=(v:unknown,max:number)=>typeof v==='string'&&v.length>0&&v.length<=max;
const instant=(v:unknown)=>str(v,80)&&Number.isFinite(Date.parse(v as string));
function invalid():never{throw new ReviewedActionError('invalid_action');}
function json(v:unknown,depth=0):v is JsonValue {
 if(depth>16)return false;
 if(v===null||typeof v==='boolean'||typeof v==='string')return true;
 if(typeof v==='number')return Number.isFinite(v);
 if(Array.isArray(v))return v.length<=500&&v.every(x=>json(x,depth+1));
 return object(v)&&[Object.prototype,null].includes(Object.getPrototypeOf(v))&&Object.keys(v).length<=200&&Object.entries(v).every(([k,x])=>!['__proto__','constructor','prototype'].includes(k)&&json(x,depth+1));
}
export function normalizePreparedAction(value:unknown):PreparedAction {
 if(!object(value)||!keys(value,['operation','parameters','review','sourceReferences'])||!['proposal.save_draft','inventory.create_pending_receivals'].includes(String(value.operation))||!object(value.parameters)||!json(value.parameters))invalid();
 const r=value.review;
 if(!object(r)||!keys(r,['title','summary','consequences','fields','issues','preview'])||!str(r.title,160)||!str(r.summary,1200)||!Array.isArray(r.consequences)||r.consequences.length>12||r.consequences.some(x=>!str(x,600))||!Array.isArray(r.fields)||r.fields.length>240||!Array.isArray(r.issues)||r.issues.length>80)invalid();
 if(r.fields.some(x=>!object(x)||!keys(x,['path','label','value','editable'])||!str(x.path,200)||!str(x.label,200)||!json(x.value)||x.editable!==undefined&&typeof x.editable!=='boolean')||r.issues.some(x=>!object(x)||!keys(x,['code','message','blocking'])||!str(x.code,100)||!str(x.message,600)||typeof x.blocking!=='boolean'))invalid();
 if(r.preview!==undefined&&(!object(r.preview)||!keys(r.preview,['kind'])||r.preview.kind!=='proposal_pdf'||value.operation!=='proposal.save_draft'))invalid();
 if(value.sourceReferences!==undefined&&(!Array.isArray(value.sourceReferences)||value.sourceReferences.length>100||value.sourceReferences.some(x=>!object(x)||!keys(x,['kind','id'])||!str(x.kind,80)||!str(x.id,200))))invalid();
 if(new TextEncoder().encode(JSON.stringify(value)).length>120000)invalid();
 return JSON.parse(JSON.stringify(value)) as PreparedAction;
}
export function parseActionReference(value:unknown):ActionReference {
 if(!object(value)||!keys(value,['id','revision','hash','expiresAt'])||typeof value.id!=='string'||!uuid.test(value.id)||!Number.isSafeInteger(value.revision)||Number(value.revision)<1||typeof value.hash!=='string'||!digest.test(value.hash)||!instant(value.expiresAt))invalid();
 return {id:value.id,revision:Number(value.revision),hash:value.hash,expiresAt:value.expiresAt as string};
}
export function parseActionCard(value:unknown):ActionCard {
 if(!object(value)||!keys(value,['kind','contract','reference','operation','review','confirmation'])||value.kind!=='proposed_action'||value.contract!=='tenbot.actions.v1'||!object(value.confirmation)||!keys(value.confirmation,['kind','available'])||value.confirmation.kind!=='account_password'||typeof value.confirmation.available!=='boolean')invalid();
 const prepared=normalizePreparedAction({operation:value.operation,parameters:{},review:value.review});
 return {kind:'proposed_action',contract:'tenbot.actions.v1',reference:parseActionReference(value.reference),operation:prepared.operation,review:prepared.review,confirmation:{kind:'account_password',available:value.confirmation.available}};
}
export function parseActionReceipt(value:unknown,reference:ActionReference):ActionReceipt {
 if(!object(value)||!keys(value,['contract','kind','reference','operation','status','idempotent','result','completedAt'])||value.contract!=='tenbot.actions.v1'||value.kind!=='action_result'||value.status!=='completed'||!['proposal.save_draft','inventory.create_pending_receivals'].includes(String(value.operation))||typeof value.idempotent!=='boolean'||!object(value.result)||!json(value.result)||!instant(value.completedAt))invalid();
 const found=parseActionReference(value.reference);
 if(found.id!==reference.id||found.revision!==reference.revision||found.hash!==reference.hash||found.expiresAt!==reference.expiresAt)invalid();
 const result=value.result;
 if(value.operation==='proposal.save_draft'){
  if(typeof result.proposalId!=='string'||!uuid.test(result.proposalId)||result.status!=='draft'||result.url!=='/proposals?open='+result.proposalId)invalid();
 }else if(typeof result.draftId!=='string'||!uuid.test(result.draftId)||typeof result.hash!=='string'||!digest.test(result.hash)||!Array.isArray(result.createdRecordIds)||result.createdRecordIds.length<1||result.createdRecordIds.length>80||result.createdRecordIds.some(id=>typeof id!=='string'||!uuid.test(id))||new Set(result.createdRecordIds).size!==result.createdRecordIds.length||!Array.isArray(result.createdCatalogRecords)||!instant(result.executedAt)||typeof result.idempotent!=='boolean'||result.onHandChangedByCreation!==false||result.url!=='/inventory#pending-receivals')invalid();
 return {...value,reference:found} as ActionReceipt;
}
/** Trusted host publication ONLY: pass deterministic domain-adapter output
 * after runtime/source reauthorization. Never expose this factory to a model
 * tool or accept client-authored intent/review in an HTTP preparation route. */
export function createTrustedActionPublisher(options:{ownerId:string;sessionId:string;service:ActionRpc}) {
 if(!uuid.test(options.ownerId)||!uuid.test(options.sessionId))invalid();
 return {async prepare(input:{conversationId:string;action:PreparedAction;supersedes?:ActionReference}):Promise<ActionCard>{
  if(!uuid.test(input.conversationId))invalid();
  const action=normalizePreparedAction(input.action),old=input.supersedes?parseActionReference(input.supersedes):null;
  let response:Awaited<ReturnType<ActionRpc['rpc']>>;
  try{response=await options.service.rpc('prepare_tenbot_reviewed_action',{p_owner:options.ownerId,p_session_id:options.sessionId,p_conversation_id:input.conversationId,p_intent:action,p_supersedes_id:old?.id??null,p_supersedes_hash:old?.hash??null});}catch{throw new ReviewedActionError('uncertain');}
  if(response.error)throw new ReviewedActionError(['42501','22023','P0002','23505'].includes(response.error.code??'')?'rejected':'uncertain');
  return parseActionCard(response.data);
 }};
}
export function createReviewedActionService(caller:ActionRpc) {
 async function call(name:string,args:Record<string,unknown>,mutation=false) {
  let response:Awaited<ReturnType<ActionRpc['rpc']>>;
  try{response=await caller.rpc(name,args);}catch{throw new ReviewedActionError(mutation?'uncertain':'not_available');}
  if(response.error)throw new ReviewedActionError(['42501','22023','P0002','23505'].includes(response.error.code??'')?'rejected':mutation?'uncertain':'not_available');
  return response.data;
 }
 const args=(reference:ActionReference)=>{const r=parseActionReference(reference);return {p_action_id:r.id,p_revision:r.revision,p_expected_hash:r.hash};};
 return {
  async get(reference:ActionReference):Promise<ActionStatus>{
   const value=await call('get_tenbot_reviewed_action',args(reference));
   if(!object(value)||!keys(value,['contract','card','state','receipt'])||value.contract!=='tenbot.actions.v1'||!['prepared','authorized','completed','failed','revoked','expired'].includes(String(value.state)))invalid();
   const card=parseActionCard(value.card);if(card.reference.id!==reference.id||card.reference.hash!==reference.hash||card.reference.revision!==reference.revision||card.reference.expiresAt!==reference.expiresAt)invalid();
   const receipt=value.receipt===null?null:parseActionReceipt(value.receipt,card.reference);
   if((value.state==='completed')!==(receipt!==null))invalid();
   return {contract:'tenbot.actions.v1',card,state:value.state as ActionStatus['state'],receipt};
  },
  async revoke(reference:ActionReference):Promise<void>{const value=await call('revoke_tenbot_reviewed_action',args(reference),true);if(!object(value)||value.revoked!==true||value.id!==reference.id)invalid();},
  async preview(reference:ActionReference):Promise<PreparedAction>{return normalizePreparedAction(await call('preview_tenbot_reviewed_action',args(reference)));},
  /** Trusted confirmation orchestration only. Stages canonical review metadata;
   * the returned IDs are not created Pending Receivals or a success receipt. */
  async stageReceivals(reference:ActionReference):Promise<{draftId:string;hash:string;approvalId:string}>{
   const value=await call('stage_tenbot_reviewed_receivals',args(reference),true);
   if(object(value)&&value.kind==='action_failure'&&value.status==='failed'&&value.id===reference.id&&value.hash===reference.hash)throw new ReviewedActionError('rejected');
   if(!object(value)||!keys(value,['draftId','hash','approvalId'])||typeof value.draftId!=='string'||!uuid.test(value.draftId)||typeof value.hash!=='string'||!digest.test(value.hash)||typeof value.approvalId!=='string'||!uuid.test(value.approvalId))invalid();
   return {draftId:value.draftId,hash:value.hash,approvalId:value.approvalId};
  },
  async execute(reference:ActionReference):Promise<ActionReceipt>{const value=await call('execute_tenbot_reviewed_action',args(reference),true);if(object(value)&&value.kind==='action_failure'&&value.status==='failed'&&value.id===reference.id&&value.hash===reference.hash)throw new ReviewedActionError('rejected');return parseActionReceipt(value,reference);},
 };
}
