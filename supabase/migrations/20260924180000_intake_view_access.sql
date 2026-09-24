-- Intake Under Development: all active roles may read; existing writers remain unchanged.

-- Prepared only. No hosted application authorized. No business-row mutation.

begin;

do $$begin if exists(select 1 from public.app_role_capabilities where capability='viewIntake') then raise exception 'viewIntake already exists; review installed authorization';end if; if (select array_agg(role::text order by role::text) from public.app_role_capabilities where capability='accessIntake') is distinct from array['admin','developer']::text[] then raise exception 'Intake writer matrix drift';end if;end$$;

insert into public.app_role_capabilities(role,capability) values ('admin','viewIntake'),('developer','viewIntake'),('lead','viewIntake'),('member','viewIntake'),('guest','viewIntake');

do $$begin if not exists(select 1 from pg_policies where schemaname='public' and tablename='bid_updates' and policyname='intake_early_access' and permissive='RESTRICTIVE' and cmd='ALL' and roles=array['authenticated']::name[] and qual='has_app_capability(''accessIntake''::text)' and with_check='has_app_capability(''accessIntake''::text)') then raise exception 'Intake policy drift: public.bid_updates';end if;end$$;

drop policy intake_early_access on public.bid_updates;

create policy intake_view on public.bid_updates as restrictive for select to authenticated using (has_app_capability('viewIntake'::text));

create policy intake_manage_insert on public.bid_updates as restrictive for insert to authenticated with check (has_app_capability('accessIntake'::text));

create policy intake_manage_update on public.bid_updates as restrictive for update to authenticated using (has_app_capability('accessIntake'::text)) with check (has_app_capability('accessIntake'::text));

create policy intake_manage_delete on public.bid_updates as restrictive for delete to authenticated using (has_app_capability('accessIntake'::text));

do $$begin if not exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='intake_file_early_access' and permissive='RESTRICTIVE' and cmd='ALL' and roles=array['authenticated']::name[] and qual='((bucket_id <> ''bid-files''::text) OR has_app_capability(''accessIntake''::text))' and with_check='((bucket_id <> ''bid-files''::text) OR has_app_capability(''accessIntake''::text))') then raise exception 'Intake policy drift: storage.objects';end if;end$$;

drop policy intake_file_early_access on storage.objects;

create policy intake_view on storage.objects as restrictive for select to authenticated using (((bucket_id <> 'bid-files'::text) OR has_app_capability('viewIntake'::text)));

create policy intake_manage_insert on storage.objects as restrictive for insert to authenticated with check (((bucket_id <> 'bid-files'::text) OR has_app_capability('accessIntake'::text)));

create policy intake_manage_update on storage.objects as restrictive for update to authenticated using (((bucket_id <> 'bid-files'::text) OR has_app_capability('accessIntake'::text))) with check (((bucket_id <> 'bid-files'::text) OR has_app_capability('accessIntake'::text)));

create policy intake_manage_delete on storage.objects as restrictive for delete to authenticated using (((bucket_id <> 'bid-files'::text) OR has_app_capability('accessIntake'::text)));

do $$begin if not exists(select 1 from pg_policies where schemaname='public' and tablename='bids' and policyname='intake_early_access' and permissive='RESTRICTIVE' and cmd='ALL' and roles=array['authenticated']::name[] and qual='has_app_capability(''accessIntake''::text)' and with_check='has_app_capability(''accessIntake''::text)') then raise exception 'Intake policy drift: public.bids';end if;end$$;

drop policy intake_early_access on public.bids;

create policy intake_view on public.bids as restrictive for select to authenticated using (has_app_capability('viewIntake'::text));

create policy intake_manage_insert on public.bids as restrictive for insert to authenticated with check (has_app_capability('accessIntake'::text));

create policy intake_manage_update on public.bids as restrictive for update to authenticated using (has_app_capability('accessIntake'::text)) with check (has_app_capability('accessIntake'::text));

create policy intake_manage_delete on public.bids as restrictive for delete to authenticated using (has_app_capability('accessIntake'::text));

do $$begin if not exists(select 1 from pg_policies where schemaname='public' and tablename='canonical_files' and policyname='intake_file_early_access' and permissive='RESTRICTIVE' and cmd='ALL' and roles=array['authenticated']::name[] and qual='((storage_bucket <> ''bid-files''::text) OR has_app_capability(''accessIntake''::text))' and with_check='((storage_bucket <> ''bid-files''::text) OR has_app_capability(''accessIntake''::text))') then raise exception 'Intake policy drift: public.canonical_files';end if;end$$;

drop policy intake_file_early_access on public.canonical_files;

create policy intake_view on public.canonical_files as restrictive for select to authenticated using (((storage_bucket <> 'bid-files'::text) OR has_app_capability('viewIntake'::text)));

create policy intake_manage_insert on public.canonical_files as restrictive for insert to authenticated with check (((storage_bucket <> 'bid-files'::text) OR has_app_capability('accessIntake'::text)));

create policy intake_manage_update on public.canonical_files as restrictive for update to authenticated using (((storage_bucket <> 'bid-files'::text) OR has_app_capability('accessIntake'::text))) with check (((storage_bucket <> 'bid-files'::text) OR has_app_capability('accessIntake'::text)));

create policy intake_manage_delete on public.canonical_files as restrictive for delete to authenticated using (((storage_bucket <> 'bid-files'::text) OR has_app_capability('accessIntake'::text)));

