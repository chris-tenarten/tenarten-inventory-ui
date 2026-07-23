begin;

update public.vendors
set notes = null,
    updated_at = now()
where notes = 'Chip and aggregate Vendor imported from Tenarten purchasing references.';

update public.vendor_contacts
set notes = null,
    updated_at = now()
where notes = 'Imported from Tenarten chip Purchase Order references.';

commit;
