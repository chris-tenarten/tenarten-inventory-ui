begin;
do $$ begin
 if not exists(select 1 from public.messaging_attachment_release where singleton and phase in ('migrated','open')
  and client_sha='5cbc69dd67d380baa0bf03b01ae65c9318f7889a' and nullif(deployment_id,'') is not null and refreshed_verified) then raise exception 'Exact deployed/refreshed client attestation required'; end if;
 if not exists(select 1 from storage.buckets where id='my-work-inbox-attachments' and not public and file_size_limit=50000000 and allowed_mime_types is null) then raise exception 'Messaging bucket not ready'; end if;
 if not exists(select 1 from cron.job where jobname='tenops-messaging-abandoned-drafts' and active and schedule='17 * * * *') then raise exception 'Cleanup scheduler not ready'; end if;
 if not exists(select 1 from public.messaging_cleanup_runs where status='succeeded' and finished_at>now()-interval '1 hour') then raise exception 'Recent verified cleanup success required'; end if;
end $$;
revoke execute on function public.create_my_work_inbox_message_draft(uuid,text,uuid) from authenticated;
grant execute on function public.begin_my_work_attachment_transfer(uuid,uuid,text,uuid,jsonb) to authenticated;
drop policy if exists messaging_release_upload_pause on storage.objects;
update public.messaging_attachment_release set phase='open' where singleton;
commit;
