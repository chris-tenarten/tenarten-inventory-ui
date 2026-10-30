-- PREPARED ONLY: fixed standalone FREE fixture jltgxcfiprocydhbrahz; root review before execution.
-- Dispatcher DDL/pg_net/Vault preflight omitted; credential-query guard unchanged.
-- Prepared only: safe Cron/pg_net wake authentication for original expiry cleanup.
-- No schedule, secret, activation, source deletion or business mutation is installed.
-- Existing source-retention migrations and their immutable guards stay unchanged.
begin;
set local lock_timeout='3s';set local statement_timeout='20s';

do $preflight$ begin
 if to_regprocedure('public.claim_expired_invoice_receival_sources(integer)') is null
  or to_regprocedure('public.finish_expired_invoice_receival_source_removal(uuid)') is null then raise exception 'Validated original-source expiry contracts required.';end if;

end $preflight$;

create table public.invoice_receival_cleanup_control(
 singleton boolean primary key default true check(singleton),
 enabled boolean not null default false
);
insert into public.invoice_receival_cleanup_control(singleton,enabled) values(true,false);
create table public.invoice_receival_cleanup_runs(
 id uuid primary key default gen_random_uuid(),
 purpose text not null default 'invoice-original-expiry' check(purpose='invoice-original-expiry'),
 request_limit integer not null check(request_limit between 1 and 20),
 expires_at bigint not null,
 created_at timestamptz not null default clock_timestamp(),
 request_id bigint,
 consumed_at timestamptz,
 finished_at timestamptz,
 status text not null default 'queued' check(status in('queued','running','succeeded','failed','cancelled')),
 removed_count integer check(removed_count between 0 and 20),
 check(removed_count is null or removed_count<=request_limit),
 check(status<>'queued' or consumed_at is null and finished_at is null),
 check(status<>'running' or consumed_at is not null and finished_at is null),
 check(status<>'succeeded' or consumed_at is not null and finished_at is not null and removed_count is not null)
);
create index invoice_cleanup_recent on public.invoice_receival_cleanup_runs(created_at desc);
alter table public.invoice_receival_cleanup_control enable row level security;
alter table public.invoice_receival_cleanup_runs enable row level security;
revoke all on public.invoice_receival_cleanup_control,public.invoice_receival_cleanup_runs from public,anon,authenticated,service_role;

-- A captured queued request grants only this run/expiry/limit and can be consumed
-- once. The service credential never enters pg_net headers, bodies or job text.
create function public.consume_invoice_receival_cleanup_run(p_id uuid,p_exp bigint,p_limit integer) returns boolean language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Cleanup run consumption is server-only.' using errcode='42501';end if;
 perform 1 from public.invoice_receival_cleanup_control where singleton and enabled for share;
 if not found then return false;end if;
 update public.invoice_receival_cleanup_runs set consumed_at=clock_timestamp(),status='running'
 where id=p_id and purpose='invoice-original-expiry' and request_limit=p_limit and expires_at=p_exp
  and status='queued' and consumed_at is null and p_exp>=extract(epoch from clock_timestamp())
  and p_exp<=extract(epoch from clock_timestamp())+120;
 return found;
end $$;

create function public.finish_invoice_receival_cleanup_run(p_id uuid,p_status text,p_removed_count integer) returns boolean language plpgsql security definer set search_path=pg_catalog,public as $$
declare run public.invoice_receival_cleanup_runs;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Cleanup run completion is server-only.' using errcode='42501';end if;
 if p_status is null or p_status not in('succeeded','failed','cancelled') or p_status='succeeded' and (p_removed_count is null or p_removed_count not between 0 and 20) or p_status<>'succeeded' and p_removed_count is not null then raise exception 'Bounded count-only cleanup status required.' using errcode='22023';end if;
 select * into run from public.invoice_receival_cleanup_runs where id=p_id and consumed_at is not null for update;
 if not found then return false;end if;
 if run.status in('succeeded','failed','cancelled') then return run.status=p_status and run.removed_count is not distinct from p_removed_count;end if;
 if run.status<>'running' or p_removed_count>run.request_limit then return false;end if;
 update public.invoice_receival_cleanup_runs set status=p_status,removed_count=p_removed_count,finished_at=clock_timestamp() where id=run.id;
 return true;
