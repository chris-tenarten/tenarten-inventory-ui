/** Caller-authorized, independently composable business reads and previews.
 * No operation here persists drafts, approvals, source state or business rows.
 * The host keeps proposal separate from model-visible data and owns execution.
 */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- Edge/Node source
// @ts-ignore -- Edge requires explicit extensions.
import type {AgentTool,JsonValue,StrictSchema} from './tenbot-agent.ts';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- Edge/Node source
// @ts-ignore -- Edge requires explicit extensions.
import {AgentToolError} from './tenbot-investigation-diagnostics.ts';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- Edge/Node source
// @ts-ignore -- Edge requires explicit extensions.
import {createCallerInvoiceReader,type TenbotInvoiceReader,type TenbotInvoiceDocument} from './tenbot-invoice.ts';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- Edge/Node source
// @ts-ignore -- Edge requires explicit extensions.
import type {JobToolCaller,JobToolQuery} from './tenbot-job-tools.ts';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- Edge/Node source
// @ts-ignore -- Edge requires explicit extensions.
import {createInvoiceReceivalAttachmentService,type InvoiceReceivalSource,type InvoiceReceivalStorageCaller} from '../../../src/modules/inventory/invoice-receival-attachments.ts';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- Edge/Node source
// @ts-ignore -- Edge requires explicit extensions.
import {combinePurchasingCatalogRecords,samePurchasingVendor} from '../../../src/modules/purchasing/catalog-records.ts';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- Edge/Node source
// @ts-ignore -- Edge requires explicit extensions.
import {deriveInvoiceQuantity,invoiceQuantityIssues,invoiceQuantityUnit} from '../../../src/modules/inventory/invoice-quantity.ts';
import type {InvoiceReceivalLine} from '../../../src/modules/inventory/invoice-receival-service.ts';

type Row=Record<string,unknown>;
export type BusinessPreparedAction={operation:'inventory.create_pending_receivals';parameters:Record<string,JsonValue>;review:{title:string;summary:string;consequences:string[];fields:{path:string;label:string;value:JsonValue;editable?:boolean}[];issues:{code:string;message:string;blocking:boolean}[]};sourceReferences?:{kind:string;id:string}[]};
export type BusinessLookup={suppliers(query:string,signal:AbortSignal):Promise<JsonValue>;getOrder(id:string,signal:AbortSignal):Promise<JsonValue>};
export type BusinessDocumentRead={sourceId:string;ownerId:string;lines:Array<{source_ref:string;text:string}>};
export type BusinessOperationsDependencies={
 ownerId:string;can(capability:string):Promise<boolean>;
 reader:TenbotInvoiceReader;
 originals:Pick<ReturnType<typeof createInvoiceReceivalAttachmentService>,'download'>;
 /** Optional existing metered transcription adapter. Never writes source state. */
 extractDocument?(input:{source:InvoiceReceivalSource;original:Blob;signal:AbortSignal}):Promise<TenbotInvoiceDocument>;
 /** Trusted per-run evidence handoff after the final caller permission check.
  * Never registers model-supplied text and never persists document content. */
 onDocumentRead?(input:BusinessDocumentRead):void;
 lookup?:BusinessLookup;
};
const record=(value:unknown):value is Row=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const json=(value:unknown):JsonValue=>JSON.parse(JSON.stringify(value)) as JsonValue;
const str=(maxLength=240):StrictSchema=>({type:'string',maxLength});
const object=(properties:Record<string,StrictSchema>):StrictSchema=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
const nullable=(schema:StrictSchema):StrictSchema=>({anyOf:[schema,{type:'null'}]});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function fail():never{throw new AgentToolError('invalid-arguments');}
function text(value:unknown,max=240,empty=false):string{if(typeof value!=='string'||value.length>max||/[\u0000-\u001f\u007f]/.test(value)||!empty&&!value.trim())return fail();return value.trim();}
function keys(args:Row,names:string[]){if(Object.keys(args).some(key=>!names.includes(key))||names.some(key=>!Object.hasOwn(args,key)))fail();}
const norm=(value:unknown)=>String(value??'').trim().replace(/\s+/g,' ').toLocaleLowerCase('en-US');
const phrase=(line:string,value:string)=>new RegExp(`(?:^|[^a-z0-9])${norm(value).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}(?:$|[^a-z0-9])`,'i').test(norm(line));
function verifiedLineQuantity(source:InvoiceReceivalSource,ref:string,line:string){
 const state=source.agentState;
 if(!['ready','retained'].includes(source.state)||!source.evidenceSha256||!/^[a-f0-9]{64}$/.test(source.evidenceSha256)||state?.version!=='invoice-receival-state.v1'||state.originalSha256!==source.sha256||!Array.isArray(state.sourceRows))return null;
 const matches=state.sourceRows.filter(row=>record(row)&&row.lineId===ref);
 if(matches.length!==1||matches[0].sourceText!==line)return null;
 const value=matches[0].sourceQuantity;
 if(!record(value)||typeof value.quantity!=='string'||typeof value.unit!=='string'||value.quantity.length>30||value.unit.length>40||value.quantity!==value.quantity.trim()||value.unit!==value.unit.trim()||/[\u0000-\u001f\u007f]/.test(value.quantity+value.unit))return null;
 const quantity={quantity:value.quantity,unit:value.unit};
 return deriveInvoiceQuantity(quantity,undefined).sourceKind==='unknown'?null:quantity;
}
function date(value:string){return /^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;}
async function digest(value:unknown){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value))))].map(x=>x.toString(16).padStart(2,'0')).join('');}

