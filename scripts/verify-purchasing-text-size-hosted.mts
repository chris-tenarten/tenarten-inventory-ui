/* eslint-disable @typescript-eslint/no-explicit-any -- Hosted inspection rows have no generated database types. */
/** Explicitly authorized hosted gate. Disposable authenticated fixtures only.
 * Run: node --env-file=.env.local --import tsx scripts/verify-purchasing-text-size-hosted.mts
 * Does not apply migrations or deploy. Candidate rendering is a separate local step.
 */
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {createClient} from '@supabase/supabase-js';
import {supabase as client} from '../src/lib/supabase';
import {createPurchaseOrderDraft,createPurchaseOrderMaterialLine} from '../src/modules/purchasing/defaults';
import {savePurchaseOrderDraft,generatePurchaseOrderDraftPdf,issuePurchaseOrder,generatePurchaseOrderPdf} from '../src/modules/purchasing/mutations';
import {loadPurchaseOrder} from '../src/modules/purchasing/queries';
import {normalizePdfTextSize} from '../supabase/functions/_shared/pdf-text-size.mjs';
import type {PurchaseOrderDraft} from '../src/modules/purchasing/types';
const url=process.env.NEXT_PUBLIC_SUPABASE_URL!,key=process.env.SUPABASE_SERVICE_ROLE_KEY!;
assert(url&&key,'Hosted credentials required');
const service=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const marker=`po-text-size-${Date.now()}`, directory=`output/pdf/hosted-po-text-size/${marker}`;
mkdirSync(directory,{recursive:true});
const ids:string[]=[],lineIds:string[]=[],issuanceIds:string[]=[],paths:Array<{storage_bucket:string;storage_path:string}>=[];
let uid=''; let fixtureUid=''; let configuredVendorId='';
const report:Record<string,unknown>={marker,scope:'Hosted DB/auth/live renderer; candidate renderer runs locally against captured snapshots',directory};
const hash=(data:unknown)=>createHash('sha256').update(JSON.stringify(data)).digest('hex');
const check=(r:any,label:string)=>{if(r.error)throw Error(`${label}: ${r.error.code||''} ${r.error.message}`);return r.data;};
function sql(statement:string){const r=spawnSync('npx',['--yes','supabase@2.110.0','db','query','--linked',statement],{encoding:'utf8',timeout:60000});assert.equal(r.status,0,`${r.stdout} ${r.stderr} ${r.error||''}`);const result=JSON.parse(r.stdout);assert(Array.isArray(result.rows),r.stdout);return result.rows;}
const historical=async()=>check(await service.from('purchase_order_issuances').select('id,snapshot_hash,order_snapshot,lines_snapshot').order('id'),'historical snapshots');
const historicalBefore=await historical();
const historyIds=historicalBefore.map((r:any)=>r.id);
const historicalDocs=async()=>historyIds.length?check(await service.from('purchase_order_documents').select('*').in('issuance_id',historyIds).order('id'),'historical document records'):[];
const historicalDocsBefore=await historicalDocs();
const anthony=async()=>check(await service.from('purchase_orders').select('*,lines:purchase_order_lines(*,details:chip_purchase_order_line_details(*))').eq('id','cdea2905-4df5-45fb-9649-adc8801715fa').single(),'protected recovery fingerprint');
const anthonyBefore=hash(await anthony());
let savedPreview:any;
const functionClient=client.functions;
Object.defineProperty(client,'functions',{value:functionClient});
const originalInvoke=functionClient.invoke.bind(functionClient);
functionClient.invoke=async function(name:string,options:any){if(options?.body?.action==='draft-preview')savedPreview=structuredClone(options.body);return originalInvoke(name,options);};
const originalRpc=client.rpc.bind(client);let savedArgs:any;
client.rpc=((name:string,args:any,options:any)=>{if(name==='save_chip_purchase_order_draft_v2')savedArgs=structuredClone(args);return originalRpc(name,args,options);}) as typeof client.rpc;
async function reopen(id:string):Promise<PurchaseOrderDraft>{const po=await loadPurchaseOrder(id);return {...po,poNumber:po.poNumber||'',status:'draft'};}
function fixture(long=false):PurchaseOrderDraft{
 const draft=createPurchaseOrderDraft();Object.assign(draft,{vendorId:configuredVendorId,vendorNameSnapshot:marker,createdBy:marker,authorizedBySnapshot:'Disposable gate verifier',orderDate:'2026-09-18',vendorAddressSnapshot:long?'Dock address\n'.repeat(6)+'ADDRESS-TAIL':'123 Fixture Way',vendorContactSnapshot:long?'unbroken-contact-'.repeat(16)+'CONTACT-TAIL':'Fixture Buyer | buyer@example.com',shipToSnapshot:long?'Receiving address\n'.repeat(6)+'SHIP-TAIL':'Fixture receiving',commercialNotes:long?'Retained note content\n'.repeat(70)+'NOTES-TAIL':'Call before delivery.'});
 draft.lines=(['chip','resin','pigment','filler','other'] as const).map((kind,index)=>{const line=createPurchaseOrderMaterialLine(kind,index+1);Object.assign(line.details,{materialNameSnapshot:`Fixture ${kind}`,chipSize:kind==='chip'?'#1':'',quantityOrdered:'1',orderUnit:kind==='chip'?'Bag':'gal',unitPrice:'1',vendorSkuSnapshot:`SKU-${kind}`,resinColor:kind==='resin'?'Blue':'',componentType:kind==='resin'?'Part A':'',notes:long&&index===0?'Retained description '.repeat(170)+'DESCRIPTION-TAIL':`Fixture ${kind} content`});return line;});return draft;
}
async function save(draft:PurchaseOrderDraft){const id=await savePurchaseOrderDraft(draft);if(!ids.includes(id))ids.push(id);return reopen(id);}
async function capturePreview(draft:PurchaseOrderDraft,label:string){const blob=await generatePurchaseOrderDraftPdf(draft);assert(blob.size>1000);assert.equal(savedPreview.orderSnapshot.pdf_text_size,draft.pdfTextSize);writeFileSync(`${directory}/${label}-snapshot.json`,JSON.stringify(savedPreview,null,2));writeFileSync(`${directory}/${label}-live.pdf`,Buffer.from(await blob.arrayBuffer()));return savedPreview;}
try{
 console.log('Hosted gate: inspecting 002');
 const schema=sql(`select (select data_type from information_schema.columns where table_schema='public' and table_name='purchase_orders' and column_name='pdf_text_size') as column_type, (select pg_get_constraintdef(oid) from pg_constraint where conrelid='public.purchase_orders'::regclass and conname='purchase_orders_pdf_text_size_check') as constraint_def, pg_get_functiondef('public.capture_purchase_order_pdf_snapshot_fields()'::regprocedure) as capture_def, pg_get_functiondef('public.save_chip_purchase_order_draft_v2(jsonb,jsonb,text)'::regprocedure) as save_def, (select count(*) from public.purchase_orders where pdf_text_size is null) as existing_implicit_standard;`)[0];
 assert.equal(schema.column_type,'text');assert.match(schema.constraint_def,/compact.*standard.*large/);assert(schema.capture_def.indexOf("'pdf_text_size'")<schema.capture_def.indexOf('new.snapshot_hash :='));assert.match(schema.save_def,/PDF text size must be compact/);report.hosted002={column:true,constraint:true,save:true,captureBeforeHash:true,existingImplicitStandard:Number(schema.existing_implicit_standard)};
 const existing=check(await service.from('purchase_orders').select('id,pdf_text_size').is('pdf_text_size',null).limit(1),'existing default');if(existing.length)assert.equal(normalizePdfTextSize(existing[0].pdf_text_size),'standard');
 configuredVendorId=check(await service.from('vendors').select('id').eq('is_active',true).limit(1).single(),'configured vendor reference').id;
 console.log('Hosted gate: creating authenticated fixtures');
 const password=`Gate!${randomUUID()}9a`,email=`${marker}@example.com`;
 const auth=check(await service.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{display_name:marker}}),'create disposable user');uid=auth.user.id;fixtureUid=uid;
 check(await service.from('app_users').insert({user_id:uid,display_name:marker,role:'admin',is_active:true}),'create disposable app user');
 check(await client.auth.signInWithPassword({email,password}),'authenticated sign in');
 let draft=await save(fixture());const normalNumber=draft.poNumber;assert(normalNumber);assert.equal(draft.pdfTextSize,'standard');assert.deepEqual(draft.lines.map(l=>l.materialType),['chip','resin','pigment','filler','other']);
 // Legacy caller omits the new field; save/reopen still resolves Standard.
 const legacyArgs=structuredClone(savedArgs);delete legacyArgs.p_order.pdf_text_size;delete legacyArgs.p_order.id;
 const legacyId=String(check(await client.rpc('save_chip_purchase_order_draft_v2',legacyArgs),'legacy no preference save'));ids.push(legacyId);const legacy=await reopen(legacyId);assert.equal(legacy.pdfTextSize,'standard');
 for(const value of ['huge',null,'']){const invalid=await client.rpc('save_chip_purchase_order_draft_v2',{...legacyArgs,p_order:{...legacyArgs.p_order,id:legacyId,pdf_text_size:value}});assert.equal(invalid.error?.code,'22023');}
 console.log('Hosted gate: defaults/invalid passed; preview matrix');
 report.defaultsAndInvalid={existingStandard:true,newOmittedStandard:true,newClientStandard:true,invalidRejected:true};
 const perPreset:Record<string,unknown>={};
 for(const preset of ['compact','standard','large'] as const){draft=await save({...draft,pdfTextSize:preset});assert.equal(draft.pdfTextSize,preset);assert.equal(draft.poNumber,normalNumber);await capturePreview(draft,`normal-${preset}`);perPreset[preset]={savedAndReopened:true,numberStable:true,previewPayload:preset};}
 // Long/mixed snapshots are real authenticated saved/reopened values.
 let longDraft=await save(fixture(true));
 for(const preset of ['compact','standard','large'] as const){longDraft=await save({...longDraft,pdfTextSize:preset});await capturePreview(longDraft,`long-mixed-${preset}`);}
 report.persistence=perPreset;report.taxonomyAndNumbering={fiveTypes:true,mixedPreview:savedPreview.orderSnapshot.material_classification==='mixed',stableOnResave:true,distinctNewNumbers:normalNumber!==legacy.poNumber};
 // Issue all three effective presets, including a legacy NULL->Standard order.
 console.log('Hosted gate: issuing disposable snapshots');
 const issuedEvidence:Record<string,unknown>={};
 for(const preset of ['compact','standard','large'] as const){const issuing=preset==='standard'?await reopen(legacyId):await save({...fixture(),pdfTextSize:preset});if(preset==='standard')assert.equal(check(await service.from('purchase_orders').select('pdf_text_size').eq('id',issuing.id!).single(),'legacy null').pdf_text_size,null);
  const result=await issuePurchaseOrder(issuing.id!,marker,issuing.updatedAt);issuanceIds.push(result.issuanceId);
  const row=check(await client.from('purchase_order_issuances').select('*').eq('id',result.issuanceId).single(),'read issued snapshot');assert.equal(row.order_snapshot.pdf_text_size,preset);
  const validHash=sql(`select snapshot_hash=encode(extensions.digest(convert_to(order_snapshot::text || E'\\n' || lines_snapshot::text,'UTF8'),'sha256'),'hex') as valid from public.purchase_order_issuances where id='${result.issuanceId}'::uuid;`)[0].valid;assert.equal(validHash,true);
  writeFileSync(`${directory}/issued-${preset}-snapshot.json`,JSON.stringify({orderSnapshot:row.order_snapshot,linesSnapshot:row.lines_snapshot},null,2));
  await generatePurchaseOrderPdf(result.issuanceId,marker);
  const doc=check(await service.from('purchase_order_documents').select('*').eq('issuance_id',result.issuanceId).single(),'generated document');paths.push(doc);assert.equal(doc.status,'generated');assert.equal(doc.snapshot_hash,row.snapshot_hash);
  const beforeBlob=check(await service.storage.from(doc.storage_bucket).download(doc.storage_path),'issued artifact');const beforeBytes=Buffer.from(await beforeBlob.arrayBuffer());
  // Attempt to mutate the issued PO via the Draft API must fail.
  let denied=false;try{await savePurchaseOrderDraft({...issuing,pdfTextSize:preset==='large'?'compact':'large'});}catch{denied=true;}assert(denied);
  // Changing another Draft and retrying generation cannot change this artifact.
  draft=await save({...draft,pdfTextSize:preset==='large'?'compact':'large'});await generatePurchaseOrderPdf(result.issuanceId,marker);
  const afterRow=check(await client.from('purchase_order_issuances').select('*').eq('id',result.issuanceId).single(),'immutable issued snapshot');assert.equal(hash(afterRow),hash(row));
  const afterBlob=check(await service.storage.from(doc.storage_bucket).download(doc.storage_path),'immutable artifact');assert.deepEqual(Buffer.from(await afterBlob.arrayBuffer()),beforeBytes);
  issuedEvidence[preset]={captured:true,hashIncludesPreset:true,issuedDraftEditDenied:true,snapshotUnchanged:true,storedArtifactUnchanged:true};
 }
 report.issuance=issuedEvidence;
 // Recovery semantics on a disposable recovery key only; never Anthony's key.
 const recoveryOrder={vendor_name_snapshot:marker,order_date:'2026-09-18',currency:'USD'};
 const recoveryLine={line_number:1,material_type:'pigment',material_name_snapshot:'Fixture pigment',quantity_ordered:'1',order_unit:'bag',unit_price:'1'};
 const recoveryArgs={p_order:recoveryOrder,p_lines:[recoveryLine],p_actor:marker,p_confirmation:'RECOVER_EVIDENCE_BACKED_UNNUMBERED_DRAFT',p_recovery_key:`${marker}-recovery`};
 const recovered=String(check(await client.rpc('recover_purchase_order_draft_v2',recoveryArgs),'disposable recovery'));ids.push(recovered);
 assert.equal(String(check(await client.rpc('recover_purchase_order_draft_v2',recoveryArgs),'recovery retry')),recovered);
 const recoveryRow=await reopen(recovered);assert.equal(recoveryRow.poNumber,'');assert.equal(recoveryRow.pdfTextSize,'standard');
 const conflict=await client.rpc('recover_purchase_order_draft_v2',{...recoveryArgs,p_order:{...recoveryOrder,commercial_notes:'different'}});assert.equal(conflict.error?.code,'23505');
 report.recovery={unnumbered:true,idempotent:true,conflictRejected:true,anthonyUntouched:hash(await anthony())===anthonyBefore};assert.equal(hash(await anthony()),anthonyBefore);
 report.hostedDatabaseGate='passed';
}catch(error){report.failure=error instanceof Error?error.message:JSON.stringify(error);writeFileSync(`${directory}/failure.json`,JSON.stringify(report,null,2));throw error;}
finally{
 // Discover only marker-owned fixtures, including any partially completed RPC.
 console.log('Hosted gate: cleaning all disposable fixtures');
 writeFileSync(`${directory}/progress.json`,JSON.stringify(report,null,2));
 const owned=check(await service.from('purchase_orders').select('id,status,po_number,lines:purchase_order_lines(id)').eq('vendor_name_snapshot',marker),'cleanup discovery');
 for(const po of owned){if(!ids.includes(po.id))ids.push(po.id);lineIds.push(...po.lines.map((l:any)=>l.id));
  if(po.status==='issued'){const result=check(await service.rpc('purge_test_purchase_order',{p_purchase_order_id:po.id,p_expected_po_number:po.po_number,p_confirmation:`DELETE ${po.po_number}`}),'purge disposable issuance');for(const path of result||[])if(path.storage_path){check(await service.storage.from(path.storage_bucket).remove([path.storage_path]),'remove disposable storage');}}
  else check(await client.rpc('delete_purchase_order_draft',{p_purchase_order_id:po.id,p_actor:marker}),'delete disposable draft');
 }
 if(uid){check(await service.from('my_work_messages').delete().or(`sender_user_id.eq.${uid},recipient_user_id.eq.${uid}`),'cleanup disposable messages');check(await service.from('app_users').delete().eq('user_id',uid),'cleanup app user');check(await service.auth.admin.deleteUser(uid),'cleanup auth user');}
 const counts:Record<string,number|null>={};
 for(const [table,column,values] of [['purchase_orders','id',ids],['purchase_order_lines','purchase_order_id',ids],['chip_purchase_order_line_details','purchase_order_line_id',lineIds],['purchase_order_issuances','purchase_order_id',ids],['purchase_order_documents','issuance_id',issuanceIds],['pending_receivals','source_purchase_order_issuance_id',issuanceIds]] as const){const result=values.length?await service.from(table).select('*',{count:'exact',head:true}).in(column,values):{count:0};check(result,`zero ${table}`);counts[table]=result.count??0;assert.equal(counts[table],0);}
 if(fixtureUid){for(const [table,filter] of [['app_users',`user_id.eq.${fixtureUid}`],['my_work_messages',`sender_user_id.eq.${fixtureUid},recipient_user_id.eq.${fixtureUid}`]]){const result=await service.from(table).select('*',{count:'exact',head:true}).or(filter);check(result,`zero ${table}`);counts[table]=result.count;assert.equal(result.count,0);}const gone=await service.auth.admin.getUserById(fixtureUid);assert(gone.error);counts.auth_users=0;}
 const residue=sql(`select count(*)::int as count from storage.objects where name like '%${marker}%' ${issuanceIds.length?'or '+issuanceIds.map(id=>`name like '%${id}%'`).join(' or '):''} ${paths.length?'or '+paths.map(p=>`name='${p.storage_path.replaceAll("'","''")}'`).join(' or '):''};`)[0].count;assert.equal(residue,0);counts.storage_objects=0;
 const historyAfter=(await historical()).filter((r:any)=>historyIds.includes(r.id));assert.equal(hash(historyAfter),hash(historicalBefore));assert.equal(hash(await historicalDocs()),hash(historicalDocsBefore));assert.equal(hash(await anthony()),anthonyBefore);
 report.historical={issuances:historyIds.length,snapshotsAndHashesUnchanged:true,documentRecordsUnchanged:true,anthonyFingerprintUnchanged:true};report.cleanup=counts;
 writeFileSync(`${directory}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));await client.auth.signOut();
}
