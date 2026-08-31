-- Private, ephemeral typing authorization for direct My Work Inbox conversations.
-- Typing events remain Supabase Realtime Broadcast messages and are never persisted in public tables.

create function public.can_access_my_work_typing_topic(p_topic text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  with parsed as (
    select
      matched[1]::uuid as first_user_id,
      matched[2]::uuid as second_user_id
    from regexp_match(
      p_topic,
      '^my-work-typing:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}):([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$'
    ) as matched
  )
  select coalesce((
    select
      first_user_id <> second_user_id
      and first_user_id::text < second_user_id::text
      and auth.uid() in (first_user_id, second_user_id)
      and exists (
        select 1 from public.app_users actor
        where actor.user_id = auth.uid() and actor.is_active
      )
      and exists (
        select 1 from public.app_users participant
        where participant.user_id = first_user_id and participant.is_active
      )
      and exists (
        select 1 from public.app_users participant
        where participant.user_id = second_user_id and participant.is_active
      )
    from parsed
  ), false);
$$;

alter function public.can_access_my_work_typing_topic(text) owner to postgres;
revoke all on function public.can_access_my_work_typing_topic(text) from public, anon, authenticated;
grant execute on function public.can_access_my_work_typing_topic(text) to authenticated;

create policy my_work_typing_participant_receive
on realtime.messages
for select
to authenticated
using (
  extension = 'broadcast'
  and public.can_access_my_work_typing_topic(realtime.topic())
);

create policy my_work_typing_participant_publish
on realtime.messages
for insert
to authenticated
with check (
  extension = 'broadcast'
  and public.can_access_my_work_typing_topic(realtime.topic())
);

comment on function public.can_access_my_work_typing_topic(text) is
  'Authorizes only the two active users in a canonical private My Work typing topic.';
