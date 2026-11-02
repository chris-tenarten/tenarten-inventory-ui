/** Caller-authorized directory reads and nonpersistent Proposal preparation.
 * No tool in this module creates records, assigns document numbers or issues a document. */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- shared Edge/Node source
// @ts-ignore -- explicit extension required by Deno.
import {validateStrictSchema,type AgentTool,type JsonValue,type StrictSchema} from './tenbot-agent.ts';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- shared Edge/Node source
// @ts-ignore -- explicit extension required by Deno.
import {AgentToolError} from './tenbot-investigation-diagnostics.ts';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- shared Edge/Node source
// @ts-ignore -- reuse canonical pure defaults, not an agent calculation contract.
import {emptyProposalEstimateInputs} from '../../../src/modules/proposals/estimate-defaults.ts';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- shared Edge/Node source
// @ts-ignore -- explicit extension required by Deno.
import {PROPOSAL_DISCLAIMER} from '../../../src/modules/proposals/types.ts';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- shared Edge/Node source
// @ts-ignore -- reuse canonical Proposal amount calculations.
import {lineTotal} from '../../../src/modules/proposals/model.ts';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- shared Edge/Node source
// @ts-ignore -- explicit extension required by Deno.
import type {PreparedAction} from './tenbot-actions.ts';

