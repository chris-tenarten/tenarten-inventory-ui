/** Trusted HTTP authentication boundary only. Never register this module as an
 * agent tool or include its request/response in conversation/model history. */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- Deno requires the extension; both Node and Edge checks inspect this file.
// @ts-ignore Explicit extension is required by the deployed Deno runtime.
import {createReviewedActionService,parseActionReference,type ActionReceipt,type ActionReference,type ActionRpc,ReviewedActionError} from './tenbot-actions.ts';

type AuthUser={id:string;email?:string};
export type PrivateActionSession={access_token:string;refresh_token:string;expires_at:number;token_type:'bearer'};
export type PasswordAuthClient={auth:{
 signInWithPassword(input:{email:string;password:string}):Promise<{data:{user:AuthUser|null;session:{access_token:string;refresh_token:string;expires_at?:number;token_type?:string}|null};error:unknown}>;
 getUser(token:string):Promise<{data:{user:AuthUser|null};error:unknown}>;
}};
export type ActionPasswordDependencies={
 /** Must verify bearer with Supabase Auth, not client-replayed session data. */
 authenticate():Promise<{user:AuthUser;token:string;caller:ActionRpc}>;
 /** A NEW Auth client: persistSession/autoRefreshToken/detectSessionInUrl=false.
  * It must have no caller Authorization override or shared storage. */
 createPasswordClient():PasswordAuthClient;
 callerForToken(token:string):ActionRpc;
 /** Restricted service-role metadata RPC adapter, never a business client. */
 service:ActionRpc;
 now?:()=>number;
};
export type TrustedActionConfirmation={
 contract:'tenbot.actions.v1';reference:ActionReference;status:'completed'|'failed'|'uncertain';
 receipt:ActionReceipt|null;session:PrivateActionSession;
 recovery:{kind:'refresh_action';reference:ActionReference};
 error?:{code:'authorization_changed'|'outcome_uncertain';message:string};
};
export class ActionPasswordError extends Error {
 constructor(readonly code:'invalid_request'|'sign_in_required'|'password_rejected'|'mfa_required'|'unavailable') {
  super({invalid_request:'Review the proposed changes before confirming.',sign_in_required:'Sign in to confirm this operation.',password_rejected:'Your account password could not be verified.',mfa_required:'This account requires additional authentication before this operation can be enabled.',unavailable:'Password confirmation is temporarily unavailable.'}[code]);this.name='ActionPasswordError';
 }
}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function claims(token:string,owner:string,now:number):{sessionId:string;aal:'aal1'|'aal2'} {
 try {
  const segments=token.split('.');if(segments.length!==3)throw Error();
  const payload=JSON.parse(atob(segments[1].replace(/-/g,'+').replace(/_/g,'/'))) as Record<string,unknown>;
  if(payload.sub!==owner||payload.role!=='authenticated'||typeof payload.session_id!=='string'||!uuid.test(payload.session_id)||!['aal1','aal2'].includes(String(payload.aal))||typeof payload.exp!=='number'||payload.exp*1000<=now)throw Error();
  return {sessionId:payload.session_id,aal:payload.aal as 'aal1'|'aal2'};
 }catch{throw new ActionPasswordError('sign_in_required');}
}
/** Password is sent once to Supabase Auth. Every later dependency receives
 * only owner/action/session identifiers. Session handoff belongs exclusively
 * in the private no-store HTTP response consumed by the authentication UI. */
