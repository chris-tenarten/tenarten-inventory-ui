-- Notify an authenticated author only when they explicitly select their own
-- canonical account as a Job Update mention. Assignment behavior is unchanged.

begin;

create or replace function public.notify_job_update_account(
  p_user_id uuid,
  p_update public.job_updates,
  p_purpose text
)
returns void
language plpgsql security definer
set search_path = pg_catalog, public
as $function$
declare
  selected_job public.jobs%rowtype;
  notification_title text;
begin
  if p_user_id is null then return; end if;
  if p_purpose not in ('mention', 'assignment') then
    raise exception 'Invalid Job Update notification purpose.' using errcode = '22023';
  end if;
  if p_purpose = 'assignment' and p_user_id = auth.uid() then return; end if;
  if not exists (select 1 from public.app_users where user_id = p_user_id and is_active) then
    raise exception 'Job Update recipient must be an active TenOps user.' using errcode = '22023';
  end if;

  select * into selected_job from public.jobs where id = p_update.job_id;
  if not found then raise exception 'Production Job was not found.' using errcode = 'P0002'; end if;
  notification_title := case p_purpose
    when 'mention' then 'You were mentioned in a Job Update'
    else 'A Job Update was assigned to you'
  end;

  insert into public.account_notifications(
    user_id, notification_key, notification_type, title, body, metadata
  ) values (
    p_user_id,
    'job-update-' || p_purpose || ':' || p_update.id::text,
    'job_update_' || p_purpose,
    notification_title,
    coalesce(nullif(btrim(selected_job.job_number), '') || ' · ', '') || selected_job.name || E'\n' || left(p_update.body, 180),
    jsonb_build_object(
      'job_id', p_update.job_id,
      'update_id', p_update.id,
      'job_number', selected_job.job_number,
      'job_name', selected_job.name,
      'purpose', p_purpose
    )
  ) on conflict (user_id, notification_key) do nothing;
end;
$function$;

alter function public.notify_job_update_account(uuid, public.job_updates, text) owner to postgres;
revoke all on function public.notify_job_update_account(uuid, public.job_updates, text) from public, anon, authenticated;

commit;