end $$;
revoke all on function public.consume_invoice_receival_cleanup_run(uuid,bigint,integer),public.finish_invoice_receival_cleanup_run(uuid,text,integer) from public,anon,authenticated,service_role;
grant execute on function public.consume_invoice_receival_cleanup_run(uuid,bigint,integer),public.finish_invoice_receival_cleanup_run(uuid,text,integer) to service_role;

-- Private operator cancellation is only for unconsumed wakes. In-flight network
-- requests cannot be undone; handler abort/deadline stops later operations and a
-- fresh signed run safely reconciles existing deleting sources on the next pass.
create function public.cancel_invoice_receival_cleanup_run(p_id uuid) returns boolean language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 update public.invoice_receival_cleanup_runs set status='cancelled',finished_at=clock_timestamp()
 where id=p_id and status='queued' and consumed_at is null;
 return found;
end $$;
revoke all on function public.cancel_invoice_receival_cleanup_run(uuid) from public,anon,authenticated,service_role;

comment on table public.invoice_receival_cleanup_runs is 'Private count-only one-use cleanup wakes. No credentials, filenames, source paths, employee content or model history. A consumed failed/cancelled wake cannot be replayed; fresh signed dispatch retries source cleanup safely.';
comment on table public.invoice_receival_cleanup_control is 'Default-off private cleanup control. Enabling requires separate reviewed configuration; no application mutator, Cron creation or global permission change.';
notify pgrst,'reload schema';
-- PREPARED, NOT EXECUTED. Isolated Free fixture jltgxcfiprocydhbrahz ONLY.
-- Uses exact 20261030200000 ledger/control DDL; dispatcher definition omitted.
-- Dispatcher source and SQL/Node HMAC vector checked separately, never invoked.
-- pg_net/Vault preflight excluded here because this only tests ledger/control DDL.
-- No HTTP dispatcher invocation, Vault values, schedule changes, Storage DELETE,
-- Inventory writes, migration-ledger writes, or persistent DDL. Always ROLLBACK.
create temporary table cleanup_check_results(name text primary key) on commit drop;
create function pg_temp.cleanup_check(ok boolean,label text) returns void language plpgsql as $$begin
 if ok is distinct from true then raise exception 'Cleanup rollback verifier failed: %',label;end if;
 insert into cleanup_check_results values(label);
end $$;
create function pg_temp.cleanup_cron_state() returns text language plpgsql as $$declare value text;begin
 if to_regclass('cron.job') is null then return 'cron-absent';end if;
 execute $q$select md5(coalesce(string_agg(format('%s|%s|%s|%s',jobid,jobname,schedule,active),'' order by jobid),'')) from cron.job$q$ into value;return value;
end $$;
create function pg_temp.cleanup_migration_state() returns text language plpgsql as $$declare value text;begin
 if to_regclass('supabase_migrations.schema_migrations') is null then return 'migration-ledger-absent';end if;
 execute $q$select md5(coalesce(string_agg(version,'' order by version),'')) from supabase_migrations.schema_migrations$q$ into value;return value;
end $$;
create temporary table cleanup_prior_state on commit drop as
select
 (select md5(coalesce(string_agg(md5(to_jsonb(s)::text),'' order by s.id),'')) from public.invoice_receival_sources s) source_hash,
 (select md5(coalesce(string_agg(md5(to_jsonb(s)::text),'' order by s.draft_id),'')) from public.invoice_receival_source_bindings s) binding_hash,
 (select md5(coalesce(string_agg(md5(to_jsonb(s)::text),'' order by s.id),'')) from storage.objects s where bucket_id='invoice-receival-originals') object_hash,
 pg_temp.cleanup_cron_state() cron_hash,
 pg_temp.cleanup_migration_state() migration_hash;
