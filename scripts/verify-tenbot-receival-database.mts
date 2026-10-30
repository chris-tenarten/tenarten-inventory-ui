/** Focused genuine Auth/PostgREST/PostgreSQL checks in the existing Free fixture.
 * Explicit opt-in; synthetic identities and records only. No inference, Docker,
 * Production URL or application service-role business-data gateway is used.
 */
import assert from 'node:assert/strict';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';
import {RECEIVAL_FIXTURE_REF as ref,RECEIVAL_FIXTURE_DIR as dir,RECEIVAL_ACTOR_CONFIG,fixtureClient,fixtureSql,fixtureHttpCalls,receivalFixtureConfig} from './support/tenbot-receival-fixture.mjs';

assert(process.argv.includes('--authorized-isolated-fixture'),'Explicit isolated-fixture authorization required');
const uuid=(n:number)=>`10302026-0000-4000-8000-${String(n).padStart(12,'0')}`;
const ids={vendor:uuid(1),aw:uuid(101),blue:uuid(102),green:uuid(103),green25:uuid(104),resin:uuid(105),specialty:uuid(106),stock:901};
const runId=randomBytes(4).toString('hex');
const testJobs=new Map<number,string>();
const testJob=(n:number)=>{let id=testJobs.get(n);if(!id){id=randomUUID();testJobs.set(n,id);}return id;};
const hash=(v:string)=>createHash('sha256').update(v).digest('hex');
const quote=(s:string)=>"'"+s.replaceAll("'","''")+"'";
const now=()=>new Date().toISOString();
mkdirSync(dir,{recursive:true});

