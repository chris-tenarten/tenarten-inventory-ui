/** Workspace's trusted review channel. Never register as an AgentTool. */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- Edge/Node source
// @ts-ignore -- explicit Edge extension
import {createReviewedActionService,parseActionReference,ReviewedActionError,type ActionRpc} from './tenbot-actions.ts';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- Edge/Node source
// @ts-ignore -- explicit Edge extension
import {confirmReviewedActionPassword,ActionPasswordError,type ActionPasswordDependencies} from './tenbot-action-auth.ts';

export const TENBOT_ACTION_WORKSPACE='tenbot.actions.v1';
export type ActionTransportDependencies={
 enabled:boolean;origin:string;caller:ActionRpc;password:ActionPasswordDependencies;
 /** Loads the exact saved review snapshot and renders through TenOps's existing
  * authorized PDF-preview service. No client snapshot or arbitrary URL. */
 preview?(reference:ReturnType<typeof parseActionReference>):Promise<Uint8Array>;
};
const record=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
export function createReviewedActionTransport(deps:ActionTransportDependencies){
 const service=createReviewedActionService(deps.caller);
 return async(body:unknown):Promise<{body:unknown;status:number;pdf?:Uint8Array}>=>{
  try{
   // The additional application gate cannot activate Production-origin writes.
   // Database action and existing domain execution policies independently gate.
   if(!deps.enabled||deps.origin!=='https://tendev.pages.dev')throw new ReviewedActionError('not_available');
   if(!record(body)||body.workspace!==TENBOT_ACTION_WORKSPACE||!['status','cancel','confirm','preview'].includes(String(body.action)))throw new ReviewedActionError('invalid_action');
   const allowed=['workspace','action','reference',...(body.action==='confirm'?['password']:[])];
   if(Object.keys(body).some(key=>!allowed.includes(key)))throw new ReviewedActionError('invalid_action');
   const reference=parseActionReference(body.reference);
   if(body.action==='confirm'){
    const confirmation=await confirmReviewedActionPassword(deps.password,{reference,password:body.password});
    return {status:200,body:confirmation};
   }
   if(body.action==='status')return {status:200,body:await service.get(reference)};
   if(body.action==='cancel'){await service.revoke(reference);return {status:200,body:{contract:TENBOT_ACTION_WORKSPACE,kind:'action_cancelled',reference}};}
   const status=await service.get(reference);
   if(status.card.operation!=='proposal.save_draft'||!status.card.review.preview||!['prepared','authorized'].includes(status.state)||!deps.preview)throw new ReviewedActionError('not_available');
   const pdf=await deps.preview(reference);
   if(pdf.length<5||new TextDecoder().decode(pdf.subarray(0,5))!=='%PDF-')throw new ReviewedActionError('not_available');
   return {status:200,body:null,pdf};
  }catch(error){
   // Raw Auth/database/provider errors and input credentials are never returned.
   const known=error instanceof ActionPasswordError||error instanceof ReviewedActionError;
   return {status:error instanceof ActionPasswordError&&error.code==='password_rejected'?401:known?409:503,
    body:{contract:TENBOT_ACTION_WORKSPACE,kind:'action_error',error:{code:known?error.code:'unavailable',message:known?error.message:'This operation is temporarily unavailable. Check its saved status before retrying.'}}};
  }
 };
}