select pg_temp.cleanup_check(not exists(select 1 from public.invoice_receival_cleanup_control where enabled),'default OFF');
select pg_temp.cleanup_check(encode(extensions.hmac(convert_to(E'v1\ninvoice-original-expiry\nb0000000-0000-4000-8000-000000000002\n1793394060\n20','UTF8'),convert_to('synthetic-cleanup-signing-value-for-offline-tests-only','UTF8'),'sha256'),'hex')='62b5ab5c74e6f41510ef2afd7179691e81f229ef781e77a0d1006a691da0a99f','SQL HMAC matches real Node/WebCrypto vector');
do $$declare r text;t text;f text;begin
 foreach r in array array['anon','authenticated','service_role'] loop
  foreach t in array array['invoice_receival_cleanup_control','invoice_receival_cleanup_runs'] loop
   if has_table_privilege(r,'public.'||t,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') then raise exception 'Unexpected private cleanup table grant';end if;
  end loop;
 end loop;
 foreach r in array array['anon','authenticated'] loop
  foreach f in array array['consume_invoice_receival_cleanup_run(uuid,bigint,integer)','finish_invoice_receival_cleanup_run(uuid,text,integer)','cancel_invoice_receival_cleanup_run(uuid)'] loop
   if has_function_privilege(r,'public.'||f,'EXECUTE') then raise exception 'Unexpected cleanup routine grant';end if;
  end loop;
 end loop;
 if has_function_privilege('service_role','public.cancel_invoice_receival_cleanup_run(uuid)','EXECUTE') then raise exception 'Service role must not cancel';end if;
 if not has_function_privilege('service_role','public.consume_invoice_receival_cleanup_run(uuid,bigint,integer)','EXECUTE') or not has_function_privilege('service_role','public.finish_invoice_receival_cleanup_run(uuid,text,integer)','EXECUTE') then raise exception 'Missing narrow service RPC grants';end if;
 perform pg_temp.cleanup_check(true,'private tables and narrowly granted RPCs');
end $$;
-- Real SET ROLE privilege checks; these are synthetic JWT-claim GUCs, not
-- another signed HTTP/JWT/RLS validation campaign (reuse accepted fixture proof).
set local role authenticated;
do $$begin
 begin perform 1 from public.invoice_receival_cleanup_runs;raise exception 'Authenticated table read unexpectedly allowed';exception when insufficient_privilege then null;end;
 begin perform public.consume_invoice_receival_cleanup_run(gen_random_uuid(),0,1);raise exception 'Authenticated consume unexpectedly allowed';exception when insufficient_privilege then null;end;
end $$;
reset role;
select pg_temp.cleanup_check(true,'actual authenticated direct table/RPC denial');
set local role service_role;
select set_config('request.jwt.claims','{"role":"authenticated"}',true);
select set_config('request.jwt.claim.role','authenticated',true);
do $$begin
 begin perform public.consume_invoice_receival_cleanup_run(gen_random_uuid(),0,1);raise exception 'Wrong server claim unexpectedly allowed';exception when insufficient_privilege then null;end;
end $$;
reset role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select set_config('request.jwt.claim.role','service_role',true);
select pg_temp.cleanup_check(true,'server grant alone cannot bypass role-claim check');
do $$declare rid uuid:=gen_random_uuid();expiry bigint:=floor(extract(epoch from clock_timestamp()))::bigint+60;begin
 insert into public.invoice_receival_cleanup_runs(id,request_limit,expires_at) values(rid,2,expiry);
 if public.consume_invoice_receival_cleanup_run(rid,expiry,2) then raise exception 'Default-OFF consume allowed';end if;
 update public.invoice_receival_cleanup_control set enabled=true where singleton;
 if public.consume_invoice_receival_cleanup_run(rid,expiry,1) or public.consume_invoice_receival_cleanup_run(rid,expiry+1,2) or public.consume_invoice_receival_cleanup_run(gen_random_uuid(),expiry,2) then raise exception 'Mismatched exact binding consumed';end if;
 if not public.consume_invoice_receival_cleanup_run(rid,expiry,2) or public.consume_invoice_receival_cleanup_run(rid,expiry,2) then raise exception 'Consume not single-use';end if;
 if public.cancel_invoice_receival_cleanup_run(rid) then raise exception 'Already consumed cancellation allowed';end if;
 if public.finish_invoice_receival_cleanup_run(rid,'succeeded',3) then raise exception 'Out-of-limit count accepted';end if;
 if not public.finish_invoice_receival_cleanup_run(rid,'succeeded',2) or not public.finish_invoice_receival_cleanup_run(rid,'succeeded',2) or public.finish_invoice_receival_cleanup_run(rid,'failed',null) then raise exception 'Terminal receipt not immutable/idempotent';end if;
 perform pg_temp.cleanup_check(true,'exact binding, atomic consume/replay, bounded idempotent finish');
end $$;
do $$declare rid uuid;expiry bigint;begin
 foreach expiry in array array[floor(extract(epoch from clock_timestamp()))::bigint-1,floor(extract(epoch from clock_timestamp()))::bigint+121] loop
  rid:=gen_random_uuid();insert into public.invoice_receival_cleanup_runs(id,request_limit,expires_at) values(rid,20,expiry);
  if public.consume_invoice_receival_cleanup_run(rid,expiry,20) then raise exception 'Expired/distant future run consumed';end if;
 end loop;
 rid:=gen_random_uuid();expiry:=floor(extract(epoch from clock_timestamp()))::bigint+60;
 insert into public.invoice_receival_cleanup_runs(id,request_limit,expires_at) values(rid,20,expiry);
 if not public.cancel_invoice_receival_cleanup_run(rid) or public.consume_invoice_receival_cleanup_run(rid,expiry,20) then raise exception 'Cancelled queued run consumed';end if;
 rid:=gen_random_uuid();insert into public.invoice_receival_cleanup_runs(id,request_limit,expires_at) values(rid,20,expiry);
 update public.invoice_receival_cleanup_control set enabled=false where singleton;
 if public.consume_invoice_receival_cleanup_run(rid,expiry,20) then raise exception 'Revoked control consumed';end if;
 update public.invoice_receival_cleanup_control set enabled=true where singleton;
 perform pg_temp.cleanup_check(true,'expiry, queued cancellation and global revocation');
end $$;
do $$declare rid uuid;fresh uuid:=gen_random_uuid();expiry bigint:=floor(extract(epoch from clock_timestamp()))::bigint+60;outcome text;begin
 foreach outcome in array array['failed','cancelled'] loop
  rid:=gen_random_uuid();insert into public.invoice_receival_cleanup_runs(id,request_limit,expires_at) values(rid,20,expiry);
  if not public.consume_invoice_receival_cleanup_run(rid,expiry,20) then raise exception 'Initial failure-test consume denied';end if;
  if not public.finish_invoice_receival_cleanup_run(rid,outcome,null) or public.consume_invoice_receival_cleanup_run(rid,expiry,20) then raise exception 'Failure/cancel replay allowed';end if;
 end loop;
 -- Interrupted/uncertain consumed result remains running and cannot be replayed.
 rid:=gen_random_uuid();insert into public.invoice_receival_cleanup_runs(id,request_limit,expires_at) values(rid,20,expiry);
 if not public.consume_invoice_receival_cleanup_run(rid,expiry,20) or public.consume_invoice_receival_cleanup_run(rid,expiry,20) then raise exception 'Uncertain consumed run replayed';end if;
 insert into public.invoice_receival_cleanup_runs(id,request_limit,expires_at) values(fresh,20,expiry);
 if not public.consume_invoice_receival_cleanup_run(fresh,expiry,20) then raise exception 'Fresh retry nonce denied';end if;
 if not public.finish_invoice_receival_cleanup_run(fresh,'succeeded',0) then raise exception 'Fresh retry completion denied';end if;
 perform pg_temp.cleanup_check(true,'failed/cancelled/uncertain nonce cannot replay; fresh retry');
end $$;
select pg_temp.cleanup_check(
 (select source_hash from cleanup_prior_state)=(select md5(coalesce(string_agg(md5(to_jsonb(s)::text),'' order by s.id),'')) from public.invoice_receival_sources s)
 and (select binding_hash from cleanup_prior_state)=(select md5(coalesce(string_agg(md5(to_jsonb(s)::text),'' order by s.draft_id),'')) from public.invoice_receival_source_bindings s)
 and (select object_hash from cleanup_prior_state)=(select md5(coalesce(string_agg(md5(to_jsonb(s)::text),'' order by s.id),'')) from storage.objects s where bucket_id='invoice-receival-originals')
 and (select cron_hash from cleanup_prior_state)=pg_temp.cleanup_cron_state()
 and (select migration_hash from cleanup_prior_state)=pg_temp.cleanup_migration_state(),'sources, bindings, originals, unrelated jobs and applied ledger unchanged');
select jsonb_build_object('mode','isolated-real-postgresql-rollback-only','fixture','jltgxcfiprocydhbrahz','groupsPassed',count(*),'groups',jsonb_agg(name order by name),'newMigrationApplied',false,'httpOrStorageDeletion',false,'concurrency','not-tested-cross-connection-DDL-uncommitted') as result from cleanup_check_results;
rollback;
