/** Restricted hosted dispatch for the accepted caller-scoped receival service.
 * Ordinary TenBot routing does not enter this module. No model, SQL, shell,
 * service-role business client or process-local approval authority is exposed.
 */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- shared Node/Deno module
// @ts-ignore -- explicit local extension is required by Edge bundling.
import {createInvoiceReceivalService,INVOICE_RECEIVAL_APPROVAL,type InvoiceReceivalCaller,type InvoiceReceivalDraft} from '../../../src/modules/inventory/invoice-receival-service.ts';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- shared Node/Deno module
// @ts-ignore -- explicit local extension is required by Edge bundling.
import {TenbotError} from './tenbot-core.ts';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- shared Node/Deno module
// @ts-ignore -- explicit local extension is required by Edge bundling.
import {createAuthenticatedReceivalAgent,type ReceivalAgentCaller} from './tenbot-receival-runtime.ts';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- shared Node/Deno module
// @ts-ignore -- explicit local extension is required by Edge bundling.
import {extractOriginalInvoiceDocument,type InvoiceImage} from './tenbot-invoice-extraction.ts';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- shared Node/Deno module
// @ts-ignore -- explicit local extension is required by Edge bundling.
import {createInvoiceReceivalAttachmentService,createInvoiceReceivalSourceStateWriter,type InvoiceReceivalStorageCaller,type InvoiceReceivalSource} from '../../../src/modules/inventory/invoice-receival-attachments.ts';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- shared Node/Deno module
// @ts-ignore -- explicit local extension is required by Edge bundling.
import {createHostedOpenAIMetering,usdToMicrousd} from './tenbot-openai-metering.ts';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- shared Node/Deno module
// @ts-ignore -- explicit local extension is required by Edge bundling.
import {createOpenAIProvider,OPENAI_EXPERIMENT_PRICING} from './tenbot-openai.ts';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- shared Node/Deno module
// @ts-ignore -- explicit local extension is required by Edge bundling.
import {AgentStepError,type AgentProvider} from './tenbot-agent.ts';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- shared Node/Deno module
// @ts-ignore -- explicit local extension is required by Edge bundling.
import {safeInvestigationDiagnostic} from './tenbot-investigation-diagnostics.ts';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- shared Node/Deno module
// @ts-ignore -- explicit extension required by Edge bundling.
import {TENBOT_CANARY_OWNER,parseTenbotCanaryAccess,tenbotCanaryDocumentMatches,tenbotCanaryDraftMatches,tenbotCanaryEditsMatch,type TenbotCanaryAccess} from '../../../src/modules/inventory/tenbot-canary-access.ts';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- shared Node/Deno module
// @ts-ignore -- explicit extension required by Edge bundling.
import {createHostedCanaryMetering,readHostedCanaryFunding,assertHostedCanaryFunding} from './tenbot-canary-funding.ts';
import type {HostedTenbotConfig} from './tenbot-hosted.ts';

