import assert from 'node:assert/strict';
import {PDFDocument} from 'pdf-lib';
const originalCreate=PDFDocument.create;
PDFDocument.create=async (...args)=>{if(mode==='render')throw Error('SECRET_RENDER_FAILURE');return originalCreate(...args);};
// Exercise the real Edge callback with local HTTP substitutes; no hosted requests.
let handler:(request:Request)=>Promise<Response>;let role='admin',mode='storage',reads=0,uploads=0;
const originalFetch=globalThis.fetch;
const env:Record<string,string>={SUPABASE_URL:'https://diagnostic-fixture.invalid',SUPABASE_ANON_KEY:'local-public',SUPABASE_SERVICE_ROLE_KEY:'local-service'};
Object.assign(globalThis,{Deno:{env:{get:(key:string)=>env[key]},serve:(fn:typeof handler)=>{handler=fn;}}});
globalThis.fetch=async(input,init)=>{
 const request=new Request(input,init);const url=new URL(request.url);assert.equal(url.hostname,'diagnostic-fixture.invalid');
 const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json'}});
 if(url.pathname.endsWith('/rpc/has_app_capability'))return reply(true);
 if(url.pathname.endsWith('/rpc/get_my_app_user'))return reply([{role,is_active:true}]);
 if(url.pathname.includes('/rest/v1/sample_issued_documents')){if(request.method==='PATCH')return reply(null);reads++;return reply({id:'00000000-0000-0000-0000-000000000001',sample_id:'00000000-0000-0000-0000-000000000002',document_version:'sample-work-order-pdf-v10-audience',generation_status:'pending',storage_path:'',issued_snapshot:mode==='render'?{blend_rows:{invalid:'SECRET_RENDER_INPUT'}}:{blend_rows:[]}});}
 if(url.pathname.includes('/storage/v1/')){uploads++;return reply({message:'SECRET_STORAGE_PROVIDER_DETAIL'},500);}
 throw Error('Unexpected fixture request '+url.pathname);
};
try{
 await import('../supabase/functions/generate-sample-pdf/index');
 for(const [m,action,stage,code] of [['render','generate','pdf-render','PDF_RENDER_FAILED'],['storage','generate','storage-upload','PDF_STORAGE_FAILED'],['delivery','open','delivery','PDF_DELIVERY_FAILED']]){
  mode=m;role='admin';const r=await handler!(new Request('https://edge.invalid',{method:'POST',headers:{authorization:'Bearer local','content-type':'application/json'},body:JSON.stringify({action,documentId:'00000000-0000-0000-0000-000000000001'})}));const body=await r.json();assert.equal(body.diagnostic.stage,stage);assert.equal(body.diagnostic.code,code);assert(!JSON.stringify(body).includes('SECRET'));assert.match(body.diagnostic.correlationId,/^[a-f0-9-]{36}$/);
 }
 role='member';mode='delivery';const r=await handler!(new Request('https://edge.invalid',{method:'POST',headers:{authorization:'Bearer local','content-type':'application/json'},body:JSON.stringify({action:'open',documentId:'00000000-0000-0000-0000-000000000001'})}));assert.equal((await r.json()).diagnostic,undefined);
 assert.equal(reads,4);assert(uploads>=3);console.log('PASS real Sample Edge callback: render/upload/delivery stages, sanitized Admin diagnostics, normal-user omission; existing document IDs only.');
}finally{PDFDocument.create=originalCreate;globalThis.fetch=originalFetch;Reflect.deleteProperty(globalThis,'Deno');}
