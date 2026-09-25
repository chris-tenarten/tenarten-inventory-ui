-- PREPARED ONLY. Separate authorized operator action BEFORE the migration.
-- Exact unchanged, unconverted Gio training Bid only; never match by TEST name.
-- No Storage cleanup: inspection found no files. Any new dependency aborts.
begin;
lock table public.intake_training_workflows, public.bids, public.bid_activity,
 public.bid_updates, public.bid_file_relationships, public.bid_proposal_relationships,
 public.samples in share row exclusive mode;
do $cleanup$
declare target constant uuid := 'c6da2ea0-f6d0-4de2-a08f-d8c895291ac6';
 c record; occupied boolean; deleted integer;
begin
 if not exists(select 1 from public.intake_training_workflows where bid_id=target
  and owner_user_id='29bed5b3-2ed8-43aa-9af2-45578b00388e' and job_id is null)
 then raise exception 'Exact unconverted training registry missing or changed';end if;
 if (select md5(to_jsonb(b)::text) from public.bids b where id=target) is distinct from '37725445b1d1ffe014a27ecc8b2ed334'
 then raise exception 'Training Bid changed; review cleanup again';end if;
 if (select count(*) from public.bid_activity where bid_id=target)<>1 or
 (select md5(string_agg(to_jsonb(a)::text,'' order by id)) from public.bid_activity a where bid_id=target) is distinct from '14f32a19b54179ac594d53a4889cee9f'
 then raise exception 'Training activity changed; review cleanup again';end if;
 -- All foreign keys, including newly introduced CASCADE/SET NULL dependencies, fail closed.
 for c in select con.conrelid::regclass rel,a.attname,cardinality(con.conkey) width
 from pg_constraint con join pg_attribute a on a.attrelid=con.conrelid and a.attnum=con.conkey[1]
 where con.contype='f' and con.confrelid='public.bids'::regclass
 and con.conrelid not in ('public.intake_training_workflows'::regclass,'public.bid_activity'::regclass)
 loop
  if c.width<>1 then raise exception 'Unreviewed composite Bid dependency';end if;
  execute format('lock table %s in share row exclusive mode',c.rel);
  execute format('select exists(select 1 from %s where %I=$1)',c.rel,c.attname) into occupied using target;
  if occupied then raise exception 'Training Bid dependency in %; cleanup refused',c.rel;end if;
 end loop;
 delete from public.bid_activity where bid_id=target;
 get diagnostics deleted=row_count;if deleted<>1 then raise exception 'Unexpected activity count';end if;
 delete from public.intake_training_workflows where bid_id=target;
 get diagnostics deleted=row_count;if deleted<>1 then raise exception 'Unexpected registry count';end if;
 delete from public.bids where id=target;
 get diagnostics deleted=row_count;if deleted<>1 then raise exception 'Unexpected Bid count';end if;
end $cleanup$;
commit;
