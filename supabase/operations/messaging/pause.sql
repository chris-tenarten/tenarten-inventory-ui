begin;
do $$ begin
 if not exists(select 1 from public.messaging_attachment_release where singleton and phase in ('prepared','paused')) then raise exception 'Use post-migration hold after migration'; end if;
 if to_regprocedure('public.begin_my_work_attachment_transfer(uuid,uuid,text,uuid,jsonb)') is not null then raise exception 'Application migration already present'; end if;
end $$;
revoke execute on function public.create_my_work_inbox_message_draft(uuid,text,uuid) from authenticated;
update public.messaging_attachment_release set phase='paused' where singleton;
commit;
