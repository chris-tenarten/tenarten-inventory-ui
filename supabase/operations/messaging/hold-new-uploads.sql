-- After migration: no new sends; active drafts can recover/heartbeat/cancel or finish.
begin;
revoke execute on function public.begin_my_work_attachment_transfer(uuid,uuid,text,uuid,jsonb) from authenticated;
revoke execute on function public.create_my_work_inbox_message_draft(uuid,text,uuid) from authenticated;
update public.messaging_attachment_release set phase='migrated',client_sha=null,deployment_id=null,refreshed_verified=false where singleton;
commit;
-- For a concrete unsafe-completion incident, separately install the INSERT barrier
-- after assessing in-progress drafts. Routine hold does not interrupt their bytes.
