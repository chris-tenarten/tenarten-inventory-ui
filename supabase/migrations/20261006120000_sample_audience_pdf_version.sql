-- Future Batch-first Sample documents use the audience-specific layout.
-- Historical captures and existing renderer versions remain unchanged.
begin;
alter function public.issue_sample_form(uuid) rename to issue_sample_form_before_audience_pdf;
revoke all on function public.issue_sample_form_before_audience_pdf(uuid) from public,anon,authenticated,service_role;
create function public.issue_sample_form(p_sample_id uuid)
returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare result uuid;
begin
 result:=public.issue_sample_form_before_audience_pdf(p_sample_id);
 update public.sample_issued_documents set document_version='sample-work-order-pdf-v10-audience'
 where id=result and issued_snapshot#>>'{formulation_state,calculationVersion}'='sample-formulation-v5-batch-first';
 return result;
end $$;
revoke all on function public.issue_sample_form(uuid) from public,anon;
grant execute on function public.issue_sample_form(uuid) to authenticated,service_role;
commit;
