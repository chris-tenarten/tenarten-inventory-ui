/** Default-off, service-only maintenance; no employee, model or business-data gateway. */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- shared Node/Deno module
// @ts-ignore -- explicit local extension is required by Edge bundling.
import {cleanupExpiredInvoiceReceivalSources} from '../../../src/modules/inventory/invoice-receival-attachments.ts';
import type {InvoiceReceivalCaller} from '../../../src/modules/inventory/invoice-receival-service.ts';
type CleanupDependencies={enabled:boolean;serviceRoleKey:string;rpc:InvoiceReceivalCaller['rpc'];remove:(paths:string[])=>Promise<{error:unknown}>};
const permittedRpcs=new Set(['claim_expired_invoice_receival_sources','finish_expired_invoice_receival_source_removal']);
const reply=(status:number,value:Record<string,unknown>)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
async function boundedBody(request:Request):Promise<string>{
 const reader=request.body?.getReader();if(!reader)throw Error('invalid_body');
 let size=0;const chunks:Uint8Array[]=[];
 try{for(;;){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>1024){await reader.cancel();throw Error('body_too_large');}chunks.push(part.value);}}
 finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;for(const part of chunks){bytes.set(part,offset);offset+=part.byteLength;}
 return new TextDecoder('utf-8',{fatal:true}).decode(bytes);
}
export function createTenbotReceivalCleanupHandler(deps:CleanupDependencies){
 return async(request:Request):Promise<Response>=>{
  if(request.method!=='POST')return reply(405,{error:'method_not_allowed'});
  if(deps.serviceRoleKey.length<16||request.headers.get('authorization')!=='Bearer '+deps.serviceRoleKey)return reply(401,{error:'unauthorized'});
  if(deps.enabled!==true)return reply(503,{error:'cleanup_disabled'});
  if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type')??''))return reply(415,{error:'json_required'});
  let limit=20;
  try{
   const raw=await boundedBody(request),body:unknown=JSON.parse(raw);
   if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(key=>key!=='limit'))throw Error('invalid_body');
   const candidate=(body as {limit?:unknown}).limit;if(candidate!==undefined){if(!Number.isSafeInteger(candidate)||Number(candidate)<1||Number(candidate)>20)throw Error('invalid_body');limit=Number(candidate);}
  }catch(error){return reply(error instanceof Error&&error.message==='body_too_large'?413:400,{error:'invalid_cleanup_request'});}
  try{
   const result=await cleanupExpiredInvoiceReceivalSources({rpc:(name,args)=>{if(!permittedRpcs.has(name))throw Error('unsupported_cleanup_rpc');return deps.rpc(name,args);}},async(path)=>{if((await deps.remove([path])).error)throw Error('cleanup_delete_failed');},limit);
   return reply(200,{removedCount:result.removedSourceIds.length});
  }catch{return reply(503,{error:'cleanup_incomplete'});}
 };
}
