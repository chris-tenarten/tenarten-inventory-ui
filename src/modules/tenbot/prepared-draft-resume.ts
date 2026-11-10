import type {LocalAttachment,LocalDemoStatus,LocalOrderDetails,LocalReceivalDraft} from './live-review';
import {TENBOT_CANARY_OWNER} from '../inventory/tenbot-canary-access';
import {TENBOT_CANARY_EXECUTION_SOURCE_ID} from '../inventory/tenbot-canary-execution';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const digest=/^[a-f0-9]{64}$/;
const prefix='tenops.tenbot.prepared-source.v1:';
const object=(value:unknown):value is Record<string,unknown>=>value!==null&&typeof value==='object'&&!Array.isArray(value);
type LocatorStorage=Pick<Storage,'getItem'|'setItem'|'removeItem'>;
const browserStorage=()=>{try{return typeof window==='undefined'?null:window.sessionStorage;}catch{return null;}};

/** Only an opaque source ID survives remounts. The source, invoice and draft
 * are always retrieved again with the current employee's authenticated client. */
export function readPreparedDraftLocator(owner:string,storage:LocatorStorage|null=browserStorage()):string|null{
 if(!uuid.test(owner)||!storage)return null;
 try{
  const raw=storage.getItem(prefix+owner);if(!raw)return null;
  const value:unknown=JSON.parse(raw);
  if(!object(value)||Object.keys(value).length!==2||value.owner!==owner||typeof value.sourceId!=='string'||!uuid.test(value.sourceId)){storage.removeItem(prefix+owner);return null;}
  return value.sourceId;
 }catch{return null;}
}
export function savePreparedDraftLocator(owner:string,sourceId:string,storage:LocatorStorage|null=browserStorage()):void{
 if(!uuid.test(owner)||!uuid.test(sourceId)||!storage)return;
 try{storage.setItem(prefix+owner,JSON.stringify({owner,sourceId}));}catch{/* Storage is a convenience, never authorization. */}
}
export function clearPreparedDraftLocator(owner:string,storage:LocatorStorage|null=browserStorage()):void{
 if(!uuid.test(owner)||!storage)return;
 try{storage.removeItem(prefix+owner);}catch{/* No local-storage fallback retains invoice content. */}
}

export type PreparedReceivalResume={attachment:LocalAttachment;draft:LocalReceivalDraft;simulation:false;notices?:string[]};
/** Shape/identity checking protects UI restoration; server ownership, RLS,
 * source evidence, permissions and expiry remain the actual trust boundary. */
export function preparedReceivalResumeResponse(value:unknown,sourceId:string,now=Date.now()):PreparedReceivalResume{
 if(!uuid.test(sourceId)||!object(value)||value.simulation!==false||!object(value.attachment)||!object(value.draft))throw Error('The prepared invoice response is invalid. No action was approved.');
 const attachment=value.attachment,draft=value.draft;
 if(typeof attachment.expiresAt==='string'&&Number.isFinite(Date.parse(attachment.expiresAt))&&Date.parse(attachment.expiresAt)<=now)throw Object.assign(Error('This prepared invoice is expired. No action was approved.'),{status:410});
 if(attachment.attachmentId!==sourceId||attachment.sourceId!==sourceId||attachment.simulation!==false||typeof attachment.filename!=='string'||!attachment.filename||attachment.filename.length>255||!['application/pdf','image/png','image/jpeg'].includes(String(attachment.mediaType))||typeof attachment.expiresAt!=='string'||!Number.isFinite(Date.parse(attachment.expiresAt))||Date.parse(attachment.expiresAt)<=now)throw Error('This prepared invoice is unavailable or expired. No action was approved.');
 const details=draft.orderDetails;
 if(draft.id!==sourceId||draft.attachmentId!==sourceId||draft.simulation!==false||draft.status!=='review_required'||!Number.isSafeInteger(draft.revision)||Number(draft.revision)<1||typeof draft.hash!=='string'||!digest.test(draft.hash)||!object(details)||!['orderedBy','orderDate','location'].every(key=>typeof details[key]==='string')||!Array.isArray(draft.rows)||!draft.rows.length||draft.rows.length>60||!Array.isArray(draft.missingFields))throw Error('The prepared draft could not be restored. No action was approved.');
 if(!draft.rows.every(row=>object(row)&&typeof row.lineId==='string'&&row.lineId.startsWith(sourceId+':L')&&typeof row.quantity==='string'&&typeof row.unit==='string'&&typeof row.excluded==='boolean'&&Array.isArray(row.reasons)))throw Error('The prepared draft has invalid line evidence. No action was approved.');
 return value as unknown as PreparedReceivalResume;
}
/** One explicit non-model endpoint. Never retries as ask/upload or supplies
 * draft rows, metadata, model history or an approval on behalf of an employee. */
export async function resumePreparedReceival(sourceId:string,request:(body:{action:'resume';sourceId:string})=>Promise<unknown>,now=Date.now()):Promise<PreparedReceivalResume>{
 if(!uuid.test(sourceId))throw Error('Choose a valid prepared invoice.');
 return preparedReceivalResumeResponse(await request({action:'resume',sourceId}),sourceId,now);
}
export function preparedDraftResumeFailure(error:unknown):string{
 const status=object(error)?Number(error.status):0;
 if(status===403)return 'Your current permissions do not allow this prepared invoice. No AI request was repeated.';
 if([400,404,409,410].includes(status))return 'This prepared invoice is expired, changed or unavailable. No AI request was repeated.';
 return 'The prepared invoice could not be restored. No AI request was repeated. Reopen TenBot to retry its authorized review.';
}
/** These are an editable local proposal, not invoice evidence or a mutation.
 * A saved nonblank value always wins; the exact stored draft stays unchanged. */
export function proposedCanaryOrderDetails(owner:string,draft:LocalReceivalDraft,status:LocalDemoStatus):LocalOrderDetails|undefined{
 if(owner!==TENBOT_CANARY_OWNER||draft.id!==TENBOT_CANARY_EXECUTION_SOURCE_ID||status.executionOnly!==true)return undefined;
 const proposal={orderedBy:'',orderDate:'',location:''};
 return Object.fromEntries((Object.keys(proposal) as (keyof LocalOrderDetails)[]).map(key=>[key,draft.orderDetails[key]||proposal[key]])) as LocalOrderDetails;
}
