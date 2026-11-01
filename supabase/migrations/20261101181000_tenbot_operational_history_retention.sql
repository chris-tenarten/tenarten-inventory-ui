-- Private bounded text purge for the existing assistant store. No new storage,
-- employee authority, HTTP invocation or scheduler/service configuration.
begin;
create function public.tenbot_purge_expired_operational_history() returns integer
language plpgsql security definer set search_path=pg_catalog,public as $$
declare changed integer;
begin
 with expired as (
  select conversation_id from public.tenbot_agent_history h
  where (h.claim_until is null or h.claim_until<=clock_timestamp())
   and jsonb_typeof(h.state->'operational')='array'
   and exists(select 1 from jsonb_array_elements(h.state->'operational') t where (t->>'expiresAt')::timestamptz<=clock_timestamp())
  order by h.conversation_id limit 100 for update skip locked
 )
 update public.tenbot_agent_history h set state=jsonb_set(h.state,'{operational}',
  coalesce((select jsonb_agg(t order by ordinal) from jsonb_array_elements(h.state->'operational') with ordinality a(t,ordinal)
   where (t->>'expiresAt')::timestamptz>clock_timestamp()),'[]'::jsonb))
 from expired e where e.conversation_id=h.conversation_id;
 get diagnostics changed=row_count;
 return changed;
end;$$;
alter function public.tenbot_purge_expired_operational_history() owner to postgres;
revoke all on function public.tenbot_purge_expired_operational_history() from public,anon,authenticated,service_role;
comment on function public.tenbot_purge_expired_operational_history() is 'Private count-only maintenance, at most100 existing histories per invocation. Skips active claims, removes only expired operational answer text, retains static guidance/context. Schedule every minute using existing trusted database infrastructure after separate release approval. Display expiry is enforced even if maintenance fails.';
notify pgrst,'reload schema';
commit;
