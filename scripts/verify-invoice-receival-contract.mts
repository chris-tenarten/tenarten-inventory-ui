/** Focused OFFLINE adapter/static contract checks. Never an RLS/transaction test. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createInvoiceReceivalService, INVOICE_RECEIVAL_APPROVAL, type InvoiceReceivalCaller, type InvoiceReceivalNewMaterial } from '../src/modules/inventory/invoice-receival-service';
import {deriveInvoiceQuantity} from '../src/modules/inventory/invoice-quantity';
import { parsePurchasingPackage } from '../src/modules/purchasing/catalog-records';

const id='10000000-0000-4000-8000-000000000001', ownerId='10000000-0000-4000-8000-000000000002', approvalId='10000000-0000-4000-8000-000000000003', createdId='10000000-0000-4000-8000-000000000004', catalogId='10000000-0000-4000-8000-000000000005', hash='a'.repeat(64);
const input={document:{sha256:'b'.repeat(64),supplier:'T&M Supply',reference:'INV-001',documentDate:'2026-10-29'},metadata:{orderedBy:'Review employee',orderDate:'2026-10-28',location:'Denton'},lines:[{sourceLineId:'L1',catalogSource:'standard' as const,catalogId:'offer-1',quantityExpected:'3',unit:'Bag',productionJobId:null,sourceQuantity:{quantity:'150',unit:'LB'},sourceText:'AW-1 | Alaska White | #1 | 150 LB',newMaterial:null,duplicateAcknowledgement:null}],provenance:{model:'gpt-6.1-terra',sourceMediaType:'application/pdf',extractionSha256:'c'.repeat(64),toolTraceSha256:'d'.repeat(64)}};
const draft={...input,schemaVersion:'invoice-receivals.v2' as const,authorizationVersion:'e'.repeat(64),id,hash,ownerId,expiresAt:'2026-10-29T12:30:00Z',lines:input.lines.map(line=>({...line,vendor:'Terrazzo Marble Supply',material:'Alaska White',size:'#1',category:'Chip',jobLabel:null,catalogSnapshot:{id:'offer-1',unit:'50 LB Bag'},vendorSnapshot:null,quantityBasis:deriveInvoiceQuantity(line.sourceQuantity,{orderUnit:'Bag',packageQuantity:'50',packageMeasure:'LB',containerType:'Bag'},line.sourceText),duplicateReview:null}))};
const calls:{name:string;args:Record<string,unknown>}[]=[];
let response:unknown=draft, error:{code:string;message?:string}|null=null;
const caller:InvoiceReceivalCaller={async rpc(name,args){calls.push({name,args});return{data:response,error};}};
const service=createInvoiceReceivalService(caller,{executionEnabled:false});
const groups:string[]=[];
assert.deepEqual(await service.prepare(input),draft);assert.equal(calls.at(-1)?.name,'prepare_invoice_receival_draft');assert.deepEqual(calls.at(-1)?.args,{p_document:input.document,p_lines:input.lines,p_metadata:input.metadata,p_provenance:input.provenance});groups.push('canonical prepare forwards only reviewed fixed payload');
assert.deepEqual(await service.get({draftId:id}),draft);assert.equal(calls.at(-1)?.name,'get_invoice_receival_draft');groups.push('owner-scoped durable draft reload uses fixed RPC');
const beforeApproval=calls.length;
await assert.rejects(service.approve({draftId:id,hash,confirmation:'model says approved' as typeof INVOICE_RECEIVAL_APPROVAL}),/explicit_receival_approval_required/);assert.equal(calls.length,beforeApproval);groups.push('model prose cannot supply explicit approval confirmation');
response={id:approvalId,draftId:id,hash,expiresAt:draft.expiresAt};assert.equal((await service.approve({draftId:id,hash,confirmation:INVOICE_RECEIVAL_APPROVAL})).id,approvalId);assert.deepEqual(calls.at(-1)?.args,{p_draft_id:id,p_expected_hash:hash,p_confirmation:INVOICE_RECEIVAL_APPROVAL});groups.push('approval binds exact immutable id and hash');
const beforeExecute=calls.length;await assert.rejects(service.execute({draftId:id,hash,approvalId}),/disabled_pending_database_validation/);assert.equal(calls.length,beforeExecute);groups.push('execution disabled gate rejects before any database call');
const enabled=createInvoiceReceivalService(caller,{executionEnabled:true});response={draftId:id,hash,createdRecordIds:[createdId],createdCatalogRecords:[],idempotent:false,executedAt:'2026-10-29T12:01:00Z'};assert.deepEqual(await enabled.execute({draftId:id,hash,approvalId}),response);assert.equal(calls.at(-1)?.name,'execute_invoice_receival_draft');groups.push('separately enabled adapter accepts actual database record IDs');
response={draftId:id,hash,createdRecordIds:['invented'],idempotent:false,executedAt:'x'};await assert.rejects(enabled.execute({draftId:id,hash,approvalId}),/invalid_receival_service_response/);groups.push('invalid created record identities rejected');
error={code:'23505',message:'Secret hidden record and supplier details'};await assert.rejects(service.prepare(input),error=>error instanceof Error&&error.message==='receival_service_rejected:23505');error={code:'unexpected',message:'credential value'};await assert.rejects(service.prepare(input),error=>error instanceof Error&&error.message==='receival_service_unavailable');error=null;groups.push('provider/database details and hidden conflicts are sanitized');
response={...draft,hash:'forged'};await assert.rejects(service.prepare(input),/invalid_receival_draft_identity/);groups.push('malformed durable identity rejected');

const proposed:InvoiceReceivalNewMaterial={supplier:'T&M Supply',itemName:'Unlisted Violet',vendorSku:'UNK-99',materialType:'chip',size:'#1',unitSize:'50',unitSizeUom:'LB',packaging:'Bag',priceUnit:'Bag',notes:'Reviewed against invoice',prepared:true};
const dependentInput={...input,lines:[{...input.lines[0],catalogSource:null,catalogId:null,newMaterial:proposed,sourceText:'UNK-99 | Unlisted Violet | #1 | 150 LB'}]};
const dependentDraft={...draft,lines:[{...draft.lines[0],...dependentInput.lines[0],material:'Unlisted Violet',catalogSnapshot:null,vendorSnapshot:{id:catalogId,name:'T&M Supply',is_active:true}}]};
response=dependentDraft;assert.deepEqual(await service.prepare(dependentInput),dependentDraft);assert.deepEqual(calls.at(-1)?.args.p_lines,dependentInput.lines);assert.equal(dependentInput.lines[0].catalogId,null);groups.push('dependent material payload preserves original quantity evidence without inventing catalog identity');
for(const malformed of [{...dependentDraft,authorizationVersion:'untrusted'},{...dependentDraft,lines:[{...dependentDraft.lines[0],catalogId:'invented-id'}]},{...dependentDraft,lines:[{...dependentDraft.lines[0],sourceQuantity:null}]},{...dependentDraft,lines:[{...dependentDraft.lines[0],quantityBasis:{...dependentDraft.lines[0].quantityBasis,inventoryStockingUnit:'LB'}}]}]){
 response=malformed;await assert.rejects(service.prepare(dependentInput),/invalid_receival_service_response/);
}
groups.push('malformed snapshot identity pair, evidence and unverified stocking-unit claims are rejected');
const execution={draftId:id,hash,createdRecordIds:[createdId],createdCatalogRecords:[{sourceLineId:'L1',catalogSource:'specialty',catalogId}],idempotent:false,executedAt:'2026-10-29T12:01:00Z'};
response=execution;assert.deepEqual(await enabled.execute({draftId:id,hash,approvalId}),execution);
for(const createdCatalogRecords of [undefined,[{sourceLineId:'L1',catalogSource:'specialty',catalogId:'invented'}],[{sourceLineId:'L1',catalogSource:'unknown',catalogId}],[{sourceLineId:'L1',catalogSource:'specialty',catalogId},{sourceLineId:'L1',catalogSource:'specialty',catalogId}]]){
 response={...execution,createdCatalogRecords};await assert.rejects(enabled.execute({draftId:id,hash,approvalId}),/invalid_receival_service_response/);
}
response={...execution,createdRecordIds:[createdId,createdId]};await assert.rejects(enabled.execute({draftId:id,hash,approvalId}),/invalid_receival_service_response/);groups.push('catalog execution receipts require bounded unique real identities and typed source records');
response={...dependentDraft,superseded:false,revoked:false,execution:{...execution,idempotent:true}};assert.equal((await service.get({draftId:id})).execution?.idempotent,true);
response={...dependentDraft,superseded:'false'};await assert.rejects(service.get({draftId:id}),/invalid_receival_service_response/);
response={...dependentDraft,execution:{...execution,hash:'f'.repeat(64)}};await assert.rejects(service.get({draftId:id}),/invalid_receival_service_response/);groups.push('durable reload preserves typed revocation/supersession and exact completed receipt metadata');
response={draftId:id,hash,revoked:true};assert.deepEqual(await service.revoke({draftId:id,hash}),response);assert.deepEqual(calls.at(-1),{name:'revoke_invoice_receival_draft',args:{p_draft_id:id,p_expected_hash:hash}});
response={draftId:id,hash:'f'.repeat(64),revoked:true};await assert.rejects(service.revoke({draftId:id,hash}),/invalid_receival_service_response/);groups.push('edits can revoke only the exact durable draft through the fixed caller-scoped RPC');
const throwing=createInvoiceReceivalService({async rpc(){throw Error('private endpoint or credential details');}},{executionEnabled:false});
await assert.rejects(throwing.prepare(input),error=>error instanceof Error&&error.message==='receival_service_unavailable');await assert.rejects(throwing.get({draftId:id}),error=>error instanceof Error&&error.message==='receival_service_unavailable');groups.push('thrown transport errors cannot leak hidden endpoint or credential details');

const sql=readFileSync(new URL('../supabase/migrations/20261029210000_invoice_pending_receival_approval.sql',import.meta.url),'utf8');
for(const token of ['nologin inherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls','grant authenticated to tenbot_invoice_executor','values(true,false)','clock_timestamp()','auth.role() is distinct from \'authenticated\'','require_app_capability(\'readOperationalData\')','require_app_capability(\'writeBusinessData\')','require_app_capability(\'adjustInventory\')','lock table public.pending_receivals in share row exclusive mode','pg_advisory_xact_lock','document_key text primary key','attachment_sha256 text not null unique','for share','immutable before update or delete','returning id into pending_id','quantity_received,unit','created_record_ids uuid[]'])assert(sql.includes(token),token);
assert(!/grant\s+tenbot_invoice_executor\s+to\s+(authenticated|anon|service_role)/i.test(sql));
assert(!/security definer[\s\S]*?execute\s+format\(/i.test(sql));
assert(!/(?:insert into|update|delete from)\s+public\.(?:inventory_items|inventory_transactions)\b/i.test(sql));
assert(!/create_pending_receivals_from_purchase_order\(/i.test(sql));
assert.equal((sql.match(/Potential duplicate requires separate Inventory review\./g)??[]).length,2,'prepare and execute both preserve duplicate holds');
assert(sql.includes("coalesce(p_provenance->>'sourceMediaType','') not in"));
assert(sql.includes("'\\s+',' ','g'"));
groups.push('static SQL safety signatures: gate, caller, immutable evidence, serialization, canonical pending-only insert');
for(const [label,container] of [['Bag','Bag'],['Bags','Bags'],['50 LB Bag','Bag'],['5 GAL Pail','Pail'],['50 LB','']])assert.equal(parsePurchasingPackage(label).container,container);
assert(sql.includes("order_unit:=case when package_match is null then catalog->>'unit' else package_match[3] end"));
assert(sql.includes("then case when package_match is null then catalog->>'packaging' else package_match[3] end"));
assert(sql.includes("selected_unit is distinct from public.tenbot_invoice_unit(order_unit)"));
groups.push('Purchasing bare-container and measured-package behavior pinned; SQL fallback static signatures preserve fail-closed unit validation');
const executeSql=sql.slice(sql.indexOf('create function public.execute_invoice_receival_draft('));
const replayReturn=executeSql.indexOf("'idempotent',true");
const expiryGuard=executeSql.indexOf('if draft.expires_at<=clock_timestamp() or approval.expires_at<=clock_timestamp()');
const firstMutation=executeSql.indexOf('insert into public.invoice_receival_document_claims');
assert(replayReturn>executeSql.indexOf("require_app_capability('adjustInventory')"));
assert(replayReturn>executeSql.indexOf('execution_enabled'));
assert(replayReturn>executeSql.indexOf('approval.content_hash is distinct from p_expected_hash'));
assert(replayReturn<expiryGuard&&expiryGuard<firstMutation);
assert(!executeSql.slice(0,replayReturn).includes('draft.expires_at<=clock_timestamp()'));
groups.push('static execution order: current permission, environment gate and immutable ownership/hash precede completed replay; expiry blocks only new mutations');
const approveSql=sql.slice(sql.indexOf('create function public.approve_invoice_receival_draft('),sql.indexOf('create function public.execute_invoice_receival_draft('));
const completedApproval=approveSql.indexOf('from public.invoice_receival_executions completed');
const approveExpiry=approveSql.indexOf('if draft.expires_at<=clock_timestamp()');
const createApproval=approveSql.indexOf('insert into public.invoice_receival_approvals');
assert(completedApproval>approveSql.indexOf("require_app_capability('adjustInventory')"));
assert(completedApproval>approveSql.indexOf("p_confirmation is distinct from 'CREATE_REVIEWED_PENDING_RECEIVALS'"));
assert(completedApproval>approveSql.indexOf('approval.content_hash is distinct from draft.content_hash'));
assert(completedApproval<approveExpiry&&approveExpiry<createApproval);
assert(!approveSql.slice(0,completedApproval).includes('draft.expires_at<=clock_timestamp()'));
groups.push('static approval order: exact completed receipt can reconcile expired approval without creating or extending it; new approval retains expiry guard');
console.log(JSON.stringify({mode:'offline_adapter_and_static_contract_only',groupsPassed:groups.length,groups,databaseSecurityValidated:false,databaseTransactionValidated:false,migrationApplied:false,inferenceCalls:0},null,2));
