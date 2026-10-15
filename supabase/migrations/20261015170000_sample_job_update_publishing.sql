-- Candidate only. Reuses Job Updates, mentions/notifications and Job attachments.
-- No role grants, buckets, tables or Jobs RLS changes.
begin;

-- Raw REST inserts previously relied only on writeBusinessData. Compose with
-- existing policies; the established creation RPC already checks postJobUpdate.
create policy job_updates_post_permission on public.job_updates as restrictive for insert to public
 with check (auth.uid() is not null and public.has_app_capability('writeBusinessData') and public.has_app_capability('postJobUpdate'));

create function public.can_publish_sample_to_job(p_job_id uuid)
returns boolean language sql stable security invoker set search_path=pg_catalog,public as $$
 select auth.uid() is not null and public.has_app_capability('writeBusinessData')
 and public.has_app_capability('postJobUpdate') and public.has_app_capability('uploadSupportingFiles')
 and exists(select 1 from public.jobs where id=p_job_id);
$$;
revoke all on function public.can_publish_sample_to_job(uuid) from public;
grant execute on function public.can_publish_sample_to_job(uuid) to authenticated;

create function public.can_upload_sample_update(p_path text)
returns boolean language plpgsql stable security invoker set search_path=pg_catalog,public as $$
begin
 if p_path !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/sample-updates/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$' then return false; end if;
 return public.can_publish_sample_to_job(split_part(p_path,'/',1)::uuid);
end;$$;
revoke all on function public.can_upload_sample_update(text) from public;
grant execute on function public.can_upload_sample_update(text) to authenticated;

-- Limit only this generated-document namespace; preserve manual uploads.
create policy sample_update_upload on storage.objects as restrictive for insert to public
 with check (bucket_id<>'job-attachments' or name not like '%/sample-updates/%' or (auth.uid() is not null and public.can_upload_sample_update(name)));
create policy sample_update_immutable on storage.objects as restrictive for update to public
 using (bucket_id<>'job-attachments' or name not like '%/sample-updates/%')
 with check (bucket_id<>'job-attachments' or name not like '%/sample-updates/%');
create policy sample_update_metadata_insert on public.job_attachments as restrictive for insert to public
 with check (storage_path not like '%/sample-updates/%' or (auth.uid() is not null and public.can_publish_sample_to_job(job_id) and split_part(storage_path,'/',1)=job_id::text and job_update_id is not null));
create policy sample_update_metadata_immutable on public.job_attachments as restrictive for update to public
 using (storage_path not like '%/sample-updates/%') with check (storage_path not like '%/sample-updates/%');

create function public.search_sample_update_jobs(p_search text default '')
returns table(id uuid,name text,customer text,job_number text)
language sql stable security invoker set search_path=pg_catalog,public as $$
 select j.id,j.name,j.customer,j.job_number from public.jobs j
 where public.can_publish_sample_to_job(j.id)
 and (nullif(trim(p_search),'') is null or strpos(lower(concat_ws(' ',j.name,j.customer,j.job_number)),lower(left(trim(p_search),120)))>0)
 order by j.name,j.id limit 20;
$$;
revoke all on function public.search_sample_update_jobs(text) from public;
grant execute on function public.search_sample_update_jobs(text) to authenticated;

-- Invoker preserves actual Jobs SELECT RLS. Existing creation RPC handles
-- canonical attribution, mention validation and notification delivery unchanged.
-- Serialize by request path, then commit Update + attachment + notifications
-- together. Retrying a lost response returns the original Update.
create function public.publish_sample_job_update(p_job_id uuid,p_request_id uuid,p_filename text,p_size_bytes bigint,p_document_type text,p_body text default '',p_mentioned_user_ids uuid[] default '{}')
returns public.job_updates language plpgsql security invoker set search_path=pg_catalog,public,storage as $$
declare path text:=p_job_id::text||'/sample-updates/'||p_request_id::text||'.pdf'; result public.job_updates; existing public.job_attachments; actor text;
begin
 if not public.can_publish_sample_to_job(p_job_id) then raise exception 'Job Update posting is not authorized.' using errcode='42501'; end if;
 if p_request_id is null or nullif(trim(p_filename),'') is null or p_size_bytes is null or p_size_bytes<=0 or p_size_bytes>52428800 or p_document_type not in ('work_order','blend_sheet','color_plate') then raise exception 'Invalid Sample PDF attachment.' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(path,0));
 select * into existing from public.job_attachments where storage_path=path;
 if found then
   select * into result from public.job_updates where id=existing.job_update_id and author_user_id=auth.uid();
   if not found then raise exception 'This request belongs to another Update.' using errcode='42501'; end if;
   return result;
 end if;
 if not exists(select 1 from storage.objects where bucket_id='job-attachments' and name=path) then raise exception 'Upload the generated PDF before posting.' using errcode='22023'; end if;
 select display_name into actor from public.app_users where user_id=auth.uid() and is_active;
 select * into result from public.create_job_update_with_mentions(p_job_id,actor,coalesce(nullif(trim(p_body),''),'Sample document: '||p_filename),false,null,null,p_mentioned_user_ids);
 insert into public.job_attachments(job_id,file_name,storage_path,mime_type,size_bytes,document_type,job_update_id,job_update_attachment_role,uploaded_by)
 values(p_job_id,p_filename,path,'application/pdf',p_size_bytes,p_document_type,result.id,'update',actor);
 return result;
end;$$;
revoke all on function public.publish_sample_job_update(uuid,uuid,text,bigint,text,text,uuid[]) from public;
grant execute on function public.publish_sample_job_update(uuid,uuid,text,bigint,text,text,uuid[]) to authenticated;
commit;