export const TENBOT_RECEIVAL_WORKSPACE='invoice-receivals.v1';
export const TENBOT_RECEIVAL_PILOT_ORIGIN='https://tendev.pages.dev';
export const TENBOT_RECEIVAL_SERVICE_RPCS=new Set(['tenbot_receival_mint_execution_permit','record_invoice_receival_source_state','tenbot_openai_reserve','tenbot_openai_settle','tenbot_openai_canary_reserve','tenbot_openai_canary_settle']);
export type HostedReceivalConfig={enabled:boolean;executionEnabled:boolean;origins:string[];employeeIds:string[];expiresAt:string};
/** Dormant experiment only. No activation authority is accepted from a body. */
export type HostedInvoicePreparationConfig={enabled:boolean;spendingAuthorized:boolean;startsAt:string;expiresAt:string};
/** A finite shared-meter preparation window must never reopen normal spending. */
export const ordinaryTenbotSpendingAuthorized=(authorized:boolean,preparation:HostedInvoicePreparationConfig)=>authorized&&!preparation.enabled;
export const TENBOT_PREPARATION_DOCUMENT_SHA256='c66a0eb7a0512b40df092a7852fbbeaded6664b97b2f2df2153487441124ba2a';
/** Called only after canonical download verifies actual bytes against metadata. */
export const preparationDocumentMatches=(source:InvoiceReceivalSource,owner:string)=>owner===TENBOT_CANARY_OWNER&&source.ownerId===owner&&source.sha256===TENBOT_PREPARATION_DOCUMENT_SHA256&&source.mediaType==='application/pdf'&&source.byteSize===2877&&['uploading','ready'].includes(source.state);
export function hostedInvoicePreparationEnabled(config:HostedInvoicePreparationConfig|undefined,owner:string,origin:string,now=Date.now()):boolean{
 if(!config?.enabled||owner!==TENBOT_CANARY_OWNER||origin!==TENBOT_RECEIVAL_PILOT_ORIGIN)return false;
 const start=Date.parse(config.startsAt),end=Date.parse(config.expiresAt);
 return Number.isFinite(start)&&Number.isFinite(end)&&start<=now&&now<end&&end>start&&end-start<=15*60000;
}
async function preparationAccess(caller:InvoiceReceivalCaller){const r=await caller.rpc('can_prepare_invoice_receival',{});if(r.error||r.data!==true)throw new TenbotError('Your current permissions do not allow private invoice preparation.',403);}
type Rpc=(name:string,args:Record<string,unknown>)=>PromiseLike<{data:unknown;error:unknown}>;
type Runtime=(body:Record<string,unknown>,owner:string,caller:InvoiceReceivalCaller)=>Promise<unknown>;
export type HostedReceivalOperationalCaller=ReceivalAgentCaller&InvoiceReceivalStorageCaller;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const sha=/^[a-f0-9]{64}$/;
const record=(value:unknown):value is Record<string,unknown>=>value!==null&&typeof value==='object'&&!Array.isArray(value);
/** Only the pinned development account uses the temporary exception. The
 * projection is caller-scoped, has no activation authority and never changes
 * the normal assistant or any other employee's capability path. */
export async function readHostedCanaryAccess(caller:InvoiceReceivalCaller,owner:string,now=Date.now()):Promise<TenbotCanaryAccess|null>{
 if(owner!==TENBOT_CANARY_OWNER)return null;
 let result:Awaited<ReturnType<InvoiceReceivalCaller['rpc']>>;
 try{result=await caller.rpc('get_my_tenbot_receival_canary_access',{});}catch{throw new TenbotError('The temporary receival canary access is unavailable or expired.',403);}
 if(result.error)throw new TenbotError('The temporary receival canary access is unavailable or expired.',403);
 try{const access=parseTenbotCanaryAccess(result.data,owner);if(!access||Date.parse(access.expiresAt)<=now)throw Error('inactive');return access;}
 catch{throw new TenbotError('The temporary receival canary access is unavailable or expired.',403);}
}
export function hostedReceivalPilotEnabled(config:HostedReceivalConfig,owner:string,origin:string,now=Date.now()):boolean{
 const expiry=Date.parse(config.expiresAt);
 return config.enabled===true&&uuid.test(owner)&&origin===TENBOT_RECEIVAL_PILOT_ORIGIN&&config.origins.length===1&&config.origins[0]===origin
  &&config.employeeIds.length>0&&config.employeeIds.length<=20&&config.employeeIds.every(id=>uuid.test(id))&&new Set(config.employeeIds).size===config.employeeIds.length&&config.employeeIds.includes(owner)
  &&Number.isFinite(expiry)&&expiry>now;
}
/** Reuse the accepted controller with durable private source state, not a second
 * business engine. One request ID and a conservative micro-dollar counter cover
 * both vision and all investigation steps; durable shared SQL remains final.
 */
