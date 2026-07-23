begin;

insert into public.vendors (name, canonical_name, address, address_line_1, city, state, postal_code, country, phone, email, website, payment_terms, notes, is_active)
values
  ('Arim', 'arim', null, null, null, null, null, 'USA', null, null, null, null, 'Chip and aggregate Vendor imported from Tenarten purchasing references.', true),
  ('ASG', 'asg', null, null, null, null, null, 'USA', null, null, null, null, 'Chip and aggregate Vendor imported from Tenarten purchasing references.', true),
  ('CCQ', 'ccq', null, null, null, null, null, 'USA', null, null, null, null, 'Chip and aggregate Vendor imported from Tenarten purchasing references.', true),
  ('EnviroGlas', 'enviroglas', null, null, null, null, null, 'USA', null, null, null, null, 'Chip and aggregate Vendor imported from Tenarten purchasing references.', true),
  ('Klein & Co. Inc.', 'kleincoinc', '165-167 Hickory Springs Industrial Drive, Canton, Georgia 30115', '165-167 Hickory Springs Industrial Drive', null, 'GA', '30115', 'USA', '800.241.0681', 'rkent@kleincoinc.com', null, 'Net 30', 'Chip and aggregate Vendor imported from Tenarten purchasing references.', true),
  ('Southern Aggregates', 'southernaggregates', null, null, null, null, null, 'USA', null, null, null, null, 'Chip and aggregate Vendor imported from Tenarten purchasing references.', true),
  ('Terrazzo & Marble Supply', 'terrazzomarblesupply', '464 Northgate Parkway, Wheeling, IL 60090', '464 Northgate Parkway', 'Wheeling', 'IL', '60090', 'USA', '800.762.7253', 'wfryer@tmsupply.com', null, 'Net 30', 'Chip and aggregate Vendor imported from Tenarten purchasing references.', true)
on conflict (lower(canonical_name)) do update set
  address = coalesce(public.vendors.address, excluded.address), address_line_1 = coalesce(public.vendors.address_line_1, excluded.address_line_1), city = coalesce(public.vendors.city, excluded.city), state = coalesce(public.vendors.state, excluded.state), postal_code = coalesce(public.vendors.postal_code, excluded.postal_code), country = coalesce(public.vendors.country, excluded.country), phone = coalesce(public.vendors.phone, excluded.phone), email = coalesce(public.vendors.email, excluded.email), payment_terms = coalesce(public.vendors.payment_terms, excluded.payment_terms), notes = coalesce(public.vendors.notes, excluded.notes), updated_at = now();

insert into public.vendor_contacts (vendor_id, contact_name, role, email, phone, notes, is_default, is_active)
select id, 'Raymond Kent', 'Sales Contact', 'rkent@kleincoinc.com', '770.364.4126 / 800.241.0681', 'Imported from Tenarten chip Purchase Order references.', not exists (select 1 from public.vendor_contacts c where c.vendor_id=vendors.id and c.is_default and c.is_active), true from public.vendors where lower(canonical_name) = 'kleincoinc'
union all
select id, 'Bill Fryer', 'Sales Contact', 'wfryer@tmsupply.com', '800.762.7253', 'Imported from Tenarten chip Purchase Order references.', not exists (select 1 from public.vendor_contacts c where c.vendor_id=vendors.id and c.is_default and c.is_active), true from public.vendors where lower(canonical_name) = 'terrazzomarblesupply'
on conflict (vendor_id, lower(contact_name), lower(coalesce(email, ''))) do update set role = coalesce(public.vendor_contacts.role, excluded.role), phone = coalesce(public.vendor_contacts.phone, excluded.phone), notes = coalesce(public.vendor_contacts.notes, excluded.notes), updated_at = now();

commit;
