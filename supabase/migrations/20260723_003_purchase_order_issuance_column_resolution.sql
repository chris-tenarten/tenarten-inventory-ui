begin;

-- issue_purchase_order returns columns named purchase_order_id and
-- revision_number while querying tables with those same columns. Qualify the
-- table references directly without changing a database-wide PL/pgSQL setting.
do $migration$
declare
  original_definition text;
  patched_definition text;
begin
  select pg_get_functiondef(procedure.oid)
    into original_definition
  from pg_proc procedure
  where procedure.oid = to_regprocedure('public.issue_purchase_order(uuid,text,timestamptz)');

  if original_definition is null then
    raise exception 'public.issue_purchase_order(uuid, text, timestamptz) was not found.';
  end if;

  patched_definition := regexp_replace(
    original_definition,
    'from\s+public\.purchase_order_issuances\s+where\s+purchase_order_id\s*=\s*selected_order\.id\s+and\s+revision_number\s*=\s*selected_order\.revision_number',
    'from public.purchase_order_issuances issuance where issuance.purchase_order_id = selected_order.id and issuance.revision_number = selected_order.revision_number',
    'g'
  );

  patched_definition := regexp_replace(
    patched_definition,
    'from\s+public\.purchase_order_lines\s+where\s+purchase_order_id\s*=\s*selected_order\.id',
    'from public.purchase_order_lines order_lines where order_lines.purchase_order_id = selected_order.id',
    'g'
  );

  if patched_definition = original_definition then
    raise exception 'issue_purchase_order did not contain the expected ambiguous references.';
  end if;

  if patched_definition ~ E'from public\\.purchase_order_issuances\\s+where purchase_order_id'
     or patched_definition ~ E'from public\\.purchase_order_lines\\s+where purchase_order_id' then
    raise exception 'issue_purchase_order still contains an ambiguous purchase_order_id reference.';
  end if;

  execute patched_definition;
end;
$migration$;

commit;