/** Narrow read facade over the existing Purchasing tables/contracts. This does
 * not implement PO business rules or map arbitrary tables/projections. */
export function createCallerBusinessLookup(caller:JobToolCaller):BusinessLookup{
 const db=caller as unknown as {from(table:string):{select(columns:string,options?:{count:'exact'}):JobToolQuery}};
 async function rows(query:JobToolQuery,signal:AbortSignal,max=100){
  const result=await query.order('id').range(0,max).abortSignal(signal);
  if(signal.aborted||result.error||!Array.isArray(result.data)||!Number.isSafeInteger(result.count)||result.count===null||result.count===undefined||result.count>max||result.count!==result.data.length||result.data.some(row=>!record(row)||typeof row.id!=='string')||new Set(result.data.map(row=>(row as Row).id)).size!==result.data.length)throw new AgentToolError('invoice_read_incomplete');
  return result.data as Row[];
 }
 return {
  async suppliers(query,signal){const term=text(query,120);if(term.length<2)fail();const pattern=JSON.stringify(`%${term.replace(/[\\%_]/g,'\\$&')}%`);return json({complete:true,suppliers:await rows(db.from('vendors').select('id,name,canonical_name,is_active',{count:'exact'}).eq('is_active',true).or(`name.ilike.${pattern},canonical_name.ilike.${pattern}`),signal)});},
  async getOrder(id,signal){if(!uuid.test(id))fail();const orders=await rows(db.from('purchase_orders').select('id,po_number,status,vendor_id,vendor_name_snapshot,order_date,requested_date,revision_number,updated_at',{count:'exact'}).eq('id',id),signal,1);if(!orders.length)return {status:'not_found_or_not_authorized',order:null};
   const [lines,issuances]=await Promise.all([
    rows(db.from('purchase_order_lines').select('id,purchase_order_id,line_number,material_type,details:chip_purchase_order_line_details(vendor_sku_snapshot,material_name_snapshot,chip_size,quantity_ordered,order_unit,package_quantity,package_measure,container_type)',{count:'exact'}).eq('purchase_order_id',id),signal),
    rows(db.from('purchase_order_issuances').select('id,revision_number,issued_at,snapshot_hash,order_snapshot,lines_snapshot',{count:'exact'}).eq('purchase_order_id',id),signal),
   ]);return json({status:'ok',complete:true,order:orders[0],lines,issuances,limitations:['Saved order and immutable issuance evidence; current physical receipt is a separate record.']});},
 };
}
/** Convenience wiring uses only the supplied employee JWT client. No privileged
 * client, provider credentials or new upload path enters this factory. */
export function callerBusinessDependencies(caller:JobToolCaller&InvoiceReceivalStorageCaller,ownerId:string):BusinessOperationsDependencies{
 return {ownerId,async can(capability){const r=await caller.rpc('has_app_capability',{p_capability:capability});return !r.error&&r.data===true;},reader:createCallerInvoiceReader(caller),originals:createInvoiceReceivalAttachmentService(caller),lookup:createCallerBusinessLookup(caller)};
}