do $$begin if not exists(select 1 from pg_policies where schemaname='public' and tablename='bid_file_relationships' and policyname='intake_early_access' and permissive='RESTRICTIVE' and cmd='ALL' and roles=array['authenticated']::name[] and qual='has_app_capability(''accessIntake''::text)' and with_check='has_app_capability(''accessIntake''::text)') then raise exception 'Intake policy drift: public.bid_file_relationships';end if;end$$;

drop policy intake_early_access on public.bid_file_relationships;

create policy intake_view on public.bid_file_relationships as restrictive for select to authenticated using (has_app_capability('viewIntake'::text));

create policy intake_manage_insert on public.bid_file_relationships as restrictive for insert to authenticated with check (has_app_capability('accessIntake'::text));

create policy intake_manage_update on public.bid_file_relationships as restrictive for update to authenticated using (has_app_capability('accessIntake'::text)) with check (has_app_capability('accessIntake'::text));

create policy intake_manage_delete on public.bid_file_relationships as restrictive for delete to authenticated using (has_app_capability('accessIntake'::text));

do $$begin if not exists(select 1 from pg_policies where schemaname='public' and tablename='bid_activity' and policyname='intake_early_access' and permissive='RESTRICTIVE' and cmd='ALL' and roles=array['authenticated']::name[] and qual='has_app_capability(''accessIntake''::text)' and with_check='has_app_capability(''accessIntake''::text)') then raise exception 'Intake policy drift: public.bid_activity';end if;end$$;

drop policy intake_early_access on public.bid_activity;

create policy intake_view on public.bid_activity as restrictive for select to authenticated using (has_app_capability('viewIntake'::text));

create policy intake_manage_insert on public.bid_activity as restrictive for insert to authenticated with check (has_app_capability('accessIntake'::text));

create policy intake_manage_update on public.bid_activity as restrictive for update to authenticated using (has_app_capability('accessIntake'::text)) with check (has_app_capability('accessIntake'::text));

create policy intake_manage_delete on public.bid_activity as restrictive for delete to authenticated using (has_app_capability('accessIntake'::text));

do $$begin if not exists(select 1 from pg_policies where schemaname='public' and tablename='bid_proposal_relationships' and policyname='intake_early_access' and permissive='RESTRICTIVE' and cmd='ALL' and roles=array['authenticated']::name[] and qual='has_app_capability(''accessIntake''::text)' and with_check='has_app_capability(''accessIntake''::text)') then raise exception 'Intake policy drift: public.bid_proposal_relationships';end if;end$$;

drop policy intake_early_access on public.bid_proposal_relationships;

create policy intake_view on public.bid_proposal_relationships as restrictive for select to authenticated using (has_app_capability('viewIntake'::text));

create policy intake_manage_insert on public.bid_proposal_relationships as restrictive for insert to authenticated with check (has_app_capability('accessIntake'::text));

create policy intake_manage_update on public.bid_proposal_relationships as restrictive for update to authenticated using (has_app_capability('accessIntake'::text)) with check (has_app_capability('accessIntake'::text));

create policy intake_manage_delete on public.bid_proposal_relationships as restrictive for delete to authenticated using (has_app_capability('accessIntake'::text));

do $guard$declare definition text;begin select pg_get_functiondef('list_bid_activity(uuid)'::regprocedure) into definition; if md5(regexp_replace(definition, '\s', '', 'g')) <> '8e2d946209e6e229cd3563efc9d16bd9' then raise exception 'Intake reader drift: list_bid_activity(uuid)';end if; execute replace(definition, '''accessIntake''', '''viewIntake''');end $guard$;

do $guard$declare definition text;begin select pg_get_functiondef('list_bid_updates(uuid)'::regprocedure) into definition; if md5(regexp_replace(definition, '\s', '', 'g')) <> '1a6af2c1d33733dd6308ec5f2b42bbd5' then raise exception 'Intake reader drift: list_bid_updates(uuid)';end if; execute replace(definition, '''accessIntake''', '''viewIntake''');end $guard$;

do $guard$declare definition text;begin select pg_get_functiondef('list_bid_files(uuid)'::regprocedure) into definition; if md5(regexp_replace(definition, '\s', '', 'g')) <> 'ff1ce674532c68b80625e8e9eaa7713f' then raise exception 'Intake reader drift: list_bid_files(uuid)';end if; execute replace(definition, '''accessIntake''', '''viewIntake''');end $guard$;

do $guard$declare definition text;begin select pg_get_functiondef('list_samples(uuid)'::regprocedure) into definition; if md5(regexp_replace(definition, '\s', '', 'g')) <> '883bbead90f47280f7679c516250d0e1' then raise exception 'Intake reader drift: list_samples(uuid)';end if; execute replace(definition, '''accessIntake''', '''viewIntake''');end $guard$;

do $guard$declare definition text;begin select pg_get_functiondef('list_bid_owners()'::regprocedure) into definition; if md5(regexp_replace(definition, '\s', '', 'g')) <> '677cd4ccac23f8feb72b168c25ad486a' then raise exception 'Intake reader drift: list_bid_owners()';end if; execute replace(definition, '''accessIntake''', '''viewIntake''');end $guard$;

do $guard$declare definition text;begin select pg_get_functiondef('list_bids()'::regprocedure) into definition; if md5(regexp_replace(definition, '\s', '', 'g')) <> '01d92178cbb9d4d320de20adf9f3d0e7' then raise exception 'Intake reader drift: list_bids()';end if; execute replace(definition, '''accessIntake''', '''viewIntake''');end $guard$;

-- Write RPC bodies/grants, conversion gates, deletion authority and bucket privacy are unchanged.

commit;