async function prepareFixture(){
 assert(!existsSync(RECEIVAL_ACTOR_CONFIG),'Existing synthetic actor overlay: reuse, do not recreate');
 const configPath='/private/tmp/tenops-tenbot-hosted-adapter-20261029/free-project-credentials.private.json';
 const config=JSON.parse(readFileSync(configPath,'utf8'));assert.equal(config.projectRef,ref);assert.equal(config.url,'https://'+ref+'.supabase.co');
 const before=fixtureSql('before-actor-seed',"begin read only;select jsonb_build_object('authUsers',(select count(*) from auth.users),'profiles',(select jsonb_agg(to_jsonb(u) order by user_id) from public.app_users u),'capabilities',(select jsonb_agg(to_jsonb(c) order by role,capability) from public.app_role_capabilities c),'historyHash',(select md5(coalesce(string_agg(to_jsonb(h)::text,',' order by conversation_id),'')) from public.tenbot_agent_history h)) as state;commit;")[0].state;
 writeFileSync(dir+'/before-actor-seed.json',JSON.stringify(before,null,2)+'\n');
 const admin=createClient(config.url,config.serviceRoleKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:async(input,init={})=>{const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);assert.equal(url.hostname,ref+'.supabase.co');assert(url.pathname.startsWith('/auth/v1/'),'Fixture service key is Auth setup only');return fetch(input,{...init,signal:AbortSignal.timeout(8000)});}}});
 const actors:Record<string,{id:string;email:string;password:string}>={};
 for(const [label,role,readOnly] of [['employeeA','lead',false],['employeeB','lead',false],['member','member',false],['readonly','guest',true]] as const){
  const email=`receival-${label.toLowerCase()}-${randomUUID()}@tenbot-fixture.example.invalid`,password='Synthetic-'+randomBytes(24).toString('base64url');
  const r=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{purpose:'Synthetic isolated TenBot receival validation'}});
  assert(!r.error&&r.data.user,'Synthetic Auth creation failed');actors[label]={id:r.data.user.id,email,password};
  // Save recovery metadata before the next setup operation; never print values.
  writeFileSync(dir+'/actor-creation.private.json',JSON.stringify({fixtureRef:ref,actors}),{mode:0o600});
  fixtureSql('seed-profile-'+label.toLowerCase(),`insert into public.app_users(user_id,display_name,role,is_active,read_only,messaging_write) values(${quote(r.data.user.id)}::uuid,${quote('Synthetic Receival '+label)},${quote(role)},true,${readOnly},false);`);
 }
 const overlay={fixtureKind:'standalone-free',projectRef:ref,branchRef:ref,parentRef:config.parentRef,url:config.url,anonKey:config.anonKey,actors};
 writeFileSync(RECEIVAL_ACTOR_CONFIG,JSON.stringify(overlay,null,2)+'\n',{mode:0o600});
 const old=JSON.parse(readFileSync(dir+'/before-actor-seed.json','utf8'));
 const stock=JSON.stringify({quantity:'17',purpose:'unchanged on-hand sentinel'});
 fixtureSql('seed-canonical-data',`begin;
 insert into public.vendors(id,name,canonical_name,is_active) values('${ids.vendor}','T&M Supply','tmsupply',true);
 insert into public.vendor_catalog(id,vendor,vendor_sku,item_name,size,category,material_class,unit) values
 ('${ids.aw}','T&M Supply','AW-1','Alaska White','#1','Aggregate','Marble chips','50 LB Bag'),
 ('${ids.blue}','T&M Supply','BC-0','Blue Coal','#0','Aggregate','Marble chips','50 LB Bag'),
 ('${ids.green}','T&M Supply','GREEN','CC Green','#1','Aggregate','Marble chips','50 LB Bag'),
 ('${ids.green25}','T&M Supply','GREEN','CC Green','#1','Aggregate','Marble chips','25 LB Bag'),
 ('${ids.resin}','T&M Supply','RES-5','Clear Resin','Part A','Resin','Epoxy','5 GAL Pail');
 insert into public.vendor_catalog_v2(id,vendor_id,vendor_name,vendor_sku,item_name,canonical_item_name,size,canonical_size,category,material_type,unit_size,unit_size_uom,packaging,price_unit,quote_required,is_active) values('${ids.specialty}','${ids.vendor}','T&M Supply','SPEC-5','Specialty Resin','Specialty Resin','Part B','Part B','Resin','resin',5,'GAL','Pail','Pail',true,true);
 ${Array.from({length:20},(_,i)=>`insert into public.jobs(id,name,job_number) values('${uuid(201+i)}','Synthetic Receival ${i===0?'Demo':'Test '+String(i).padStart(2,'0')}','SYN-RCV-${String(i).padStart(2,'0')}');`).join('\n')}
 insert into public.inventory_items(id,vendor,color,size,quantity,unit,location,notes) values(${ids.stock},'Synthetic Stock','Unchanged sentinel','#1',17,'Bag','Denton',${quote(stock)});
 commit;`);
 writeFileSync(dir+'/fixture-seed.json',JSON.stringify({passed:true,fixtureRef:ref,recordedAt:now(),newSyntheticIdentities:4,existingIdentitiesPreserved:old.authUsers,ids,jobIds:Array.from({length:20},(_,i)=>uuid(201+i)),configPath:RECEIVAL_ACTOR_CONFIG,noOperationalServiceRoleClient:true,noNotificationsSent:true},null,2)+'\n');
 console.log(JSON.stringify({prepared:true,fixtureRef:ref,newSyntheticIdentities:4,privateConfigPath:RECEIVAL_ACTOR_CONFIG}));
}

