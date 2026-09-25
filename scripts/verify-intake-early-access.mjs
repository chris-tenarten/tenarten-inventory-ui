// Focused disposable authorization validation; never connects to hosted services.
import {readFileSync} from 'node:fs';import {spawnSync} from 'node:child_process';
const arg=name=>process.argv.find(value=>value.startsWith(`--${name}=`))?.slice(name.length+3);
const baselineDir=arg('baseline-dir');
if(!baselineDir)throw Error('Pass --baseline-dir=<approved pre-PO/Sample schema capture directory containing public-schema.sql and config-data.json>. Disposable Docker only.');
const name='tenops-intake-early-validation',read=p=>readFileSync(p,'utf8');
function run(args,input){const r=spawnSync('docker',args,{input,encoding:'utf8',maxBuffer:30e6});if(r.status)throw Error(r.stderr.slice(-3000));return r.stdout;}
const sql=q=>run(['exec','-i',name,'psql','-X','-U','postgres','-v','ON_ERROR_STOP=1','-At'],q);
run(['run','--rm','-d','--name',name,'-e','POSTGRES_PASSWORD=local-only','postgres:17.6']);
try {
 for(let i=0;i<60;i++){if(!spawnSync('docker',['exec',name,'pg_isready','-h','127.0.0.1','-U','postgres']).status)break;await new Promise(r=>setTimeout(r,250));}
 const bootstrap=read('scripts/verify-po-reservation-allocations.mjs').match(/const bootstrap = `([\s\S]*?)`;/)[1];
 sql(bootstrap+read(baselineDir+'/public-schema.sql'));
 const config=JSON.parse(read(baselineDir+'/config-data.json')).rows.map(r=>{const table={capabilities:'app_role_capabilities',profiles:'sample_formulation_profiles',defaults:'sample_formulation_defaults'}[r.kind];return `insert into public.${table} overriding system value select * from jsonb_populate_recordset(null::public.${table},'${JSON.stringify(r.rows).replaceAll("'","''")}'::jsonb);`;}).join('\n');sql(config);
 sql('create schema storage;create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,metadata jsonb);');
 for(const f of ['20260923160000_sample_operational_profiles','20260923160100_po_reservation_allocations','20260923160200_partial_pending_receipts','20260923215900_intake_early_access','20260923220000_intake_projected_planning'])sql(read('supabase/migrations/'+f+'.sql'));
 sql("alter table storage.objects enable row level security;grant usage on schema storage to authenticated,anon;grant select,insert,update,delete on storage.objects to authenticated;create policy bid_file_object_delete on storage.objects as PERMISSIVE for DELETE to authenticated using (((bucket_id = 'bid-files'::text) AND has_app_capability('readOperationalData'::text) AND (EXISTS ( SELECT 1\n   FROM app_users actor\n  WHERE ((actor.user_id = auth.uid()) AND actor.is_active))) AND (EXISTS ( SELECT 1\n   FROM (canonical_files file\n     JOIN bid_file_relationships relationship ON ((relationship.file_id = file.id)))\n  WHERE ((file.storage_path = objects.name) AND (((file.lifecycle_state = 'uploading'::text) AND (relationship.relationship_state = 'uploading'::text) AND (file.uploader_user_id = auth.uid())) OR (relationship.relationship_state = 'removal_pending'::text)))))));create policy bid_file_object_insert on storage.objects as PERMISSIVE for INSERT to authenticated with check (((bucket_id = 'bid-files'::text) AND has_app_capability('readOperationalData'::text) AND (EXISTS ( SELECT 1\n   FROM app_users actor\n  WHERE ((actor.user_id = auth.uid()) AND actor.is_active))) AND (EXISTS ( SELECT 1\n   FROM (canonical_files file\n     JOIN bid_file_relationships relationship ON ((relationship.file_id = file.id)))\n  WHERE ((file.storage_path = objects.name) AND (file.lifecycle_state = 'uploading'::text) AND (relationship.relationship_state = 'uploading'::text) AND (file.uploader_user_id = auth.uid()))))));create policy bid_file_object_select on storage.objects as PERMISSIVE for SELECT to authenticated using (((bucket_id = 'bid-files'::text) AND has_app_capability('readOperationalData'::text) AND (EXISTS ( SELECT 1\n   FROM app_users actor\n  WHERE ((actor.user_id = auth.uid()) AND actor.is_active))) AND (EXISTS ( SELECT 1\n   FROM (canonical_files file\n     JOIN bid_file_relationships relationship ON ((relationship.file_id = file.id)))\n  WHERE ((file.storage_path = objects.name) AND (file.lifecycle_state = 'ready'::text) AND (relationship.relationship_state = ANY (ARRAY['active'::text, 'removal_pending'::text])))))));");

 // Seed only synthetic actors/records, then replay the released migrations.
 sql(read('scripts/fixtures/intake-view-access.sql').split('create table test_rows')[0]);
 sql(read('supabase/migrations/20260924180000_intake_view_access.sql'));
 sql("insert into auth.users(id) values('00000000-0000-4000-8000-000000000101'),('00000000-0000-4000-8000-000000000102'),('00000000-0000-4000-8000-000000000103');insert into app_users(user_id,display_name,role,is_active) values ('00000000-0000-4000-8000-000000000101','Patrick Soldow','lead',true),('00000000-0000-4000-8000-000000000102','Giovanni Coppola','lead',true),('00000000-0000-4000-8000-000000000103','Anthony Iorio','lead',true);");
 sql(read('supabase/migrations/20260924190000_intake_personal_training.sql'));
 // Match installed Storage engine ACL; the migration never modifies this ACL.
 sql("alter role supabase_storage_admin superuser;alter table storage.objects owner to supabase_storage_admin;revoke all on storage.objects from authenticated,anon,postgres;set role supabase_storage_admin;grant all on storage.objects to supabase_storage_admin with grant option;grant all on storage.objects to service_role,authenticated,anon;grant all on storage.objects to postgres with grant option;reset role;");
 const migration=read('supabase/migrations/20260925180000_intake_early_access_editing.sql');
 const expected=JSON.parse(migration.match(/\$expected\$([\s\S]*?)\$expected\$/)[1]);
 // Reproduce current hosted Storage policy composition, including unrelated bucket predicates.
 sql("create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;");
 const installed=JSON.parse(sql("select json_agg(policyname) from pg_policies where schemaname='storage' and tablename='objects';"));
 const ident=v=>'"'+v.replaceAll('"','""')+'"';
 for(const p of expected.policies.filter(p=>p.schemaname==='storage'&&!installed.includes(p.policyname)))sql(`create policy ${ident(p.policyname)} on storage.objects as ${p.permissive} for ${p.cmd} to ${p.roles.map(ident).join(',')} ${p.qual?'using ('+p.qual+')':''} ${p.with_check?'with check ('+p.with_check+')':''};`);
 const actual=JSON.parse(sql(read('scripts/fixtures/intake-early-access/contract.sql')+';'));
 if(JSON.stringify(actual)!==JSON.stringify(expected)) {
  const {writeFileSync}=await import('node:fs');writeFileSync('/tmp/intake-early-replay-contract.json',JSON.stringify(actual,null,2));
  // Compare structurally; JSON object property order is not contractual.
  if(sql('select $a$'+JSON.stringify(actual)+'$a$::jsonb=$b$'+JSON.stringify(expected)+'$b$::jsonb;').trim()!=='t')throw Error('Replay differs from current hosted guard; see /tmp/intake-early-replay-contract.json');
 }
 sql(read('scripts/fixtures/intake-early-access/normal-production.sql'));
 const business="select jsonb_object_agg(name,digest) from ("+['bids','bid_updates','bid_activity','canonical_files','bid_file_relationships','jobs','samples','proposals','account_notifications'].map(t=>`select '${t}' name,md5(coalesce(string_agg(to_jsonb(r)::text,'' order by to_jsonb(r)::text),'')) digest from public.${t} r`).join(' union all ')+") q";
 sql("insert into bids(customer,project_name,creator_user_id,owner_user_id) select 'Synthetic demo','Shared example '||i,'00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001' from generate_series(2,8) i;");
 const before=sql(business);
 // Exercise the exact cleanup algorithm on synthetic equivalents, never hosted data.
 const target='80000000-0000-4000-8000-000000000001',owner='00000000-0000-4000-8000-000000000102';
 sql(`insert into bids(id,customer,project_name,creator_user_id,owner_user_id) values('${target}','Synthetic','Retired training','${owner}','${owner}');insert into intake_training_workflows(owner_user_id,bid_id) values('${owner}','${target}');insert into bid_activity(bid_id,activity_type,actor_user_id,details) values('${target}','created','${owner}','{"personal_training":true}');`);
 const bidHash=sql(`select md5(to_jsonb(b)::text) from bids b where id='${target}'`).trim();
 const activityHash=sql(`select md5(string_agg(to_jsonb(a)::text,'' order by id)) from bid_activity a where bid_id='${target}'`).trim();
 const cleanup=read('scripts/fixtures/intake-early-access/cleanup-retired-training.sql').replaceAll('c6da2ea0-f6d0-4de2-a08f-d8c895291ac6',target).replaceAll('29bed5b3-2ed8-43aa-9af2-45578b00388e',owner).replace(/distinct from '[0-9a-f]{32}'/,`distinct from '${bidHash}'`).replace(/(from public.bid_activity a where bid_id=target\) is distinct from )'[0-9a-f]{32}'/,`$1'${activityHash}'`);
 for(const extra of [`update bids set notes='changed' where id='${target}';`,`insert into bid_updates(bid_id,author_user_id,body) values('${target}','${owner}','new dependency');`]) {
  try{sql(cleanup.replace('begin;','begin;'+extra));throw Error('Cleanup unexpectedly accepted drift');}catch(e){if(!/changed|dependency/.test(e.message))throw e;}
 }
 sql(cleanup);
 if(sql(business)!==before)throw Error('Cleanup modified unrelated fixtures');
 // Prove guard rejection is atomic for function/capability drift and a nonempty registry.
 function rejects(setup,cleanup){sql(setup);try{sql(migration);throw Error('Migration unexpectedly accepted drift');}catch(e){if(!/drift|workflows remain/.test(e.message))throw e;}sql(cleanup);}
 rejects("update app_role_capabilities set capability='unexpectedIntake' where role='developer' and capability='accessIntake'", "update app_role_capabilities set capability='accessIntake' where role='developer' and capability='unexpectedIntake'");
 rejects("grant update on bids to authenticated", "revoke update on bids from authenticated");
 const manageDefinition=sql("select pg_get_functiondef('require_bid_management(uuid)'::regprocedure)");
 rejects("create or replace function require_bid_management(p_bid_id uuid) returns void language plpgsql security definer set search_path=pg_catalog,public as $$begin null;end$$",manageDefinition);
 rejects("insert into intake_training_workflows(owner_user_id,bid_id) values('00000000-0000-4000-8000-000000000101','10000000-0000-4000-8000-000000000001')", "delete from intake_training_workflows");
 sql(migration.replace(/commit;\s*$/, 'rollback;'));
 if(sql(read('scripts/fixtures/intake-early-access/contract.sql')+';')!==JSON.stringify(actual)+'\n') {
  const rolled=JSON.parse(sql(read('scripts/fixtures/intake-early-access/contract.sql')+';'));
  if(JSON.stringify(rolled)!==JSON.stringify(actual))throw Error('Migration rollback changed contract');
 }
 sql(migration);
 if(sql(business)!==before)throw Error('Business data changed');
 sql(read('scripts/fixtures/intake-early-access/matrix.sql'));
 if(sql(business)!==before)throw Error('Disposable probe residue');
 console.log('PASS: fresh hosted guard; atomic drift/nonempty-registry refusal and rollback; five-role editing/file/window/conversion/deletion matrix; anonymous/inactive denied; service read/write; 35 unchanged Production operation pairs; zero business-row changes; guarded synthetic training cleanup');
}finally{run(['stop',name]);}
