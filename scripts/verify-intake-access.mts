import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { roleHasCapability, APP_ROLES } from '../src/lib/rbac';
for (const role of APP_ROLES) assert.equal(roleHasCapability(role, 'accessIntake'), true);
const read=(name:string)=>readFileSync(`supabase/migrations/${name}.sql`,'utf8');
const migration=read('20260923215900_intake_early_access');
// The migration embeds the narrowly captured hosted bodies with exact drift guards.
// Reconstruct that pre-change fixture; the migration's hashes independently reject
// any reconstruction mismatch. Real Bid/file tables and policies replay below.
const originals=[...migration.matchAll(/execute \$replacement\$([\s\S]*?)\$replacement\$;/g)].map(m=>m[1]
 .replaceAll("'accessIntake'","'readOperationalData'")
 .replace("perform public.require_app_capability('readOperationalData'); select * into strict linked_bid",'select * into strict linked_bid')
 .replace(" and (p_bid_id is null or public.has_app_capability('readOperationalData'))",''));
const roles=['admin','developer','lead','member','guest'];
const ids=roles.map((_,i)=>`00000000-0000-4000-8000-00000000000${i+1}`);
const bid='10000000-0000-4000-8000-000000000001';
const bootstrap=`create role authenticated;create role anon;create role service_role;create schema auth;create schema storage;
create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,metadata jsonb);
alter table storage.objects enable row level security;grant usage on schema storage to authenticated;grant select,insert,delete on storage.objects to authenticated;
`;
const identity=read('20260818_001_rbac_identity_infrastructure').split('create or replace function public.get_my_app_user()')[0]+'commit;';
const dependencies=`grant select on public.app_users to authenticated;create table public.proposals(id uuid primary key,prior_proposal_id uuid,created_by_user_id uuid,job_id uuid,status text,customer_name text,project_name text);
create function public.has_proposal_access() returns boolean language sql as $$select true$$;
create table public.samples(id uuid primary key,bid_id uuid,job_id uuid,created_by_user_id uuid);
create table public.sample_formulation_defaults(id uuid);create table public.sample_formulation_profiles(id uuid);
set check_function_bodies=off;
`;
const tables=read('20260713_002_production_mvp_jobs')+read('20260716_002_atomic_production_schedule_batch')+read('20260901_001_preproduction_bids')+read('20260901_002_bid_operational_context')+read('20260901_003_bid_files')+read('20260902_002_bid_proposal_relationships');
const seed=roles.map((role,i)=>`insert into auth.users values('${ids[i]}');insert into public.app_users(user_id,display_name,role,is_active) values('${ids[i]}','TEST ${role}','${role}',true);`).join('\n')+`
insert into public.bids(id,customer,project_name,creator_user_id,owner_user_id) values('${bid}','TEST CUSTOMER','TEST Intake secret','${ids[0]}','${ids[0]}');
insert into public.bid_updates(bid_id,author_user_id,body) values('${bid}','${ids[0]}','TEST private context');
insert into public.canonical_files(id,uploader_user_id,storage_path,original_filename,byte_size,lifecycle_state) values('${bid}','${ids[0]}','test-file','TEST.pdf',1,'ready');
insert into public.bid_file_relationships(bid_id,file_id,relationship_state) values('${bid}','${bid}','active');
insert into storage.objects(bucket_id,name) values('bid-files','test-file');
create table public.test_historical as select to_jsonb(b) as row from public.bids b;
`;
const cleanupSource=read('20260901_004_admin_canonical_cleanup');
const cleanup=cleanupSource.slice(cleanupSource.indexOf('create function public.prepare_admin_delete_bid('),cleanupSource.indexOf('create function public.cancel_admin_delete_bid('))+`create function public.production_job_delete_blockers(uuid) returns jsonb language sql as $$select '[]'::jsonb$$;`;
let tests='';
for (const [i,role] of roles.entries()) {
 const allowed=i<2;
 tests+=`set role authenticated;select set_config('request.jwt.claim.sub','${ids[i]}',false);
 do $$begin
 if public.has_app_capability('accessIntake') is distinct from ${allowed} then raise exception '${role} capability incorrect';end if;
 if (select count(*) from public.bids) <> ${allowed?1:0} then raise exception '${role} table leak';end if;
 if (select count(*) from public.list_bids()) <> ${allowed?1:0} then raise exception '${role} RPC leak';end if;
 if (select count(*) from public.list_bid_updates('${bid}')) <> ${allowed?1:0} then raise exception '${role} context leak';end if;
 if (select count(*) from public.canonical_files) <> ${allowed?1:0} then raise exception '${role} file metadata leak';end if;
 if (select count(*) from storage.objects) <> ${allowed?1:0} then raise exception '${role} Storage leak';end if;
`;
 if(!allowed) for(const call of [`public.set_bid_projected_window('${bid}',null,null,now())`,`public.convert_bid_to_production('${bid}',now(),'unscheduled')`,`public.create_bid('TEST','TEST')`,`public.create_bid_update('${bid}','TEST')`,`public.begin_bid_file_upload('${bid}','TEST.txt','text/plain',1)`,`public.create_bid_proposal('${bid}')`,`public.link_sample_to_bid('${bid}','${bid}')`,`public.create_sample('${bid}',null)`])tests+=`begin perform ${call};raise exception '${role} unauthorized mutation';exception when insufficient_privilege then null;end;\n`;
 if(allowed)tests+=`perform public.set_bid_projected_window('${bid}','2026-10-01','2026-10-02',(select updated_at from public.bids where id='${bid}'));perform public.set_bid_projected_window('${bid}',null,null,(select updated_at from public.bids where id='${bid}'));`;
 tests+='end$$;reset role;\n';
}
tests+=`do $$begin if exists(select 1 from public.bids b join public.test_historical t on b.id=(t.row->>'id')::uuid where (to_jsonb(b)-array['updated_at','projected_production_start','projected_production_end','projected_window_updated_by','projected_window_updated_at','production_job_id','converted_by_user_id','converted_at'])<>(t.row-'updated_at')) then raise exception 'Historical rewrite';end if;end$$;`;
const name=`tenops-intake-access-${process.pid}`;
function run(args:string[],input?:string){const r=spawnSync('docker',args,{input,encoding:'utf8',maxBuffer:10_000_000});if(r.status!==0)throw Error(r.stdout+'\n'+r.stderr);return r.stdout;}
try {
 run(['run','--rm','-d','--name',name,'-e','POSTGRES_PASSWORD=postgres','postgres:17.6']);
 for(let i=0;i<40;i++){if(spawnSync('docker',['exec',name,'pg_isready','-h','127.0.0.1','-U','postgres']).status===0)break;await new Promise(r=>setTimeout(r,250));}
 run(['exec','-i',name,'psql','-U','postgres','-v','ON_ERROR_STOP=1'],bootstrap+identity+dependencies+tables+originals.join(';\n')+';'+seed+migration+cleanup+read('20260923220000_intake_projected_planning')+tests);
 console.log('Intake access: exact hosted guards replayed; Admin/Developer allow, Lead/Member/Guest deny; RPC/table/Storage and contextual entry points; historical rows unchanged.');
} finally {spawnSync('docker',['stop',name],{stdio:'ignore'});}
