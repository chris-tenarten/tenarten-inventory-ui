begin;

-- reserve_job_document_number is an internal helper invoked only by
-- postgres-owned SECURITY DEFINER business functions. No API role needs to
-- execute the reservation primitive directly.
alter function public.reserve_job_document_number(
  text, text, uuid, uuid, text, integer
) owner to postgres;

revoke all on function public.reserve_job_document_number(
  text, text, uuid, uuid, text, integer
) from public, anon, authenticated, service_role;

comment on function public.reserve_job_document_number(
  text, text, uuid, uuid, text, integer
) is
  'Owner-private shared numbering primitive. Called only by postgres-owned SECURITY DEFINER Purchase Order and Job Transmittal business functions.';

commit;
