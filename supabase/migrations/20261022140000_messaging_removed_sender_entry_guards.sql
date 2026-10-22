-- Release halted by hosted preflight: requires separate Product approval.
-- Forward correction for 120000's case-sensitive BEGIN replacement.
-- Preserve complete installed bodies, owners, signatures, ACLs and search paths.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
do $$
declare f record; definition text; replacement text; argument_name text; installed_source text; changed_count integer:=0;
begin
 for f in
  select p.oid,p.proname,p.prosrc,p.proargnames,p.prosecdef,p.proconfig,l.lanname
  from pg_proc p join pg_language l on l.oid=p.prolang
  where p.oid=any(array[
   'public.recover_my_work_attachment_transfer(uuid)'::regprocedure,
   'public.my_work_attachment_transfer_status(uuid)'::regprocedure,
   'public.edit_my_work_inbox_message(uuid,text)'::regprocedure])
 loop
  argument_name:=case when f.proname='edit_my_work_inbox_message' then 'p_message_id' else 'p_id' end;
  if f.lanname<>'plpgsql' or not f.prosecdef or f.proargnames[1] is distinct from argument_name
     or not coalesce(f.proconfig @> array[case when f.proname='my_work_attachment_transfer_status' then 'search_path=pg_catalog, public, storage' else 'search_path=pg_catalog, public' end],false) then
   raise exception 'Unsupported Messaging entry-point prerequisite: %',f.proname;
  end if;
  definition:=pg_get_functiondef(f.oid);
  -- Functions correctly guarded by 120000 retain their exact definitions.
  if position('and group_id is not null and not public.is_my_work_group_member(group_id)' in f.prosrc)=0 then
   if definition !~* '\mBEGIN\M' then raise exception 'Missing Messaging function body: %',f.proname; end if;
   replacement:='BEGIN'||E'\n'||'  if exists(select 1 from public.my_work_messages where id='||argument_name||
    ' and group_id is not null and not public.is_my_work_group_member(group_id)) then raise exception ''Message unavailable.'' using errcode=''42501''; end if;';
   execute regexp_replace(definition,'\mBEGIN\M',replacement,'i');
  end if;
  select prosrc into strict installed_source from pg_proc where oid=f.oid;
  if position('and group_id is not null and not public.is_my_work_group_member(group_id)' in installed_source)=0 then
   raise exception 'Removed-member guard failed to install: %',f.proname;
  end if;
  changed_count:=changed_count+1;
 end loop;
 if changed_count<>3 then raise exception 'Incomplete Messaging entry-point prerequisites.'; end if;
end$$;
notify pgrst,'reload schema';
commit;
