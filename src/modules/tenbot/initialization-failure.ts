/** Initialization diagnostics deliberately exclude response/error text, records,
 * account identifiers and documents. Only a fixed server code is actionable. */
const codes=['invoice_catalog_unavailable','invoice_jobs_unavailable','invoice_configuration_unavailable'] as const;
type FailureCode=typeof codes[number];
export type TenbotInitializationStage='local-status'|'hosted-status'|'hosted-invoice-status';
type Metadata={status:number|null;code:FailureCode|null;requestId:string|null};
const object=(value:unknown):value is Record<string,unknown>=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
export function tenbotFailureMetadata(status:unknown,payload:unknown,requestId:unknown):Metadata{
 const code=object(payload)?payload.code:undefined;
 return {status:Number.isInteger(status)&&Number(status)>=400&&Number(status)<=599?Number(status):null,
  code:codes.includes(code as FailureCode)?code as FailureCode:null,
  requestId:typeof requestId==='string'&&uuid.test(requestId)?requestId:null};
}
export function tenbotFailureTimedOut(value:unknown,depth=0):boolean{
 if(!object(value))return false;
 const timeout=(item:unknown)=>object(item)&&(item.name==='TimeoutError'||item.name==='AbortError');
 return timeout(value)||depth<2&&(tenbotFailureTimedOut(value.context,depth+1)||tenbotFailureTimedOut(value.cause,depth+1));
}
export function tenbotInitializationFailure(error:unknown,stage:TenbotInitializationStage){
 const source=object(error)?error:{},metadata=tenbotFailureMetadata(source.status,{code:source.code},source.requestId);
 let message:string;
 if(stage==='local-status')message='The local TenBot review workspace is unavailable. Reopen TenBot after its server is ready.';
 else if(stage==='hosted-status')message='TenBot could not verify its connection. Reopen TenBot to try again. The rest of TenOps remains available.';
 else if(metadata.status===401)message='Invoice preparation could not verify your sign-in. Refresh TenOps or sign in again. TenBot help remains available.';
 else if(metadata.status===403)message='Your current account cannot use invoice preparation. TenBot help remains available.';
 else if(metadata.code==='invoice_catalog_unavailable')message='The material catalog is unavailable for invoice preparation. Reopen TenBot to try again. TenBot help remains available.';
 else if(metadata.code==='invoice_jobs_unavailable')message='Production Job choices are unavailable for invoice preparation. Reopen TenBot to try again. TenBot help remains available.';
 else if(metadata.code==='invoice_configuration_unavailable')message='Invoice preparation is not ready in this environment. Contact your TenOps administrator. TenBot help remains available.';
 else if(metadata.status===503||metadata.status===504||tenbotFailureTimedOut(error))message='Invoice preparation is temporarily unavailable. Reopen TenBot to try again. TenBot help remains available.';
 else message='Invoice preparation could not be started. Reopen TenBot to try again. TenBot help remains available.';
 return {message,diagnostic:{stage,...metadata}};
}
