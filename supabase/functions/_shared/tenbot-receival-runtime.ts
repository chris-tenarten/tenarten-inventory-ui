// Accepted receival controller shared by local and hosted adapters.
// No service-role business client or model approval/execute tool.
import {createHash,randomUUID} from 'node:crypto';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- shared Node/Deno module
// @ts-ignore -- Edge requires explicit extensions.
import {createTenbotAgentSessions} from './tenbot-agent-session.ts';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- shared Node/Deno module
// @ts-ignore -- Edge requires explicit extensions.
import {createCallerInvoiceReader,InvoiceReadError,type TenbotInvoiceDocument,type InvoiceCatalogIdentity} from './tenbot-invoice.ts';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- shared Node/Deno module
// @ts-ignore -- Edge requires explicit extensions.
import {createTenbotJobTools,type JobToolCaller,type JobToolQuery} from './tenbot-job-tools.ts';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- shared Node/Deno module
// @ts-ignore -- Edge requires explicit extensions.
import {TenbotError} from './tenbot-core.ts';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- shared Node/Deno module
// @ts-ignore -- Edge requires explicit extensions.
import {AgentStepError,isJsonValue,type AgentProvider} from './tenbot-agent.ts';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- shared Node/Deno module
// @ts-ignore -- Edge requires explicit extensions.
import {emitInvestigationDiagnostic,type InvestigationDiagnostic,type InvestigationDiagnosticSink} from './tenbot-investigation-diagnostics.ts';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- shared Node/Deno module
// @ts-ignore -- Edge requires explicit extensions.
import {deriveInvoiceQuantity,invoiceQuantityIssues,type InvoiceSourceQuantity,type InvoiceQuantityBasis} from '../../../src/modules/inventory/invoice-quantity.ts';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- shared Node/Deno module
// @ts-ignore -- Edge requires explicit extensions.
import {combinePurchasingCatalogRecords} from '../../../src/modules/purchasing/catalog-records.ts';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- shared Node/Deno module
// @ts-ignore -- Edge requires explicit extensions.
import {createInvoiceReceivalService,INVOICE_RECEIVAL_APPROVAL,type InvoiceReceivalCaller,type InvoiceReceivalDraft,type InvoiceReceivalLine} from '../../../src/modules/inventory/invoice-receival-service.ts';
import type {InvoiceImage} from './tenbot-invoice-extraction.ts';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- shared Node/Deno module
// @ts-ignore -- Edge requires explicit extensions.
import {catalogRequestIssues} from './tenbot-invoice-catalog.ts';
import type {ProposedCatalogMaterial,LocalReceivalDraft,LocalDraftRow,LocalOrderDetails} from '../../../src/modules/tenbot/live-review.ts';

import type {InvoiceReceivalSource,InvoiceReceivalSourceState} from '../../../src/modules/inventory/invoice-receival-attachments.ts';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- shared Node/Deno module
// @ts-ignore -- Edge requires explicit extensions.
import {TENBOT_CANARY_OWNER} from '../../../src/modules/inventory/tenbot-canary-access.ts';

export type ReceivalRuntimeSourceStore={get(id:string):Promise<InvoiceReceivalSource>;download(id:string):Promise<{source:InvoiceReceivalSource;original:Blob}>;record(input:{actorId:string;sourceId:string;expectedVersion:number;verifiedSha256:string;state:InvoiceReceivalSourceState}):Promise<InvoiceReceivalSource>;abandon(id:string):Promise<unknown>};
type Row=Record<string,unknown>;
type SourceDraftRow=LocalDraftRow&{sourceQuantity:InvoiceSourceQuantity|null;quantityBasis:InvoiceQuantityBasis};
export type ReceivalAgentCaller=JobToolCaller&InvoiceReceivalCaller;
export type ReceivalRuntimeDependencies={model:string;sourceStore?(caller:ReceivalAgentCaller,owner:string):ReceivalRuntimeSourceStore;/** Host-verified picker restriction only; never supplied by body/model. */catalogScope?(owner:string):readonly InvoiceCatalogIdentity[]|undefined;decodeAttachment(value:unknown):Promise<InvoiceImage&{filename:string;sha256:string}>;extractDocument(input:{id:string;filename:string;image:InvoiceImage;model:string;provider:AgentProvider;remainingUsd:number;assertNoFatal():void}):Promise<TenbotInvoiceDocument>;createProvider(label:string,image?:InvoiceImage):AgentProvider;remainingUsd():number;assertNoFatal():void;now?:()=>number;onDiagnostic?:InvestigationDiagnosticSink;execution?:{enabled:boolean;databaseEnvironment:'isolated-test'|'restricted-tendev'};beforeExecute?(input:{owner:string;draftId:string;hash:string;approvalId:string}):Promise<unknown>};
type Attachment={id:string;owner:string;filename:string;image:InvoiceImage;sha256:string;expires:number;document?:TenbotInvoiceDocument;session?:ReturnType<typeof createTenbotAgentSessions>;source?:InvoiceReceivalSource};
type Review={owner:string;attachmentId:string;expires:number;draft:LocalReceivalDraft;supplier:string;reference:string;traceHash:string;durable?:InvoiceReceivalDraft};
const record=(v:unknown):v is Row=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const text=(v:unknown)=>typeof v==='string'?v:'';
const array=(v:unknown):Row[]=>Array.isArray(v)?v.filter(record):[];
const digest=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const clone=<T,>(v:T):T=>structuredClone(v);
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function fail(message:string,status=400):never{throw new TenbotError(message,status);}
function initializationUnavailable(stage:'catalog'|'jobs',error?:unknown):never{
 const code=stage==='catalog'?'invoice_catalog_unavailable':'invoice_jobs_unavailable';
 console.warn('tenbot_invoice_initialization_failed',{stage,code,reason:error instanceof InvoiceReadError?error.reason:'unavailable'});
 throw Object.assign(new TenbotError(stage==='catalog'?'Authorized material catalog choices are unavailable. Please try again.':'Authorized Job choices are unavailable. Please try again.',503),{code});
}
const BLOCKED='Real execution is disabled until database-backed release gates pass.';
function keys(value:Row,allowed:string[]){if(Object.keys(value).some(key=>!allowed.includes(key)))fail('Invalid receival request fields.');}
function details(value:unknown):LocalOrderDetails{if(!record(value))fail('Review the order details.');keys(value,['orderedBy','orderDate','location']);for(const v of Object.values(value))if(typeof v!=='string'||v.length>120||/[\u0000-\u001f\u007f]/.test(v))fail('Invalid order details.');return {orderedBy:text(value.orderedBy).trim(),orderDate:text(value.orderDate).trim(),location:text(value.location).trim()};}

