// Local authenticated integration. No service-role client or model write tool.
import {createHash,randomUUID} from 'node:crypto';
import {createTenbotAgentSessions} from '../../supabase/functions/_shared/tenbot-agent-session';
import {createCallerInvoiceReader,type TenbotInvoiceDocument} from '../../supabase/functions/_shared/tenbot-invoice';
import {createTenbotJobTools,type JobToolCaller} from '../../supabase/functions/_shared/tenbot-job-tools';
import {TenbotError} from '../../supabase/functions/_shared/tenbot-core';
import {isJsonValue,type AgentProvider} from '../../supabase/functions/_shared/tenbot-agent';
import {deriveInvoiceQuantity,invoiceQuantityIssues,type InvoiceSourceQuantity,type InvoiceQuantityBasis} from '../../src/modules/inventory/invoice-quantity';
import {combinePurchasingCatalogRecords} from '../../src/modules/purchasing/catalog-records';
import {createInvoiceReceivalService,INVOICE_RECEIVAL_APPROVAL,type InvoiceReceivalCaller,type InvoiceReceivalDraft,type InvoiceReceivalLine} from '../../src/modules/inventory/invoice-receival-service';
import {decodeInvoiceAttachment,extractInvoiceDocument,type InvoiceImage} from './tenbot-invoice-attachment.mjs';
import type {LocalReceivalDraft,LocalDraftRow,LocalOrderDetails} from '../../src/modules/tenbot/live-review';

type Row=Record<string,unknown>;
type SourceDraftRow=LocalDraftRow&{sourceQuantity:InvoiceSourceQuantity|null;quantityBasis:InvoiceQuantityBasis};
export type ReceivalAgentCaller=JobToolCaller&InvoiceReceivalCaller;
type Dependencies={model:string;createProvider(label:string,image?:InvoiceImage):AgentProvider;remainingUsd():number;assertNoFatal():void;now?:()=>number};
type Attachment={id:string;owner:string;filename:string;image:InvoiceImage;sha256:string;expires:number;document?:TenbotInvoiceDocument;session?:ReturnType<typeof createTenbotAgentSessions>};
type Review={owner:string;attachmentId:string;expires:number;draft:LocalReceivalDraft;supplier:string;reference:string;traceHash:string;durable?:InvoiceReceivalDraft};
const record=(v:unknown):v is Row=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const text=(v:unknown)=>typeof v==='string'?v:'';
const array=(v:unknown):Row[]=>Array.isArray(v)?v.filter(record):[];
const digest=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const clone=<T,>(v:T):T=>structuredClone(v);
function fail(message:string,status=400):never{throw new TenbotError(message,status);}
const BLOCKED='Real execution is disabled until database-backed release gates pass.';
function keys(value:Row,allowed:string[]){if(Object.keys(value).some(key=>!allowed.includes(key)))fail('Invalid receival request fields.');}
function details(value:unknown):LocalOrderDetails{if(!record(value))fail('Review the order details.');keys(value,['orderedBy','orderDate','location']);for(const v of Object.values(value))if(typeof v!=='string'||v.length>120||/[\u0000-\u001f\u007f]/.test(v))fail('Invalid order details.');return {orderedBy:text(value.orderedBy).trim(),orderDate:text(value.orderDate).trim(),location:text(value.location).trim()};}

/** The HTTP adapter MUST authenticate getUser for every request and supply that
 * exact caller client. Tokens are not retained in attachment/conversation state. */
