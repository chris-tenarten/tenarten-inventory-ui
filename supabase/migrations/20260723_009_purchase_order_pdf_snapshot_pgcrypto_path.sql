begin;

do $preflight$
begin
  if to_regprocedure('public.capture_purchase_order_pdf_snapshot_fields()') is null then
    raise exception 'Migration 20260723_009 requires capture_purchase_order_pdf_snapshot_fields().';
  end if;
  if to_regprocedure('extensions.digest(bytea,text)') is null then
    raise exception 'Migration 20260723_009 requires pgcrypto digest(bytea,text) in the extensions schema.';
  end if;
end;
$preflight$;

-- Migration 20260723_005 recreated this trigger function with a restricted
-- search path that omitted Supabase's extensions schema. Issuance therefore
-- failed while the trigger attempted to recalculate the immutable snapshot
-- hash. Preserve the function body and correct only its execution environment.
alter function public.capture_purchase_order_pdf_snapshot_fields()
  set search_path = public, extensions, pg_temp;

commit;