/** The HTTP adapter MUST authenticate getUser for every request and supply that
 * exact caller client. Tokens are not retained in attachment/conversation state. */
export function createAuthenticatedReceivalAgent(deps:ReceivalRuntimeDependencies){
 const now=deps.now??Date.now,attachments=new Map<string,Attachment>(),reviews=new Map<string,Review>(),active=new Map<string,ReceivalAgentCaller>();
 const diagnostic=(stage:InvestigationDiagnostic['stage'],outcome:InvestigationDiagnostic['outcome'],started:number,reasonCode:string)=>emitInvestigationDiagnostic(deps.onDiagnostic,{stage,tool:null,outcome,durationMs:now()-started,reasonCode});
 // This host-only gate cannot be supplied by an HTTP request or model output.
 // The independent database gate and authenticated canonical RPCs remain final.
 const executionEnabled=deps.execution?.enabled===true&&['isolated-test','restricted-tendev'].includes(deps.execution.databaseEnvironment);
 const client=(owner:string)=>active.get(owner)??fail('The authenticated request has ended.',403);
 const can=async(owner:string,capability:string)=>{const r=capability==='proposal.access'?await client(owner).rpc('has_proposal_access',{}):await client(owner).rpc('has_app_capability',{p_capability:capability});return !r.error&&r.data===true;};
 const authorize=async(owner:string,write=false)=>{const started=now();for(const cap of ['readOperationalData',...(write?['writeBusinessData','adjustInventory']:[])])if(!await can(owner,cap)){diagnostic('authorization','error',started,'authorization-denied');fail('Your current permissions do not allow this TenOps request.',403);}};
 const helpSession=createTenbotAgentSessions({mode:'openai',can,jobTools:id=>createTenbotJobTools(client(id)),provider:()=>deps.createProvider('authenticated-conversation'),invoice:{document:{id:'no-attachment',filename:'No attachment',mediaType:'text/plain',synthetic:true,text:'No attachment was submitted.'},reader:id=>createCallerInvoiceReader(client(id))},now});
 function attached(id:unknown,owner:string){const item=typeof id==='string'?attachments.get(id):undefined;if(!item||item.owner!==owner||item.expires<=now())return fail('This invoice attachment is unavailable or expired.',403);return item;}
 function reviewed(id:unknown,owner:string){const value=typeof id==='string'?reviews.get(id):undefined;if(!value||value.owner!==owner||value.expires<=now())return fail('This reviewed draft is unavailable or expired.',403);attached(value.attachmentId,owner);return value;}
 function hash(value:Review){return digest({owner:value.owner,attachment:value.attachmentId,source:attached(value.attachmentId,value.owner).sha256,revision:value.draft.revision,details:value.draft.orderDetails,rows:value.draft.rows,durable:value.durable?{id:value.durable.id,hash:value.durable.hash}:null});}
 function update(value:Review){
  value.draft.missingFields=Object.entries(value.draft.orderDetails).filter(([,v])=>!v).map(([k])=>k);
  value.draft.canApprove=Boolean(value.durable)&&!value.draft.missingFields.length&&value.draft.rows.some(r=>!r.excluded)&&value.draft.rows.every(r=>r.excluded||!r.reasons.length);
  value.draft.executionEnabled=executionEnabled;value.draft.blockReason=executionEnabled?undefined:BLOCKED;
  value.draft.durableDraftId=value.durable?.id;value.draft.durableHash=value.durable?.hash;value.draft.hash=hash(value);
 }
 async function restore(sourceId:unknown,owner:string,store:ReceivalRuntimeSourceStore){
  if(typeof sourceId!=='string'||!uuid.test(sourceId))fail('Choose the exact private original document.');
  const source=await store.get(sourceId);
  if(source.ownerId!==owner||['deleting','deleted'].includes(source.state)||source.state!=='retained'&&Date.parse(source.expiresAt)<=now())fail('This private invoice source is unavailable or expired.',403);
  const current=attachments.get(sourceId);
  if(current?.source?.version===source.version)return current;
  const state=source.agentState;
  const item:Attachment={id:source.id,owner,filename:source.filename,image:{bytes:new Uint8Array(),mediaType:source.mediaType},sha256:source.sha256,expires:source.state==='retained'?now()+3600000:Date.parse(source.expiresAt),source};
  if(state?.document&&record(state.document)&&typeof state.document.text==='string')item.document=clone(state.document) as unknown as TenbotInvoiceDocument;
  attachments.set(source.id,item);
  if(state?.draft){const draft=clone(state.draft),durable=draft.durableDraftId?await createInvoiceReceivalService(client(owner),{executionEnabled}).get({draftId:draft.durableDraftId}):undefined;reviews.set(draft.id,{owner,attachmentId:item.id,expires:item.expires,draft,supplier:draft.provenance?.supplier??'',reference:draft.provenance?.documentReference??'',traceHash:state.traceHash??digest([]),durable});}
  return item;
 }
 async function persist(item:Attachment,owner:string,store:ReceivalRuntimeSourceStore,value?:Review){
  if(!item.source||!item.document)return;
  const previous=item.source.agentState;
  const state:InvoiceReceivalSourceState={version:'invoice-receival-state.v1',originalSha256:item.source.sha256,visionSha256:item.document.extraction?.sha256??item.source.sha256,rawLines:item.document.text.split('\n'),sourceRows:previous?.sourceRows.length?clone(previous.sourceRows):(value?value.draft.rows.map(row=>({lineId:row.lineId,sourceText:row.sourceText,sourceQuantity:clone(row.sourceQuantity??null)})):[]),draft:value?clone(value.draft):previous?.draft??null,traceHash:value?.traceHash??previous?.traceHash??null,document:clone(item.document) as unknown as Row};
  item.source=await store.record({actorId:owner,sourceId:item.source.id,expectedVersion:item.source.version,verifiedSha256:item.source.sha256,state});
 }
 function proposal(owner:string,item:Attachment,data:Row,orderDetails:LocalOrderDetails,trace:unknown){
  const rows:SourceDraftRow[]=[];
  for(const line of [...array(data.ready_lines),...array(data.held_lines)]){const extracted=record(line.extracted)?line.extracted:{},p=record(line.proposal)?line.proposal:{},source=record(line.sourceQuantity)?line.sourceQuantity:{};const sourceQuantity=typeof source.quantity==='string'&&typeof source.unit==='string'?{quantity:source.quantity,unit:source.unit}:null,quantityBasis=record(line.quantityBasis)?clone(line.quantityBasis) as unknown as InvoiceQuantityBasis:deriveInvoiceQuantity(sourceQuantity,undefined);rows.push({lineId:text(line.source_ref),sourceText:text(line.evidence),sourceQuantity,quantityBasis,materialId:text(line.catalog_candidate_id)||null,materialName:text(p.material_name)||text(extracted.description)||null,size:text(p.size)||text(extracted.size)||null,quantity:String(p.quantity_expected??quantityBasis.receivalQuantity??extracted.quantity??''),unit:text(p.unit)||quantityBasis.receivalUnit||text(extracted.unit),jobId:null,excluded:false,reasons:Array.isArray(line.reasons)?line.reasons.map(String):[]});}
  for(const line of array(data.excluded_lines))rows.push({lineId:text(line.source_ref),sourceText:text(line.evidence),sourceQuantity:null,quantityBasis:deriveInvoiceQuantity(null,undefined),materialId:null,materialName:null,size:null,quantity:'',unit:'',jobId:null,excluded:true,reasons:['non_material_line']});
  rows.sort((a,b)=>Number(a.lineId.match(/:L(\d+)$/)?.[1]??Infinity)-Number(b.lineId.match(/:L(\d+)$/)?.[1]??Infinity));
  if(item.source){const originalLines=item.document!.text.split('\n');for(const row of rows){const line=originalLines[Number(row.lineId.match(/:L(\d+)$/)?.[1])-1];if(typeof line!=='string'||line.trim()!==row.sourceText.trim())fail('Invoice source evidence changed before review.',503);row.sourceText=line;}}
  if(!rows.length||rows.length>60||rows.some(r=>!r.lineId.startsWith(item.id+':L'))||new Set(rows.map(r=>r.lineId)).size!==rows.length)fail('A complete reviewable invoice draft was not produced.',503);
  const draft:LocalReceivalDraft={id:item.source?.id??randomUUID(),revision:1,hash:'',simulation:false,status:'review_required',attachmentId:item.id,orderDetails,missingFields:[],canApprove:false,rows,provenance:{supplier:text(data.supplier),documentReference:text(data.document_reference),attachmentSha256:item.sha256}};
  const value:Review={owner,attachmentId:item.id,expires:item.expires,draft,supplier:text(data.supplier),reference:text(data.document_reference),traceHash:digest(trace)};update(value);reviews.set(draft.id,value);return clone(draft);
 }
 return async(body:Row,owner:string,caller:ReceivalAgentCaller)=>{
  if(!owner||!isJsonValue(body))fail('Invalid authenticated request.',401);
  if(active.has(owner))fail('Wait for the current invoice request to finish.',409);active.set(owner,caller);
  try{
   await authorize(owner);
   for(const [id,item] of attachments)if(item.expires<=now())attachments.delete(id);
   for(const [id,item] of reviews)if(item.expires<=now())reviews.delete(id);
   const action=body.action,store=deps.sourceStore?.(caller,owner);
   if(store&&action!=='status'&&action!=='history'&&!(action==='ask'&&body.attachmentId===undefined)&&!(action==='clear'&&body.attachmentId===undefined)){const sourceId=action==='upload'?body.sourceId:body.attachmentId??body.draftId;if(sourceId!==undefined)await restore(sourceId,owner,store);}
   if(action==='history'){
    keys(body,['action','conversationId']);const history=await helpSession(body,owner);await authorize(owner);return history;
   }
   if(action==='status'){
    keys(body,['action']);const reader=createCallerInvoiceReader(caller),scope=deps.catalogScope?.(owner);
    const catalog=await reader.readCatalog!(AbortSignal.timeout(4000),scope).catch(error=>initializationUnavailable('catalog',error));
    // Same canonical Job identity picker as Inventory. Invoice preparation does
    // not require unrelated Rework/Labor modules just to offer a Job association.
    const jobQuery=caller.from('jobs') as {select(columns:string,options:{count:'exact'}):JobToolQuery};
    const found=owner===TENBOT_CANARY_OWNER&&scope!==undefined?{data:[],error:null}:await Promise.resolve(jobQuery.select('id,name,job_number',{count:'exact'}).is('archived_at',null).order('job_number').limit(21).abortSignal(AbortSignal.timeout(4000))).catch(()=>initializationUnavailable('jobs'));
    if(found.error||!Array.isArray(found.data))initializationUnavailable('jobs');
    await authorize(owner);
    return {mode:'authenticated-receivals',simulation:false,databaseEnvironment:deps.execution?.databaseEnvironment,canPrepare:await can(owner,'writeBusinessData')&&await can(owner,'adjustInventory'),canCreateCatalog:await can(owner,'writeBusinessData')&&await can(owner,'manageVendorsCatalog'),executionEnabled,blockedReason:executionEnabled?undefined:BLOCKED,model:deps.model,recordSource:executionEnabled?'Real isolated test records / caller JWT, existing TenOps RBAC and RLS':'Caller JWT / existing TenOps RBAC and RLS; execution disabled',catalog:combinePurchasingCatalogRecords(catalog.standard,catalog.specialty).map(c=>({id:`${c.source}:${c.id}`,materialName:c.materialName,size:c.chipSize,unit:c.orderUnit||c.containerType,supplier:c.vendor,packageQuantity:c.packageQuantity,packageMeasure:c.packageMeasure,containerType:c.containerType,packageLabel:c.packageEvidence?.label||''})),jobs:array(found.data).slice(0,20).map(j=>({id:j.id,label:[j.job_number,j.name].filter(Boolean).join(' — ')})),jobsLimited:Array.isArray(found.data)&&found.data.length>20,requiresPrivateOriginal:Boolean(store),maxOriginalBytes:12000000,maxAttachmentBytes:90000,mediaTypes:['image/png','image/jpeg']};
   }
   if(action==='upload'){
    await authorize(owner,true);
    keys(body,['action','attachment','sourceId','syntheticConfirmed']);if(body.syntheticConfirmed!==true)fail('Use approved synthetic test documents for this restricted candidate.');
    if(store){if(body.attachment!==undefined)fail('The original must be uploaded privately; inline derivatives are not accepted.');const item=await restore(body.sourceId,owner,store);if(item.source?.state==='retained')fail('This original already belongs to an approved batch. Open its pending receivals in Inventory.',409);await store.download(item.id);return {attachmentId:item.id,sourceId:item.id,filename:item.filename,mediaType:item.source!.mediaType,expiresAt:new Date(item.expires).toISOString(),simulation:false};}
    if(body.sourceId!==undefined)fail('Private original retention is unavailable.');
    const image=await deps.decodeAttachment(body.attachment);await authorize(owner);if(attachments.size>=20)fail('Local attachment limit reached.',429);
    const id='attachment-'+randomUUID(),expires=now()+3600000;attachments.set(id,{id,owner,filename:image.filename,image,sha256:image.sha256,expires});
    return {attachmentId:id,filename:image.filename,mediaType:image.mediaType,expiresAt:new Date(expires).toISOString(),simulation:false};
   }
   if(action==='ask'){
    keys(body,['action','attachmentId','conversationId','question','context','orderDetails']);
    if(body.attachmentId===undefined){const result=await helpSession({action:'ask',question:body.question,context:body.context,...(body.conversationId?{conversationId:body.conversationId}:{})},owner);await authorize(owner);return {...result,notices:['Local OpenAI TenOps guidance. Guidance is separate from actions; no database changes were made.'],localDemo:{simulation:false,draft:null}};}
    await authorize(owner,true);const item=attached(body.attachmentId,owner);const metadata=details(body.orderDetails??{});
    if(item.source?.state==='retained')fail('This original has already been approved. Open the existing Inventory receipt.',409);
    if(!item.document){
     const started=now();
     try{if(store){const original=await store.download(item.id);item.source=original.source;item.image={bytes:new Uint8Array(await original.original.arrayBuffer()),mediaType:item.source.mediaType};}item.document=await deps.extractDocument({id:item.id,filename:item.filename,image:item.image,model:deps.model,provider:deps.createProvider('authenticated-invoice-vision',item.image),remainingUsd:deps.remainingUsd(),assertNoFatal:deps.assertNoFatal});diagnostic('extraction','ok',started,'completed');}
     catch(error){diagnostic('extraction','error',started,error instanceof AgentStepError?error.code:'extraction-failed');throw error;}
     if(store){const started=now();try{await persist(item,owner,store);diagnostic('source-persistence','ok',started,'completed');}catch(error){diagnostic('source-persistence','error',started,'source-persistence-failed');throw error;}}
    }
    item.session??=createTenbotAgentSessions({mode:'openai',can,jobTools:id=>createTenbotJobTools(client(id)),provider:()=>deps.createProvider('authenticated-invoice-investigation'),invoice:{document:item.document,reader:id=>createCallerInvoiceReader(client(id))},now,onDiagnostic:deps.onDiagnostic});
    const investigationStarted=now();
    let result:Awaited<ReturnType<NonNullable<typeof item.session>>>;
    try{result=await item.session({action:'ask',question:body.question,context:body.context,...(!store&&body.conversationId?{conversationId:body.conversationId}:{}),invoiceId:item.id,orderDetails:metadata},owner);}
    catch(error){diagnostic('investigation','error',investigationStarted,'investigation-failed');throw error;}
    await authorize(owner,true);attached(item.id,owner);
    const agent='agent' in result?result.agent:undefined;if(!agent){diagnostic('investigation','error',investigationStarted,'invalid-agent-result');fail('The agent did not publish a validated result.',503);}
    diagnostic('investigation',agent.status==='completed'?'ok':'stopped',investigationStarted,agent.status==='completed'?'completed':agent.reason??'investigation-failed');
    const proposals=agent.status==='completed'?array(agent.proposals).map(p=>p.proposal).filter(record):[];
    const value=proposals.find(p=>p.version==='tenbot-pending-receival-review.v1');
    let prepared:LocalReceivalDraft|null=null;const draftStarted=now();
    try{prepared=value?proposal(owner,item,value,metadata,agent.trace):null;diagnostic('draft',prepared?'ok':'stopped',draftStarted,prepared?'completed':'no-draft-proposal');}
    catch(error){diagnostic('draft','error',draftStarted,'draft-invalid');throw error;}
    if(store&&prepared){const started=now();try{await persist(item,owner,store,reviews.get(prepared.id));diagnostic('draft-persistence','ok',started,'completed');}catch(error){diagnostic('draft-persistence','error',started,'draft-persistence-failed');throw error;}}
    return {...result,notices:[executionEnabled?'Preparation only. Your explicit approval is required to create reviewed pending receivals.':'Experimental authenticated TenOps preparation. '+BLOCKED],localDemo:{simulation:false,draft:prepared}};
   }
   if(action==='review'){
    await authorize(owner,true);
    keys(body,['action','draftId','revision','edits','orderDetails']);const value=reviewed(body.draftId,owner);
    if(body.revision!==value.draft.revision||!Array.isArray(body.edits)||body.edits.length!==value.draft.rows.length)fail('The draft changed. Review the current exact lines.',409);
    if(value.draft.status==='created')fail('This operation is already created. Open its receipt instead of editing it.',409);
    // A received edit revokes the old immutable approval even when the replacement
    // later fails validation. There is no route back to the stale approval.
    if(value.durable){await createInvoiceReceivalService(caller,{executionEnabled}).revoke({draftId:value.durable.id,hash:value.durable.hash});value.durable=undefined;update(value);}
    const next=clone(value.draft),seen=new Set<string>();
    for(const edit of body.edits){if(!record(edit))fail('Invalid reviewed line.');keys(edit,['lineId','materialId','quantity','unit','jobId','excluded','catalogRequest','duplicateAcknowledgement']);const row=next.rows.find(r=>r.lineId===edit.lineId);if(!row||seen.has(row.lineId)||typeof edit.excluded!=='boolean'||!(edit.materialId===null||typeof edit.materialId==='string')||!(edit.jobId===null||typeof edit.jobId==='string')||typeof edit.quantity!=='string'||typeof edit.unit!=='string')fail('Review every exact invoice line.');seen.add(row.lineId);if(!edit.excluded&&row.reasons.includes('non_material_line'))fail('Freight and non-material lines cannot become Inventory materials.');
     let catalogRequest:ProposedCatalogMaterial|null=null;
     if(edit.catalogRequest!==undefined&&edit.catalogRequest!==null){if(!record(edit.catalogRequest))fail('Invalid new catalog material proposal.');keys(edit.catalogRequest,['supplier','itemName','vendorSku','materialType','size','unitSize','unitSizeUom','packaging','priceUnit','notes','prepared']);catalogRequest=clone(edit.catalogRequest) as ProposedCatalogMaterial;if(catalogRequest.prepared!==true||Object.keys(catalogRequestIssues(catalogRequest,value.supplier)).length)fail(`Invoice line ${row.lineId}: complete the new catalog material details.`,409);if(edit.materialId!==null)fail('Choose an existing catalog material or a dependent new-material proposal, never both.');}
     const ack=edit.duplicateAcknowledgement??null;if(ack!==null&&(typeof ack!=='string'||!/^[a-f0-9]{64}$/.test(ack)))fail('Invalid duplicate acknowledgement.');
     if(ack&&(!row.duplicateReview?.canAcknowledge||row.duplicateReview.fingerprint!==ack))fail('Duplicate evidence changed. Save the review and inspect the current matching records before acknowledging a separate order.',409);
     Object.assign(row,{materialId:edit.materialId,jobId:edit.jobId,quantity:edit.quantity.trim(),unit:edit.unit.trim(),excluded:edit.excluded,catalogRequest,duplicateAcknowledgement:ack});}
    next.orderDetails=details(body.orderDetails);
    const identities=new Map<string,InvoiceCatalogIdentity>();
    for(const row of next.rows){if(row.excluded||row.materialId===null)continue;const match=row.materialId.match(/^(standard|specialty):(.+)$/);if(!match)fail(`Invoice line ${row.lineId}: choose a current authorized catalog offer or complete its new-material proposal.`);identities.set(row.materialId,{source:match[1] as 'standard'|'specialty',id:match[2]});}
    const catalog=await createCallerInvoiceReader(caller).readCatalog!(AbortSignal.timeout(4000),[...identities.values()]),offers=new Map(combinePurchasingCatalogRecords(catalog.standard,catalog.specialty).map(c=>[`${c.source}:${c.id}`,c]));
    for(const row of next.rows as SourceDraftRow[]){if(row.excluded)continue;const offer=row.materialId?offers.get(row.materialId):undefined,proposed=row.catalogRequest;
     if(!offer&&!proposed)fail(`Invoice line ${row.lineId}: choose a current authorized catalog offer or complete its new-material proposal.`);
     if(proposed&&!await can(owner,'manageVendorsCatalog'))fail('Your new-material request is retained for review. An employee with Manage vendors and catalog permission must approve the dependent catalog creation.',403);
     const quantityOffer=offer?{orderUnit:offer.orderUnit||offer.containerType,packageQuantity:offer.packageQuantity,packageMeasure:offer.packageMeasure,containerType:offer.containerType}:{orderUnit:proposed!.priceUnit,packageQuantity:proposed!.unitSize,packageMeasure:proposed!.unitSizeUom,containerType:proposed!.packaging};
     const checked=invoiceQuantityIssues(row.sourceQuantity,quantityOffer,row.quantity,row.unit,row.sourceText);row.quantityBasis=checked.basis;if(checked.reasons.length||checked.basis.receivalQuantity===null)fail(`Invoice line ${row.lineId}: quantity/unit contradicts source evidence (${checked.reasons.join(', ')}). Expected ${checked.basis.receivalQuantity??'clarification'} ${checked.basis.receivalUnit??''}.`,409);}
    const lines:InvoiceReceivalLine[]=next.rows.filter(r=>!r.excluded).map(r=>{const match=r.materialId?.match(/^(standard|specialty):(.+)$/);if((!match&&!r.catalogRequest)||!/^(?:0|[1-9]\d{0,8})(?:\.\d{1,6})?$/.test(r.quantity)||Number(r.quantity)<=0||r.unit.length>40||!r.sourceQuantity)fail('Resolve included materials, source evidence, positive quantities and valid units.');return {sourceLineId:r.lineId,catalogSource:match?match[1] as 'standard'|'specialty':null,catalogId:match?match[2]:null,quantityExpected:r.quantity,unit:r.unit,productionJobId:r.jobId,sourceQuantity:clone(r.sourceQuantity),sourceText:r.sourceText,newMaterial:r.catalogRequest??null,duplicateAcknowledgement:r.duplicateAcknowledgement??null};});
    const item=attached(value.attachmentId,owner),service=createInvoiceReceivalService(caller,{executionEnabled:false});
    const durable=await service.prepare({...(item.source?{sourceId:item.source.id}:{}),document:{sha256:item.sha256,supplier:value.supplier,reference:value.reference,documentDate:null},lines,metadata:next.orderDetails,provenance:{model:deps.model,sourceMediaType:item.source?.mediaType??item.image.mediaType,extractionSha256:item.source?.evidenceSha256??digest(item.document?.text??''),toolTraceSha256:digest({trace:value.traceHash,review:next.rows})}});
    await authorize(owner,true);reviewed(value.draft.id,owner);if(durable.ownerId!==owner)fail('The durable draft owner changed.',403);
    for(const row of next.rows){if(row.excluded){row.reasons=[];continue;}const canonical=durable.lines.find(l=>l.sourceLineId===row.lineId);if(!canonical)fail('The server did not validate every included line.',503);if(canonical.sourceQuantity&&(canonical.sourceQuantity.quantity!==row.sourceQuantity?.quantity||canonical.sourceQuantity.unit!==row.sourceQuantity?.unit)||canonical.sourceText!==undefined&&canonical.sourceText!==row.sourceText)fail('The canonical draft changed immutable invoice evidence. No approval is available.',503);row.materialName=canonical.material;row.size=canonical.size;row.quantity=canonical.quantityExpected;row.unit=canonical.unit;row.reasons=[];row.duplicateReview=canonical.duplicateReview??null;
     if(row.duplicateReview?.matches.some(m=>m.classification==='confirmed'))row.reasons.push('confirmed_duplicate');else if(row.duplicateReview?.matches.length&&!row.duplicateReview.acknowledged)row.reasons.push('potential_duplicate');
     row.catalogRequest=canonical.newMaterial;row.duplicateAcknowledgement=canonical.duplicateAcknowledgement;
     const source=row as SourceDraftRow,offer=row.materialId?offers.get(row.materialId):undefined,p=row.catalogRequest,quantityOffer=offer?{orderUnit:offer.orderUnit||offer.containerType,packageQuantity:offer.packageQuantity,packageMeasure:offer.packageMeasure,containerType:offer.containerType}:p?{orderUnit:p.priceUnit,packageQuantity:p.unitSize,packageMeasure:p.unitSizeUom,containerType:p.packaging}:undefined;
     if(!quantityOffer||invoiceQuantityIssues(source.sourceQuantity,quantityOffer,row.quantity,row.unit,row.sourceText).reasons.length)fail('The canonical draft changed an invoice quantity or unit. No approval is available.',503);row.quantityBasis=canonical.quantityBasis??deriveInvoiceQuantity(source.sourceQuantity,quantityOffer,row.sourceText);}
    next.revision++;next.reviewed=true;next.catalogApprovalRequired=next.rows.some(r=>!r.excluded&&Boolean(r.catalogRequest));value.draft=next;value.durable=durable;update(value);if(store)await persist(item,owner,store,value);return {draft:clone(value.draft),simulation:false};
   }
   if(action==='approve'){
    await authorize(owner,true);
    keys(body,['action','draftId','revision','hash','confirmation','durableDraftId','durableHash']);
    if(body.confirmation!==true||typeof body.draftId!=='string'||!Number.isSafeInteger(body.revision)||Number(body.revision)<1||typeof body.hash!=='string'||!/^[a-f0-9]{64}$/.test(body.hash)||typeof body.durableDraftId!=='string'||typeof body.durableHash!=='string')fail('Explicit approval must identify the exact current durable draft.',409);
    const service=createInvoiceReceivalService(caller,{executionEnabled});
    const value=reviews.get(body.draftId);
    if(value){reviewed(body.draftId,owner);if(body.revision!==value.draft.revision||body.hash!==value.draft.hash||!value.durable||body.durableDraftId!==value.durable.id||body.durableHash!==value.durable.hash)fail('Explicit approval must match the exact current durable draft.',409);if(value.draft.status!=='created'&&!value.draft.canApprove)fail('Resolve the exact remaining review concerns before approving.',409);}
    if(!executionEnabled)fail(BLOCKED,503);
    // Process/review memory is not authority. An exact owned immutable draft can
    // be reconciled after a server restart using its durable identity/hash. The
    // employee's explicit confirmation and every database permission/gate still
    // apply; a model has no approve or execute tool.
    const durable=await service.get({draftId:body.durableDraftId});
    if(durable.ownerId!==owner||durable.hash!==body.durableHash||durable.revoked||durable.superseded)fail('This durable review was changed, revoked or is unavailable. Review a fresh draft.',409);
    if(durable.lines.some(l=>Boolean(l.newMaterial))&&!await can(owner,'manageVendorsCatalog'))fail('Catalog creation permission is required for this dependent operation.',403);
    const result=durable.execution??await (async()=>{const approval=await service.approve({draftId:durable.id,hash:durable.hash,confirmation:INVOICE_RECEIVAL_APPROVAL});await deps.beforeExecute?.({owner,draftId:durable.id,hash:durable.hash,approvalId:approval.id});return service.execute({draftId:durable.id,hash:durable.hash,approvalId:approval.id});})();
    const query=caller.from('pending_receivals') as {select(columns:string):{in(column:string,ids:string[]):{abortSignal(signal:AbortSignal):PromiseLike<{data:unknown;error:unknown}>}}};
    const verified=await query.select('id,status,quantity_expected,quantity_received,unit,vendor,material_name,size,production_job_id').in('id',result.createdRecordIds).abortSignal(AbortSignal.timeout(4000));
    // This is an already committed canonical receipt, not another mutation.
    // The temporary grant may expire/revoke immediately after commit. Preserve
    // the fresh read permission and caller RLS checks without falsely claiming
    // the successful write failed because adjustment access has since ended.
    const records=array(verified.data);await authorize(owner,owner!==TENBOT_CANARY_OWNER);
    const matches=records.length===durable.lines.length&&result.createdRecordIds.every((id,index)=>{
     const actual=records.find(r=>r.id===id),expected=durable.lines[index];
     return actual&&expected&&actual.status==='pending'&&Number(actual.quantity_received)===0&&Number(actual.quantity_expected)===Number(expected.quantityExpected)&&actual.unit===expected.unit&&actual.vendor===expected.vendor&&actual.material_name===expected.material&&(actual.size??'')===expected.size&&(actual.production_job_id??null)===expected.productionJobId;
    });
    const visible=result.createdRecordIds.length===durable.lines.length&&records.length===result.createdRecordIds.length&&new Set(records.map(r=>r.id)).size===records.length&&result.createdRecordIds.every(id=>records.some(row=>row.id===id));
    // A completed immutable receipt proves the historical creation. Subsequent
    // authorized receiving/editing must not turn an exact retry into endless
    // failures, and never authorizes another write. Keep the initial strict
    // readback plus fresh caller-RLS visibility of every returned record ID.
    if(verified.error||!visible||!matches&&!result.idempotent)fail(owner===TENBOT_CANARY_OWNER?'Creation returned a durable receipt, but current records could not be verified. Reconcile the exact receipt and returned IDs with your authorized read access; do not reactivate access or create a new request.':'Creation returned a durable receipt, but current records could not be verified. Retry the exact approval to reconcile; do not create a new request.',503);
    const notice=!matches?'These receivals were already created. Their current Inventory state has changed since creation; the original receipt and record IDs are unchanged. No additional records were created.':undefined;
    const draft:LocalReceivalDraft=value?.draft??{id:body.draftId,revision:Number(body.revision),hash:body.hash,status:'created',simulation:false,attachmentId:'durable:'+durable.id,orderDetails:durable.metadata,missingFields:[],canApprove:false,rows:durable.lines.map(line=>({lineId:line.sourceLineId,sourceText:line.sourceText,sourceQuantity:line.sourceQuantity,quantityBasis:line.quantityBasis,materialId:line.catalogId?`${line.catalogSource}:${line.catalogId}`:null,materialName:line.material,size:line.size,quantity:line.quantityExpected,unit:line.unit,jobId:line.productionJobId,excluded:false,reasons:[],catalogRequest:line.newMaterial,duplicateReview:line.duplicateReview,duplicateAcknowledgement:line.duplicateAcknowledgement})),durableDraftId:durable.id,durableHash:durable.hash,executionEnabled,provenance:{supplier:durable.document.supplier,documentReference:durable.document.reference,attachmentSha256:durable.document.sha256},reviewed:true};
    draft.status='created';draft.canApprove=false;
    return {draft:clone(draft),simulation:false,receivals:records,createdRecordIds:result.createdRecordIds,createdCatalogRecords:result.createdCatalogRecords,createdCount:result.idempotent?0:records.length,idempotent:result.idempotent,onHandChanged:false,inventoryUrl:'/inventory#pending-receivals',...(notice?{notice}:{})};
   }
   if(action==='clear'){
    keys(body,['action','attachmentId','conversationId']);if(body.attachmentId===undefined)return helpSession({action:'clear',...(body.conversationId?{conversationId:body.conversationId}:{})},owner);const item=attached(body.attachmentId,owner);
    for(const r of reviews.values())if(r.owner===owner&&r.attachmentId===item.id&&r.durable&&r.draft.status!=='created'&&await can(owner,'writeBusinessData')&&await can(owner,'adjustInventory'))await createInvoiceReceivalService(caller,{executionEnabled}).revoke({draftId:r.durable.id,hash:r.durable.hash});
    if(store&&(await store.get(item.id)).state!=='retained')await store.abandon(item.id);attachments.delete(item.id);for(const [id,r] of reviews)if(r.owner===owner&&r.attachmentId===item.id)reviews.delete(id);return {cleared:true,simulation:false,durableDraftsRetained:true};
   }
   fail('Only authenticated invoice read, prepare and explicit reviewed approval actions are supported.');
  }finally{active.delete(owner);}
 };
}
