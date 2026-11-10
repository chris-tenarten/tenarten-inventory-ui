/** Frontend projection of the accepted afa4bfa tenbot.actions.v1 wire contract.
 * This module does not prepare, authorize or execute business operations. */
export const ACTION_CONTRACT='tenbot.actions.v1' as const;
export type JsonValue=null|boolean|number|string|JsonValue[]|{[key:string]:JsonValue};
export type ActionOperation='proposal.save_draft'|'inventory.create_pending_receivals';
export type ActionReference={id:string;revision:number;hash:string;expiresAt:string};
export type ActionReview={
 title:string;summary:string;consequences:string[];
 fields:Array<{path:string;label:string;value:JsonValue;editable?:boolean}>;
 issues:Array<{code:string;message:string;blocking:boolean}>;
 preview?:{kind:'proposal_pdf'};
};
export type ActionCard={kind:'proposed_action';contract:typeof ACTION_CONTRACT;reference:ActionReference;operation:ActionOperation;review:ActionReview;confirmation:{kind:'account_password';available:boolean}};
export type ActionReceipt={contract:typeof ACTION_CONTRACT;kind:'action_result';reference:ActionReference;operation:ActionOperation;status:'completed';idempotent:boolean;result:Record<string,JsonValue>;completedAt:string};
export type ActionStatus={contract:typeof ACTION_CONTRACT;card:ActionCard;state:'prepared'|'authorized'|'completed'|'failed'|'revoked'|'expired';receipt:ActionReceipt|null};