export async function confirmReviewedActionPassword(deps:ActionPasswordDependencies,input:unknown):Promise<TrustedActionConfirmation> {
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!['reference','password'].includes(k)))throw new ActionPasswordError('invalid_request');
 const body=input as Record<string,unknown>;
 if(typeof body.password!=='string'||body.password.length<1||body.password.length>4096)throw new ActionPasswordError('invalid_request');
 let reference:ActionReference;try{reference=parseActionReference(body.reference);}catch{throw new ActionPasswordError('invalid_request');}
 const now=deps.now??Date.now;
 let actor:Awaited<ReturnType<ActionPasswordDependencies['authenticate']>>;
 try{actor=await deps.authenticate();}catch{throw new ActionPasswordError('sign_in_required');}
 if(!uuid.test(actor.user.id)||typeof actor.user.email!=='string'||!actor.user.email.trim())throw new ActionPasswordError('sign_in_required');
 const original=claims(actor.token,actor.user.id,now());
 // Password-only login cannot preserve AAL2. Stop before creating a competing
 // session until the Workspace supports completing the existing MFA flow.
 if(original.aal!=='aal1')throw new ActionPasswordError('mfa_required');
 let current:Awaited<ReturnType<ReturnType<typeof createReviewedActionService>['get']>>;
 try{current=await createReviewedActionService(actor.caller).get(reference);}catch{throw new ActionPasswordError('unavailable');}
 if(current.card.operation!=='proposal.save_draft'||!current.card.confirmation.available||current.state!=='prepared'||current.card.review.issues.some(x=>x.blocking))throw new ActionPasswordError('unavailable');
 let auth:PasswordAuthClient,login:Awaited<ReturnType<PasswordAuthClient['auth']['signInWithPassword']>>;
 try{auth=deps.createPasswordClient();login=await auth.auth.signInWithPassword({email:actor.user.email,password:body.password});}catch{throw new ActionPasswordError('password_rejected');}
 if(login.error||!login.data.user||login.data.user.id!==actor.user.id||!login.data.session)throw new ActionPasswordError('password_rejected');
 const fresh=login.data.session;
 let renewed:ReturnType<typeof claims>;
 try{renewed=claims(fresh.access_token,actor.user.id,now());}catch{throw new ActionPasswordError('unavailable');}
 if(renewed.aal!==original.aal||renewed.sessionId===original.sessionId||!fresh.refresh_token||!Number.isSafeInteger(fresh.expires_at)||(fresh.expires_at??0)*1000<=now())throw new ActionPasswordError('unavailable');
 const session:PrivateActionSession={access_token:fresh.access_token,refresh_token:fresh.refresh_token,expires_at:fresh.expires_at!,token_type:'bearer'};
 const response=(status:TrustedActionConfirmation['status'],receipt:ActionReceipt|null):TrustedActionConfirmation=>({contract:'tenbot.actions.v1',reference,status,receipt,session,recovery:{kind:'refresh_action',reference},...(status==='completed'?{}:{error:status==='uncertain'?{code:'outcome_uncertain' as const,message:'The operation may still be completing. Check its saved status before trying again.'}:{code:'authorization_changed' as const,message:'The operation was not completed. Refresh its saved status and review any changed requirements.'}})});
 // From here onward every failure returns the new session privately, so a
 // single-session Auth policy cannot strand the employee on the old login.
 try {
  const verified=await auth.auth.getUser(fresh.access_token);
  if(verified.error||verified.data.user?.id!==actor.user.id)return response('failed',null);
  const stamped=await deps.service.rpc('stamp_tenbot_action_password',{p_owner:actor.user.id,p_action_id:reference.id,p_revision:reference.revision,p_expected_hash:reference.hash,p_original_session_id:original.sessionId,p_execution_session_id:renewed.sessionId,p_aal:renewed.aal});
  if(stamped.error)return response(['42501','22023','P0002','23505'].includes(stamped.error.code??'')?'failed':'uncertain',null);
  const value=stamped.data as Record<string,unknown>|null;
  if(!value||value.id!==reference.id||value.hash!==reference.hash||value.authorized!==true)return response('uncertain',null);
  const caller=deps.callerForToken(fresh.access_token);
  return response('completed',await createReviewedActionService(caller).execute(reference));
 }catch(error){return response(error instanceof ReviewedActionError&&error.code==='rejected'?'failed':'uncertain',null);}
}
