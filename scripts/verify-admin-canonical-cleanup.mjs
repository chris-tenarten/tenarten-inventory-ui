import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const name = `tenops-admin-cleanup-${process.pid}`;
const image = "public.ecr.aws/supabase/postgres:17.6.1.143";
const migration = readFileSync("supabase/migrations/20260901_004_admin_canonical_cleanup.sql", "utf8");
const admin = "00000000-0000-0000-0000-000000000001";
const member = "00000000-0000-0000-0000-000000000002";
const bid = "10000000-0000-0000-0000-000000000001";
const otherBid = "10000000-0000-0000-0000-000000000002";
const safeJob = "20000000-0000-0000-0000-000000000001";
const blockedJob = "20000000-0000-0000-0000-000000000002";
const setup = String.raw`
create schema if not exists auth; create schema if not exists storage;
create table public.app_users(user_id uuid primary key,display_name text not null,role text not null,is_active boolean not null default true);
create function public.require_app_capability(capability text) returns void language plpgsql security definer as $$ begin if capability<>'manageUsers' or not exists(select 1 from public.app_users where user_id=auth.uid() and role='admin' and is_active) then raise exception 'Access denied.' using errcode='42501'; end if; end $$;
create table public.jobs(id uuid primary key,name text not null,job_number text);
create table public.bids(id uuid primary key,customer text not null,project_name text not null,creator_user_id uuid,owner_user_id uuid,status text,created_at timestamptz default now());
create table public.bid_updates(id uuid primary key default gen_random_uuid(),bid_id uuid,body text);
create table public.bid_activity(id uuid primary key default gen_random_uuid(),bid_id uuid,details jsonb);
create table public.canonical_files(id uuid primary key,storage_bucket text,storage_path text,lifecycle_state text,original_filename text);
create table public.bid_file_relationships(bid_id uuid,file_id uuid,relationship_state text,primary key(bid_id,file_id));
create table storage.objects(bucket_id text,name text,metadata jsonb,primary key(bucket_id,name));
create table public.job_attachments(id uuid primary key default gen_random_uuid(),job_id uuid,storage_path text);
create table public.job_activity(id uuid primary key default gen_random_uuid(),job_id uuid);
create table public.job_update_seen_state(id uuid primary key default gen_random_uuid(),job_id uuid);
create table public.planning_phases(id uuid primary key default gen_random_uuid(),job_id uuid);
create table public.manpower_entries(id uuid primary key default gen_random_uuid(),job_id uuid);
create table public.production_rework_cycles(id uuid primary key default gen_random_uuid(),job_id uuid);
create table public.purchase_orders(id uuid primary key default gen_random_uuid(),production_job_id uuid);
create table public.chip_purchase_order_line_details(id uuid primary key default gen_random_uuid(),production_job_id uuid);
create table public.pending_receivals(id uuid primary key default gen_random_uuid(),production_job_id uuid);
create table public.receiving_documents(id uuid primary key default gen_random_uuid(),suggested_production_job_id uuid);
create table public.receiving_document_lines(id uuid primary key default gen_random_uuid(),production_job_id uuid);
create table public.inventory_items(id uuid primary key default gen_random_uuid(),production_job_id uuid);
create table public.inventory_transactions(id uuid primary key default gen_random_uuid(),production_job_id uuid);
create table public.material_usage_reports(id uuid primary key default gen_random_uuid(),job_id uuid);
create table public.job_document_numbers(id uuid primary key default gen_random_uuid(),job_id uuid);
create table public.job_transmittals(id uuid primary key default gen_random_uuid(),job_id uuid);
create table public.proposals(id uuid primary key default gen_random_uuid(),job_id uuid);
create table public.job_updates(id uuid primary key default gen_random_uuid(),job_id uuid);
create table public.my_work_messages(id uuid primary key default gen_random_uuid(),job_id uuid);
create table public.project_tasks(id uuid primary key default gen_random_uuid(),job_id uuid);
insert into public.app_users values('${admin}','Admin','admin',true),('${member}','Member','member',true);
`;
const tests = String.raw`
\set ON_ERROR_STOP on
insert into public.bids(id,customer,project_name,creator_user_id,owner_user_id,status) values('${bid}','Acme','Lobby','${admin}','${admin}','active'),('${otherBid}','Other','Shared','${admin}','${admin}','active');
insert into public.bid_updates(bid_id,body) values('${bid}','sensitive update');
insert into public.bid_activity(bid_id,details) values('${bid}','{"notes":"sensitive"}');
insert into public.canonical_files values('30000000-0000-0000-0000-000000000001','bid-files','exclusive','ready','secret.pdf'),('30000000-0000-0000-0000-000000000002','bid-files','shared','ready','shared.pdf');
insert into public.bid_file_relationships values('${bid}','30000000-0000-0000-0000-000000000001','active'),('${bid}','30000000-0000-0000-0000-000000000002','active'),('${otherBid}','30000000-0000-0000-0000-000000000002','active');
insert into storage.objects values('bid-files','exclusive','{}'),('bid-files','shared','{}');
select set_config('request.jwt.claim.sub','${member}',false);
do $$ begin perform public.prepare_admin_delete_bid('${bid}'); raise exception 'member unexpectedly authorized'; exception when insufficient_privilege then null; end $$;
select set_config('request.jwt.claim.sub','${admin}',false);
select * from public.prepare_admin_delete_bid('${bid}');
delete from storage.objects where bucket_id='bid-files' and name='exclusive';
select public.admin_permanently_delete_bid('${bid}','Acme · Lobby');
do $$ begin if exists(select 1 from public.bids where id='${bid}') or exists(select 1 from public.bid_updates where bid_id='${bid}') or exists(select 1 from public.bid_activity where bid_id='${bid}') then raise exception 'Bid-owned state survived'; end if; if not exists(select 1 from public.canonical_files where storage_path='shared') or not exists(select 1 from storage.objects where name='shared') then raise exception 'Shared file was removed'; end if; end $$;
insert into public.jobs values('${safeJob}','Disposable','T-1'),('${blockedJob}','Historical','T-2');
insert into public.job_activity(job_id) values('${safeJob}'); insert into public.job_update_seen_state(job_id) values('${safeJob}'); insert into public.job_attachments(job_id,storage_path) values('${safeJob}','safe/attachment'); insert into storage.objects values('job-attachments','safe/attachment','{}');
insert into public.manpower_entries(job_id) values('${blockedJob}'); insert into public.job_updates(job_id) values('${blockedJob}');
select set_config('request.jwt.claim.sub','${member}',false);
do $$ begin perform public.preflight_admin_delete_production_job('${safeJob}'); raise exception 'member unexpectedly authorized'; exception when insufficient_privilege then null; end $$;
select set_config('request.jwt.claim.sub','${admin}',false);
do $$ declare result record; begin select * into result from public.preflight_admin_delete_production_job('${blockedJob}'); if result.eligible or jsonb_array_length(result.blockers)<>2 then raise exception 'Protected Job preflight failed'; end if; begin perform public.admin_permanently_delete_production_job('${blockedJob}','T-2'); raise exception 'Protected Job deleted'; exception when object_not_in_prerequisite_state then null; end; if not exists(select 1 from public.jobs where id='${blockedJob}') or not exists(select 1 from public.manpower_entries where job_id='${blockedJob}') then raise exception 'Blocked deletion mutated history'; end if; end $$;
select * from public.prepare_admin_delete_production_job('${safeJob}'); delete from storage.objects where bucket_id='job-attachments' and name='safe/attachment'; select public.admin_permanently_delete_production_job('${safeJob}','T-1');
do $$ begin if exists(select 1 from public.jobs where id='${safeJob}') or exists(select 1 from public.job_attachments where job_id='${safeJob}') or exists(select 1 from public.job_activity where job_id='${safeJob}') then raise exception 'Safe Job state survived'; end if; if (select count(*) from public.canonical_record_deletion_audit)<>2 then raise exception 'Deletion audit missing'; end if; if exists(select 1 from public.canonical_record_deletion_audit where dependency_counts::text ~* 'sensitive|secret|acme|lobby') then raise exception 'Audit retained content'; end if; end $$;
select 'admin canonical cleanup verifier passed' as result;
`;

function run(args, input) { const result=spawnSync("docker",args,{input,encoding:"utf8"}); if(result.status!==0)throw new Error(`${result.stdout}\n${result.stderr}`); return result.stdout; }
try {
  run(["run","--rm","-d","--name",name,"-e","POSTGRES_PASSWORD=postgres",image]);
  for(let attempt=0;attempt<40;attempt++){const ready=spawnSync("docker",["exec",name,"pg_isready","-U","postgres"],{encoding:"utf8"});if(ready.status===0)break;Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,250);if(attempt===39)throw new Error("Disposable PostgreSQL did not become ready.");}
  run(["exec","-i",name,"psql","-U","postgres","-d","postgres","-v","ON_ERROR_STOP=1"],setup+migration+tests);
  console.log("admin canonical cleanup verifier passed");
} finally { spawnSync("docker",["stop",name],{encoding:"utf8"}); }
