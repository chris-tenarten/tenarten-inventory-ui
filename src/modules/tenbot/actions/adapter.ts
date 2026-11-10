/** Trusted action channel only. No ordinary chat transport, logging or draft store. */
import {ACTION_CONTRACT,ActionContractError,isActionObject,isActionUuid,parseActionReference,parseActionReceipt,parseActionStatus,sameActionReference,type ActionOperation,type ActionReceipt,type ActionReference,type ActionStatus} from './contract';

export type ActionConfirmation={status:'completed'|'failed'|'uncertain';receipt:ActionReceipt|null};
export type ActionAdapter={
 availability:'connected'|'preview'|'unavailable';
 status(reference:ActionReference,signal?:AbortSignal):Promise<ActionStatus>;
 preview(reference:ActionReference,signal?:AbortSignal):Promise<Blob>;
 cancel(reference:ActionReference,signal?:AbortSignal):Promise<void>;
 confirm(reference:ActionReference,password:string,signal?:AbortSignal):Promise<ActionConfirmation>;
};
export type ActionAdapterErrorCode='not_connected'|'sign_in_required'|'password_rejected'|'mfa_required'|'changed'|'unavailable'|'uncertain'|'invalid_response';
const messages:Record<ActionAdapterErrorCode,string>={
 not_connected:'Interactive actions are not connected yet. Nothing was submitted.',
 sign_in_required:'Your account session changed. Sign in and check the action status before continuing.',
 password_rejected:'Your TenOps password could not be verified. Try again or reset it through your account.',
 mfa_required:'This account needs additional authentication before this action can be confirmed.',
 changed:'This action changed or is no longer available. Refresh its status and review it again.',
 unavailable:'This action is temporarily unavailable. Check its saved status before continuing.',
 uncertain:'The result is not yet confirmed. Check the saved status before trying again.',
 invalid_response:'The action response could not be verified. Check its saved status before continuing.',
};
export class ActionAdapterError extends Error {
 constructor(readonly code:ActionAdapterErrorCode){super(messages[code]);this.name='ActionAdapterError';}
}
const disconnected=async():Promise<never>=>{throw new ActionAdapterError('not_connected');};
export const unavailableActionAdapter:ActionAdapter={availability:'unavailable',status:disconnected,preview:disconnected,cancel:disconnected,confirm:disconnected};

export type PrivateActionSession={access_token:string;refresh_token:string;expires_at:number;token_type:'bearer'};
export type ActionSessionSnapshot={ownerId:string;accessToken:string;contextKey:string};
/** Infrastructure must implement the atomic expected-session handoff using the
 * existing Auth subsystem. A plain unchecked setSession callback is insufficient. */
export type TrustedActionSessionAccess={
 read():Promise<ActionSessionSnapshot|null>;
 verifyUser(accessToken:string):Promise<{id:string}|null>;
 installSession(session:PrivateActionSession,expected:ActionSessionSnapshot):Promise<void>;
};
export type TrustedActionAdapterOptions={
 enabled?:boolean;
 /** Infrastructure configuration only; never a model/user/query supplied URL. */
 functionUrl:string;
 /** Existing public project key; never a service-role credential. */
 anonKey?:string;
 session:TrustedActionSessionAccess;
 fetch?:typeof fetch;
 now?:()=>number;
};
type SessionClaims={ownerId:string;sessionId:string;aal:'aal1'|'aal2';expiresAt:number};
function claims(token:unknown,ownerId:string,now:number):SessionClaims {
 try{
  if(typeof token!=='string'||token.length>16384)throw Error();
  const pieces=token.split('.');if(pieces.length!==3)throw Error();
  const value=JSON.parse(atob(pieces[1].replace(/-/g,'+').replace(/_/g,'/')));
  if(!isActionObject(value)||value.sub!==ownerId||value.role!=='authenticated'||!isActionUuid(value.session_id)||!['aal1','aal2'].includes(String(value.aal))||typeof value.exp!=='number'||value.exp*1000<=now)throw Error();
  return {ownerId,sessionId:value.session_id,aal:value.aal as 'aal1'|'aal2',expiresAt:value.exp};
 }catch{throw new ActionAdapterError('sign_in_required');}
}
const sameSession=(left:ActionSessionSnapshot,right:ActionSessionSnapshot|null)=>!!right&&left.ownerId===right.ownerId&&left.accessToken===right.accessToken&&left.contextKey===right.contextKey;
function privateSession(value:unknown,owner:string,now:number):PrivateActionSession {
 if(!isActionObject(value)||Object.keys(value).some(key=>!['access_token','refresh_token','expires_at','token_type'].includes(key))||typeof value.access_token!=='string'||typeof value.refresh_token!=='string'||!value.refresh_token||value.refresh_token.length>16384||!Number.isSafeInteger(value.expires_at)||Number(value.expires_at)*1000<=now||value.token_type!=='bearer')throw new ActionAdapterError('invalid_response');
 claims(value.access_token,owner,now);
 return {access_token:value.access_token,refresh_token:value.refresh_token,expires_at:Number(value.expires_at),token_type:'bearer'};
}
function backendError(value:unknown,mutation:boolean):ActionAdapterError {
 const code=isActionObject(value)&&value.contract===ACTION_CONTRACT&&value.kind==='action_error'&&isActionObject(value.error)?value.error.code:null;
 if(code==='password_rejected'||code==='mfa_required'||code==='sign_in_required')return new ActionAdapterError(code);
 if(code==='invalid_action'||code==='invalid_request'||code==='rejected')return new ActionAdapterError('changed');
 return new ActionAdapterError(mutation?'uncertain':'unavailable');
}