export function createHostedReceivalRuntime(options:{owner:string;origin:string;pilot:HostedReceivalConfig;preparation?:HostedInvoicePreparationConfig;openAI:HostedTenbotConfig;caller:HostedReceivalOperationalCaller;service:Rpc;now?:()=>number;fetcher?:typeof fetch;validatePdf?:(bytes:Uint8Array)=>Promise<void>}):Runtime{
 const now=options.now??Date.now,maximumMicros=250000;
 const preparationOnly=options.preparation?.enabled===true;
 let accountedMicros=0,uncertain=false,canaryAccess:TenbotCanaryAccess|null=null,verifiedSourceId:string|null=null;
 const refreshCanary=async()=>{if(preparationOnly){if(!hostedInvoicePreparationEnabled(options.preparation,options.owner,options.origin,now()))throw new TenbotError('This finite invoice preparation test is unavailable or expired.',403);await preparationAccess(options.caller);return null;}canaryAccess=await readHostedCanaryAccess(options.caller,options.owner,now());return canaryAccess;};
 const requireCanaryFunding=async()=>{const access=await refreshCanary();if(access){const funding=await readHostedCanaryFunding(options.caller);assertHostedCanaryFunding(funding,access,now());}return access;};
 const meterOptions={owner:options.owner,model:'gpt-6.1-terra' as const,requestId:crypto.randomUUID(),rpc:async(n:string,a:Record<string,unknown>)=>options.service(n,a)};
 const meter=!preparationOnly&&options.owner===TENBOT_CANARY_OWNER?createHostedCanaryMetering({...meterOptions,origin:options.origin,async scope(){const access=await requireCanaryFunding();if(!access||!verifiedSourceId)throw new AgentStepError('canary-original-unverified');return {sourceId:verifiedSourceId,grantId:access.grantId};}}):createHostedOpenAIMetering(meterOptions);
 const source=createInvoiceReceivalAttachmentService(options.caller);
 async function verifiedDownload(sourceId:string){
  const original=await source.download(sourceId);
  if(preparationOnly){
   await refreshCanary();if(!preparationDocumentMatches(original.source,options.owner))throw new TenbotError('Use the exact approved synthetic original.',403);
   verifiedSourceId=original.source.id;
  }else if(options.owner===TENBOT_CANARY_OWNER){
   const access=await refreshCanary();
   if(!access||original.source.ownerId!==options.owner||!tenbotCanaryDocumentMatches(access,original.source)||original.source.mediaType!=='application/pdf'||original.source.byteSize!==2877||!['uploading','ready'].includes(original.source.state))throw new TenbotError('Use the exact approved synthetic original.',403);
   // download() has just rechecked caller Storage RLS and the actual byte hash,
   // MIME type and length. A metadata claim alone never selects this allowance.
   verifiedSourceId=original.source.id;
  }
  return original;
 }
 const writer=createInvoiceReceivalSourceStateWriter({async rpc(name,args){
  if(name!=='record_invoice_receival_source_state')return {data:null,error:{code:'42501'}};
  const result=await options.service(name,args),error=result.error;
  return {data:result.data,error:error?{code:record(error)&&typeof error.code==='string'?error.code:'service-unavailable'}:null};
 }});
 function assertNoFatal(){
  const expiry=Date.parse(options.openAI.keyExpiresAt);
  const enabled=preparationOnly?hostedInvoicePreparationEnabled(options.preparation,options.owner,options.origin,now())&&options.preparation?.spendingAuthorized===true&&options.openAI.spendingAuthorized===false:hostedReceivalPilotEnabled(options.pilot,options.owner,options.origin,now())&&options.openAI.spendingAuthorized;
  if(!enabled||!options.openAI.enabled||!options.openAI.origins.includes(options.origin)||options.openAI.apiKey.length<16||!Number.isFinite(expiry)||expiry<=now())throw new AgentStepError('provider-not-configured');
  if(uncertain)throw new AgentStepError('invoice-accounting-unavailable');
  if(!preparationOnly&&options.owner===TENBOT_CANARY_OWNER&&(!canaryAccess||Date.parse(canaryAccess.expiresAt)<=now()))throw new AgentStepError('canary-access-unavailable');
 }
 async function reserveBudget(usd:number){
  await requireCanaryFunding();assertNoFatal();const reserved=usdToMicrousd(usd);
  if(reserved>maximumMicros-accountedMicros)throw new AgentStepError('request-budget-unavailable');
  let reservation:Awaited<ReturnType<typeof meter.reserveBudget>>;
  try{reservation=await meter.reserveBudget(usd);}catch(error){uncertain=true;throw error;}
  accountedMicros+=reserved;let settled=false;
  return {async settle(actual?:number){
   if(settled)return;settled=true;
   try{await reservation.settle(actual);}catch(error){uncertain=true;throw error;}
   if(actual===undefined)uncertain=true;else accountedMicros+=usdToMicrousd(actual)-reserved;
  }};
 }
 async function validatePdf(bytes:Uint8Array){
  if(options.validatePdf)return options.validatePdf(bytes);
  // Same existing PDF library/version as TenOps document generators. Deferred
  // import keeps ordinary read-only startup/requests unchanged.
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment -- Deno npm import
  // @ts-ignore -- Deno resolves npm dependencies during Edge bundling.
  const {PDFDocument}=await import('npm:pdf-lib@1.17.1');
  let pdf;try{pdf=await PDFDocument.load(bytes,{ignoreEncryption:false,updateMetadata:false});}catch{throw new TenbotError('Use an unencrypted, valid one-page PDF invoice.');}
  if(pdf.getPageCount()!==1)throw new TenbotError('This restricted pilot accepts one-page PDF invoices. No pages were omitted.');
 }
 function provider(_label:string,image?:InvoiceImage):AgentProvider{
  const transport=createOpenAIProvider({model:'gpt-6.1-terra',apiKey:options.openAI.apiKey,spendingAuthorized:preparationOnly?options.preparation?.spendingAuthorized===true:options.openAI.spendingAuthorized,pricing:OPENAI_EXPERIMENT_PRICING['gpt-6.1-terra'],requireResponseMetadata:true,reserveBudget,
   ...(image?{originalAttachment:{filename:image.mediaType==='application/pdf'?'invoice.pdf':image.mediaType==='image/png'?'invoice.png':'invoice.jpg',mediaType:image.mediaType,bytes:image.bytes}}:{}),
   async fetcher(url,init){await requireCanaryFunding();assertNoFatal();if(options.owner===TENBOT_CANARY_OWNER&&!verifiedSourceId)throw new AgentStepError('canary-original-unverified');return (options.fetcher??fetch)(url,init);},
  });
  return {...transport,async step(request){await requireCanaryFunding();assertNoFatal();if(image?.mediaType==='application/pdf')await validatePdf(image.bytes);return transport.step({...request,remainingUsd:Math.min(request.remainingUsd,Math.max(0,maximumMicros-accountedMicros)/1000000)});}};
 }
 const runtime=createAuthenticatedReceivalAgent({model:'gpt-6.1-terra',now,remainingUsd:()=>Math.max(0,maximumMicros-accountedMicros)/1000000,assertNoFatal,createProvider:provider,extractDocument:extractOriginalInvoiceDocument,
  onDiagnostic(event){console.info('tenbot_receival_investigation',safeInvestigationDiagnostic(event));},preparationOnly,
  catalogScope(owner){
   if(preparationOnly)return [{source:'standard',id:'ba6a3690-0886-4f72-9f86-581bcc1f3b44'}];
   if(owner!==TENBOT_CANARY_OWNER)return undefined;
   if(owner!==options.owner||!canaryAccess||Date.parse(canaryAccess.expiresAt)<=now())throw new TenbotError('This temporary canary is unavailable.',403);
   return [{source:canaryAccess.catalogSource,id:canaryAccess.catalogId}];
  },
  async decodeAttachment(){throw new TenbotError('Upload the original privately; inline attachment derivatives are not accepted.');},
  sourceStore(_caller,owner){if(owner!==options.owner)throw new TenbotError('Private invoice owner changed.',403);return {...source,download:verifiedDownload,async record(input){if(preparationOnly)await refreshCanary();if(input.actorId!==options.owner)throw new TenbotError('Private invoice owner changed.',403);return writer.record(input);}};},
  execution:{enabled:!preparationOnly&&options.pilot.executionEnabled,databaseEnvironment:'restricted-tendev'},
  async beforeExecute(input){
   if(input.owner!==options.owner||!hostedReceivalPilotEnabled(options.pilot,input.owner,options.origin,now()))throw new TenbotError('Restricted execution is unavailable.',403);
   const access=await requireCanaryFunding();
   if(access){const draft=await createInvoiceReceivalService(options.caller,{executionEnabled:false}).get({draftId:input.draftId});if(!tenbotCanaryDraftMatches(access,draft))throw new TenbotError('This temporary canary permits only the approved invoice and one pending Bag.',403);}
   await mintHostedReceivalExecutionPermit({...input,origin:options.origin,service:options.service});
  },
 });
 return async(body,owner)=>{
  verifiedSourceId=null;
  if(owner!==options.owner||!(preparationOnly?hostedInvoicePreparationEnabled(options.preparation,owner,options.origin,now()):hostedReceivalPilotEnabled(options.pilot,owner,options.origin,now())))throw new TenbotError('The restricted receival workspace is unavailable.',403);
  if(preparationOnly){if(!['status','upload','ask'].includes(String(body.action)))throw new TenbotError('This workspace prepares non-executing drafts only.',403);if(body.action==='ask'&&body.attachmentId===undefined)throw new TenbotError('Use the exact approved synthetic original for this test.',403);const sourceId=body.action==='upload'?body.sourceId:body.attachmentId;if(sourceId!==undefined){if(typeof sourceId!=='string'||!uuid.test(sourceId))throw new TenbotError('Choose the exact private original.',403);await verifiedDownload(sourceId);}}
  const access=await refreshCanary();
  if(access){
   const sourceId=body.action==='upload'?body.sourceId:body.attachmentId??(['review','approve','clear'].includes(String(body.action))?body.draftId:undefined);
   if(sourceId!==undefined){if(typeof sourceId!=='string'||!uuid.test(sourceId))throw new TenbotError('Choose the exact approved canary original.',403);const original=await source.get(sourceId);if(original.ownerId!==owner||!tenbotCanaryDocumentMatches(access,original))throw new TenbotError('This temporary canary permits only the approved synthetic invoice.',403);if(body.action==='ask')await verifiedDownload(sourceId);}
   if(body.action==='ask'&&body.attachmentId===undefined)throw new TenbotError('Use the ordinary TenBot conversation for guidance; the canary workspace requires its approved invoice.',403);
   if(body.action==='review'&&!tenbotCanaryEditsMatch(access,body.edits))throw new TenbotError('Review exactly one approved catalog Bag, with no Job or catalog addition.',403);
  }
  const result=await runtime(body,owner,options.caller);
  // The canonical runtime already rechecks current caller read permission/RLS
  // for a completed approval. Returning its historical receipt is not a second
  // write and must not fail solely because the temporary grant just ended.
  if(body.action==='approve')return result;
  const current=await refreshCanary();
  if(body.action==='status'&&current&&record(result)){
   const status:Record<string,unknown>=result;
   const acknowledge=await options.caller.rpc('has_app_capability',{p_capability:'adjustInventory'});
   return {...status,canAcknowledgeDuplicates:!acknowledge.error&&acknowledge.data===true,canaryAccess:current,canCreateCatalog:false,jobs:[],catalog:Array.isArray(status.catalog)?status.catalog.filter((item:unknown)=>record(item)&&item.id===current.catalogSource+':'+current.catalogId):[]};
  }
  return result;
 };
}
/** Only call with the owner just verified by Auth.getUser in the Edge entry.
 * This service RPC mints short-lived metadata, never approves or writes Inventory.
 * The caller-JWT canonical execute RPC independently consumes it in its TX.
 */