export type ProposalOperationSource = {id:string;text:string};
export type ProposalOperationDependencies = {
 callerId:string;
 /** Must be bound to this verified employee's JWT, never a service-role client. */
 rpc(name:string,args:Record<string,JsonValue>,signal:AbortSignal):Promise<{data:unknown;error?:unknown}>;
 /** Host-supplied employee text or authorized document text. Never model-authored evidence. */
 sources:readonly ProposalOperationSource[];
 /** Owner-scoped current-run evidence supplied by an authorized document tool.
  * The resolver must recheck access; model arguments can only select its refs. */
 resolveSource?(sourceRef:string,signal:AbortSignal):Promise<string|null>;
 now?:()=>Date;
};
type Row=Record<string,unknown>;
type Evidence={value:string;source_ref:string};
type ReviewField=PreparedAction['review']['fields'][number];
type ReviewIssue=PreparedAction['review']['issues'][number];
type Customer={company:{id:string;name:string;phone:string;email:string;mailing_address:string;updated_at:string};contact:{id:string;company_id:string;name:string;phone:string;email:string;title:string;updated_at:string}|null};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const object=(value:unknown):value is Row=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const json=(value:unknown)=>JSON.parse(JSON.stringify(value)) as JsonValue;
function fail(code:'invalid-arguments'|'tool-failed'|'unknown-capability'='invalid-arguments'):never{throw new AgentToolError(code);}
const text=(maxLength:number,minLength=0):StrictSchema=>({type:'string',minLength,maxLength});
const schema=(properties:Record<string,StrictSchema>):StrictSchema=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
const nullable=(value:StrictSchema):StrictSchema=>({anyOf:[value,{type:'null'}]});
const identity=text(36,36);
const headerFields=['customer_name','customer_street','customer_city','customer_state','customer_postal_code','customer_contact_name','customer_office_phone','customer_mobile_phone','customer_email','project_name','project_number','project_location','side_mark','sales_rep','terms','requested_delivery','fob','destination_zip','tax_county','tax_rate','submitted_by_name','submitted_by_phone','submitted_by_email','notes','proposal_date'] as const;
const lineFields=['item_number','description','ref','color_plate','quantity','unit','length','width','height_thickness','cft','lf','estimated_weight','rate'] as const;
const evidenceFields=(paths:readonly string[])=>({type:'array',maxItems:paths.length,items:schema({path:{type:'string',enum:[...paths]},value:text(2000,1),source_ref:text(160,1)})}) as StrictSchema;
const prepareSchema=schema({
 customer_company_id:nullable(identity),customer_contact_id:nullable(identity),
 fields:evidenceFields(headerFields),
 lines:{type:'array',minItems:1,maxItems:20,items:schema({line_type:{type:'string',enum:['product','charge','informational','included']},fields:evidenceFields(lineFields)})},
});
const headerLimits:Record<string,number>={customer_name:500,customer_street:1000,customer_city:200,customer_state:100,customer_postal_code:40,customer_contact_name:500,customer_office_phone:100,customer_mobile_phone:100,customer_email:500,project_name:500,project_number:200,project_location:500,side_mark:500,sales_rep:500,terms:500,requested_delivery:500,fob:500,destination_zip:40,tax_county:200,tax_rate:20,submitted_by_name:500,submitted_by_phone:100,submitted_by_email:500,notes:2000,proposal_date:10};
const lineLimits:Record<string,number>={item_number:100,description:2000,ref:500,color_plate:500,quantity:30,unit:100,length:200,width:200,height_thickness:200,cft:200,lf:200,estimated_weight:200,rate:30};
const normalize=(value:string)=>value.normalize('NFKC').replace(/\s+/g,' ').trim().toLocaleLowerCase('en-US');
function validText(value:unknown,max=2000):value is string{return typeof value==='string'&&value.length<=max&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value);}
function exactEvidence(source:string,value:string){
 const haystack=normalize(source),needle=normalize(value);
 if(!needle)return false;
 // Prevent an invented 12 from being justified by 125 or X12 in the source.
 let offset=haystack.indexOf(needle);
 while(offset>=0){
  const before=haystack[offset-1]??'',after=haystack[offset+needle.length]??'';
  if(!(/[\p{L}\p{N}]/u.test(needle[0])&&/[\p{L}\p{N}]/u.test(before))&&!(/[\p{L}\p{N}]/u.test(needle.at(-1)!)&&/[\p{L}\p{N}]/u.test(after)))return true;
  offset=haystack.indexOf(needle,offset+1);
 }
 return false;
}
function decimal(value:string,places:number,integerDigits:number){
 if(!new RegExp(`^\\d{1,${integerDigits}}(?:\\.\\d{1,${places}})?$`).test(value)||!Number.isFinite(Number(value)))fail();
 return value;
}
function quoteRateEvidence(source:string,value:string){
 const escaped=value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 const priceLabel='(?:quote(?:d)?(?:\\s+(?:unit\\s+)?(?:price|rate))?|customer\\s+(?:unit\\s+)?(?:price|rate)|sell(?:ing)?\\s+(?:price|rate)|proposal\\s+(?:price|rate))';
 return new RegExp('\\b'+priceLabel+'\\s*(?:(?:is|of|at)\\s*)?[:=]?\\s*\\$?\\s*'+escaped+'(?!\\d|\\.\\d)','i').test(source);
}
function currentDate(now:Date){
 if(!Number.isFinite(now.getTime()))fail('tool-failed');
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
 return ['year','month','day'].map(type=>parts.find(part=>part.type===type)?.value).join('-');
}
function directoryText(row:Row,key:string,max:number){const value=row[key]??'';if(!validText(value,max))fail('tool-failed');return value;}
function customer(value:unknown,expectedCompany?:string,expectedContact?:string|null):Customer{
 if(!object(value)||!object(value.company))fail('tool-failed');
 const company=value.company as Row,contact=value.contact;
 if(typeof company.id!=='string'||!uuid.test(company.id)||expectedCompany&&company.id.toLowerCase()!==expectedCompany.toLowerCase()||company.archived_at!=null)fail('tool-failed');
 const projected:Customer={company:{id:company.id,name:directoryText(company,'name',500),phone:directoryText(company,'phone',100),email:directoryText(company,'email',500),mailing_address:directoryText(company,'mailing_address',1000),updated_at:directoryText(company,'updated_at',80)},contact:null};
 if(!projected.company.name.trim())fail('tool-failed');
 if(contact!=null){
  if(!object(contact)||typeof contact.id!=='string'||!uuid.test(contact.id)||contact.company_id!==company.id||expectedContact!==undefined&&contact.id!==expectedContact)fail('tool-failed');
  projected.contact={id:contact.id,company_id:company.id,name:directoryText(contact,'name',500),phone:directoryText(contact,'phone',100),email:directoryText(contact,'email',500),title:directoryText(contact,'title',500),updated_at:directoryText(contact,'updated_at',80)};
 }
 if(expectedContact&&projected.contact?.id!==expectedContact||expectedContact===null&&projected.contact!==null)fail('tool-failed');
 return projected;
}

/** Existing generate-proposal-pdf preview snapshot. The label allocates no number.
 * Its renderer coerces unknown amounts to zero, so incomplete prices cannot be previewed as a quote. */
