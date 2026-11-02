-- LOCAL FORWARD CORRECTION from actual isolated canonical execution:
-- PostgreSQL 42703 at deferred commit: invoice_receival_executions has no id.
-- The source-only preparation exception must choose its record type before
-- referencing NEW.id. Preserve every other canary check, trigger and ACL.
begin;
set local lock_timeout='3s';
set local statement_timeout='15s';

do $deferred_record_boundary$
declare
 signature constant text:='public.tenbot_chris_dev_canary_commit_authorized()';
 target oid:=to_regprocedure(signature);
 definition text;original_source text;old_clause text;new_clause text;matches integer;
 original_owner oid;original_acl aclitem[];original_config text[];
begin
 select prosrc,proowner,proacl,proconfig into original_source,original_owner,original_acl,original_config
 from pg_proc where oid=target and prosecdef and prorettype='trigger'::regtype;
 if original_source is null or md5(original_source)<>'1a33c77b396cd951f390239a157541b4' or original_owner<>'postgres'::regrole then
  raise exception 'Exact reviewed deferred canary predecessor required; inspect source before applying.';
 end if;
 select pg_get_functiondef(target) into definition;
 old_clause:=$old$ if tg_table_schema='public' and tg_table_name='invoice_receival_sources'
  and new.owner_user_id='3785f6b9-742e-452f-af6c-31613a983633'
  and auth.role()='authenticated' and auth.uid()=new.owner_user_id
  and public.can_read_invoice_preparation_source(new.id) then
  return null;
 end if;$old$;
 new_clause:=$new$ if tg_table_schema='public' and tg_table_name='invoice_receival_sources' then
  if new.owner_user_id='3785f6b9-742e-452f-af6c-31613a983633'
   and auth.role()='authenticated' and auth.uid()=new.owner_user_id
   and public.can_read_invoice_preparation_source(new.id) then
   return null;
  end if;
 end if;$new$;
 matches:=(length(definition)-length(replace(definition,old_clause,'')))/length(old_clause);
 if matches<>1 then raise exception 'Exact source-only preparation clause required.';end if;
 -- pg_get_functiondef uses CREATE OR REPLACE and retains the same signature,
 -- owner, SECURITY DEFINER and configuration. Existing ACLs remain untouched.
 execute replace(definition,old_clause,new_clause);
 if not exists(select 1 from pg_proc where oid=target and prosecdef and prorettype='trigger'::regtype
   and proowner=original_owner and proacl is not distinct from original_acl and proconfig is not distinct from original_config
   and prosrc=replace(original_source,old_clause,new_clause)) then
  raise exception 'Deferred canary metadata or unrelated enforcement changed.';
 end if;
end $deferred_record_boundary$;

commit;