export class ActionContractError extends Error {
 constructor(){super('The saved action could not be verified. Check its status before continuing.');this.name='ActionContractError';}
}
export const isActionObject=(value:unknown):value is Record<string,unknown>=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const keys=(value:Record<string,unknown>,allowed:string[])=>Object.keys(value).every(key=>allowed.includes(key));
const text=(value:unknown,max:number):value is string=>typeof value==='string'&&value.length>0&&value.length<=max;
const instant=(value:unknown):value is string=>text(value,80)&&Number.isFinite(Date.parse(value));
export const isActionUuid=(value:unknown):value is string=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const operation=(value:unknown):value is ActionOperation=>value==='proposal.save_draft'||value==='inventory.create_pending_receivals';
function invalid():never{throw new ActionContractError();}
function json(value:unknown,depth=0):value is JsonValue {
 if(depth>16)return false;
 if(value===null||typeof value==='boolean'||typeof value==='string')return true;
 if(typeof value==='number')return Number.isFinite(value);
 if(Array.isArray(value))return value.length<=500&&value.every(item=>json(item,depth+1));
 return isActionObject(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value))&&Object.keys(value).length<=200&&Object.entries(value).every(([key,item])=>!['__proto__','constructor','prototype'].includes(key)&&json(item,depth+1));
}
export function parseActionReference(value:unknown):ActionReference {
 if(!isActionObject(value)||!keys(value,['id','revision','hash','expiresAt'])||!isActionUuid(value.id)||!Number.isSafeInteger(value.revision)||Number(value.revision)<1||typeof value.hash!=='string'||!/^[a-f0-9]{64}$/.test(value.hash)||!instant(value.expiresAt))invalid();
 return {id:value.id,revision:Number(value.revision),hash:value.hash,expiresAt:value.expiresAt};
}
export function sameActionReference(left:ActionReference,right:ActionReference):boolean {
 return left.id===right.id&&left.revision===right.revision&&left.hash===right.hash&&left.expiresAt===right.expiresAt;
}
export function parseActionCard(value:unknown):ActionCard {
 if(!isActionObject(value)||!keys(value,['kind','contract','reference','operation','review','confirmation'])||value.kind!=='proposed_action'||value.contract!==ACTION_CONTRACT||!operation(value.operation)||!isActionObject(value.confirmation)||!keys(value.confirmation,['kind','available'])||value.confirmation.kind!=='account_password'||typeof value.confirmation.available!=='boolean')invalid();
 const review=value.review;
 if(!isActionObject(review)||!keys(review,['title','summary','consequences','fields','issues','preview'])||!text(review.title,160)||!text(review.summary,1200)||!Array.isArray(review.consequences)||review.consequences.length>12||review.consequences.some(item=>!text(item,600))||!Array.isArray(review.fields)||review.fields.length>240||!Array.isArray(review.issues)||review.issues.length>80)invalid();
 if(review.fields.some(field=>!isActionObject(field)||!keys(field,['path','label','value','editable'])||!text(field.path,200)||!text(field.label,200)||!json(field.value)||field.editable!==undefined&&typeof field.editable!=='boolean')||review.issues.some(issue=>!isActionObject(issue)||!keys(issue,['code','message','blocking'])||!text(issue.code,100)||!text(issue.message,600)||typeof issue.blocking!=='boolean'))invalid();
 if(review.preview!==undefined&&(!isActionObject(review.preview)||!keys(review.preview,['kind'])||review.preview.kind!=='proposal_pdf'||value.operation!=='proposal.save_draft'))invalid();
 if(new TextEncoder().encode(JSON.stringify({operation:value.operation,parameters:{},review})).length>120000)invalid();
 return {kind:'proposed_action',contract:ACTION_CONTRACT,reference:parseActionReference(value.reference),operation:value.operation,review:JSON.parse(JSON.stringify(review)) as ActionReview,confirmation:{kind:'account_password',available:value.confirmation.available}};
}
export function parseActionReceipt(value:unknown,reference:ActionReference,expectedOperation?:ActionOperation):ActionReceipt {
 if(!isActionObject(value)||!keys(value,['contract','kind','reference','operation','status','idempotent','result','completedAt'])||value.contract!==ACTION_CONTRACT||value.kind!=='action_result'||value.status!=='completed'||!operation(value.operation)||expectedOperation&&value.operation!==expectedOperation||typeof value.idempotent!=='boolean'||!isActionObject(value.result)||!json(value.result)||!instant(value.completedAt))invalid();
 const found=parseActionReference(value.reference);if(!sameActionReference(found,reference))invalid();
 if(!resultRecordLink(value.operation,value.result))invalid();
 return {contract:ACTION_CONTRACT,kind:'action_result',reference:found,operation:value.operation,status:'completed',idempotent:value.idempotent,result:JSON.parse(JSON.stringify(value.result)) as Record<string,JsonValue>,completedAt:value.completedAt};
}
export function parseActionStatus(value:unknown,reference?:ActionReference):ActionStatus {
 if(!isActionObject(value)||!keys(value,['contract','card','state','receipt'])||value.contract!==ACTION_CONTRACT||!['prepared','authorized','completed','failed','revoked','expired'].includes(String(value.state)))invalid();
 const card=parseActionCard(value.card);if(reference&&!sameActionReference(card.reference,reference))invalid();
 const receipt=value.receipt===null?null:parseActionReceipt(value.receipt,card.reference,card.operation);
 if((value.state==='completed')!==(receipt!==null))invalid();
 return {contract:ACTION_CONTRACT,card,state:value.state as ActionStatus['state'],receipt};
}
/** Canonical result requirements match accepted afa4bfa. The same validation
 * guards both completion claims and navigation to the created records. */
function resultRecordLink(operation:ActionOperation,result:Record<string,unknown>):{href:string;label:string}|null {
 if(operation==='inventory.create_pending_receivals'){
  if(!isActionUuid(result.draftId)||typeof result.hash!=='string'||!/^[a-f0-9]{64}$/.test(result.hash)||!Array.isArray(result.createdRecordIds)||result.createdRecordIds.length<1||result.createdRecordIds.length>80||result.createdRecordIds.some(id=>!isActionUuid(id))||new Set(result.createdRecordIds).size!==result.createdRecordIds.length||!Array.isArray(result.createdCatalogRecords)||!instant(result.executedAt)||typeof result.idempotent!=='boolean'||result.onHandChangedByCreation!==false||result.url!=='/inventory#pending-receivals')return null;
  return {href:'/inventory#pending-receivals',label:'Open Pending Receivals'};
 }
 if(operation!=='proposal.save_draft'||result.status!=='draft'||!isActionUuid(result.proposalId))return null;
 const href=`/proposals?open=${result.proposalId}`;
 return result.url===href?{href,label:'Open Proposal draft'}:null;
}
export function actionRecordLink(receipt:ActionReceipt):{href:string;label:string}|null {
 if(receipt.contract!==ACTION_CONTRACT||receipt.kind!=='action_result'||receipt.status!=='completed')return null;
 return resultRecordLink(receipt.operation,receipt.result);
}
