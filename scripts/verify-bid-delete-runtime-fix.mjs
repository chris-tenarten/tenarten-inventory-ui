import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const migration=readFileSync('supabase/migrations/20260902_003_bid_delete_runtime_fix.sql','utf8');
const workspace=readFileSync('src/modules/pre-production/BidWorkspace.tsx','utf8');
const name=`tenops-bid-delete-fix-${process.pid}`;
const image='public.ecr.aws/supabase/postgres:17.6.1.084';
const admin='00000000-0000-0000-0000-000000000001';
const member='00000000-0000-0000-0000-000000000002';
const bid='10000000-0000-0000-0000-000000000001';
const otherBid='10000000-0000-0000-0000-000000000002';

assert.match(workspace,/const expected=draft\.projectName\.trim\(\)\|\|'DELETE'/);
assert.doesNotMatch(workspace,/const expected=`\$\{draft\.customer\}/);
assert.match(workspace,/setDraft\(null\);setSelectedId\(''\);setActivity\(\[\]\);setUpdates\(\[\]\);setFiles\(\[\]\)/);
assert.doesNotMatch(migration,/delete from public\.(samples|proposals|jobs|vendor_catalog)/i);
assert.match(migration,/update public\.samples set bid_id=null where bid_id=p_bid_id/);

const setup=String.raw`
do $$begin if not exists(select 1 from pg_roles where rolname='authenticated')then create role authenticated nologin;end if;end$$;
create schema if not exists auth;create schema if not exists storage;
do $$begin if to_regprocedure('auth.uid()') is null then execute $fn$create function auth.uid() returns uuid language sql stable as 'select nullif(current_setting(''request.jwt.claim.sub'',true),'''')::uuid'$fn$;end if;end$$;
create table public.app_users(user_id uuid primary key,role text not null,is_active boolean not null);
create function public.require_app_capability(capability text)returns void language plpgsql security definer as $$begin if capability<>'manageUsers' or not exists(select 1 from public.app_users where user_id=auth.uid() and role='admin' and is_active)then raise exception 'Access denied.' using errcode='42501';end if;end$$;
create table public.jobs(id uuid primary key);
create table public.vendor_catalog(id text primary key);
create table public.bids(id uuid primary key,customer text not null,project_name text not null);
create table public.samples(id uuid primary key,bid_id uuid references public.bids(id) on delete restrict,issued_marker text);
create table public.proposals(id uuid primary key,issued_snapshot jsonb);
create table public.bid_proposal_relationships(bid_id uuid references public.bids(id) on delete cascade,proposal_id uuid unique references public.proposals(id) on delete cascade,linked_by_user_id uuid references public.app_users(user_id),linked_at timestamptz default now(),primary key(bid_id,proposal_id));
create table public.bid_updates(id uuid primary key default gen_random_uuid(),bid_id uuid references public.bids(id) on delete restrict,body text);
create table public.bid_activity(id uuid primary key default gen_random_uuid(),bid_id uuid references public.bids(id) on delete restrict,details jsonb);
create table public.canonical_files(id uuid primary key,storage_bucket text,storage_path text,lifecycle_state text);
create table public.bid_file_relationships(bid_id uuid references public.bids(id) on delete restrict,file_id uuid references public.canonical_files(id) on delete restrict,relationship_state text,primary key(bid_id,file_id));
create table storage.objects(bucket_id text,name text,primary key(bucket_id,name));
grant select on storage.objects to postgres;
create table public.canonical_record_deletion_audit(id uuid primary key default gen_random_uuid(),record_type text,deleted_record_id uuid,actor_user_id uuid references public.app_users(user_id),deleted_at timestamptz default now(),dependency_counts jsonb);
insert into public.app_users values('${admin}','admin',true),('${member}','member',true);
insert into public.jobs values('20000000-0000-0000-0000-000000000001');insert into public.vendor_catalog values('catalog-1');
insert into public.bids values('${bid}','test_customer','test_bid'),('${otherBid}','other_customer','other_bid'),('10000000-0000-0000-0000-000000000003','fallback_customer','');
insert into public.samples values('30000000-0000-0000-0000-000000000001','${bid}','issued-sample-preserved');
insert into public.proposals values('40000000-0000-0000-0000-000000000001','{"issued":true}');
insert into public.bid_proposal_relationships(bid_id,proposal_id,linked_by_user_id)values('${bid}','40000000-0000-0000-0000-000000000001','${admin}');
insert into public.bid_updates(bid_id,body)values('${bid}','owned update');insert into public.bid_activity(bid_id,details)values('${bid}','{"structural":true}');
insert into public.canonical_files values('50000000-0000-0000-0000-000000000001','bid-files','exclusive','ready'),('50000000-0000-0000-0000-000000000002','bid-files','shared','ready');
insert into public.bid_file_relationships values('${bid}','50000000-0000-0000-0000-000000000001','active'),('${bid}','50000000-0000-0000-0000-000000000002','active'),('${otherBid}','50000000-0000-0000-0000-000000000002','active');
insert into storage.objects values('bid-files','exclusive'),('bid-files','shared');
`;

const tests=String.raw`
select set_config('request.jwt.claim.sub','${admin}',false);
do $$begin begin perform public.admin_permanently_delete_bid('${bid}','test_customer · test_bid');raise exception 'Legacy confirmation accepted';exception when invalid_parameter_value then null;end;if not exists(select 1 from public.bids where id='${bid}')then raise exception 'Wrong confirmation mutated Bid';end if;end$$;
select set_config('request.jwt.claim.sub','${member}',false);
do $$begin begin perform public.admin_permanently_delete_bid('${bid}','test_bid');raise exception 'Ordinary user deleted Bid';exception when insufficient_privilege then null;end;end$$;
select set_config('request.jwt.claim.sub','${admin}',false);
update public.bid_file_relationships set relationship_state='removal_pending' where bid_id='${bid}' and file_id='50000000-0000-0000-0000-000000000001';
delete from storage.objects where bucket_id='bid-files' and name='exclusive';
select public.admin_permanently_delete_bid('${bid}','test_bid');
do $$begin
 if exists(select 1 from public.bids where id='${bid}') or exists(select 1 from public.bid_updates where bid_id='${bid}') or exists(select 1 from public.bid_activity where bid_id='${bid}') or exists(select 1 from public.bid_file_relationships where bid_id='${bid}')then raise exception 'Bid-owned state survived';end if;
 if not exists(select 1 from public.samples where id='30000000-0000-0000-0000-000000000001' and bid_id is null and issued_marker='issued-sample-preserved')then raise exception 'Canonical Sample was not safely detached';end if;
 if not exists(select 1 from public.proposals where id='40000000-0000-0000-0000-000000000001' and issued_snapshot='{"issued":true}'::jsonb) or exists(select 1 from public.bid_proposal_relationships where proposal_id='40000000-0000-0000-0000-000000000001')then raise exception 'Canonical Proposal/history handling failed';end if;
 if exists(select 1 from public.canonical_files where storage_path='exclusive') or not exists(select 1 from public.canonical_files where storage_path='shared') or not exists(select 1 from storage.objects where name='shared') or not exists(select 1 from public.bid_file_relationships where bid_id='${otherBid}' and file_id='50000000-0000-0000-0000-000000000002')then raise exception 'File cleanup/shared-file safety failed';end if;
 if(select count(*) from public.jobs)<>1 or(select count(*) from public.vendor_catalog)<>1 or not exists(select 1 from public.bids where id='${otherBid}')then raise exception 'Unrelated canonical state changed';end if;
 if not exists(select 1 from public.canonical_record_deletion_audit where record_type='bid' and deleted_record_id='${bid}' and dependency_counts->>'samples_detached'='1')then raise exception 'Structural deletion audit missing';end if;
end$$;
select public.admin_permanently_delete_bid('10000000-0000-0000-0000-000000000003','DELETE');
`;

function run(args,input){const result=spawnSync('docker',args,{input,encoding:'utf8'});if(result.status!==0)throw new Error(`${result.stdout}\n${result.stderr}`);return result.stdout;}
try{
 run(['run','--rm','-d','--name',name,'-e','POSTGRES_PASSWORD=postgres',image]);
 for(let attempt=0;attempt<40;attempt++){if(spawnSync('docker',['exec',name,'pg_isready','-U','postgres']).status===0)break;Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,250);if(attempt===39)throw new Error('Disposable PostgreSQL did not become ready.');}
 run(['exec','-e','PGPASSWORD=postgres','-i',name,'psql','-U','supabase_admin','-d','postgres','-v','ON_ERROR_STOP=1'],setup+migration+tests);
 console.log('Bid deletion runtime-fix checks passed.');
}finally{spawnSync('docker',['stop',name]);}