export async function mintHostedReceivalExecutionPermit(input:{owner:string;draftId:string;hash:string;approvalId:string;origin:string;service:Rpc}){
 if(!uuid.test(input.owner)||!uuid.test(input.draftId)||!sha.test(input.hash)||!uuid.test(input.approvalId)||input.origin!==TENBOT_RECEIVAL_PILOT_ORIGIN)throw new TenbotError('Invalid hosted execution authorization.',403);
 const result=await input.service('tenbot_receival_mint_execution_permit',{p_user:input.owner,p_draft_id:input.draftId,p_expected_hash:input.hash,p_approval_id:input.approvalId,p_origin:input.origin});
 const value=result.data;
 if(result.error||!record(value)||value.ok!==true||typeof value.alreadyExecuted!=='boolean')throw new TenbotError('Hosted execution authorization is unavailable. No new records were confirmed.',503);
 if(!value.alreadyExecuted&&(!uuid.test(String(value.permitId))||value.draftId!==input.draftId||value.hash!==input.hash||value.approvalId!==input.approvalId||!Number.isSafeInteger(value.policyVersion)||Number(value.policyVersion)<1||!Number.isFinite(Date.parse(String(value.expiresAt)))))throw new TenbotError('Hosted execution authorization is unavailable.',503);
 return value;
}
/** Stateless durable-operation fallback. An optional shared accepted runtime
 * handles document investigation/review once its source-store adapter is ready.
 * No generic client p_lines/source-evidence forwarding is implemented here.
 */