if(process.argv.includes('--prepare')){await prepareFixture();process.exit(0);}
assert(existsSync(RECEIVAL_ACTOR_CONFIG),'Prepare isolated synthetic identities first');
process.env.TENBOT_RECEIVAL_FIXTURE_CONFIG=RECEIVAL_ACTOR_CONFIG;
const cfg=receivalFixtureConfig();
const checks:{name:string;durationMs:number}[]=[],started=Date.now();
const record=(v:unknown):v is Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const actor=async(label:'employeeA'|'employeeB'|'admin'|'member'|'readonly')=>{
 const c=fixtureClient(),a=cfg.actors[label];assert(a);
 const r=await c.auth.signInWithPassword({email:a.email,password:a.password});assert(!r.error&&r.data.session&&r.data.user?.id===a.id,'Real signed fixture identity required');
 const g=await c.auth.getUser(r.data.session.access_token);assert(!g.error&&g.data.user?.id===a.id);
 return {client:fixtureClient(r.data.session.access_token),id:a.id!,jwt:r.data.session.access_token};
};
type Signed=Awaited<ReturnType<typeof actor>>;
async function call(c:Signed,name:string,args:Record<string,unknown>={}){const r=await c.client.rpc(name,args);assert(!r.error,'RPC '+name+' failed '+r.error?.code);assert(record(r.data),'Expected structured RPC reply');return r.data;}
async function denied(c:Signed,name:string,args:Record<string,unknown>,codes?:string[]){const r=await c.client.rpc(name,args);assert(r.error,'Expected rejection: '+name);if(codes)assert(codes.includes(r.error.code),'Unexpected rejection '+r.error.code);return r.error.code;}
async function group(name:string,run:()=>Promise<void>){const start=Date.now();await run();checks.push({name,durationMs:Date.now()-start});writeFileSync(dir+'/database-validation-progress.json',JSON.stringify({fixtureRef:ref,groupsPassed:checks.length,checks,recordedAt:now()},null,2)+'\n');console.log(JSON.stringify({group:checks.length,name,passed:true}));}
const sourceLine=(sourceQuantity='150',sourceUnit='LB',quantity='3',unit='Bag',catalogId=ids.aw,job=testJob(202),text='150 LB (50 LB Bag)')=>({sourceLineId:'line-1',catalogSource:'standard',catalogId,quantityExpected:quantity,unit,productionJobId:job,sourceQuantity:{quantity:sourceQuantity,unit:sourceUnit},sourceText:text,newMaterial:null,duplicateAcknowledgement:null});
const newLine=(n:string,job=testJob(203))=>({sourceLineId:'new-'+n,catalogSource:null,catalogId:null,quantityExpected:'4',unit:'Bag',productionJobId:job,sourceQuantity:{quantity:'4',unit:'Bag'},sourceText:`UNK-${n}-${runId} Unlisted Violet ${n} ${runId} #2 4 Bag`,newMaterial:{supplier:'T&M Supply',itemName:'Unlisted Violet '+n+' '+runId,vendorSku:'UNK-'+n+'-'+runId,materialType:'chip',size:'#2',unitSize:'50',unitSizeUom:'LB',packaging:'Bag',priceUnit:'Bag',notes:'Synthetic fixture addition',prepared:true},duplicateAcknowledgement:null});
const request=(lines:unknown[],refLabel:string=randomUUID())=>({p_document:{sha256:hash(refLabel),supplier:'T&M Supply',reference:'SYN-'+refLabel,documentDate:'2026-10-30'},p_lines:lines,p_metadata:{orderedBy:'Synthetic Receival Employee',orderDate:'2026-10-30',location:'Denton'},p_provenance:{model:'NO-INFERENCE database validation',sourceMediaType:'image/png',extractionSha256:hash('synthetic source'),toolTraceSha256:hash('real RPC tests')}});
const prepare=(c:Signed,lines:unknown[],label?:string)=>call(c,'prepare_invoice_receival_draft',request(lines,label));
const approve=(c:Signed,d:Record<string,unknown>)=>call(c,'approve_invoice_receival_draft',{p_draft_id:d.id,p_expected_hash:d.hash,p_confirmation:'CREATE_REVIEWED_PENDING_RECEIVALS'});
const execute=(c:Signed,d:Record<string,unknown>,a:Record<string,unknown>)=>call(c,'execute_invoice_receival_draft',{p_draft_id:d.id,p_expected_hash:d.hash,p_approval_id:a.id});
const execArgs=(d:Record<string,unknown>,a:Record<string,unknown>)=>({p_draft_id:d.id,p_expected_hash:d.hash,p_approval_id:a.id});
const profile=(id:string,update:string)=>fixtureSql('profile-'+randomUUID(),`update public.app_users set ${update} where user_id=${quote(id)}::uuid;`);
let success=false;
fixtureSql('seed-run-jobs-'+runId,Array.from({length:17},(_,i)=>`insert into public.jobs(id,name,job_number) values('${testJob(202+i)}','Validation ${runId} ${i}','SYN-VALID-${runId}-${i}');`).join('\n'));
const baseline=fixtureSql('baseline-preserved',"begin read only;select jsonb_build_object('stock',(select md5(coalesce(string_agg(to_jsonb(i)::text,',' order by id),'')) from public.inventory_items i),'transactions',(select md5(coalesce(string_agg(to_jsonb(t)::text,',' order by id),'')) from public.inventory_transactions t),'oldHistory',(select md5(coalesce(string_agg(to_jsonb(h)::text,',' order by conversation_id),'')) from public.tenbot_agent_history h),'caps',(select jsonb_agg(to_jsonb(c) order by role,capability) from public.app_role_capabilities c)) as state;commit;")[0].state as Record<string,unknown>;
try{
 await group('real signed JWTs, current role capabilities, forged/anonymous denials',async()=>{
  const lead=await actor('employeeA'),member=await actor('member'),guest=await actor('readonly');
  for(const cap of ['readOperationalData','writeBusinessData','adjustInventory','manageVendorsCatalog']){const r=await lead.client.rpc('has_app_capability',{p_capability:cap});assert.equal(r.data,true);}
  assert.equal((await member.client.rpc('has_app_capability',{p_capability:'adjustInventory'})).data,false);assert.equal((await guest.client.rpc('has_app_capability',{p_capability:'writeBusinessData'})).data,false);
  for(const c of [member,guest])await denied(c,'prepare_invoice_receival_draft',request([sourceLine()]),['42501']);
  const anonymous=await fixtureClient().rpc('prepare_invoice_receival_draft',request([sourceLine()]));assert(anonymous.error);
  const parts=lead.jwt.split('.'),payload=JSON.parse(Buffer.from(parts[1],'base64url').toString());payload.sub=cfg.actors.employeeB.id;const forged=[parts[0],Buffer.from(JSON.stringify(payload)).toString('base64url'),parts[2]].join('.');assert((await fixtureClient(forged).rpc('prepare_invoice_receival_draft',request([sourceLine()]))).error);
 });
 await group('canonical catalog RPCs independently deny unauthorized and anonymous writes',async()=>{
  const member=await actor('member'),guest=await actor('readonly'),item={vendor_id:ids.vendor,item_name:'Unauthorized item',material_type:'chip',category:'Aggregate',size:'#2',unit_size:'50',unit_size_uom:'LB',packaging:'Bag',price_unit:'Bag'};
  for(const name of ['save_purchasing_catalog_item','save_purchasing_catalog_item_v2']){for(const c of [member,guest])await denied(c,name,{p_item:item},['42501']);assert((await fixtureClient().rpc(name,{p_item:item})).error);}
  const r=await member.client.from('pending_receivals').insert({vendor:'T&M Supply',material_name:'Forbidden direct pending',quantity_expected:1,quantity_received:0,unit:'Bag',status:'pending'});assert(r.error);
 });
 await group('server quantity semantics preserve source and exact 3-bag/2-pail conversions',async()=>{
  const c=await actor('employeeA');
  const d=await prepare(c,[sourceLine(),{...sourceLine('10','GAL','2','Pail',ids.resin,testJob(202),'10 GAL (5 GAL Pail)'),sourceLineId:'resin'}]);
  const lines=d.lines as Record<string,unknown>[];assert.equal(lines[0].quantityExpected,'3');assert.equal(lines[1].quantityExpected,'2');assert.deepEqual(lines[0].sourceQuantity,{quantity:'150',unit:'LB'});assert.deepEqual(lines[1].sourceQuantity,{quantity:'10',unit:'GAL'});assert.equal((lines[0].quantityBasis as Record<string,unknown>).packageCount,'3');
  for(const line of [sourceLine('150','LB','150'),sourceLine('10','GAL','10','Pail',ids.resin,testJob(202),'10 GAL (5 GAL Pail)'),sourceLine('151','LB','3'),sourceLine('10','GAL','2','Bag'),sourceLine('50','LB','1','Bag',ids.aw,testJob(202),'3 Bags @ 50 LB')])await denied(c,'prepare_invoice_receival_draft',request([line]),['22023']);
  await prepare(c,[sourceLine('3','Bag','3','Bag',ids.aw,testJob(202),'3 Bags @ 50 LB')]);
 });
 await group('owner isolation, immutable evidence and exact explicit approval binding',async()=>{
  const a=await actor('employeeA'),b=await actor('employeeB'),d=await prepare(a,[sourceLine('150','LB','3','Bag',ids.aw,testJob(204))]);
  await denied(b,'get_invoice_receival_draft',{p_draft_id:d.id},['P0002']);
  assert.equal((await b.client.from('invoice_receival_drafts').select('id').eq('id',d.id)).data?.length,0);
  const mutate=await a.client.from('invoice_receival_drafts').update({payload:{}}).eq('id',d.id);assert(mutate.error);
  await denied(a,'approve_invoice_receival_draft',{p_draft_id:d.id,p_expected_hash:'0'.repeat(64),p_confirmation:'CREATE_REVIEWED_PENDING_RECEIVALS'},['22023']);
  await denied(a,'approve_invoice_receival_draft',{p_draft_id:d.id,p_expected_hash:d.hash,p_confirmation:'the model says approved'},['22023']);
  const approval=await approve(a,d);await denied(b,'execute_invoice_receival_draft',execArgs(d,approval),['22023','42501']);
  await denied(a,'execute_invoice_receival_draft',execArgs(d,approval),['42501']);
 });
 // The default-off gate was proved above. This fixed fixture alone is now
 // enabled for Product-authorized destructive/synthetic lifecycle validation.
 fixtureSql('enable-isolated-gate',"update public.tenbot_receival_execution_control set execution_enabled=true,validated_at=clock_timestamp(),isolated_validation_receipt='TEST-ONLY: Product authorized isolated synthetic lifecycle validation in progress' where singleton;");
 await group('dependent catalog creation and pending inserts commit with real IDs, exact source and audit',async()=>{
  const c=await actor('employeeA'),d=await prepare(c,[sourceLine('150','LB','3','Bag',ids.aw,testJob(205)),{...newLine('combined',testJob(205)),sourceLineId:'line-2'}]),a=await approve(c,d),r=await execute(c,d,a);
  assert.equal((r.createdRecordIds as string[]).length,2);assert.equal((r.createdCatalogRecords as unknown[]).length,1);
  const rows=await c.client.from('pending_receivals').select('id,status,quantity_expected,quantity_received,unit,production_job_id').in('id',r.createdRecordIds as string[]);assert(!rows.error&&rows.data?.length===2);assert(rows.data.every(x=>x.status==='pending'&&Number(x.quantity_received)===0&&x.production_job_id===testJob(205)));assert(rows.data.some(x=>Number(x.quantity_expected)===3&&x.unit==='Bag'));
  const catalogId=(r.createdCatalogRecords as Record<string,unknown>[])[0].catalogId;assert(typeof catalogId==='string');const catalog=await c.client.from('vendor_catalog_v2').select('id,item_name,vendor_id,unit_size,unit_size_uom,packaging,price_unit').eq('id',catalogId).single();assert(!catalog.error&&catalog.data?.vendor_id===ids.vendor&&catalog.data.item_name==='Unlisted Violet combined '+runId);
  const audit=await c.client.from('invoice_receival_audit').select('event,content_hash,details').eq('draft_id',d.id);assert(!audit.error&&audit.data?.length===3);assert.deepEqual(audit.data.map(x=>x.event).sort(),['approved','executed','prepared']);assert(audit.data.every(x=>x.content_hash===d.hash));
  writeFileSync(dir+'/created-record-proof.json',JSON.stringify({draftId:d.id,hash:d.hash,createdRecordIds:r.createdRecordIds,createdCatalogRecords:r.createdCatalogRecords,returnedRows:rows.data,auditEvents:audit.data.map(x=>x.event)},null,2)+'\n');
 });
 await group('concurrent identical submits and retries return one durable receipt without duplicate writes',async()=>{
  const c=await actor('employeeA'),d=await prepare(c,[sourceLine('150','LB','3','Bag',ids.aw,testJob(206))]),a=await approve(c,d),r=await Promise.all([execute(c,d,a),execute(c,d,a)]);
  assert.deepEqual(r[0].createdRecordIds,r[1].createdRecordIds);assert.equal(r.filter(x=>x.idempotent===false).length,1);assert.equal(r.filter(x=>x.idempotent===true).length,1);assert.equal((await execute(c,d,a)).idempotent,true);
  const audit=await c.client.from('invoice_receival_audit').select('event').eq('draft_id',d.id).eq('event','executed');assert.equal(audit.data?.length,1);
 });
 await group('edits supersede immutable drafts and invalidate previous approval',async()=>{
  const c=await actor('employeeA'),label=randomUUID(),req=request([sourceLine('150','LB','3','Bag',ids.aw,testJob(207))],label),d=await call(c,'prepare_invoice_receival_draft',req),a=await approve(c,d);
  const changed={...req,p_metadata:{...req.p_metadata,location:'Synthetic alternate location'}};const replacement=await call(c,'prepare_invoice_receival_draft',changed);assert.notEqual(replacement.id,d.id);
  await denied(c,'execute_invoice_receival_draft',execArgs(d,a),['22023']);const next=await approve(c,replacement);await execute(c,replacement,next);
 });
 await group('explicit revocation and permission revoke/regrant invalidate existing signed approvals',async()=>{
  const c=await actor('employeeA'),d=await prepare(c,[sourceLine('150','LB','3','Bag',ids.aw,testJob(208))]),a=await approve(c,d);
  await call(c,'revoke_invoice_receival_draft',{p_draft_id:d.id,p_expected_hash:d.hash});await denied(c,'execute_invoice_receival_draft',execArgs(d,a),['22023']);
  const d2=await prepare(c,[sourceLine('150','LB','3','Bag',ids.aw,testJob(209))]),a2=await approve(c,d2);profile(c.id,'is_active=false');
  try{await denied(c,'execute_invoice_receival_draft',execArgs(d2,a2),['42501']);}finally{profile(c.id,'is_active=true');}
  await denied(c,'execute_invoice_receival_draft',execArgs(d2,a2),['22023']);
  const d3=await prepare(c,[sourceLine('150','LB','3','Bag',ids.aw,testJob(217))]),a3=await approve(c,d3);fixtureSql('revoke-lead-receival',"delete from public.app_role_capabilities where role='lead' and capability='adjustInventory';");
  try{await denied(c,'execute_invoice_receival_draft',execArgs(d3,a3),['42501']);}finally{fixtureSql('restore-lead-receival',"insert into public.app_role_capabilities(role,capability) values('lead','adjustInventory');");}
  await denied(c,'execute_invoice_receival_draft',execArgs(d3,a3),['22023']);
  // Same-role read_only revoke/regrant must advance the actual actor epoch.
  // Temporary fixture role grant supplies the independent receival capability;
  // neither the canonical bundle nor the synthetic profile is left changed.
  fixtureSql('guest-receival-test',"insert into public.app_role_capabilities(role,capability) values('guest','adjustInventory');");
  const guestId=cfg.actors.readonly.id!;profile(guestId,'read_only=false');
  try{const guest=await actor('readonly'),gd=await prepare(guest,[sourceLine('150','LB','3','Bag',ids.aw,testJob(218))]),ga=await approve(guest,gd);profile(guestId,'read_only=true');await denied(guest,'execute_invoice_receival_draft',execArgs(gd,ga),['42501']);profile(guestId,'read_only=false');await denied(guest,'execute_invoice_receival_draft',execArgs(gd,ga),['22023']);}
  finally{profile(guestId,'read_only=true');fixtureSql('restore-guest-receival',"delete from public.app_role_capabilities where role='guest' and capability='adjustInventory';");}
 });
 await group('catalog and Job evidence changes require fresh review before writes',async()=>{
  const c=await actor('employeeA'),d=await prepare(c,[sourceLine('150','LB','3','Bag',ids.aw,testJob(210))]),a=await approve(c,d);
  fixtureSql('mutate-catalog-evidence',`update public.vendor_catalog set item_name='Changed synthetic catalog' where id='${ids.aw}';`);
  try{await denied(c,'execute_invoice_receival_draft',execArgs(d,a),['22023']);}finally{fixtureSql('restore-catalog-evidence',`update public.vendor_catalog set item_name='Alaska White' where id='${ids.aw}';`);}
  const d2=await prepare(c,[sourceLine('150','LB','3','Bag',ids.aw,testJob(211))]),a2=await approve(c,d2);fixtureSql('archive-job',`update public.jobs set archived_at=clock_timestamp() where id='${testJob(211)}';`);
  try{await denied(c,'execute_invoice_receival_draft',execArgs(d2,a2),['22023']);}finally{fixtureSql('restore-job',`update public.jobs set archived_at=null where id='${testJob(211)}';`);}
 });
 await group('possible duplicate evidence requires exact acknowledgement; confirmed document claim stays authoritative',async()=>{
  const a=await actor('employeeA'),b=await actor('employeeB'),label=randomUUID(),original=request([sourceLine('150','LB','3','Bag',ids.aw,testJob(212))],label),d=await call(a,'prepare_invoice_receival_draft',original),approval=await approve(a,d);await execute(a,d,approval);
  const same=await call(b,'prepare_invoice_receival_draft',original);const review=((same.lines as Record<string,unknown>[])[0].duplicateReview as Record<string,unknown>);assert.equal(review.canAcknowledge,true);assert.equal(review.acknowledged,false);assert((review.matches as unknown[]).length>0);await denied(b,'approve_invoice_receival_draft',{p_draft_id:same.id,p_expected_hash:same.hash,p_confirmation:'CREATE_REVIEWED_PENDING_RECEIVALS'},['23505']);
  const ack={...original,p_lines:[{...original.p_lines[0] as Record<string,unknown>,duplicateAcknowledgement:review.fingerprint}]};const acknowledged=await call(b,'prepare_invoice_receival_draft',ack),approved=await approve(b,acknowledged);await denied(b,'execute_invoice_receival_draft',execArgs(acknowledged,approved),['23505']);
  const legitimate=request([{...sourceLine('150','LB','3','Bag',ids.aw,testJob(212)),duplicateAcknowledgement:review.fingerprint}]);const nd=await call(b,'prepare_invoice_receival_draft',legitimate),na=await approve(b,nd);await execute(b,nd,na);
 });
 await group('atomic failure after catalog creation rolls back catalog, pending, claim, execution and audit',async()=>{
  const c=await actor('employeeA'),newItem=newLine('rollback',testJob(213)),second={...sourceLine('150','LB','3','Bag',ids.aw,testJob(213)),sourceLineId:'failure-line'},d=await prepare(c,[newItem,second]),a=await approve(c,d);
  fixtureSql('install-atomic-fault',`create function public.fixture_receival_atomic_fault() returns trigger language plpgsql as $$begin if new.production_job_id='${testJob(213)}'::uuid and new.material_name='Alaska White' then raise exception 'Synthetic atomic failure' using errcode='23514';end if;return new;end$$;create trigger fixture_receival_atomic_fault before insert on public.pending_receivals for each row execute function public.fixture_receival_atomic_fault();`);
  try{await denied(c,'execute_invoice_receival_draft',execArgs(d,a),['23514']);}finally{fixtureSql('remove-atomic-fault','drop trigger fixture_receival_atomic_fault on public.pending_receivals;drop function public.fixture_receival_atomic_fault();');}
  assert.equal((await c.client.from('vendor_catalog_v2').select('id').eq('vendor_sku','UNK-rollback-'+runId)).data?.length,0);assert.equal((await c.client.from('pending_receivals').select('id').eq('production_job_id',testJob(213))).data?.length,0);assert.equal((await c.client.from('invoice_receival_executions').select('draft_id').eq('draft_id',d.id)).data?.length,0);assert.equal((await c.client.from('invoice_receival_audit').select('event').eq('draft_id',d.id).eq('event','executed')).data?.length,0);
  const after=await execute(c,d,a);assert.equal((after.createdRecordIds as unknown[]).length,2);assert.equal((after.createdCatalogRecords as unknown[]).length,1);
 });
 await group('catalog and receival capabilities are independent, with current-grant revalidation',async()=>{
  fixtureSql('member-receival-only',"insert into public.app_role_capabilities(role,capability) values('member','adjustInventory');");
  try{const c=await actor('member');assert.equal((await c.client.rpc('has_app_capability',{p_capability:'manageVendorsCatalog'})).data,false);const d=await prepare(c,[sourceLine('150','LB','3','Bag',ids.aw,testJob(214))]),a=await approve(c,d);await execute(c,d,a);await denied(c,'prepare_invoice_receival_draft',request([newLine('permission',testJob(215))]),['42501']);}finally{fixtureSql('restore-member-receival',"delete from public.app_role_capabilities where role='member' and capability='adjustInventory';");}
 });
 await group('RLS hides a restricted synthetic Job from the non-bypass execution role',async()=>{
  const c=await actor('employeeA');fixtureSql('restrict-job-rls',`create policy fixture_hidden_job on public.jobs as restrictive for select to authenticated using(id<>'${testJob(216)}'::uuid);`);
  try{await denied(c,'prepare_invoice_receival_draft',request([sourceLine('150','LB','3','Bag',ids.aw,testJob(216))]),['22023']);}finally{fixtureSql('restore-job-rls','drop policy fixture_hidden_job on public.jobs;');}
 });
 await group('all pending creations leave on-hand Inventory and transactions byte-for-byte unchanged',async()=>{
  const current=fixtureSql('final-preserved',"begin read only;select jsonb_build_object('stock',(select md5(coalesce(string_agg(to_jsonb(i)::text,',' order by id),'')) from public.inventory_items i),'transactions',(select md5(coalesce(string_agg(to_jsonb(t)::text,',' order by id),'')) from public.inventory_transactions t),'oldHistory',(select md5(coalesce(string_agg(to_jsonb(h)::text,',' order by conversation_id),'')) from public.tenbot_agent_history h),'caps',(select jsonb_agg(to_jsonb(c) order by role,capability) from public.app_role_capabilities c)) as state;commit;")[0].state;assert.deepEqual(current,baseline);
  const role=fixtureSql('role-attributes',"begin read only;select rolcanlogin,rolsuper,rolbypassrls from pg_roles where rolname='tenbot_invoice_executor';commit;")[0];assert.equal(role.rolcanlogin,false);assert.equal(role.rolsuper,false);assert.equal(role.rolbypassrls,false);
 });
 success=true;
}catch(error){writeFileSync(dir+'/database-validation-failure-'+runId+'.json',JSON.stringify({passed:false,fixtureRef:ref,recordedAt:now(),groupsPassed:checks.length,checks,error:error instanceof Error?error.message.slice(0,250):'unknown'},null,2)+'\n');throw error;}
finally{if(!success)fixtureSql('fail-closed-gate','update public.tenbot_receival_execution_control set execution_enabled=false where singleton;');}
const migrations=JSON.parse(readFileSync(dir+'/migration-hashes.json','utf8')) as {path:string;sha256:string}[];
for(const m of migrations)assert.equal(hash(readFileSync(m.path,'utf8')),m.sha256,'Applied migration file changed');
const receipt={passed:true,fixtureRef:ref,recordedAt:now(),groupsPassed:checks.length,checks,migrations,productionMutations:0,actualDatabase:true,actualSignedJwt:true,inferenceCalls:0,serviceRoleBusinessCalls:0,httpCalls:fixtureHttpCalls(),durationMs:Date.now()-started,gate:'Isolated fixture only; enabled for localhost candidate after focused validation',limitations:['Canonical table contract projection; full shared-Production schema compatibility remains a release gate.','Synthetic Auth identities only; no Production customer/employee records.','RLS hidden-Job and transaction failure are deliberate actual database policies/triggers, removed afterward; not model or persistence mocks.']};
writeFileSync(dir+'/database-validation.json',JSON.stringify(receipt,null,2)+'\n');
fixtureSql('passed-validation-gate',`update public.tenbot_receival_execution_control set execution_enabled=true,validated_at=clock_timestamp(),isolated_validation_receipt=${quote('Focused actual database validation receipt sha256:'+hash(JSON.stringify(receipt)))} where singleton;`);
console.log(JSON.stringify({passed:true,fixtureRef:ref,groupsPassed:checks.length,httpCalls:fixtureHttpCalls(),productionMutations:0,inferenceCalls:0,result:dir+'/database-validation.json'}));