export function createBusinessOperations(deps:BusinessOperationsDependencies):AgentTool[]{
 async function authorize(context:{callerId:string;signal:AbortSignal}){if(context.callerId!==deps.ownerId||context.signal.aborted||!await deps.can('readOperationalData'))throw new AgentToolError('invoice_session_not_authorized');}
 async function document(id:string,context:{callerId:string;signal:AbortSignal}){
  if(!uuid.test(id))fail();const downloaded=await deps.originals.download(id);await authorize(context);
  const source=downloaded.source;if(source.id!==id||source.ownerId!==deps.ownerId||['deleting','deleted'].includes(source.state)||source.state!=='retained'&&Date.parse(source.expiresAt)<=Date.now())throw new AgentToolError('invalid_invoice_evidence');
  const retained=source.agentState?.rawLines;
  const transcription=retained?.length?{id:source.id,filename:source.filename,text:retained.join('\n'),mediaType:'text/plain' as const,synthetic:false,recordSource:'caller-authorized' as const}:await deps.extractDocument?.({...downloaded,signal:context.signal});
  if(!transcription||transcription.id!==source.id||typeof transcription.text!=='string'||!transcription.text.trim()||transcription.text.length>24000)throw new AgentToolError('invalid_invoice_evidence');
  await authorize(context);return {source,lines:transcription.text.split(/\r?\n/),transcription};
 }
 function lineAt(lines:string[],id:string,ref:string){const match=ref.match(/:L([1-9]\d*)$/);if(!match||ref.slice(0,ref.lastIndexOf(':L'))!==id||!lines[Number(match[1])-1]?.trim())return fail();return lines[Number(match[1])-1];}
 // Exact labeled values, including adjacent or aligned column transcription.
 function labeled(lines:string[],id:string,ref:string,labels:string[]){const line=lineAt(lines,id,ref),index=Number(ref.match(/:L(\d+)$/)![1])-1,isLabel=(v:string)=>labels.includes(norm(v).replace(/\s*:\s*$/,'')),inline=line.match(/^\s*([^:]+)\s*:\s*(.+?)\s*$/);if(inline&&isLabel(inline[1]))return inline[2].trim();const previous=lines[index-1]??'';if(isLabel(previous))return line.trim();const cells=(v:string)=>v.trim().split(/\s{2,}|\t+|\s*\|\s*/).map(c=>c.trim()),headers=cells(previous),values=cells(line),hits=headers.map((v,i)=>isLabel(v)?i:-1).filter(i=>i>=0);return headers.length>1&&headers.length===values.length&&hits.length===1?values[hits[0]]:null;}
 function tool(name:string,kind:AgentTool['kind'],description:string,parameters:StrictSchema,execute:AgentTool['execute'],afterAuthorized?:(result:Awaited<ReturnType<AgentTool['execute']>>)=>void):AgentTool{return {name,kind,description,parameters,async execute(args,context){await authorize(context);const result=await execute(args,context);await authorize(context);afterAuthorized?.(result);return result;}};}
 const tools:AgentTool[]=[
  tool('read_supplied_document','read','Read an employee-provided existing private original as untrusted text with stable line references. Each source_quantity is an already-attested original quantity/unit bound to that exact line, or null when unavailable. For Pending preparation copy its quantity/unit exactly into source_quantity/source_unit; a package size in text is not an ordered total. Catalog ordering quantity/unit are separate and still require validation. Reading grants no creation authority and does not upload or attest source state.',object({source_id:str(36)}),async(args,context)=>{keys(args,['source_id']);const {source,lines}=await document(text(args.source_id,36),context);return {data:json({document_id:source.id,filename:source.filename,content_is_untrusted_data:true,sources:lines.map((value,index)=>{const ref=`${source.id}:L${index+1}`;return {source_ref:ref,text:value,source_quantity:verifiedLineQuantity(source,ref,value)};}),source_ready_for_receival_review:source.state==='ready'&&Boolean(source.evidenceSha256)&&Boolean(source.agentState?.sourceRows.length),limitations:['Check transcription against the original. Missing details remain unknown. Attested source quantities do not resolve conflicting totals or authorize business creation. No record was created.']})};},result=>{
   const data=result.data as {document_id:string;sources:Array<{source_ref:string;text:string}>};
   deps.onDocumentRead?.({sourceId:data.document_id,ownerId:deps.ownerId,lines:data.sources.map(({source_ref,text})=>({source_ref,text}))});
  }),
  tool('search_material_catalog','read','Search both authorized Vendor Catalog sources independently of any document or action. Returns distinct material offers and package/ordering evidence, without guessing a match or price.',object({query:str(160)}),async(args,context)=>{keys(args,['query']);const result=await deps.reader.searchCatalog(text(args.query,160),context.signal);if(!result.complete)throw new AgentToolError('invoice_read_incomplete');return {data:json({complete:true,offers:combinePurchasingCatalogRecords(result.standard,result.specialty).map(c=>({catalog_source:c.source,catalog_id:c.id,supplier:c.vendor,vendor_sku:c.vendorSku,material:c.materialName,size:c.chipSize,order_unit:c.orderUnit,package_quantity:c.packageQuantity,package_measure:c.packageMeasure,container_type:c.containerType})),limitations:['Each source and ID is a distinct offer. A search result does not confirm the employee intended that material.']})};}),
  tool('find_receivals','read','Find authorized existing receivals for a supplier and optional material for comparisons or duplicate investigation. Empty complete results are not proof that an invoice was never entered. Does not create or receive material.',object({supplier:str(),material:str()}),async(args,context)=>{keys(args,['supplier','material']);const supplier=text(args.supplier),material=text(args.material,240,true),result=await deps.reader.readReceivals(context.signal);if(!result.complete)throw new AgentToolError('invoice_read_incomplete');const matches=result.rows.filter(row=>samePurchasingVendor(String(row.vendor??''),supplier)&&(!material||norm(row.material_name)===norm(material)));return {data:json({complete:true,receivals:matches,limitations:['Supplier/material matches are possible duplicates. General receivals do not establish invoice-level identity.']})};}),
 ];
 if(deps.lookup)tools.push(
  tool('find_suppliers','read','Find active authorized suppliers by name, for document interpretation or purchasing comparisons. Never creates a supplier.',object({query:str(120)}),async(args,context)=>{keys(args,['query']);return {data:await deps.lookup!.suppliers(text(args.query,120),context.signal)};}),
  tool('get_order','read','Read one exact authorized Purchase Order and its saved material lines and immutable issuances. Use for comparison or missing-information analysis; reading does not create receivals.',object({order_id:str(36)}),async(args,context)=>{keys(args,['order_id']);const id=text(args.order_id,36);if(!uuid.test(id))fail();return {data:await deps.lookup!.getOrder(id,context.signal)};}),
 );
 tools.push(tool('prepare_pending_receivals','prepare','Prepare a nonpersistent employee review from an existing private original and current catalog identities. Copy each source_ref and attested source_quantity.quantity/unit from read_supplied_document into source_quantity/source_unit exactly; never substitute package size or invent an ordered total. quantity_expected/unit are the separate catalog ordering quantity/unit and are checked against source/package evidence. Unavailable quantities may stay blank for a held review. Rechecks original access, immutable source binding, supplier, duplicates and missing details independently of prior tool order. Held issues block execution. Never writes drafts, approvals, catalogs, receivals or Inventory. Creation requires exact review, existing-account reauthentication and canonical execution.',object({source_id:str(36),supplier_source_ref:str(160),document_reference_source_ref:str(160),ordered_by:str(120),order_date:str(10),location:str(120),lines:{type:'array',minItems:1,maxItems:30,items:object({source_ref:str(160),catalog_source:nullable({type:'string',enum:['standard','specialty']}),catalog_id:nullable(str(160)),source_quantity:str(30),source_unit:str(40),quantity_expected:str(30),unit:str(40),production_job_id:nullable(str(36))})}}),async(args,context)=>{
  keys(args,['source_id','supplier_source_ref','document_reference_source_ref','ordered_by','order_date','location','lines']);const id=text(args.source_id,36),{source,lines:raw}=await document(id,context),issues:BusinessPreparedAction['review']['issues']=[];
  const issue=(code:string,message:string)=>{if(!issues.some(i=>i.code===code&&i.message===message))issues.push({code,message,blocking:true});};
  const supplier=labeled(raw,id,text(args.supplier_source_ref,160),['supplier','vendor','sold by'])??'',reference=labeled(raw,id,text(args.document_reference_source_ref,160),['invoice','invoice number','invoice reference'])??'';
  if(!supplier)issue('supplier_evidence_missing','Identify the complete invoice supplier in its labeled source evidence.');if(!reference)issue('invoice_reference_missing','Identify the complete invoice reference in its labeled source evidence.');
  const metadata={orderedBy:text(args.ordered_by,120,true),orderDate:text(args.order_date,10,true),location:text(args.location,120,true)};
  for(const [key,value] of Object.entries(metadata))if(!value||key==='orderDate'&&!date(value))issue('missing_'+key,`Confirm ${key==='orderedBy'?'who ordered the material':key==='orderDate'?'the actual order date':'the destination location'}.`);
  if(source.state!=='ready'||!source.evidenceSha256||!source.agentState?.sourceRows.length)issue('source_not_ready','This original needs trusted source-evidence preparation before business creation. Reading it has not saved that evidence.');
  if(!Array.isArray(args.lines)||!args.lines.length||args.lines.length>30)fail();
  const identities: {source:'standard'|'specialty';id:string}[]=[],inputs:Row[]=[],seen=new Set<string>();
  for(const value of args.lines){if(!record(value))fail();keys(value,['source_ref','catalog_source','catalog_id','source_quantity','source_unit','quantity_expected','unit','production_job_id']);const ref=text(value.source_ref,160);if(seen.has(ref))fail();seen.add(ref);lineAt(raw,id,ref);if(value.catalog_source!==null&&!['standard','specialty'].includes(String(value.catalog_source))||value.catalog_id!==null&&typeof value.catalog_id!=='string'||value.production_job_id!==null&&(typeof value.production_job_id!=='string'||!uuid.test(value.production_job_id)))fail();if(value.catalog_source!==null&&value.catalog_id!==null)identities.push({source:value.catalog_source as 'standard'|'specialty',id:text(value.catalog_id,160)});inputs.push(value);}
  const unique=[...new Map(identities.map(i=>[`${i.source}:${i.id}`,i])).values()];
  const catalog=deps.reader.readCatalog?await deps.reader.readCatalog(context.signal,unique):null;if(catalog&&!catalog.complete)throw new AgentToolError('invoice_read_incomplete');const offers=new Map(catalog?combinePurchasingCatalogRecords(catalog.standard,catalog.specialty).map(c=>[`${c.source}:${c.id}`,c]):[]);
  const existing=await deps.reader.readReceivals(context.signal);if(!existing.complete)throw new AgentToolError('invoice_read_incomplete');
  if(existing.rows.some(row=>typeof row.id!=='string'||!row.id.trim()||typeof row.vendor!=='string'||!row.vendor.trim()||typeof row.material_name!=='string'||!row.material_name.trim()||!['pending','partially_received','received'].includes(String(row.status))||row.size!=null&&typeof row.size!=='string'))throw new AgentToolError('invoice_read_incomplete');
  const reviewed:InvoiceReceivalLine[]=[],fields:BusinessPreparedAction['review']['fields']=[],materialKeys=new Set<string>();
  let duplicateMatches=0,unmatchedMaterials=0;
  for(const input of inputs){const ref=String(input.source_ref),sourceText=lineAt(raw,id,ref),quantity={quantity:text(input.source_quantity,30,true),unit:text(input.source_unit,40,true)},offer=offers.get(`${input.catalog_source}:${input.catalog_id}`),expected=text(input.quantity_expected,30,true),unit=text(input.unit,40,true),evidence=source.agentState?.sourceRows.find(r=>r.lineId===ref);
   if(!evidence||evidence.sourceText!==sourceText||evidence.sourceQuantity?.quantity!==quantity.quantity||evidence.sourceQuantity.unit!==quantity.unit)issue('source_evidence_unverified',`Line ${raw.indexOf(sourceText)+1}: quantity evidence is not bound to this trusted original.`);
   if(/\b(freight|shipping charge|sales tax)\b/i.test(sourceText))issue('non_material_line','Freight or tax cannot become a receival material.');
   if(!offer)issue('catalog_match_missing','Select an existing authorized catalog offer for every included material.');
   if(offer){if(!samePurchasingVendor(offer.vendor,supplier))issue('supplier_conflict','The selected catalog supplier conflicts with the invoice.');if(!phrase(sourceText,offer.vendorSku||offer.materialName)||offer.chipSize&&!phrase(sourceText,offer.chipSize))issue('material_evidence_conflict','The selected catalog material or size is not supported by its invoice line.');
    const checked=invoiceQuantityIssues(quantity,{orderUnit:offer.orderUnit||offer.containerType,packageQuantity:offer.packageQuantity,packageMeasure:offer.packageMeasure,containerType:offer.containerType},expected,unit,sourceText);for(const reason of checked.reasons)issue(reason,`Check the source quantity and unit for ${offer.materialName}.`);if(checked.basis.receivalQuantity===null||!invoiceQuantityUnit(unit))issue('quantity_unresolved',`Resolve the source quantity for ${offer.materialName}.`);
    const key=[norm(supplier),norm(offer.materialName),norm(offer.chipSize)].join('|');if(materialKeys.has(key))issue('duplicate_source_material','Repeated invoice material needs review before creation.');materialKeys.add(key);
    const matches=existing.rows.filter(r=>samePurchasingVendor(String(r.vendor??''),supplier)&&norm(r.material_name)===norm(offer.materialName)&&norm(r.size)===norm(offer.chipSize));
    duplicateMatches+=matches.length;
    const outstanding=matches.filter(row=>row.status!=='received').length;
    const identified=Boolean(supplier&&samePurchasingVendor(offer.vendor,supplier)&&phrase(sourceText,offer.vendorSku||offer.materialName)&&(!offer.chipSize||phrase(sourceText,offer.chipSize)));
    if(!identified)unmatchedMaterials++;
    const duplicateFinding=!identified?'Confirm the supplier and material identity before I can complete its duplicate check.':outstanding?`I found ${outstanding} possible matching outstanding ${outstanding===1?'entry':'entries'} for ${offer.materialName}. Review ${outstanding===1?'it':'them'} before adding another.`:matches.length?`I did not find a matching outstanding entry for ${offer.materialName}, but found ${matches.length} matching previously received ${matches.length===1?'entry':'entries'}. These need separate duplicate review.`:`I checked your existing receiving entries and did not find a matching outstanding entry for ${offer.materialName} in this size.`;
    fields.push({path:`lines.${reviewed.length}.duplicateCheck`,label:'Duplicate check',value:duplicateFinding,editable:false});
    if(matches.length)issue('potential_duplicate',`Existing receivals for ${offer.materialName} need separate duplicate review. No duplicate override is inferred.`);
   }else{
    unmatchedMaterials++;
    fields.push({path:`lines.${reviewed.length}.duplicateCheck`,label:'Duplicate check',value:'Confirm the material identity before I can complete its duplicate check.',editable:false});
   }
   if(input.production_job_id!==null)issue('job_review_required','This proposed Job association needs a verified employee-readable Job review before creation.');
   reviewed.push({sourceLineId:ref,catalogSource:offer?.source??null,catalogId:offer?.id??null,quantityExpected:expected,unit,productionJobId:input.production_job_id as string|null,sourceQuantity:quantity,sourceText,newMaterial:null,duplicateAcknowledgement:null});
   fields.push({path:`lines.${reviewed.length-1}`,label:offer?.materialName??'Unmatched material',value:json({supplier:offer?.vendor??supplier,material:offer?.materialName??null,vendorSku:offer?.vendorSku??null,size:offer?.chipSize??null,quantity:expected,unit,sourceQuantity:quantity,package:offer?{quantity:offer.packageQuantity,measure:offer.packageMeasure,container:offer.containerType}:null}),editable:false});
  }
  const parameters=json({sourceId:id,document:{sha256:source.sha256,supplier,reference,documentDate:null},lines:reviewed,metadata,provenance:{model:'trusted-existing-source',sourceMediaType:source.mediaType,extractionSha256:source.evidenceSha256??'0'.repeat(64),toolTraceSha256:await digest({sourceVersion:source.version,lines:reviewed,metadata})}}) as Record<string,JsonValue>;
  const duplicateSummary=duplicateMatches?'I found possible existing receiving entries. Review the duplicate findings before adding anything.':unmatchedMaterials?'Some material identities need confirmation before I can complete the duplicate check.':'I checked your existing receiving entries and did not find a matching outstanding entry for these materials.';
  const action:BusinessPreparedAction={operation:'inventory.create_pending_receivals',parameters,review:{title:'Review Pending Receivals',summary:`${reviewed.length} material${reviewed.length===1?'':'s'} from ${supplier||'an unconfirmed supplier'} prepared for review. ${duplicateSummary}`,consequences:['Adds incoming materials to Pending Receivals after authorized confirmation.','Received Inventory quantities will not change until the materials are received.','Compare all proposed materials against the original document before confirming.'],fields:[{path:'document.reference',label:'Invoice reference',value:reference,editable:false},...Object.entries(metadata).map(([key,value])=>({path:`metadata.${key}`,label:key==='orderedBy'?'Ordered by':key==='orderDate'?'Order date':'Destination',value,editable:false})),...fields],issues},sourceReferences:[{kind:'supplied_document',id},...unique.map(i=>({kind:'catalog',id:`${i.source}:${i.id}`}))]};
  // The complete canonical request remains only in proposal for the trusted host.
  return {data:json({status:issues.length?'needs_information':'review_required',message:action.review.summary,review:action.review,persistent_changes:false,created_count:0}),proposal:json(action)};
 }));
 return tools;
}