export function createHostedReceivalContract(options:{owner:string;origin:string;config:HostedReceivalConfig;preparation?:HostedInvoicePreparationConfig;caller:InvoiceReceivalCaller;service:Rpc;runtime?:Runtime;now?:()=>number}){
 const now=options.now??Date.now,can=async(capability:string)=>{const r=await options.caller.rpc('has_app_capability',{p_capability:capability});return !r.error&&r.data===true;};
 let canaryAccess:TenbotCanaryAccess|null=null;
 const authorize=async()=>{if(!hostedReceivalPilotEnabled(options.config,options.owner,options.origin,now()))throw new TenbotError('The restricted receival pilot is unavailable.',403);canaryAccess=await readHostedCanaryAccess(options.caller,options.owner,now());for(const cap of ['readOperationalData','writeBusinessData','adjustInventory'])if(!await can(cap))throw new TenbotError('Your current permissions do not allow pending-receival creation.',403);};
 const funded=async()=>{if(canaryAccess)assertHostedCanaryFunding(await readHostedCanaryFunding(options.caller),canaryAccess,now());};
 const service=createInvoiceReceivalService(options.caller,{executionEnabled:options.config.executionEnabled===true});
 const keys=(body:Record<string,unknown>,allowed:string[])=>{if(Object.keys(body).some(key=>!['workspace',...allowed].includes(key)))throw new TenbotError('Invalid receival request.');};
 async function current(id:unknown,hash?:unknown):Promise<InvoiceReceivalDraft>{
  if(typeof id!=='string'||!uuid.test(id)||hash!==undefined&&(typeof hash!=='string'||!sha.test(hash)))throw new TenbotError('Invalid exact draft identity.');
  const draft=await service.get({draftId:id});
  if(draft.ownerId!==options.owner||hash!==undefined&&draft.hash!==hash)throw new TenbotError('This exact private draft is unavailable.',403);
  if(draft.revoked||draft.superseded)throw new TenbotError('This draft was changed or revoked. Review the current draft.',409);
  if(canaryAccess&&!tenbotCanaryDraftMatches(canaryAccess,draft))throw new TenbotError('This temporary canary permits only the approved invoice and one pending Bag.',403);
  if(draft.lines.some(line=>line.newMaterial)&&!await can('manageVendorsCatalog'))throw new TenbotError('Catalog creation permission is required for this dependent operation.',403);
  return draft;
 }
 return async(body:Record<string,unknown>)=>{
  if(body.workspace!==TENBOT_RECEIVAL_WORKSPACE)throw new TenbotError('Invalid receival workspace.');
  if(options.preparation?.enabled===true){if(!hostedInvoicePreparationEnabled(options.preparation,options.owner,options.origin,now()))throw new TenbotError('This finite invoice preparation test is unavailable or expired.',403);await preparationAccess(options.caller);if(!['status','upload','ask'].includes(String(body.action))||!options.runtime)throw new TenbotError('This workspace prepares non-executing drafts only.',403);const {workspace:_,...request}=body;void _;return options.runtime(request,options.owner,options.caller);}
  await authorize();
  try{
   const action=body.action;
   if(options.runtime&&!['get','revoke'].includes(String(action))){const {workspace:_,...request}=body;void _;return await options.runtime(request,options.owner,options.caller);}
   if(action==='status'){
    keys(body,['action']);return {workspace:TENBOT_RECEIVAL_WORKSPACE,mode:'authenticated-receivals',simulation:false,pilot:true,executionEnabled:options.config.executionEnabled===true,preparationRuntimeAvailable:Boolean(options.runtime),requiresPrivateOriginal:true,readOnly:false};
   }
   if(action==='get'){
    keys(body,['action','draftId']);const draft=await current(body.draftId);await authorize();return {workspace:TENBOT_RECEIVAL_WORKSPACE,draft,simulation:false,inventoryUrl:'/inventory#pending-receivals'};
   }
   if(action==='revoke'){
    keys(body,['action','draftId','hash']);await current(body.draftId,body.hash);const result=await service.revoke({draftId:String(body.draftId),hash:String(body.hash)});await authorize();return result;
   }
   if(action==='approve'){
    keys(body,['action','draftId','hash','confirmation']);if(body.confirmation!==true)throw new TenbotError('Your explicit approval of the exact draft is required.',409);
    if(options.config.executionEnabled!==true)throw new TenbotError('Hosted receival execution is disabled.',403);
    const draft=await current(body.draftId,body.hash);await authorize();
    // Durable database receipt, not a previous instance's memory, resolves an
    // uncertain response without another approval, permit or Inventory write.
    if(draft.execution)return {workspace:TENBOT_RECEIVAL_WORKSPACE,...draft.execution,simulation:false,onHandChangedByCreation:false,inventoryUrl:'/inventory#pending-receivals'};
    await funded();
    const approval=await service.approve({draftId:draft.id,hash:draft.hash,confirmation:INVOICE_RECEIVAL_APPROVAL});
    await authorize();await funded();await mintHostedReceivalExecutionPermit({owner:options.owner,draftId:draft.id,hash:draft.hash,approvalId:approval.id,origin:options.origin,service:options.service});
    const result=await service.execute({draftId:draft.id,hash:draft.hash,approvalId:approval.id});
    if(options.owner===TENBOT_CANARY_OWNER){if(!await can('readOperationalData'))throw new TenbotError('Your current permissions do not allow this receipt to be read.',403);}else await authorize();
    return {workspace:TENBOT_RECEIVAL_WORKSPACE,...result,simulation:false,onHandChangedByCreation:false,inventoryUrl:'/inventory#pending-receivals'};
   }
   throw new TenbotError('Hosted document preparation is not ready. No model request or database write was made.',503);
  }catch(error){
   if(error instanceof TenbotError)throw error;
   const code=error instanceof Error?error.message:'';
   if(['receival_service_rejected:42501','invoice_source_rejected:42501'].includes(code))throw new TenbotError('Your current permissions or pilot authorization do not allow this operation.',403);
   if(['receival_service_rejected:22023','receival_service_rejected:23505','invoice_source_rejected:22023','invoice_source_rejected:23505'].includes(code))throw new TenbotError('This review, original document or duplicate state changed. Review the current draft before approval.',409);
   if(['receival_service_rejected:P0002','invoice_source_rejected:P0002'].includes(code))throw new TenbotError('This private review or original document is unavailable.',404);
   throw new TenbotError('Receival service unavailable. Retry the exact draft to reconcile; do not prepare another copy.',503);
  }
 };
}
