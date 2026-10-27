// Focused disposable PostgreSQL fixture. Reuses canonical Sample/Blend migrations.
import {readFileSync} from 'node:fs';
import {startBlendDatabase} from './production-blend-database.mjs';
import {sql,docker,literal,json,admin,member} from './sample-batch-database.mjs';
export {sql,docker,literal,json,admin,member};
export const read=f=>readFileSync('supabase/migrations/'+f,'utf8');
export const migrations=['20261026100000_historical_sample_import.sql','20261026110000_bid_accepted_scope.sql','20261026120000_bid_scope_production_handoff.sql'];
export const asUser=(statement,id=admin,role='authenticated')=>`set role ${role};select set_config('request.jwt.claim.sub',${literal(id)},false);${statement}`;
export const value=(name,expression,id=admin,role='authenticated')=>sql(name,asUser('select '+expression,id,role)).split('\n').filter(v=>v!==id).join('\n');
export function startIntakeDatabase(name){
 startBlendDatabase(name);
 // Empty bootstrap Job/Bid placeholders are replaced with actual canonical definitions.
 sql(name,'drop table bids cascade;drop table jobs cascade;alter table app_users add column created_at timestamptz default now(),add column updated_at timestamptz default now();');
 sql(name,read('20260818_001_rbac_identity_infrastructure.sql').split('create or replace function public.get_my_app_user()')[0]+'commit;');
 for(const f of ['20260713_002_production_mvp_jobs.sql','20260716_002_atomic_production_schedule_batch.sql','20260901_001_preproduction_bids.sql','20260901_002_bid_operational_context.sql','20260901_003_bid_files.sql','20260713_003_job_attachments.sql','20260827_004_proposal_generator_v1.sql'])sql(name,read(f));
 sql(name,'alter table proposals alter column job_id drop not null;');
 // Relationship behavior is replayed from its real migration; unused creation paths resolve lazily.
 sql(name,read('20260902_002_bid_proposal_relationships.sql'));
 sql(name,read('20260901_004_admin_canonical_cleanup.sql'));
 sql(name,read('20260902_003_bid_delete_runtime_fix.sql'));
 sql(name,read('20260923220000_intake_projected_planning.sql'));
 const restriction=read('20261005120000_read_only_messaging_write.sql');
 sql(name,restriction.slice(restriction.indexOf('alter table public.app_users'),restriction.indexOf('create function public.get_my_app_access()')));
 const capability=read('20261005170000_production_blend_capability.sql');
 sql(name,capability.slice(capability.indexOf('alter table public.app_users'),capability.indexOf('drop function public.get_my_app_access()')));
 sql(name,`insert into app_role_capabilities select r,c from unnest(array['guest','member','lead','developer','admin']) r cross join unnest(array['accessIntake','viewIntake']) c on conflict do nothing;
 alter table samples add constraint intake_fixture_bid_fk foreign key(bid_id) references bids(id) on delete restrict;
 alter table samples add constraint intake_fixture_job_fk foreign key(job_id) references jobs(id) on delete restrict;
 create table inventory_items(id bigint generated always as identity primary key,vendor text,color text,size text,category text,quantity numeric,unit text,production_job_id uuid references jobs(id),temporary_job_label text,earmarked_for_job boolean default false);
 create table pending_receivals(id uuid primary key default gen_random_uuid(),vendor text,material_name text,size text,category text,quantity_expected numeric,quantity_received numeric,unit text,production_job_id uuid references jobs(id),temporary_job_label text,is_earmarked boolean default false,eta date,status text default 'pending');
 alter table inventory_items enable row level security;alter table pending_receivals enable row level security;
 grant select on inventory_items,pending_receivals,app_users,jobs to authenticated;
 create policy fixture_job_read on public.jobs for select to authenticated using(public.has_app_capability('readOperationalData'));
 create policy fixture_supply_read on inventory_items for select to authenticated using(public.has_app_capability('readOperationalData'));
 create policy fixture_supply_read on pending_receivals for select to authenticated using(public.has_app_capability('readOperationalData'));
 alter table storage.objects enable row level security;grant usage on schema storage to authenticated;grant select,insert,update,delete on storage.objects to authenticated;
 `);
 sql(name,read('20261006160000_sample_color_plate_validation.sql'));
 sql(name,read('20261006190000_sample_color_plate_allocation.sql'));
 for(const f of migrations)sql(name,read(f));
}
