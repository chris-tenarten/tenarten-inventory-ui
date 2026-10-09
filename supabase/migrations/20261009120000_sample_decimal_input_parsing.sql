-- Accept ordinary nonnegative decimal spellings already accepted by the Sample UI.
-- No record/profile/snapshot backfill. Existing function ownership and ACLs preserved.
begin;
create or replace function public.sample_nonnegative_numeric(p_value text)
returns numeric language sql immutable set search_path=pg_catalog as $$
  select case when btrim(coalesce(p_value,''))~'^([0-9]+([.][0-9]*)?|[.][0-9]+)$'
    then btrim(p_value)::numeric else null end
$$;
commit;
