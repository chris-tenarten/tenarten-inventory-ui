// Focused disposable authorization validation; never connects to hosted services.
import {readFileSync} from 'node:fs';import {spawnSync,spawn} from 'node:child_process';
const arg=name=>process.argv.find(value=>value.startsWith(`--${name}=`))?.slice(name.length+3);
const baselineDir=arg('baseline-dir');
if(!baselineDir)throw Error('Pass --baseline-dir=<approved pre-PO/Sample schema capture directory containing public-schema.sql and config-data.json>. Disposable Docker only.');
const name='tenops-intake-view-validation',read=p=>readFileSync(p,'utf8');
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
 sql(read('scripts/fixtures/intake-view-access.sql').replace('-- APPLY_CURRENT_MIGRATION',()=>read('supabase/migrations/20260924180000_intake_view_access.sql')));
 if(process.argv.includes('--training')) {
  sql(read('scripts/fixtures/intake-personal-training.sql').replace('-- APPLY_TRAINING_MIGRATION',()=>read('supabase/migrations/20260924190000_intake_personal_training.sql')));
  const concurrent=q=>new Promise(resolve=>{const p=spawn('docker',['exec','-i',name,'psql','-X','-U','postgres','-v','ON_ERROR_STOP=1','-At']);let output='';p.stdout.on('data',c=>output+=c);p.stderr.on('data',c=>output+=c);p.on('close',code=>resolve({code,output}));p.stdin.end(q);});
  const actor="set role authenticated;select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000101',false);";
  const outcomes=await Promise.all([concurrent(actor+'begin;select create_personal_test_bid();select pg_sleep(0.2);commit;'),concurrent(actor+'begin;select create_personal_test_bid();commit;')]);
  if(outcomes.filter(r=>r.code===0).length!==1||!outcomes.some(r=>r.output.includes('existing TEST Bid')))throw Error('Concurrent creation did not fail closed: '+JSON.stringify(outcomes));
  sql(actor+"select reset_personal_test_workflow((select bid_id from intake_training_workflows where owner_user_id=auth.uid()),'bid','DELETE TEST');");
  console.log('PASS: 35 normal-Job before/after operations and unchanged policies/capabilities; personal training lifecycle, exclusive cleanup and concurrent one-workflow enforcement');
 }

 console.log("PASS: focused Intake view/write/RLS/Storage/anonymous/inactive matrix; writes and historical rows preserved");
}finally{run(["stop",name]);}
