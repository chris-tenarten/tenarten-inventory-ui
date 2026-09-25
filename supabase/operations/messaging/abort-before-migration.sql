begin;
do $$ begin
 if to_regprocedure('public.begin_my_work_attachment_transfer(uuid,uuid,text,uuid,jsonb)') is not null then raise exception 'Migration committed: forward repair only'; end if;
 if not exists(select 1 from public.messaging_attachment_release where singleton and phase in ('paused','barrier','prepared')) then raise exception 'Unsafe abort phase'; end if;
end $$;
grant execute on function public.create_my_work_inbox_message_draft(uuid,text,uuid) to authenticated;
drop policy if exists messaging_release_upload_pause on storage.objects;
update public.messaging_attachment_release set phase='prepared' where singleton;
commit;
