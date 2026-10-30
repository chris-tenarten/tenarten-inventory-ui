-- Prepared only: safe Cron/pg_net wake authentication for original expiry cleanup.
-- No schedule, secret, activation, source deletion or business mutation is installed.
-- Existing source-retention migrations and their immutable guards stay unchanged.
begin;
set local lock_timeout='3s';set local statement_timeout='20s';

do $preflight$ begin
 if to_regprocedure('public.claim_expired_invoice_receival_sources(integer)') is null
  or to_regprocedure('public.finish_expired_invoice_receival_source_removal(uuid)') is null then raise exception 'Validated original-source expiry contracts required.';end if;
 if not exists(select 1 from pg_extension where extname='pg_net') or to_regclass('vault.secrets') is null
  or to_regprocedure('extensions.hmac(bytea,bytea,text)') is null then raise exception 'Existing pg_net, Vault and pgcrypto infrastructure required.';end if;
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

create function public.dispatch_invoice_source_cleanup() returns bigint language plpgsql security definer set search_path=pg_catalog,public as $$
declare secret text;gateway text;payload text;run uuid:=gen_random_uuid();expiry bigint;signature text;request bigint;limit_count constant integer:=20;
begin
 perform pg_advisory_xact_lock(761030,2000);
 perform 1 from public.invoice_receival_cleanup_control where singleton and enabled for share;
 if not found then return null;end if;
 -- Do not queue overlapping work. Interrupted consumed runs are never replayed;
 -- a fresh signed run can reconcile the source cleanup protocol after its lease.
 if exists(select 1 from public.invoice_receival_cleanup_runs where status='queued' and expires_at>=extract(epoch from clock_timestamp()) or status='running' and consumed_at>clock_timestamp()-interval '100 seconds') then return null;end if;
 select decrypted_secret into strict secret from vault.decrypted_secrets where name='tenbot_receival_cleanup_wake';
 select decrypted_secret into strict gateway from vault.decrypted_secrets where name='tenbot_receival_cleanup_gateway_jwt';
 if length(secret) not between 32 and 256 or secret ~ '[[:cntrl:]]' or length(gateway)<32 then raise exception 'Cleanup wake configuration unavailable.';end if;
 payload:=translate(split_part(gateway,'.',2),'-_','+/');
 if (convert_from(decode(rpad(payload,((length(payload)+3)/4)*4,'='),'base64'),'UTF8')::jsonb->>'role') is distinct from 'anon' then raise exception 'Cleanup gateway must use public anon JWT, never service_role.';end if;
 expiry:=floor(extract(epoch from clock_timestamp()))::bigint+60;
 signature:=encode(extensions.hmac(convert_to('v1'||E'\n'||'invoice-original-expiry'||E'\n'||run::text||E'\n'||expiry::text||E'\n'||limit_count::text,'UTF8'),convert_to(secret,'UTF8'),'sha256'),'hex');
 insert into public.invoice_receival_cleanup_runs(id,request_limit,expires_at) values(run,limit_count,expiry);
 request:=net.http_post(url:='https://vxdxjhazkqhpkwdqtobp.supabase.co/functions/v1/tenbot-receival-cleanup',
  headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||gateway),
  body:=jsonb_build_object('v',1,'purpose','invoice-original-expiry','run_id',run,'exp',expiry,'limit',limit_count,'sig',signature),timeout_milliseconds:=100000);
 update public.invoice_receival_cleanup_runs set request_id=request where id=run;
 -- Count-only maintenance metadata, not invoice originals or business history.
 delete from public.invoice_receival_cleanup_runs where created_at<clock_timestamp()-interval '30 days' and status<>'running';
 return request;
end $$;
revoke all on function public.dispatch_invoice_source_cleanup() from public,anon,authenticated,service_role;
comment on table public.invoice_receival_cleanup_runs is 'Private count-only one-use cleanup wakes. No credentials, filenames, source paths, employee content or model history. A consumed failed/cancelled wake cannot be replayed; fresh signed dispatch retries source cleanup safely.';
comment on table public.invoice_receival_cleanup_control is 'Default-off private cleanup control. Enabling requires separate reviewed configuration; no application mutator, Cron creation or global permission change.';
notify pgrst,'reload schema';
commit;
