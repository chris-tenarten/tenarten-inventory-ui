begin;
set local lock_timeout='5s';
lock table public.my_work_messages in share row exclusive mode;
do $$ begin
 if not exists(select 1 from public.messaging_attachment_release where singleton and phase in ('paused','barrier')) then raise exception 'Pause first'; end if;
 if exists(select 1 from public.my_work_messages where delivery_status='draft') then raise exception 'Drain required; existing drafts may finish/cancel. Do not delete them.'; end if;
end $$;
drop policy if exists messaging_release_upload_pause on storage.objects;
create policy messaging_release_upload_pause on storage.objects as restrictive for insert to authenticated with check(bucket_id<>'my-work-inbox-attachments');
update public.messaging_attachment_release set phase='barrier' where singleton;
commit;
