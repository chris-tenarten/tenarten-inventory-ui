-- Normalize six proven legacy Catalog item names containing accidental doubled spaces.
-- Catalog IDs, sizes, taxonomy, pricing, and relationships remain unchanged.
begin;

do $$
declare
  changed_count integer;
begin
  if to_regclass('public.vendor_catalog') is null then
    raise exception 'Catalog whitespace normalization stopped: public.vendor_catalog is missing.';
  end if;

  if (
    select count(*)
    from public.vendor_catalog catalog
    join (values
      ('56445667-93de-44d5-90e3-a794ba222dae'::uuid, 'CC Green  50 lbs Bags'),
      ('5d022298-24f2-46b7-ab87-9339f9e1dc10'::uuid, 'Blue Coal  (Substitute for Blue Grey)'),
      ('64ebda43-ec2b-4329-bca5-445a9c5c841b'::uuid, 'Blue Coal  (Substitute for Blue Grey)'),
      ('cd9520b9-f67a-4605-83eb-89265a5545d3'::uuid, 'Blue Coal  (Substitute for Blue Grey)'),
      ('aca1b8f1-c3eb-4a34-af56-893d81c4587d'::uuid, 'CC Green  50 lbs Bags'),
      ('f8d70be3-2eb2-4931-b814-37c8dfbeafea'::uuid, 'CC Green  50 lbs Bags')
    ) expected(id, item_name) on expected.id=catalog.id and expected.item_name=catalog.item_name
  ) <> 6 then
    raise exception 'Catalog whitespace normalization stopped: the six reviewed source rows no longer match.';
  end if;

  if exists (
    select 1
    from public.vendor_catalog target
    join public.vendor_catalog candidate on candidate.id<>target.id
      and lower(btrim(candidate.vendor))=lower(btrim(target.vendor))
      and lower(btrim(coalesce(candidate.vendor_sku,'')))=lower(btrim(coalesce(target.vendor_sku,'')))
      and lower(btrim(candidate.item_name))=lower(regexp_replace(btrim(target.item_name),'[[:space:]]+',' ','g'))
      and lower(btrim(coalesce(candidate.size,'')))=lower(btrim(coalesce(target.size,'')))
      and lower(btrim(coalesce(candidate.unit,'')))=lower(btrim(coalesce(target.unit,'')))
    where target.id in (
      '56445667-93de-44d5-90e3-a794ba222dae'::uuid,
      '5d022298-24f2-46b7-ab87-9339f9e1dc10'::uuid,
      '64ebda43-ec2b-4329-bca5-445a9c5c841b'::uuid,
      'cd9520b9-f67a-4605-83eb-89265a5545d3'::uuid,
      'aca1b8f1-c3eb-4a34-af56-893d81c4587d'::uuid,
      'f8d70be3-2eb2-4931-b814-37c8dfbeafea'::uuid
    )
  ) then
    raise exception 'Catalog whitespace normalization stopped: a normalized identity collision now exists.';
  end if;

  update public.vendor_catalog
  set item_name=regexp_replace(btrim(item_name),'[[:space:]]+',' ','g')
  where id in (
    '56445667-93de-44d5-90e3-a794ba222dae'::uuid,
    '5d022298-24f2-46b7-ab87-9339f9e1dc10'::uuid,
    '64ebda43-ec2b-4329-bca5-445a9c5c841b'::uuid,
    'cd9520b9-f67a-4605-83eb-89265a5545d3'::uuid,
    'aca1b8f1-c3eb-4a34-af56-893d81c4587d'::uuid,
    'f8d70be3-2eb2-4931-b814-37c8dfbeafea'::uuid
  );
  get diagnostics changed_count=row_count;
  if changed_count<>6 then
    raise exception 'Catalog whitespace normalization stopped: expected 6 updates, got %.',changed_count;
  end if;
end $$;

commit;