export function buildProposalPreview(parameters:Record<string,JsonValue>):JsonValue{
 if(Object.keys(parameters).some(key=>!['p_proposal','p_lines','p_estimate_inputs','p_estimate_overrides'].includes(key))||!object(parameters.p_proposal)||!Array.isArray(parameters.p_lines)||parameters.p_lines.length>20)fail();
 const proposal=parameters.p_proposal;
 if(['id','job_id','bid_id','estimate_number','issued_snapshot','status'].some(key=>Object.hasOwn(proposal,key)))fail();
 const lines=parameters.p_lines.map(value=>{
  if(!object(value)||!['product','charge','informational','included'].includes(String(value.line_type)))fail();
  const chargeable=value.line_type==='product'||value.line_type==='charge';
  if(chargeable&&(typeof value.quantity!=='string'||typeof value.rate!=='string'))fail();
  if(chargeable){decimal(String(value.quantity),4,10);decimal(String(value.rate),2,12);}
  const total=lineTotal({lineType:value.line_type as 'product'|'charge'|'informational'|'included',quantity:String(value.quantity??''),rate:String(value.rate??'')});
  return {...value,total};
 });
 return json({...proposal,estimate_number:'UNSAVED DRAFT',status:'draft',lines});
}

/** Returns ordinary AgentTools, available for model-selected composition with other domains. */
export function createProposalOperations(deps:ProposalOperationDependencies):AgentTool[]{
 if(!deps.callerId||!Array.isArray(deps.sources)||deps.sources.length>96)throw new Error('Invalid Proposal operation dependencies.');
 const sources=new Map<string,string>();
 for(const source of deps.sources){
  if(!validText(source.id,160)||!source.id.trim()||!validText(source.text,120000)||sources.has(source.id))throw new Error('Invalid Proposal source evidence.');
  sources.set(source.id,source.text);
 }
 const rpc=async(name:string,args:Record<string,JsonValue>,signal:AbortSignal)=>{
  if(signal.aborted)fail('tool-failed');
  let result:{data:unknown;error?:unknown};
  try{result=await deps.rpc(name,args,signal);}catch{fail('tool-failed');}
  if(signal.aborted||result.error)fail('tool-failed');
  return result.data;
 };
 const authorized=async(context:Parameters<AgentTool['execute']>[1],proposal=false)=>{
  if(context.callerId!==deps.callerId||context.signal.aborted)fail('unknown-capability');
  if(await rpc('has_app_capability',{p_capability:'readOperationalData'},context.signal)!==true)fail('unknown-capability');
  if(proposal&&await rpc('has_proposal_access',{},context.signal)!==true)fail('unknown-capability');
 };
 const operation=(name:string,description:string,parameters:StrictSchema,kind:AgentTool['kind'],execute:AgentTool['execute']):AgentTool=>({name,description,parameters,kind,async execute(args,context){
  if(!validateStrictSchema(args,parameters))fail();
  await authorized(context,kind==='prepare');
  const result=await execute(args,context);
  // Revoked access cannot publish directory content or a prepared document.
  await authorized(context,kind==='prepare');
  return result;
 }});
 const list=(name:string,rpcName:string,contacts:boolean)=>operation(name,
  `Search the caller-authorized saved ${contacts?'customers and contacts':'customer directory'} by name prefix. Reusable read only; no Proposal or directory record is created. Results are one page, never proof that another page is absent. Directory notes are excluded.`,
  schema({query:text(300),offset:{type:'integer',minimum:0,maximum:10000}}),'read',async(args,context)=>{
   const value=await rpc(rpcName,{p_search:args.query,p_offset:args.offset},context.signal);
   if(!Array.isArray(value)||value.length>21)fail('tool-failed');
   const rows=value.map(row=>customer(row));
   const page=rows.slice(0,20),hasMore=rows.length>20;
   return {data:json({status:'ok',items:page,has_more:hasMore,next_offset:hasMore?Number(args.offset)+20:null,answer_facts:[{id:name+'.page',kind:'observed',text:`I found ${page.length} saved ${contacts?'customer and contact choices':'customers'} on this page${hasMore?'; more results are available':''}.`}],limitations:['Name search is paged. Select a saved identity before using its contact details.']})};
  });
 const get=(name:string,contact:boolean)=>operation(name,
  `Retrieve one caller-authorized saved customer${contact?' and the explicitly selected contact':''} by canonical IDs. Read only; validates the contact belongs to this company and omits private directory notes.`,
  schema({company_id:identity,...(contact?{contact_id:nullable(identity)}:{})}),'read',async(args,context)=>{
   if(typeof args.company_id!=='string'||!uuid.test(args.company_id)||contact&&args.contact_id!==null&&(typeof args.contact_id!=='string'||!uuid.test(args.contact_id)))fail();
   const value=await rpc(contact?'get_production_contact':'get_production_customer',contact?{p_company_id:args.company_id,p_contact_id:args.contact_id}:{p_company_id:args.company_id},context.signal);
   const item=customer(value,args.company_id,contact?args.contact_id as string|null:undefined);
   return {data:json({status:'ok',customer:item,answer_facts:[{id:name+'.identity',kind:'observed',text:`The saved customer is ${item.company.name}${item.contact?`, with contact ${item.contact.name}`:''}.`}],limitations:['These are current directory details. Copying them into a draft does not link future directory edits to the document.']})};
  });
 const prepare=operation('prepare_proposal_draft',
  'Prepare a new standalone customer Proposal for review without saving or issuing it. Supply header/line values only when copied from the host-provided employee/document source_ref. Saved customer/contact details are fetched through existing authorized RPCs. Never use catalog purchase costs as customer quote rates: a rate requires explicit employee quote/price evidence. Missing quantity/rate/specifications stay unknown. No Job, Bid, document number, revision or persistence identity is accepted. Returns a separate host-owned proposed action and preview descriptor; password-confirmed persistence is handled outside the model.',
  prepareSchema,'prepare',async(args,context)=>{
   const companyId=args.customer_company_id as string|null,contactId=args.customer_contact_id as string|null;
   if(companyId!==null&&!uuid.test(companyId)||contactId!==null&&(!uuid.test(contactId)||companyId===null))fail();
   const usedSources=new Set<string>(),fieldEvidence:Record<string,JsonValue>={},resolvedSources=new Map(sources);
   const sourceText=async(ref:string)=>{
    if(context.signal.aborted)fail('tool-failed');
    if(resolvedSources.has(ref))return resolvedSources.get(ref)!;
    let resolved:string|null=null;
    try{resolved=await deps.resolveSource?.(ref,context.signal)??null;}catch{fail('tool-failed');}
    if(context.signal.aborted||resolved===null||!validText(resolved,120000))fail();
    resolvedSources.set(ref,resolved);return resolved;
   };
   const fields=async(input:JsonValue,limits:Record<string,number>,prefix:string)=>{
    const values:Record<string,Evidence>={};
    for(const item of input as Array<Record<string,JsonValue>>){
     const path=String(item.path),value=String(item.value),sourceRef=String(item.source_ref),source=await sourceText(sourceRef);
     if(Object.hasOwn(values,path)||!validText(value,limits[path])||!value.trim()||!exactEvidence(source,value))fail();
     values[path]={value,source_ref:sourceRef};usedSources.add(sourceRef);
     fieldEvidence[prefix+path]={value,source_ref:sourceRef};
    }
    return values;
   };
   const header=await fields(args.fields,headerLimits,'');
   const proposal:Record<string,JsonValue>={
    proposal_date:currentDate((deps.now??(()=>new Date()))()),customer_name:'',customer_address:'',customer_contact:'',
    customer_street:'',customer_city:'',customer_state:'',customer_postal_code:'',customer_contact_name:'',customer_office_phone:'',customer_mobile_phone:'',customer_email:'',
    project_name:'',project_number:'',project_location:'',side_mark:'',sales_rep:'House',terms:'50% Dep / Net 30',valid_days:30,
    requested_delivery:'',fob:'Carrollton, TX',destination_zip:'',tax_county:'',tax_enabled:false,tax_rate:null,
    submitted_by_name:'Anthony Iorio',submitted_by_phone:'469-491-7002',submitted_by_email:'sales@tenartenterrazzo.com',
    notes:'',disclaimer_snapshot:PROPOSAL_DISCLAIMER,formula_snapshot:'',proposal_field_sources:{},freight_estimate:null,
    preliminary_drawings_attached:false,crating_included:false,cut_tickets_included:false,field_dimensioning_excluded:false,
   };
   const references:Array<{kind:string;id:string}>=[];
   if(companyId){
    const saved=customer(await rpc(contactId?'get_production_contact':'get_production_customer',contactId?{p_company_id:companyId,p_contact_id:contactId}:{p_company_id:companyId},context.signal),companyId,contactId??undefined);
    Object.assign(proposal,{customer_name:saved.company.name,customer_street:saved.company.mailing_address,customer_contact_name:saved.contact?.name??'',customer_office_phone:saved.contact?.phone||saved.company.phone,customer_email:saved.contact?.email||saved.company.email});
    references.push({kind:'customer',id:saved.company.id});if(saved.contact)references.push({kind:'contact',id:saved.contact.id});
    // A selected identity and an inconsistent source-authored name is unresolved identity, not an overwrite.
    if(header.customer_name&&normalize(header.customer_name.value)!==normalize(saved.company.name))fail();
   }
   for(const [path,evidence]of Object.entries(header)){
    if(path==='tax_rate'){
     decimal(evidence.value,5,3);if(Number(evidence.value)>100)fail();proposal.tax_enabled=true;
    }
    if(path==='proposal_date'&&(!/^\d{4}-\d{2}-\d{2}$/.test(evidence.value)||!Number.isFinite(Date.parse(evidence.value+'T12:00:00Z'))||new Date(evidence.value+'T12:00:00Z').toISOString().slice(0,10)!==evidence.value))fail();
    proposal[path]=evidence.value;
   }
   const issues:ReviewIssue[]=[],reviewFields:ReviewField[]=[];
   const headerLabels:Record<string,string>={proposal_date:'Proposal date',customer_name:'Customer',customer_street:'Customer street',customer_city:'Customer city',customer_state:'Customer state',customer_postal_code:'Customer postal code',customer_contact_name:'Customer contact',customer_office_phone:'Office phone',customer_mobile_phone:'Mobile phone',customer_email:'Customer email',project_name:'Project',project_number:'Project number',project_location:'Project location',side_mark:'Side mark',sales_rep:'Sales representative',terms:'Payment terms',valid_days:'Valid for days',requested_delivery:'Requested delivery',fob:'FOB',destination_zip:'Destination ZIP',tax_county:'Tax county',tax_enabled:'Apply sales tax',tax_rate:'Sales tax percent',submitted_by_name:'Submitted by',submitted_by_phone:'Sender phone',submitted_by_email:'Sender email',notes:'Notes',disclaimer_snapshot:'Standard disclaimer',freight_estimate:'Freight estimate',preliminary_drawings_attached:'Preliminary drawings attached',crating_included:'Crating included',cut_tickets_included:'Cut tickets included',field_dimensioning_excluded:'Field dimensioning excluded'};
   for(const [path,title]of Object.entries(headerLabels))reviewFields.push({path:'p_proposal.'+path,label:title,value:proposal[path],editable:false});
   if(!proposal.customer_name)issues.push({code:'missing_customer',message:'Customer is unknown. This can be saved as an incomplete draft; it cannot be issued yet.',blocking:false});
   const lines:Array<Record<string,JsonValue>>=[];
   for(const [index,input]of (args.lines as Array<Record<string,JsonValue>>).entries()){
    const supplied=await fields(input.fields,lineLimits,`lines.${index}.`),lineType=String(input.line_type);
    const line:Record<string,JsonValue>={line_type:lineType,item_number:'',description:'',ref:'',color_plate:'',quantity:null,unit:'',length:'',width:'',height_thickness:'',cft:'',lf:'',estimated_weight:'',rate:null,source_metadata:{},display_order:index};
    for(const [path,evidence]of Object.entries(supplied)){
     if(path==='quantity')decimal(evidence.value,4,10);
     if(path==='rate'){
      decimal(evidence.value,2,12);
      const source=resolvedSources.get(evidence.source_ref)!;
      // Purchase/catalog costs never authorize a customer-facing quoted rate.
      if(!quoteRateEvidence(source,evidence.value))fail();
     }
     line[path]=evidence.value;
    }
    const metadata:Record<string,JsonValue>={};for(const [path,evidence]of Object.entries(supplied))metadata[path]=json(evidence);
    line.source_metadata={tenbot_source_evidence:metadata};
    const chargeable=lineType==='product'||lineType==='charge';
    const unknownAmount=chargeable&&(line.quantity===null||line.rate===null);
    const amount=unknownAmount?null:lineTotal({lineType:lineType as 'product'|'charge'|'informational'|'included',quantity:String(line.quantity??''),rate:String(line.rate??'')});
    if(amount!==null&&amount>999999999999.99)fail();
    if(!line.description)issues.push({code:'missing_description',message:`Line ${index+1} needs a description before issuance.`,blocking:false});
    if(chargeable&&line.quantity===null)issues.push({code:'missing_quantity',message:`Line ${index+1} quantity is unknown and remains blank.`,blocking:false});
    if(chargeable&&line.rate===null)issues.push({code:'missing_quote_rate',message:`Line ${index+1} customer quote rate is unknown and remains blank; no catalog cost was substituted.`,blocking:false});
    // Do not turn canonical draft-null amounts into a claimed zero-dollar quote.
    const details:Record<string,JsonValue>={};
    for(const [path,title]of Object.entries({line_type:'Line type',item_number:'Item number',ref:'Reference',color_plate:'Color plate',length:'Length',width:'Width',height_thickness:'Height / thickness',cft:'Cubic feet',lf:'Linear feet',estimated_weight:'Estimated weight'}))details[title]=line[path];
    reviewFields.push({path:`p_lines.${index}.description`,label:`Line ${index+1} description`,value:line.description,editable:false},{path:`p_lines.${index}.quantity`,label:`Line ${index+1} quantity`,value:line.quantity,editable:false},{path:`p_lines.${index}.unit`,label:`Line ${index+1} unit`,value:line.unit,editable:false},{path:`p_lines.${index}.rate`,label:`Line ${index+1} customer rate`,value:line.rate,editable:false},{path:`p_lines.${index}.amount`,label:`Line ${index+1} amount`,value:amount,editable:false},{path:`p_lines.${index}.specifications`,label:`Line ${index+1} specifications`,value:details,editable:false});
    lines.push(line);
   }
   proposal.proposal_field_sources=fieldEvidence;
   const subtotal=lines.reduce((sum,line)=>sum+lineTotal({lineType:line.line_type as 'product'|'charge'|'informational'|'included',quantity:String(line.quantity??''),rate:String(line.rate??'')}),0);
   if(Math.round(subtotal*(1+(proposal.tax_enabled?Number(proposal.tax_rate)/100:0))*100)/100>999999999999.99)fail();
   for(const id of usedSources)references.push({kind:'submitted_source',id});
   const incomplete=issues.length>0;
   const summary=`I've prepared ${lines.length} Proposal ${lines.length===1?'line':'lines'}${proposal.customer_name?' for '+proposal.customer_name:''} for review${incomplete?'; some details remain unknown':''}. Nothing has been saved or issued.`;
   const previewAvailable=!issues.some(issue=>issue.code==='missing_quantity'||issue.code==='missing_quote_rate');
   const prepared:PreparedAction={operation:'proposal.save_draft',parameters:{p_proposal:proposal,p_lines:lines,p_estimate_inputs:json(emptyProposalEstimateInputs()),p_estimate_overrides:{}},review:{title:'Save Proposal draft',summary,consequences:['Creates one new standalone Proposal draft.','Does not issue a document, create a Production Job, or link a Bid.','Internal estimating inputs remain blank, using the existing estimating defaults.','Saving requires your account password for this exact reviewed content.',...(incomplete?['Blank quantities or rates remain incomplete draft fields. Displayed totals may be incomplete until they are supplied.']:[]),...(!previewAvailable?['PDF preview is unavailable until chargeable quantities and customer rates are supplied.']:[])],fields:reviewFields,issues,...(previewAvailable?{preview:{kind:'proposal_pdf' as const}}:{})},sourceReferences:references};
   const result={data:json({status:'prepared_only',summary,write_performed:false,issued:false,can_save_incomplete_draft:true,preview_available:previewAvailable,unknown_fields:issues.map(issue=>issue.code),answer_facts:[{id:'proposal.prepared',kind:'observed',text:summary}],limitations:['This is an unsaved review artifact. The separate execution boundary rechecks access and validates the exact confirmed parameters.','Saved customer/contact information becomes editable document snapshot content.','Internal estimating inputs remain blank; material catalog costs are not customer quote prices.','Changes require a newly validated preparation and fresh confirmation.']}),proposal:json(prepared)};
   if(new TextEncoder().encode(JSON.stringify(result)).byteLength>20000)fail();
   return result;
  });
 return [list('search_customers','search_production_customers',false),get('get_customer',false),list('search_contacts','search_production_contacts',true),get('get_contact',true),prepare];
}