export function createAuthenticatedReceivalAgent(deps:Dependencies){
 const now=deps.now??Date.now,attachments=new Map<string,Attachment>(),reviews=new Map<string,Review>(),active=new Map<string,ReceivalAgentCaller>();
 const client=(owner:string)=>active.get(owner)??fail('The authenticated request has ended.',403);
 const can=async(owner:string,capability:string)=>{const r=capability==='proposal.access'?await client(owner).rpc('has_proposal_access',{}):await client(owner).rpc('has_app_capability',{p_capability:capability});return !r.error&&r.data===true;};
 const authorize=async(owner:string,write=false)=>{for(const cap of ['readOperationalData',...(write?['writeBusinessData','adjustInventory']:[])])if(!await can(owner,cap))fail('Your current permissions do not allow this TenOps request.',403);};
 const helpSession=createTenbotAgentSessions({mode:'openai',can,jobTools:id=>createTenbotJobTools(client(id)),provider:()=>deps.createProvider('authenticated-conversation'),invoice:{document:{id:'no-attachment',filename:'No attachment',mediaType:'text/plain',synthetic:true,text:'No attachment was submitted.'},reader:id=>createCallerInvoiceReader(client(id))},now});
 function attached(id:unknown,owner:string){const item=typeof id==='string'?attachments.get(id):undefined;if(!item||item.owner!==owner||item.expires<=now())return fail('This invoice attachment is unavailable or expired.',403);return item;}
 function reviewed(id:unknown,owner:string){const value=typeof id==='string'?reviews.get(id):undefined;if(!value||value.owner!==owner||value.expires<=now())return fail('This reviewed draft is unavailable or expired.',403);attached(value.attachmentId,owner);return value;}
 function hash(value:Review){return digest({owner:value.owner,attachment:value.attachmentId,source:attached(value.attachmentId,value.owner).sha256,revision:value.draft.revision,details:value.draft.orderDetails,rows:value.draft.rows,durable:value.durable?{id:value.durable.id,hash:value.durable.hash}:null});}
 function update(value:Review){
  value.draft.missingFields=Object.entries(value.draft.orderDetails).filter(([,v])=>!v).map(([k])=>k);
  value.draft.canApprove=Boolean(value.durable)&&!value.draft.missingFields.length&&value.draft.rows.some(r=>!r.excluded)&&value.draft.rows.every(r=>r.excluded||!r.reasons.length);
  value.draft.executionEnabled=false;value.draft.blockReason=BLOCKED;
  value.draft.durableDraftId=value.durable?.id;value.draft.durableHash=value.durable?.hash;value.draft.hash=hash(value);
 }
 function proposal(owner:string,item:Attachment,data:Row,orderDetails:LocalOrderDetails,trace:unknown){
  const rows:SourceDraftRow[]=[];
  for(const line of [...array(data.ready_lines),...array(data.held_lines)]){const extracted=record(line.extracted)?line.extracted:{},p=record(line.proposal)?line.proposal:{},source=record(line.sourceQuantity)?line.sourceQuantity:{};const sourceQuantity=typeof source.quantity==='string'&&typeof source.unit==='string'?{quantity:source.quantity,unit:source.unit}:null,quantityBasis=record(line.quantityBasis)?clone(line.quantityBasis) as unknown as InvoiceQuantityBasis:deriveInvoiceQuantity(sourceQuantity,undefined);rows.push({lineId:text(line.source_ref),sourceText:text(line.evidence),sourceQuantity,quantityBasis,materialId:text(line.catalog_candidate_id)||null,materialName:text(p.material_name)||text(extracted.description)||null,size:text(p.size)||text(extracted.size)||null,quantity:String(p.quantity_expected??quantityBasis.receivalQuantity??extracted.quantity??''),unit:text(p.unit)||quantityBasis.receivalUnit||text(extracted.unit),jobId:null,excluded:false,reasons:Array.isArray(line.reasons)?line.reasons.map(String):[]});}
  for(const line of array(data.excluded_lines))rows.push({lineId:text(line.source_ref),sourceText:text(line.evidence),sourceQuantity:null,quantityBasis:deriveInvoiceQuantity(null,undefined),materialId:null,materialName:null,size:null,quantity:'',unit:'',jobId:null,excluded:true,reasons:['non_material_line']});
  rows.sort((a,b)=>Number(a.lineId.match(/:L(\d+)$/)?.[1]??Infinity)-Number(b.lineId.match(/:L(\d+)$/)?.[1]??Infinity));
  if(!rows.length||rows.length>60||rows.some(r=>!r.lineId.startsWith(item.id+':L'))||new Set(rows.map(r=>r.lineId)).size!==rows.length)fail('A complete reviewable invoice draft was not produced.',503);
  const draft:LocalReceivalDraft={id:randomUUID(),revision:1,hash:'',simulation:false,status:'review_required',attachmentId:item.id,orderDetails,missingFields:[],canApprove:false,rows};
  const value:Review={owner,attachmentId:item.id,expires:item.expires,draft,supplier:text(data.supplier),reference:text(data.document_reference),traceHash:digest(trace)};update(value);reviews.set(draft.id,value);return clone(draft);
 }
 return async(body:Row,owner:string,caller:ReceivalAgentCaller)=>{
  if(!owner||!isJsonValue(body))fail('Invalid authenticated request.',401);
  if(active.has(owner))fail('Wait for the current invoice request to finish.',409);active.set(owner,caller);
  try{
   await authorize(owner);
   for(const [id,item] of attachments)if(item.expires<=now())attachments.delete(id);
   for(const [id,item] of reviews)if(item.expires<=now())reviews.delete(id);
   const action=body.action;
   if(action==='history'){
    keys(body,['action','conversationId']);const history=await helpSession(body,owner);await authorize(owner);return history;
   }
   if(action==='status'){
    keys(body,['action']);const reader=createCallerInvoiceReader(caller),catalog=await reader.readCatalog!(AbortSignal.timeout(4000));
    const found=await createTenbotJobTools(caller).execute('find_jobs',{limit:20}),foundData:Row=record(found.data)?found.data:{};if(found.status!=='ok'||!Array.isArray(foundData.jobs))fail('Authorized Job choices are unavailable.',503);
    await authorize(owner);
    return {mode:'authenticated-receivals',simulation:false,canPrepare:await can(owner,'writeBusinessData')&&await can(owner,'adjustInventory'),executionEnabled:false,blockedReason:BLOCKED,model:deps.model,recordSource:'Caller JWT / existing TenOps RBAC and RLS; execution disabled',catalog:combinePurchasingCatalogRecords(catalog.standard,catalog.specialty).map(c=>({id:`${c.source}:${c.id}`,materialName:c.materialName,size:c.chipSize,unit:c.orderUnit||c.containerType,supplier:c.vendor,packageQuantity:c.packageQuantity,packageMeasure:c.packageMeasure,containerType:c.containerType,packageLabel:c.packageEvidence?.label||''})),jobs:array(foundData.jobs).map(j=>({id:j.job_id,label:j.reference})),jobsLimited:foundData.has_more===true,maxAttachmentBytes:90000,mediaTypes:['image/png','image/jpeg']};
   }
   if(action==='upload'){
    await authorize(owner,true);
    keys(body,['action','attachment','syntheticConfirmed']);if(body.syntheticConfirmed!==true)fail('Use approved synthetic test documents for this local candidate.');
    const image=await decodeInvoiceAttachment(body.attachment);await authorize(owner);if(attachments.size>=20)fail('Local attachment limit reached.',429);
    const id='attachment-'+randomUUID(),expires=now()+3600000;attachments.set(id,{id,owner,filename:image.filename,image,sha256:image.sha256,expires});
    return {attachmentId:id,filename:image.filename,mediaType:image.mediaType,expiresAt:new Date(expires).toISOString(),simulation:false};
   }
   if(action==='ask'){
    keys(body,['action','attachmentId','conversationId','question','context','orderDetails']);
    if(body.attachmentId===undefined){const result=await helpSession({action:'ask',question:body.question,context:body.context,...(body.conversationId?{conversationId:body.conversationId}:{})},owner);await authorize(owner);return {...result,notices:['Local OpenAI TenOps guidance. Guidance is separate from actions; no database changes were made.'],localDemo:{simulation:false,draft:null}};}
    await authorize(owner,true);const item=attached(body.attachmentId,owner);const metadata=details(body.orderDetails??{});
    if(!item.document){item.document=await extractInvoiceDocument({id:item.id,filename:item.filename,image:item.image,model:deps.model,provider:deps.createProvider('authenticated-invoice-vision',item.image),remainingUsd:deps.remainingUsd(),assertNoFatal:deps.assertNoFatal});}
    item.session??=createTenbotAgentSessions({mode:'openai',can,jobTools:id=>createTenbotJobTools(client(id)),provider:()=>deps.createProvider('authenticated-invoice-investigation'),invoice:{document:item.document,reader:id=>createCallerInvoiceReader(client(id))},now});
    const result=await item.session({action:'ask',question:body.question,context:body.context,...(body.conversationId?{conversationId:body.conversationId}:{}),invoiceId:item.id,orderDetails:metadata},owner);
    await authorize(owner,true);attached(item.id,owner);
    const agent='agent' in result?result.agent:undefined;if(!agent)fail('The agent did not publish a validated result.',503);
    const proposals=agent.status==='completed'?array(agent.proposals).map(p=>p.proposal).filter(record):[];
    const value=proposals.find(p=>p.version==='tenbot-pending-receival-review.v1');
    return {...result,notices:['Experimental authenticated TenOps preparation. '+BLOCKED],localDemo:{simulation:false,draft:value?proposal(owner,item,value,metadata,agent.trace):null}};
   }
   if(action==='review'){
    await authorize(owner,true);
    keys(body,['action','draftId','revision','edits','orderDetails']);const value=reviewed(body.draftId,owner);
    if(body.revision!==value.draft.revision||!Array.isArray(body.edits)||body.edits.length!==value.draft.rows.length)fail('The draft changed. Review the current exact lines.',409);
    const next=clone(value.draft),seen=new Set<string>();
    for(const edit of body.edits){if(!record(edit))fail('Invalid reviewed line.');keys(edit,['lineId','materialId','quantity','unit','jobId','excluded']);const row=next.rows.find(r=>r.lineId===edit.lineId);if(!row||seen.has(row.lineId)||typeof edit.excluded!=='boolean'||!(edit.materialId===null||typeof edit.materialId==='string')||!(edit.jobId===null||typeof edit.jobId==='string')||typeof edit.quantity!=='string'||typeof edit.unit!=='string')fail('Review every exact invoice line.');seen.add(row.lineId);if(!edit.excluded&&row.reasons.includes('non_material_line'))fail('Freight and non-material lines cannot become Inventory materials.');Object.assign(row,{materialId:edit.materialId,jobId:edit.jobId,quantity:edit.quantity,unit:edit.unit,excluded:edit.excluded});}
    next.orderDetails=details(body.orderDetails);
    const catalog=await createCallerInvoiceReader(caller).readCatalog!(AbortSignal.timeout(4000)),offers=new Map(combinePurchasingCatalogRecords(catalog.standard,catalog.specialty).map(c=>[`${c.source}:${c.id}`,c]));
    for(const row of next.rows as SourceDraftRow[]){if(row.excluded)continue;const offer=row.materialId?offers.get(row.materialId):undefined;if(!offer)fail(`Invoice line ${row.lineId}: choose a current authorized catalog offer.`);const checked=invoiceQuantityIssues(row.sourceQuantity,{orderUnit:offer.orderUnit||offer.containerType,packageQuantity:offer.packageQuantity,packageMeasure:offer.packageMeasure,containerType:offer.containerType},row.quantity,row.unit,row.sourceText);row.quantityBasis=checked.basis;if(checked.reasons.length)fail(`Invoice line ${row.lineId}: quantity/unit contradicts source evidence (${checked.reasons.join(', ')}). Expected ${checked.basis.receivalQuantity??'clarification'} ${checked.basis.receivalUnit??''}.`,409);}
    const lines:InvoiceReceivalLine[]=next.rows.filter(r=>!r.excluded).map(r=>{const match=r.materialId?.match(/^(standard|specialty):(.+)$/);if(!match||!/^\d{1,9}(?:\.\d{1,6})?$/.test(r.quantity)||Number(r.quantity)<=0||r.unit.length>40)fail('Resolve included lines to existing catalog materials with positive quantities and valid units.');return {sourceLineId:r.lineId,catalogSource:match[1] as 'standard'|'specialty',catalogId:match[2],quantityExpected:r.quantity,unit:r.unit,productionJobId:r.jobId};});
    const item=attached(value.attachmentId,owner),service=createInvoiceReceivalService(caller,{executionEnabled:false});
    const durable=await service.prepare({document:{sha256:item.sha256,supplier:value.supplier,reference:value.reference,documentDate:null},lines,metadata:next.orderDetails,provenance:{model:deps.model,sourceMediaType:item.image.mediaType,extractionSha256:digest(item.document?.text??''),toolTraceSha256:digest({trace:value.traceHash,review:next.rows})}});
    await authorize(owner,true);reviewed(value.draft.id,owner);if(durable.ownerId!==owner)fail('The durable draft owner changed.',403);
    for(const row of next.rows){if(row.excluded){row.reasons=[];continue;}const canonical=durable.lines.find(l=>l.sourceLineId===row.lineId);if(!canonical)fail('The server did not validate every included line.',503);row.materialName=canonical.material;row.size=canonical.size;row.quantity=canonical.quantityExpected;row.unit=canonical.unit;row.reasons=[];const source=row as SourceDraftRow;const offer=offers.get(row.materialId!);if(!offer||invoiceQuantityIssues(source.sourceQuantity,{orderUnit:offer.orderUnit||offer.containerType,packageQuantity:offer.packageQuantity,packageMeasure:offer.packageMeasure,containerType:offer.containerType},row.quantity,row.unit,row.sourceText).reasons.length)fail('The canonical draft changed an invoice quantity or unit. No approval is available.',503);}
    next.revision++;value.draft=next;value.durable=durable;update(value);return {draft:clone(value.draft),simulation:false};
   }
   if(action==='approve'){
    await authorize(owner,true);
    keys(body,['action','draftId','revision','hash','confirmation','durableDraftId','durableHash']);const value=reviewed(body.draftId,owner);
    if(body.confirmation!==true||body.revision!==value.draft.revision||body.hash!==value.draft.hash||!value.durable||body.durableDraftId!==value.durable.id||body.durableHash!==value.durable.hash)fail('Explicit approval must match the exact current durable draft.',409);
    await authorize(owner,true);
    // Candidate gate is deliberately not configurable until actual DB tests pass.
    // The canonical service already defines approval/execution, but no local
    // request can turn this gate on or create a durable approval accidentally.
    const executionValidated=false;if(!executionValidated)fail(BLOCKED,503);
    const durable=value.durable??fail('Save a durable draft before approval.',409);
    const service=createInvoiceReceivalService(caller,{executionEnabled:executionValidated});
    const approval=await service.approve({draftId:durable.id,hash:durable.hash,confirmation:INVOICE_RECEIVAL_APPROVAL});
    const result=await service.execute({draftId:durable.id,hash:durable.hash,approvalId:approval.id});
    const query=caller.from('pending_receivals') as {select(columns:string):{in(column:string,ids:string[]):{abortSignal(signal:AbortSignal):PromiseLike<{data:unknown;error:unknown}>}}};
    const verified=await query.select('id,status,quantity_expected,quantity_received,unit,vendor,material_name,size,production_job_id').in('id',result.createdRecordIds).abortSignal(AbortSignal.timeout(4000));
    const records=array(verified.data);await authorize(owner,true);
    const matches=records.length===durable.lines.length&&result.createdRecordIds.every((id,index)=>{
     const actual=records.find(r=>r.id===id),expected=durable.lines[index];
     return actual&&expected&&actual.status==='pending'&&Number(actual.quantity_received)===0&&Number(actual.quantity_expected)===Number(expected.quantityExpected)&&actual.unit===expected.unit&&actual.vendor===expected.vendor&&actual.material_name===expected.material&&(actual.size??'')===expected.size&&(actual.production_job_id??null)===expected.productionJobId;
    });
    if(verified.error||records.length!==result.createdRecordIds.length||new Set(records.map(r=>r.id)).size!==records.length||!matches)fail('Creation returned a durable receipt, but current records could not be verified. Retry the exact approval to reconcile; do not create a new request.',503);
    value.draft.status='created';value.draft.canApprove=false;
    return {draft:clone(value.draft),simulation:false,receivals:records,createdRecordIds:result.createdRecordIds,createdCount:result.idempotent?0:records.length,idempotent:result.idempotent};
   }
   if(action==='clear'){
    keys(body,['action','attachmentId','conversationId']);if(body.attachmentId===undefined)return helpSession({action:'clear',...(body.conversationId?{conversationId:body.conversationId}:{})},owner);const item=attached(body.attachmentId,owner);attachments.delete(item.id);for(const [id,r] of reviews)if(r.owner===owner&&r.attachmentId===item.id)reviews.delete(id);return {cleared:true,simulation:false,durableDraftsRetained:true};
   }
   fail('Only authenticated invoice read, prepare and explicit reviewed approval actions are supported.');
  }finally{active.delete(owner);}
 };
}