/** Explicit environment-gated connection. Trusted history supplies reviews;
 * existing Auth installs sessions through an expected-snapshot storage guard. */
export function createTrustedActionAdapter(options:TrustedActionAdapterOptions):ActionAdapter {
 if(options.enabled!==true)return unavailableActionAdapter;
 const endpoint=new URL(options.functionUrl);
 if(endpoint.username||endpoint.password||endpoint.search||endpoint.hash||endpoint.pathname!=='/functions/v1/tenbot'||endpoint.protocol!=='https:'&&!(endpoint.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(endpoint.hostname)))throw new ActionAdapterError('not_connected');
 const send=options.fetch??fetch,now=options.now??Date.now;
 const reviews=new Map<string,{operation:ActionOperation;expected:ActionSessionSnapshot;confirmable:boolean}>();
 const key=(reference:ActionReference)=>`${reference.id}:${reference.revision}:${reference.hash}:${reference.expiresAt}`;
 async function snapshot():Promise<ActionSessionSnapshot>{
  const value=await options.session.read();
  if(!value||!isActionUuid(value.ownerId)||!value.contextKey)throw new ActionAdapterError('sign_in_required');
  claims(value.accessToken,value.ownerId,now());return {...value};
 }
 async function current(expected:ActionSessionSnapshot){if(!sameSession(expected,await options.session.read()))throw new ActionAdapterError('sign_in_required');}
 async function request(action:'status'|'preview'|'cancel'|'confirm',reference:ActionReference,signal?:AbortSignal,password?:string,reviewedSession?:ActionSessionSnapshot):Promise<{response:Response;expected:ActionSessionSnapshot}>{
  const parsed=parseActionReference(reference),expected=reviewedSession??await snapshot();
  if(reviewedSession)await current(expected);
  if(signal?.aborted)throw new ActionAdapterError('unavailable');
  if((action==='confirm'||action==='preview')&&Date.parse(parsed.expiresAt)<=now())throw new ActionAdapterError('changed');
  if(action==='confirm'&&claims(expected.accessToken,expected.ownerId,now()).aal!=='aal1')throw new ActionAdapterError('mfa_required');
  const controller=new AbortController(),abort=()=>controller.abort();
  signal?.addEventListener('abort',abort,{once:true});const timer=setTimeout(abort,35000);
  try{
   const body:Record<string,unknown>={workspace:ACTION_CONTRACT,action,reference:parsed};
   if(action==='confirm')body.password=password;
   let response:Response;
   try{response=await send(endpoint.href,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${expected.accessToken}`,...(options.anonKey?{apikey:options.anonKey}:{})},body:JSON.stringify(body),cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer',signal:controller.signal});}
   finally{delete body.password;}
   await current(expected);return {response,expected};
  }catch(caught){if(caught instanceof ActionAdapterError||caught instanceof ActionContractError)throw caught;throw new ActionAdapterError(action==='confirm'||action==='cancel'?'uncertain':'unavailable');}
  finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
 }
 async function responseJson(response:Response,mutation=false):Promise<unknown>{
  let value:unknown;try{value=await response.json();}catch{throw new ActionAdapterError(mutation?'uncertain':'invalid_response');}
  if(!response.ok)throw backendError(value,mutation);
  return value;
 }
 const adapter:ActionAdapter={
  availability:'connected',
  async status(reference,signal){
   reviews.delete(key(reference));
   const {response,expected}=await request('status',reference,signal);
   const status=parseActionStatus(await responseJson(response),reference);await current(expected);reviews.set(key(reference),{operation:status.card.operation,expected,confirmable:status.state==='prepared'&&status.card.confirmation.available&&!status.card.review.issues.some(issue=>issue.blocking)});return status;
  },
  async preview(reference,signal){
   const {response,expected}=await request('preview',reference,signal);
   if(!response.ok)await responseJson(response);
   if(!response.headers.get('content-type')?.toLowerCase().startsWith('application/pdf')||!response.headers.get('cache-control')?.toLowerCase().split(',').some(value=>value.trim()==='no-store'))throw new ActionAdapterError('invalid_response');
   const blob=await response.blob();if(blob.size<5||blob.size>25000000||await blob.slice(0,5).text()!=='%PDF-')throw new ActionAdapterError('invalid_response');
   await current(expected);return blob;
  },
  async cancel(reference,signal){
   reviews.delete(key(reference));
   const {response,expected}=await request('cancel',reference,signal);
   const value=await responseJson(response,true);
   if(!isActionObject(value)||Object.keys(value).some(field=>!['contract','kind','reference'].includes(field))||value.contract!==ACTION_CONTRACT||value.kind!=='action_cancelled'||!sameActionReference(parseActionReference(value.reference),reference))throw new ActionAdapterError('invalid_response');
   await current(expected);
  },
  async confirm(reference,password,signal){
   if(typeof password!=='string'||password.length<1||password.length>4096)throw new ActionAdapterError('password_rejected');
   const reviewed=reviews.get(key(reference));
   if(!reviewed?.confirmable)throw new ActionAdapterError('changed');
   reviews.delete(key(reference));
   const {response,expected}=await request('confirm',reference,signal,password,reviewed.expected);
   const value=await responseJson(response,true);
   if(!isActionObject(value)||Object.keys(value).some(field=>!['contract','reference','status','receipt','session','recovery','error'].includes(field))||value.contract!==ACTION_CONTRACT||!['completed','failed','uncertain'].includes(String(value.status))||!sameActionReference(parseActionReference(value.reference),reference)||!isActionObject(value.recovery)||value.recovery.kind!=='refresh_action'||!sameActionReference(parseActionReference(value.recovery.reference),reference))throw new ActionAdapterError('invalid_response');
   const session=privateSession(value.session,expected.ownerId,now()),oldClaims=claims(expected.accessToken,expected.ownerId,now()),newClaims=claims(session.access_token,expected.ownerId,now());
   if(newClaims.aal!==oldClaims.aal||newClaims.sessionId===oldClaims.sessionId)throw new ActionAdapterError('invalid_response');
   try{
    const verified=await options.session.verifyUser(session.access_token);if(verified?.id!==expected.ownerId)throw new ActionAdapterError('sign_in_required');
    await current(expected);
    // The injected Auth handoff must atomically enforce this expected snapshot.
    // Even a failed/uncertain execution can have invalidated the old Auth login.
    await options.session.installSession(session,expected);
   }catch(caught){if(caught instanceof ActionAdapterError)throw caught;throw new ActionAdapterError('sign_in_required');}
   finally{session.access_token='';session.refresh_token='';delete value.session;password='';}
   // A valid fresh login must survive even if the business receipt is malformed.
   // The caller then reconciles status; malformed data never means completion.
   let receipt:ActionReceipt|null;
   try{receipt=value.receipt===null?null:parseActionReceipt(value.receipt,reference,reviewed.operation);}
   catch{throw new ActionAdapterError('invalid_response');}
   if((value.status==='completed')!==(receipt!==null))throw new ActionAdapterError('invalid_response');
   return {status:value.status as ActionConfirmation['status'],receipt};
  },
 };
 async function safe<T>(operation:()=>Promise<T>,mutation=false):Promise<T>{
  try{return await operation();}
  catch(caught){if(caught instanceof ActionAdapterError||caught instanceof ActionContractError)throw caught;throw new ActionAdapterError(mutation?'uncertain':'unavailable');}
 }
 return {
  availability:adapter.availability,
  status:(...args)=>safe(()=>adapter.status(...args)),
  preview:(...args)=>safe(()=>adapter.preview(...args)),
  cancel:(...args)=>safe(()=>adapter.cancel(...args),true),
  confirm:(...args)=>safe(()=>adapter.confirm(...args),true),
 };
}
