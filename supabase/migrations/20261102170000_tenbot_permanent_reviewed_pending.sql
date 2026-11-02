-- Local forward-only authorization correction. Application/activation requires
-- separate Product approval. The exact reviewed action becomes the authority
-- for its Pending dispatch; the non-reviewed public pilot wrapper is unchanged.
begin;
set local lock_timeout='3s';
set local statement_timeout='15s';

do $permanent_reviewed_pending$
declare
 target oid:=to_regprocedure('public.execute_tenbot_reviewed_action(uuid,integer,text)');
 original pg_proc;definition text;old_clause text;new_clause text;replacement_source text;
begin
 select * into original from pg_proc where oid=target;
 if original.oid is null or md5(original.prosrc) is distinct from '78e5c6b1bdfebfaaaef5f06846980516'
  or original.proowner<>'postgres'::regrole or not original.prosecdef or original.provolatile<>'v'
  or original.prolang<>(select oid from pg_language where lanname='plpgsql')
  or array(select acl::text from unnest(original.proacl) acl order by acl::text)
   is distinct from array['authenticated=X/postgres','postgres=X/postgres']::text[]
  or array(select regexp_replace(setting,'[[:space:]]','','g') from unnest(original.proconfig) setting order by setting)
   is distinct from array['lock_timeout=3s','search_path=pg_catalog,public','statement_timeout=20s']::text[] then
  raise exception 'Exact reviewed action predecessor body/owner/ACL/configuration required.';
 end if;
 if to_regprocedure('public.tenbot_execute_invoice_receival_core(uuid,text,uuid)') is null
  or to_regprocedure('public.tenbot_action_guard_receival_execution()') is null
  or not exists(select 1 from pg_roles where rolname='tenbot_invoice_executor' and not rolcanlogin and not rolbypassrls and not rolsuper)
  or not exists(select 1 from pg_proc where oid='public.tenbot_execute_invoice_receival_core(uuid,text,uuid)'::regprocedure
   and proowner='tenbot_invoice_executor'::regrole and prosecdef)
  or not exists(select 1 from pg_trigger where tgrelid='public.invoice_receival_executions'::regclass
   and tgname='tenbot_action_receival_execution_guard' and not tgisinternal and tgenabled='O'
   and tgfoid='public.tenbot_action_guard_receival_execution()'::regprocedure) then
  raise exception 'Existing non-bypass canonical core and reviewed commit guard required.';
 end if;
 -- Lock disabled controls without changing any row or policy version. Applying
 -- this function correction does not activate employee execution or funding.
 perform 1 from public.tenbot_action_control where singleton and not receivals_enabled for share;
 if not found then raise exception 'Reviewed Pending control must remain disabled.';end if;
 perform 1 from public.tenbot_receival_execution_control where singleton and not execution_enabled for share;
 if not found then raise exception 'Canonical Pending execution must remain disabled.';end if;

 old_clause:=$old$   if stage.action_id is null then raise exception 'Exact canonical source review and existing pilot permit required.' using errcode='42501';end if;
   insert into public.tenbot_reviewed_action_dispatches(action_id,owner_id,session_id,revision,content_hash,transaction_id)
   values(action.id,action.owner_id,action.execution_session_id,action.revision,action.content_hash,txid_current());
   -- Unchanged employee-JWT canonical entry point: every original, duplicate,
   -- permission, pilot, enrollment, policy, permit and zero-stock gate remains.
   result:=public.execute_invoice_receival_draft(stage.draft_id,stage.content_hash,stage.approval_id)$old$;
 new_clause:=$new$   if stage.action_id is null then raise exception 'Exact canonical source review required.' using errcode='42501';end if;
   insert into public.tenbot_reviewed_action_dispatches(action_id,owner_id,session_id,revision,content_hash,transaction_id)
   values(action.id,action.owner_id,action.execution_session_id,action.revision,action.content_hash,txid_current());
   -- Exact password-authorized action plus private transaction dispatch gate
   -- the unchanged canonical core; its commit guard rechecks this authority.
   result:=public.tenbot_execute_invoice_receival_core(stage.draft_id,stage.content_hash,stage.approval_id)$new$;
 if (length(original.prosrc)-length(replace(original.prosrc,old_clause,'')))/length(old_clause)<>1 then
  raise exception 'One exact reviewed Pending dispatch branch required.';
 end if;
 replacement_source:=replace(original.prosrc,old_clause,new_clause);
 select pg_get_functiondef(target) into definition;
 execute replace(definition,old_clause,new_clause);
 if not exists(select 1 from pg_proc where oid=target and prosrc=replacement_source
  and proowner=original.proowner and proacl is not distinct from original.proacl
  and proconfig is not distinct from original.proconfig and prosecdef=original.prosecdef
  and prolang=original.prolang and provolatile=original.provolatile) then
  raise exception 'Reviewed action correction changed unrelated function metadata.';
 end if;
end $permanent_reviewed_pending$;

notify pgrst,'reload schema';
commit;
