-- READ ONLY. Run against the intended environment only after authorization.
-- Inspect object/configuration metadata; never reads private message content.
begin read only;
select version();
select to_regclass('public.my_work_messages') messages,
       to_regclass('public.my_work_message_groups') groups,
       to_regclass('public.my_work_group_members') members,
       to_regclass('public.my_work_group_message_reads') receipts;
select table_name,column_name,data_type,is_nullable from information_schema.columns
where table_schema='public' and table_name in ('my_work_messages','my_work_message_deletion_audit')
  and column_name in ('sender_user_id','recipient_user_id','delivery_status','upload_request','group_id','reply_to_message_id','is_reply','original_group_id')
order by table_name,column_name;
select p.oid::regprocedure signature,p.prosecdef,p.proconfig,
       md5(replace(pg_get_functiondef(p.oid),E'\r\n',E'\n')) definition_md5,
       has_function_privilege('authenticated',p.oid,'EXECUTE') authenticated_execute,
       has_function_privilege('anon',p.oid,'EXECUTE') anonymous_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in
('list_my_work_inbox_messages','list_my_work_message_page_v11','list_my_work_conversations_v11','begin_my_work_attachment_transfer',
 'recover_my_work_attachment_transfer','my_work_attachment_transfer_status','edit_my_work_inbox_message','finalize_my_work_inbox_message',
 'require_app_capability','guard_tenops_messaging_write','guard_tenops_notification_write',
 'web_push_source','web_push_pilot_source','web_push_environment_source','enqueue_web_push_notification','prepare_web_push_delivery',
 'resolve_my_push_notification','send_my_work_message_v12','list_my_work_message_page_v12','list_my_work_conversations_v12',
 'save_my_work_message_group','begin_my_work_attachment_transfer_v12','mark_my_work_conversation_read_v12') order by p.oid::regprocedure::text;
select schemaname,tablename,policyname,roles,cmd,qual,with_check from pg_policies
where (schemaname='public' and tablename in ('my_work_messages','my_work_message_attachments','my_work_attachment_previews','my_work_message_versions','my_work_message_groups','my_work_group_members','my_work_group_message_reads'))
 or (schemaname='storage' and policyname like 'my_work_inbox%')
 or (schemaname='realtime' and policyname in ('messaging_personal_broadcast_read','my_work_typing_participant_receive','my_work_typing_participant_publish'))
order by schemaname,tablename,policyname;
select grantee,table_name,privilege_type from information_schema.role_table_grants
where table_schema='public' and grantee in ('anon','authenticated') and table_name in ('my_work_messages','my_work_message_groups','my_work_group_members','my_work_group_message_reads') order by table_name,grantee,privilege_type;
select id,public,file_size_limit from storage.buckets where id='my-work-inbox-attachments';
select environment,enabled,activated_at from public.web_push_transport order by environment;
select pubname,schemaname,tablename from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='my_work_messages';
rollback;
