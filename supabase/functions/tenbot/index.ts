import {createClient} from 'npm:@supabase/supabase-js@2.101.1';
import {cloudflareProvider,TenbotError,MODEL} from '../_shared/tenbot-core.ts';
import {isAllowedModel} from '../_shared/tenbot-models.ts';
import {createTenbotJobTools} from '../_shared/tenbot-job-tools.ts';
import {createHostedTenbot,normalEmployeeModeAuthorized,TENBOT_HOSTED_SERVICE_RPCS} from '../_shared/tenbot-hosted.ts';
import {createHostedReceivalContract,createHostedReceivalRuntime,hostedReceivalPilotEnabled,hostedInvoicePreparationEnabled,ordinaryTenbotSpendingAuthorized,TENBOT_RECEIVAL_SERVICE_RPCS,TENBOT_RECEIVAL_WORKSPACE} from '../_shared/tenbot-receival-hosted.ts';
import {terraAcceptanceSpendingAuthorized} from '../_shared/tenbot-terra-acceptance.ts';
import {safeInvestigationDiagnostic} from '../_shared/tenbot-investigation-diagnostics.ts';
import {safeOpenAIResponseMetadata} from '../_shared/tenbot-openai.ts';
import {createReviewedActionTransport,TENBOT_ACTION_WORKSPACE} from '../_shared/tenbot-action-transport.ts';
import {createReviewedActionService,ReviewedActionError} from '../_shared/tenbot-actions.ts';
import {mintHostedReceivalExecutionPermit} from '../_shared/tenbot-receival-hosted.ts';
import {buildProposalPreview} from '../_shared/tenbot-proposal-operations.ts';
Deno.serve(async(request:Request)=>{
 const origin=request.headers.get('origin')||'';
 const allowed=(Deno.env.get('TENBOT_ALLOWED_ORIGINS')||'').split(',').map(s=>s.trim()).filter(Boolean);
 const headers={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin','Access-Control-Allow-Origin':allowed.includes(origin)?origin:'null','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS'};
 const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
 if(origin&&!allowed.includes(origin))return reply({error:'Origin not allowed.'},403);
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(request.method!=='POST')return reply({error:'POST required.'},405);
 try{
 const url=Deno.env.get('SUPABASE_URL')!,anon=Deno.env.get('SUPABASE_ANON_KEY')!;
 const authorization=request.headers.get('authorization')||'';
 const boundedFetch:typeof fetch=(input,init)=>fetch(input,{...init,signal:AbortSignal.any([...(init?.signal?[init.signal]:[]),AbortSignal.timeout(15000)])});
 const caller=createClient(url,anon,{global:{headers:{Authorization:authorization},fetch:boundedFetch},auth:{persistSession:false}});
 const {data,error}=await caller.auth.getUser(authorization.replace(/^Bearer\s+/i,''));if(error||!data.user)return reply({error:'Sign in required.'},401);
 // Stream-bound request body even when Content-Length is absent or false.
 const reader=request.body?.getReader();let raw='';let bytes=0;if(!reader)throw new TenbotError('Request required.');const decoder=new TextDecoder();
 while(true){const {value,done}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>16000){await reader.cancel();throw new TenbotError('Request too large.',413);}raw+=decoder.decode(value,{stream:true});}raw+=decoder.decode();
 const body=JSON.parse(raw);if(!body||typeof body!=='object'||Array.isArray(body))throw new TenbotError('Invalid request.');
 // Normal rollout and finite acceptance are separate authorities. Neither
 // grants inference funding or waives current operation/write permissions.
 const modelDirectedReads=(Deno.env.get('TENBOT_MODEL_DIRECTED_READ_ORIGINS')||'').split(',').map(s=>s.trim()).filter(Boolean).includes(origin);
 const acceptance={enabled:Deno.env.get('TENBOT_TERRA_ACCEPTANCE_ENABLED')==='true',ownerIds:(Deno.env.get('TENBOT_TERRA_ACCEPTANCE_OWNER_IDS')||'').split(',').map(s=>s.trim()).filter(Boolean),startsAt:Deno.env.get('TENBOT_TERRA_ACCEPTANCE_STARTS_AT')||'',expiresAt:Deno.env.get('TENBOT_TERRA_ACCEPTANCE_EXPIRES_AT')||''};
 const acceptanceScope={owner:data.user.id,origin,hostedEnabled:Deno.env.get('TENBOT_OPENAI_ENABLED')==='true'&&(Deno.env.get('TENBOT_OPENAI_ALLOWED_ORIGINS')||'').split(',').map(s=>s.trim()).filter(Boolean).includes(origin),modelDirectedReads};
 const acceptanceAuthorized=()=>terraAcceptanceSpendingAuthorized(acceptance,acceptanceScope);
 let actionSessionId='';
 // Auth.getUser verified the bearer above. This claim is only a selector; SQL
 // independently checks the live same-owner session at every write boundary.
 try{actionSessionId=JSON.parse(atob(authorization.replace(/^Bearer\s+/i,'').split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).session_id??'';}catch{/* Reviewed operations remain unavailable without a valid session. */}
 const employeeModeAuthorized=normalEmployeeModeAuthorized({enabled:Deno.env.get('TENBOT_EMPLOYEE_MODE_ENABLED')==='true',employeeIds:(Deno.env.get('TENBOT_EMPLOYEE_IDS')||'').split(',').map(s=>s.trim()).filter(Boolean),...acceptanceScope,sessionId:actionSessionId});
 const reviewedAuthorized=()=>employeeModeAuthorized||acceptanceAuthorized();
 // Password input is confined to this trusted branch before any provider is
 // constructed. Existing database controls and the transport gate default OFF.
 if(body.workspace===TENBOT_ACTION_WORKSPACE){
  const actionService=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{global:{fetch:boundedFetch},auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
  const callerForToken=(token:string)=>createClient(url,anon,{global:{headers:{Authorization:`Bearer ${token}`},fetch:boundedFetch},auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
  const metadata={rpc:(name:string,args:Record<string,unknown>)=>['stamp_tenbot_action_password','tenbot_receival_mint_execution_permit'].includes(name)?actionService.rpc(name,args):Promise.resolve({data:null,error:{code:'42501'}})};
  const trusted=createReviewedActionTransport({enabled:Deno.env.get('TENBOT_REVIEWED_ACTIONS_ENABLED')==='true'&&reviewedAuthorized(),normalEmployeeAuthorized:employeeModeAuthorized,origin,caller,
   password:{authenticate:async()=>({user:data.user,token:authorization.replace(/^Bearer\s+/i,''),caller}),
    createPasswordClient:()=>createClient(url,anon,{global:{fetch:boundedFetch},auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}}),callerForToken,service:metadata,
    async beforeExecute(input){
     const actions=createReviewedActionService(input.caller);
     if(!reviewedAuthorized()){await actions.revoke(input.reference);throw new ReviewedActionError('rejected');}
     if(input.operation!=='inventory.create_pending_receivals')return;
     const config={enabled:Deno.env.get('TENBOT_RECEIVAL_PILOT_ENABLED')==='true',executionEnabled:Deno.env.get('TENBOT_RECEIVAL_EXECUTION_ENABLED')==='true',origins:(Deno.env.get('TENBOT_RECEIVAL_ALLOWED_ORIGINS')||'').split(',').map(s=>s.trim()).filter(Boolean),employeeIds:(Deno.env.get('TENBOT_RECEIVAL_EMPLOYEE_IDS')||'').split(',').map(s=>s.trim()).filter(Boolean),expiresAt:Deno.env.get('TENBOT_RECEIVAL_PILOT_EXPIRES_AT')||''};
     if(!config.executionEnabled||!hostedReceivalPilotEnabled(config,input.ownerId,origin)){await actions.revoke(input.reference);throw new ReviewedActionError('rejected');}
     const staged=await actions.stageReceivals(input.reference);
     await mintHostedReceivalExecutionPermit({owner:input.ownerId,draftId:staged.draftId,hash:staged.hash,approvalId:staged.approvalId,origin,async service(name,args){
      const permit=await metadata.rpc(name,args);
      if(permit.error&&['42501','22023','P0002','23505'].includes(permit.error.code??'')){await actions.revoke(input.reference);throw new ReviewedActionError('rejected');}
      return permit;
     }});
    }},
   async preview(reference){
    const saved=await createReviewedActionService(caller).preview(reference);
    const response=await boundedFetch(`${url}/functions/v1/generate-proposal-pdf`,{method:'POST',headers:{Authorization:authorization,apikey:anon,'Content-Type':'application/json'},body:JSON.stringify({action:'preview',snapshot:buildProposalPreview(saved.parameters)})});
    if(!response.ok||!response.headers.get('Content-Type')?.includes('application/pdf'))throw new TenbotError('Proposal preview is unavailable.',409);
    return new Uint8Array(await response.arrayBuffer());
   }});
  const result=await trusted(body);
  if(result.pdf)return new Response(new Uint8Array(result.pdf).buffer,{status:200,headers:{...headers,'Content-Type':'application/pdf','Content-Disposition':'inline; filename="Proposal-Preview.pdf"'}});
  return reply(result.body,result.status);
 }
 if(Object.hasOwn(body,'password'))throw new TenbotError('Use the account password confirmation control.');
 const account=Deno.env.get('TENBOT_CF_ACCOUNT_ID'),token=Deno.env.get('TENBOT_CF_AI_TOKEN');
 // Hosted inference stays default-off; removing legacy dollar-shaped testing
 // credits must not implicitly activate a configured provider. This flag is
 // not set by the local pilot or this candidate. Employee activation still
 // requires a separately reviewed free-only boundary and release.
 const model=Deno.env.get('TENBOT_CF_MODEL')||MODEL;
 const provider=Deno.env.get('TENBOT_AI_ENABLED')==='true'&&account&&token&&isAllowedModel(model)?cloudflareProvider(account,token,fetch,model):null;
 // Privileged client is confined to meter/history and fixed authorization
 // metadata RPCs, never handed to operational model tools or business services.
 const service=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{global:{fetch:boundedFetch},auth:{persistSession:false}});
 const preparation={enabled:Deno.env.get('TENBOT_INVOICE_PREPARATION_ENABLED')==='true',spendingAuthorized:Deno.env.get('TENBOT_INVOICE_PREPARATION_SPEND_AUTHORIZED')==='true',startsAt:Deno.env.get('TENBOT_INVOICE_PREPARATION_STARTS_AT')||'',expiresAt:Deno.env.get('TENBOT_INVOICE_PREPARATION_EXPIRES_AT')||''};
 const openAI={enabled:Deno.env.get('TENBOT_OPENAI_ENABLED')==='true',origins:(Deno.env.get('TENBOT_OPENAI_ALLOWED_ORIGINS')||'').split(',').map(s=>s.trim()).filter(Boolean),apiKey:Deno.env.get('TENBOT_OPENAI_API_KEY')||'',keyExpiresAt:Deno.env.get('TENBOT_OPENAI_KEY_EXPIRES_AT')||'',spendingAuthorized:ordinaryTenbotSpendingAuthorized(Deno.env.get('TENBOT_OPENAI_SPEND_AUTHORIZED')==='true',preparation)};
 const pilot={enabled:Deno.env.get('TENBOT_RECEIVAL_PILOT_ENABLED')==='true',executionEnabled:Deno.env.get('TENBOT_RECEIVAL_EXECUTION_ENABLED')==='true',origins:(Deno.env.get('TENBOT_RECEIVAL_ALLOWED_ORIGINS')||'').split(',').map(s=>s.trim()).filter(Boolean),employeeIds:(Deno.env.get('TENBOT_RECEIVAL_EMPLOYEE_IDS')||'').split(',').map(s=>s.trim()).filter(Boolean),expiresAt:Deno.env.get('TENBOT_RECEIVAL_PILOT_EXPIRES_AT')||''};
 if(body.workspace===TENBOT_RECEIVAL_WORKSPACE){
  const metadata=(n:string,a:Record<string,unknown>)=>TENBOT_RECEIVAL_SERVICE_RPCS.has(n)?service.rpc(n,a):Promise.resolve({data:null,error:{message:'Receival authorization unavailable'}});
  const runtime=createHostedReceivalRuntime({owner:data.user.id,origin,pilot,preparation,openAI,caller,service:metadata});
  const receivals=createHostedReceivalContract({owner:data.user.id,origin,caller,service:metadata,config:pilot,preparation,runtime});
  return reply(await receivals(body));
 }
 // The separate, expiring Product allowance cannot fund the legacy receival
 // runtime above, an employee-selected provider, or a Production-origin call.
 const requestId=acceptanceAuthorized()?crypto.randomUUID():undefined;
 const hosted=createHostedTenbot({owner:data.user.id,origin,
  config:{...openAI,normalEmployeeAuthorized:employeeModeAuthorized,modelDirectedReads,reviewedOperationsEnabled:Deno.env.get('TENBOT_REVIEWED_OPERATIONS_ENABLED')==='true'&&reviewedAuthorized()},reviewedCaller:caller,actionSessionId,acceptanceSpendingAuthorized:acceptanceAuthorized,requestId,
  onDiagnostic:requestId?event=>{if(acceptanceAuthorized())console.info('tenbot_terra_acceptance',{requestId,...safeInvestigationDiagnostic(event)});}:undefined,
  onResponseMetadata:requestId?event=>{if(acceptanceAuthorized())console.info('tenbot_terra_provider',{requestId,...safeOpenAIResponseMetadata(event)});}:undefined,
  caller:async(n,a)=>await caller.rpc(n,a),service:async(n,a)=>TENBOT_HOSTED_SERVICE_RPCS.has(n)?await service.rpc(n,a):{data:null,error:{message:'Metering action unavailable'}},qwen:provider,jobTools:createTenbotJobTools(caller)});
 const result=await hosted(body);
 if(body.action==='status'&&preparation.enabled){if(hostedInvoicePreparationEnabled(preparation,data.user.id,origin)){const allowed=await caller.rpc('can_prepare_invoice_receival',{});if(!allowed.error&&allowed.data===true)return reply({...result,receivalPilotAvailable:true});}return reply(result);}
 if(body.action==='status'&&hostedReceivalPilotEnabled(pilot,data.user.id,origin)){
  const write=await caller.rpc('has_app_capability',{p_capability:'writeBusinessData'}),receival=await caller.rpc('has_app_capability',{p_capability:'adjustInventory'});
  if(!write.error&&write.data===true&&!receival.error&&receival.data===true)return reply({...result,receivalPilotAvailable:true});
 }
 return reply(result);
 }catch(e){
  // Only these fixed, employee-safe setup codes cross the HTTP boundary. Never
  // serialize a database/provider exception, query, request body or credential.
  const code=e instanceof TenbotError&&'code' in e&&typeof e.code==='string'&&
   ['invoice_catalog_unavailable','invoice_jobs_unavailable'].includes(e.code)?e.code:undefined;
  const message=code==='invoice_catalog_unavailable'?'Authorized material catalog choices are unavailable. Please try again.':
   code==='invoice_jobs_unavailable'?'Authorized Job choices are unavailable. Please try again.':
   e instanceof TenbotError?e.message:'TenBot is temporarily unavailable.';
  return reply({error:message,...(code?{code}:{})},e instanceof TenbotError?e.status:503);
 }
});
