-- SEPARATE HOSTED APPROVAL REQUIRED. Existing Free-plan global ceiling is 52428800.
-- Messaging uses decimal 50000000 bytes; no plan/global/other-bucket change required.
-- Apply only after migration 20260925120000_messaging_large_attachments.sql is verified.
-- Does not alter other buckets, global capacity, plan, or public access.
begin;
do $$ begin
  if not exists(select 1 from pg_proc where pronamespace='public'::regnamespace and proname='begin_my_work_attachment_transfer') then raise exception 'Messaging migration must be installed first.'; end if;
  if not exists(select 1 from storage.buckets where id='my-work-inbox-attachments' and public=false and file_size_limit=26214400) then raise exception 'Unexpected bucket state: inspect before changing.'; end if;
end;$$;
update storage.buckets set file_size_limit=50000000,allowed_mime_types=null
where id='my-work-inbox-attachments' and public=false;
commit;
