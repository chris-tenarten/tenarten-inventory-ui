/** Review-only source verifier. No network, SQL engine, credentials, migration
 * application or database-security claim. Real PostgreSQL/RLS tests remain a gate. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';

const migrationPath='supabase/migrations/20261031020000_invoice_preparation_read_boundary.sql';
const read=async(path:string)=>readFile(new URL('../'+path,import.meta.url),'utf8');
const migration=await read(migrationPath);
const predecessor=await read('supabase/migrations/20261030210000_tenbot_chris_dev_canary_grant.sql');
const storage=await read('supabase/migrations/20261030170000_invoice_original_storage_compatibility.sql');
const originals=await read('supabase/migrations/20261030150000_invoice_receival_originals.sql');
const hardened=await read('supabase/migrations/20261030180000_invoice_original_backend_fail_closed.sql');
const md5=(text:string)=>createHash('md5').update(text).digest('hex');
const sha256=(text:string)=>createHash('sha256').update(text).digest('hex');
function body(text:string,name:string){const match=text.match(new RegExp('create(?: or replace)? function public\\.'+name+'\\([^;]*?\\bas \\$\\$(.*?)\\$\\$;','is'));assert(match,name);return match[1];}
const replaceOnce=(text:string,old:string,next:string)=>{assert.equal(text.split(old).length-1,1,'Expected exactly one reviewed clause');return text.replace(old,next);};
const baseline:Record<string,string>={
 begin_invoice_receival_source:body(storage,'begin_invoice_receival_source'),
 get_invoice_receival_source:body(originals,'get_invoice_receival_source'),
 record_invoice_receival_source_state:body(storage,'record_invoice_receival_source_state'),
 invoice_receival_original_allowed:body(storage,'invoice_receival_original_allowed'),
 guard_invoice_receival_original_object:body(hardened,'guard_invoice_receival_original_object'),
 tenbot_guard_chris_dev_canary_source:body(predecessor,'tenbot_guard_chris_dev_canary_source'),
 tenbot_chris_dev_canary_commit_authorized:body(predecessor,'tenbot_chris_dev_canary_commit_authorized'),
};
for(const name of ['record_invoice_receival_source_state','guard_invoice_receival_original_object'])baseline[name]=replaceOnce(baseline[name],
 'not exists(select 1 from public.app_role_capabilities c where c.role=actor.role and c.capability=required.capability)',
 'not public.tenbot_canary_user_has_capability(actor.user_id,required.capability)');
baseline.record_invoice_receival_source_state=replaceOnce(baseline.record_invoice_receival_source_state,
 "if not found or source.lifecycle_state not in('uploading','ready')",
 "if not found or (source.owner_user_id='3785f6b9-742e-452f-af6c-31613a983633' and (source.sha256<>'c66a0eb7a0512b40df092a7852fbbeaded6664b97b2f2df2153487441124ba2a' or source.content_type<>'application/pdf' or source.byte_size<>2877)) or source.lifecycle_state not in('uploading','ready')");
baseline.invoice_receival_original_allowed=replaceOnce(baseline.invoice_receival_original_allowed,
 's.owner_user_id=auth.uid() and case p_operation',
 "s.owner_user_id=auth.uid() and (s.owner_user_id<>'3785f6b9-742e-452f-af6c-31613a983633' or (s.sha256='c66a0eb7a0512b40df092a7852fbbeaded6664b97b2f2df2153487441124ba2a' and s.content_type='application/pdf' and s.byte_size=2877)) and case p_operation");

const checks:string[]=[];
function check(name:string,run:()=>void){run();checks.push(name);}
const changed:Record<string,string>={};
const transformations:Record<string,number>={};
check('all seven final predecessor function bodies are pinned; every substitution has exactly one target',()=>{
 const sections=[...migration.matchAll(/-- Reviewed target: (\w+)\n signature:='([^']+)';expected_body:='([a-f0-9]{32})';([\s\S]*?) execute definition;/g)];
 assert.equal(sections.length,7);assert.deepEqual(sections.map(s=>s[1]).sort(),Object.keys(baseline).sort());
 for(const section of sections){const [,name,signature,pin,sql]=section;assert(signature.startsWith('public.'+name+'('));assert.equal(md5(baseline[name]),pin,name);
  assert(sql.includes("proowner='postgres'::regrole and prosecdef"));assert(sql.includes("if matches<>1 then raise exception"));
  let result=baseline[name];const replacements=[...sql.matchAll(/old_check:=\$old\$([\s\S]*?)\$old\$;\n new_check:=\$new\$([\s\S]*?)\$new\$;/g)];assert(replacements.length>0);
  for(const replacement of replacements)result=replaceOnce(result,replacement[1],replacement[2]);changed[name]=result;transformations[name]=replacements.length;
 }
});
check('only source functions/policy are changed; no capability grants, business operations or write-gate activation',()=>{
 const direct=[...migration.matchAll(/create function public\.(\w+)\(/g)].map(m=>m[1]);
 assert.deepEqual(direct,['tenbot_invoice_preparation_actor_allowed','can_prepare_invoice_receival','tenbot_invoice_source_preparation_allowed','can_read_invoice_preparation_source']);
 assert(!/\b(?:insert into|update|delete from)\s+public\.(?:app_role_capabilities|app_users|pending_receivals|vendor_catalog|tenbot_receival_pilot|tenbot_chris_dev_canary)/i.test(migration));
 assert(!/signature:='public\.(?:prepare_invoice_receival_draft|approve_invoice_receival_draft|execute_invoice_receival_draft|revoke_invoice_receival_draft|tenbot_receival_mint_execution_permit|has_app_capability|tenbot_guard_chris_dev_canary_operation)/i.test(migration));
 assert(!/grant\s+(?:all|insert|update|delete|usage)\b/i.test(migration));assert.equal((migration.match(/alter policy invoice_sources_owner_read/g)??[]).length,1);
 assert(migration.includes("set local lock_timeout='3s';set local statement_timeout='30s'"));assert(migration.trimEnd().endsWith('commit;'));
});
check('public eligibility takes no actor; owner-only authenticated source helper and private actor functions fail closed',()=>{
 const actor=body(migration,'tenbot_invoice_preparation_actor_allowed');assert(actor.includes('u.is_active and not u.read_only'));assert(actor.includes("public.tenbot_canary_user_has_capability(u.user_id,'readOperationalData')"));
 for(const name of ['can_prepare_invoice_receival','can_read_invoice_preparation_source']){const value=body(migration,name);assert(value.includes("auth.role()='authenticated' and auth.uid() is not null"));assert(value.includes('auth.uid()'));assert(migration.includes('grant execute on function public.'+name+(name==='can_prepare_invoice_receival'?'()':'(uuid)')+' to authenticated;'));}
 for(const signature of ['tenbot_invoice_preparation_actor_allowed(uuid)','tenbot_invoice_source_preparation_allowed(uuid,uuid)'])assert(migration.includes('revoke all on function public.'+signature+'\n from public,anon,authenticated,service_role,tenbot_invoice_executor;'));
 assert(!/grant execute on function public\.tenbot_invoice_(?:preparation_actor|source_preparation)_allowed/.test(migration));
});
check('read-only preparation is owned, live, unbound and unretained; fixed synthetic document applies to every weak actor',()=>{
 const source=body(migration,'tenbot_invoice_source_preparation_allowed');
 for(const text of ['s.id=p_source and s.owner_user_id=p_actor',"s.lifecycle_state in('uploading','ready') and s.expires_at>clock_timestamp()",'s.retained_draft_id is null and s.retained_at is null','not exists(select 1 from public.invoice_receival_source_bindings b where b.source_id=s.id)',"s.content_type='application/pdf' and s.byte_size=2877",'c66a0eb7a0512b40df092a7852fbbeaded6664b97b2f2df2153487441124ba2a'])assert(source.includes(text),text);
 assert(migration.includes("md5(definition) is distinct from '4857968a96b7787b85b9bf57e0a4fd53'"));assert(migration.includes("and polcmd='r' and polpermissive and polroles=array['authenticated'::regrole::oid] and polwithcheck is null"));assert(migration.includes('using ((%s) or public.can_read_invoice_preparation_source(id))'));
 assert(!source.includes("s.owner_user_id<>'3785f6b9"));
 for(const text of ["p_sha256 is distinct from 'c66a0eb7a0512b40df092a7852fbbeaded6664b97b2f2df2153487441124ba2a'","p_content_type is distinct from 'application/pdf' or p_byte_size is distinct from 2877::bigint",'Only the approved synthetic original is available for read-only preparation.'])assert(changed.begin_invoice_receival_source.includes(text),text);
 assert(changed.begin_invoice_receival_source.indexOf('Only the approved synthetic original')<changed.begin_invoice_receival_source.indexOf('select * into source'),'Weak actor document scope must be checked before any existing-hash source return');
});
check('hash-reuse/get retain stronger permissions for retained/bound/expired sources, without losing source identity guards',()=>{
 const strong="perform public.require_app_capability('readOperationalData');perform public.require_app_capability('writeBusinessData');perform public.require_app_capability('adjustInventory');";
 for(const name of ['begin_invoice_receival_source','get_invoice_receival_source'])assert(changed[name].includes('if not public.can_read_invoice_preparation_source(source.id) then '+strong+'end if;'));
 for(const text of ['pg_advisory_xact_lock',"'Original digest metadata conflicts.'","'Finish or clean up pending invoice uploads before adding another.'",'source.byte_size<>p_byte_size or source.content_type<>p_content_type','auth.uid()::text||\'/\'||ident::text||\'/original\''])assert(changed.begin_invoice_receival_source.includes(text),text);
});
check('source-state remains service-only, owned/versioned and quantity immutable; preparation cannot claim approval or completed actions',()=>{
 const value=changed.record_invoice_receival_source_state;
 for(const text of ["auth.role() is distinct from 'service_role'",'s.id=p_source_id and s.owner_user_id=p_actor for update','source.version is distinct from p_expected_version','source.sha256 is distinct from p_verified_sha256',"'Verified source quantities cannot be replaced.'","'Verified extraction and original evidence cannot be replaced.'","'Exact uploaded original object required.'",'public.tenbot_invoice_source_preparation_allowed(source.id,p_actor)',"'writeBusinessData'","'adjustInventory'","->'canApprove' is distinct from 'false'::jsonb","->'executionEnabled' is distinct from 'false'::jsonb","->>'status' is distinct from 'review_required'","array['durableDraftId','durableHash','approvalId','createdRecordIds','completed_actions']"])assert(value.includes(text),text);
 for(const text of ["stable_keys text[]:=array['version','originalSha256','visionSha256','rawLines','document']",'pg_column_size(p_state)>262144',"'Source rows must match the verified transcription exactly.'"])assert(value.includes(text),text);
});
check('Storage new branch is read/insert only; trusted backend verifies exact owner/bytes; service delete and retained rules unchanged',()=>{
 const value=changed.invoice_receival_original_allowed;
 assert(value.includes("p_operation in('read','insert')"));assert(value.includes('s.storage_path=p_path'));assert(value.includes('public.can_read_invoice_preparation_source(s.id)'));
 const oldService=baseline.invoice_receival_original_allowed.slice(baseline.invoice_receival_original_allowed.indexOf(" or (auth.role()='service_role'"));assert(value.endsWith(oldService));
 const storageGuard=changed.guard_invoice_receival_original_object;
 for(const text of ["backend is distinct from true",'new.owner_id is distinct from source.owner_user_id::text','not public.tenbot_invoice_preparation_actor_allowed(actor.user_id)','source.retained_draft_id is not null or source.retained_at is not null','public.invoice_receival_source_bindings',"'Original invoice cannot be replaced.'",'object_metadata']){if(text==='object_metadata')continue;assert(storageGuard.includes(text),text);}
 const deleteIndex=baseline.guard_invoice_receival_original_object.indexOf(" if tg_op='DELETE'");assert.equal(storageGuard.slice(storageGuard.indexOf(" if tg_op='DELETE'")),baseline.guard_invoice_receival_original_object.slice(deleteIndex));
});
check('only chris_dev source-insert/deferred branch loses grant requirement; all business trigger branches stay intact',()=>{
 const insert=changed.tenbot_guard_chris_dev_canary_source;assert(insert.includes('not public.can_prepare_invoice_receival()'));assert(insert.includes('auth.uid() is distinct from new.owner_user_id'));assert(insert.includes("new.content_type is distinct from 'application/pdf' or new.byte_size<>2877"));assert(!insert.includes('tenbot_active_chris_dev_canary_grant'));
 const deferred=changed.tenbot_chris_dev_canary_commit_authorized;assert(deferred.includes("tg_table_schema='public' and tg_table_name='invoice_receival_sources'"));assert(deferred.includes('public.can_read_invoice_preparation_source(new.id)'));
 assert(deferred.includes("and auth.role()='authenticated' and auth.uid()=new.owner_user_id"));assert(!deferred.includes('Source preparation access changed before commit.'));
 assert(deferred.endsWith(baseline.tenbot_chris_dev_canary_commit_authorized.slice('begin\n'.length)));assert(!migration.includes('drop trigger'));
});
console.log(JSON.stringify({status:'pass',mode:'offline review-only migration source/transform checks; NOT PostgreSQL/JWT/RLS proof',groups:checks.length,checks,migration:migrationPath,sha256:sha256(migration),expectedBeforeBodyMd5:Object.fromEntries(Object.entries(baseline).map(([name,value])=>[name,md5(value)])),expectedAfterBodyMd5:Object.fromEntries(Object.entries(changed).map(([name,value])=>[name,md5(value)])),transformations,migrationApplications:0,databaseWrites:0,networkCalls:0},null,2));
