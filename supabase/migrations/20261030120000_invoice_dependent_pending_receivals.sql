-- Local candidate: extends the isolated invoice approval contract, default OFF.
-- Apply only after its 20261029210000 prerequisite. This pass never authorizes
-- Production application or activation. No model SQL, service-role business
-- gateway, receiving operation, inventory_items or on-hand write is introduced.
begin;
set local lock_timeout='3s';
set local statement_timeout='30s';

do $preflight$ begin
 if to_regprocedure('public.prepare_invoice_receival_draft(jsonb,jsonb,jsonb,jsonb)') is null
   or to_regprocedure('public.save_purchasing_catalog_item_v2(jsonb)') is null
   or to_regprocedure('public.tenops_catalog_save_impl(jsonb)') is null
   or to_regclass('public.vendors') is null then
  raise exception 'Canonical invoice approval, configured Vendors and catalog save prerequisites are required.';
 end if;
 if not exists(select 1 from pg_roles where rolname='tenbot_invoice_executor' and not rolcanlogin and not rolbypassrls and not rolsuper) then
  raise exception 'The existing non-login, RLS-bound invoice executor is required.';
 end if;
end $preflight$;

-- A revoke/regrant must invalidate approval even when the final capability set
-- equals the original. These monotonic epochs contain no conversation content.
create table public.invoice_receival_permission_epochs(scope text primary key,revision bigint not null default 1 check(revision>0));
revoke all on public.invoice_receival_permission_epochs from public,anon,authenticated,service_role;
grant select on public.invoice_receival_permission_epochs to tenbot_invoice_executor;
create function public.tenbot_invoice_permission_changed() returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare key text;
begin
 if tg_table_name='app_role_capabilities' then
  if tg_op='UPDATE' and to_jsonb(new)=to_jsonb(old) then return new; end if;
  key:='capabilities';
 else
  if tg_op='UPDATE' and new.role is not distinct from old.role and new.is_active is not distinct from old.is_active and new.user_id is not distinct from old.user_id then return new; end if;
  key:='actor:'||case when tg_op='DELETE' then old.user_id else new.user_id end::text;
 end if;
 insert into public.invoice_receival_permission_epochs(scope,revision) values(key,1)
 on conflict(scope) do update set revision=invoice_receival_permission_epochs.revision+1;
 if tg_op='DELETE' then return old; end if; return new;
end $$;
revoke all on function public.tenbot_invoice_permission_changed() from public,anon,authenticated,service_role;
create trigger invoice_receival_actor_epoch after insert or update or delete on public.app_users for each row execute function public.tenbot_invoice_permission_changed();
create trigger invoice_receival_capability_epoch after insert or update or delete on public.app_role_capabilities for each row execute function public.tenbot_invoice_permission_changed();
create function public.tenbot_invoice_authorization_version() returns text language sql stable security invoker set search_path=pg_catalog,public as $$
 select encode(sha256(convert_to(auth.uid()::text||':'||coalesce((select revision::text from public.invoice_receival_permission_epochs where scope='actor:'||auth.uid()::text),'0')||':'||coalesce((select revision::text from public.invoice_receival_permission_epochs where scope='capabilities'),'0'),'UTF8')),'hex')
$$;
revoke all on function public.tenbot_invoice_authorization_version() from public,anon,authenticated,service_role;
grant execute on function public.tenbot_invoice_authorization_version() to tenbot_invoice_executor;

create table public.invoice_receival_supersessions(
 old_draft_id uuid primary key references public.invoice_receival_drafts(id),
 new_draft_id uuid not null references public.invoice_receival_drafts(id),
 owner_user_id uuid not null references public.app_users(user_id),
 superseded_at timestamptz not null default clock_timestamp(),
 check(old_draft_id<>new_draft_id)
);
alter table public.invoice_receival_supersessions enable row level security;
revoke all on public.invoice_receival_supersessions from public,anon,authenticated,service_role;
grant select on public.invoice_receival_supersessions to authenticated;
grant select,insert on public.invoice_receival_supersessions to tenbot_invoice_executor;
create policy invoice_supersessions_owner_read on public.invoice_receival_supersessions for select to authenticated using(owner_user_id=auth.uid() and public.has_app_capability('readOperationalData'));
create policy invoice_supersessions_owner_insert on public.invoice_receival_supersessions for insert to tenbot_invoice_executor with check(owner_user_id=auth.uid() and public.has_app_capability('writeBusinessData') and public.has_app_capability('adjustInventory'));
create trigger invoice_supersessions_immutable before update or delete on public.invoice_receival_supersessions for each row execute function public.tenbot_invoice_immutable();
create table public.invoice_receival_revocations(
 draft_id uuid primary key references public.invoice_receival_drafts(id),
 owner_user_id uuid not null references public.app_users(user_id),
 revoked_at timestamptz not null default clock_timestamp()
);
alter table public.invoice_receival_revocations enable row level security;
revoke all on public.invoice_receival_revocations from public,anon,authenticated,service_role;
grant select on public.invoice_receival_revocations to authenticated;
grant select,insert on public.invoice_receival_revocations to tenbot_invoice_executor;
create policy invoice_revocations_owner_read on public.invoice_receival_revocations for select to authenticated using(owner_user_id=auth.uid() and public.has_app_capability('readOperationalData'));
create policy invoice_revocations_owner_insert on public.invoice_receival_revocations for insert to tenbot_invoice_executor with check(owner_user_id=auth.uid() and public.has_app_capability('writeBusinessData') and public.has_app_capability('adjustInventory'));
create trigger invoice_revocations_immutable before update or delete on public.invoice_receival_revocations for each row execute function public.tenbot_invoice_immutable();
alter table public.invoice_receival_executions add column created_catalog_records jsonb not null default '[]'::jsonb check(jsonb_typeof(created_catalog_records)='array');

grant select on public.vendors to tenbot_invoice_executor;
grant execute on function public.save_purchasing_catalog_item_v2(jsonb) to tenbot_invoice_executor;
-- All business reads/ordinary pending inserts still execute under the existing
-- authenticated RLS membership. The catalog call is the existing fixed canonical
-- service, with caller capability/version checks before and after its invocation.
create or replace function public.tenbot_lock_invoice_resources() returns void language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if auth.role() is distinct from 'authenticated' or auth.uid() is null then raise exception 'Employee authentication required.' using errcode='42501'; end if;
 perform public.require_app_capability('readOperationalData'); perform public.require_app_capability('writeBusinessData'); perform public.require_app_capability('adjustInventory');
 -- Take the write-compatible catalog lock before validation. Two dependent
 -- creates cannot both hold SHARE and then deadlock while upgrading to INSERT.
 lock table public.vendor_catalog,public.vendor_catalog_v2,public.vendors in share row exclusive mode;
 lock table public.jobs in share mode;
 lock table public.pending_receivals in share row exclusive mode;
end $$;

create function public.tenbot_invoice_quantity_basis(p_source jsonb,p_offer jsonb,p_quantity text,p_unit text,p_source_text text) returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
declare source_quantity numeric; source_unit text; target text; package_quantity numeric; measure text; container text;
 is_count boolean; expected numeric; package_count numeric; total numeric; calculation text; mention text[]; mention_unit text; mention_quantity numeric; per_container boolean; source_has_count boolean;
begin
 if jsonb_typeof(p_source) is distinct from 'object' or (p_source-array['quantity','unit'])<>'{}'::jsonb
  or coalesce(p_source->>'quantity','') !~ '^(0|[1-9][0-9]{0,8})(\.[0-9]{1,6})?$'
  or coalesce(p_quantity,'') !~ '^(0|[1-9][0-9]{0,8})(\.[0-9]{1,6})?$'
  or length(coalesce(p_source_text,'')) not between 1 and 4000 then raise exception 'Original invoice quantity and line evidence are required.' using errcode='22023'; end if;
 source_quantity:=(p_source->>'quantity')::numeric; source_unit:=public.tenbot_invoice_unit(p_source->>'unit'); target:=public.tenbot_invoice_unit(p_offer->>'orderUnit');
 package_quantity:=nullif(p_offer->>'packageQuantity','')::numeric; measure:=public.tenbot_invoice_unit(p_offer->>'packageMeasure'); container:=public.tenbot_invoice_unit(p_offer->>'containerType');
 if source_quantity<=0 or (p_quantity)::numeric<=0 or source_unit is null or target is null then raise exception 'A positive supported source and receival quantity/unit are required.' using errcode='22023'; end if;
 is_count:=source_unit not in('LB','KG','GAL','L','OZ');
 if package_quantity is not null and (package_quantity<=0 or measure is null or measure not in('LB','KG','GAL','L','OZ') or container is null or container in('LB','KG','GAL','L','OZ')) then raise exception 'Catalog package evidence is incomplete.' using errcode='22023'; end if;
 if is_count then package_count:=source_quantity; else total:=source_quantity; end if;
 if source_unit=target then expected:=source_quantity; calculation:=case when is_count then 'source_package_count' else 'source_material_quantity' end;
 elsif not is_count and package_quantity is not null and source_unit=measure and target=container then
  expected:=source_quantity/package_quantity;
  if expected<>trunc(expected) or expected<>round(expected,6) then raise exception 'Invoice total does not identify an exact whole package count.' using errcode='22023'; end if;
  package_count:=expected;calculation:='exact_catalog_package_conversion';
 else raise exception 'Invoice and ordering units cannot be silently converted.' using errcode='22023'; end if;
 if is_count and source_unit=container and package_quantity is not null then total:=source_quantity*package_quantity; end if;
 if public.tenbot_invoice_unit(p_unit) is distinct from target or (p_quantity)::numeric<>expected then raise exception 'Receival quantity/unit contradicts immutable invoice evidence.' using errcode='22023'; end if;
 source_has_count:=p_source_text ~* '[0-9]+\s*(bag|bags|pail|pails|box|boxes|bucket|buckets|drum|drums|case|cases|tote|totes|kit|kits|each|ea)\M';
 for mention in select regexp_matches(p_source_text,'(^|[^a-zA-Z0-9.#-])([0-9]+(?:\.[0-9]+)?)\s*(?:-\s*)?(?:\|\s*)?([a-zA-Z.]+)\M(?:\s*\.?\s*(?:[/-]\s*|per\s+)?(bag|bags|pail|pails|box|boxes|bucket|buckets|drum|drums|case|cases|tote|totes|kit|kits)\M)?','gi') loop
  mention_unit:=public.tenbot_invoice_unit(mention[3]); if mention_unit is null then continue;end if;
  mention_quantity:=mention[2]::numeric;
  per_container:=mention_unit in('LB','KG','GAL','L','OZ') and (mention[4] is not null or source_has_count and p_source_text ~* ('(?:[@×]|\mx\M|\mat\M|\meach\M)\s*'||replace(mention[2],'.','\.')||'\s*'||mention[3]||'\M'));
  if per_container then
   if package_quantity is null or mention_unit<>measure or mention_quantity<>package_quantity or mention[4] is not null and public.tenbot_invoice_unit(mention[4]) is distinct from container then raise exception 'Invoice package assertion conflicts with catalog evidence.' using errcode='22023'; end if;
   if source_unit=mention_unit and source_quantity=mention_quantity then raise exception 'Invoice source quantity is a package size, not the line total.' using errcode='22023';end if;
  elsif total is not null and mention_unit=(case when is_count then measure else source_unit end) and mention_quantity<>total then raise exception 'Conflicting source material totals require clarification.' using errcode='22023';
  elsif package_count is not null and mention_unit=(case when is_count then source_unit else container end) and mention_quantity<>package_count then raise exception 'Conflicting source package counts require clarification.' using errcode='22023';end if;
 end loop;
 return jsonb_build_object('sourceKind',case when is_count then 'package_count' else 'material_total' end,'packageCount',case when package_count is null then null else trim_scale(package_count)::text end,'perPackage',case when package_quantity is null then null else jsonb_build_object('quantity',trim_scale(package_quantity)::text,'unit',measure,'container',container) end,'totalMaterial',case when total is null then null else jsonb_build_object('quantity',trim_scale(total)::text,'unit',case when is_count then measure else source_unit end) end,'receivalQuantity',trim_scale(expected)::text,'receivalUnit',target,'inventoryStockingUnit',null,'calculation',calculation,'reasons','[]'::jsonb);
end $$;

create function public.tenbot_invoice_pending_duplicates(p_line jsonb) returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
declare matches jsonb; match_count integer; fingerprint text; ack text:=nullif(p_line->>'duplicateAcknowledgement','');
begin
 with candidates as(
  select pending.* from public.pending_receivals pending where pending.status<>'received'
   and public.tenbot_invoice_vendor_key(pending.vendor)=public.tenbot_invoice_vendor_key(p_line->>'vendor')
   and public.tenbot_invoice_text_key(pending.material_name)=public.tenbot_invoice_text_key(p_line->>'material')
   and public.tenbot_invoice_text_key(pending.size)=public.tenbot_invoice_text_key(p_line->>'size')
   and coalesce(pending.production_job_id::text,'')=coalesce(p_line->>'productionJobId','') and public.tenbot_invoice_text_key(pending.temporary_job_label)=''
 ), limited as(select * from candidates order by id limit 20)
 select (select count(*) from candidates),coalesce(jsonb_agg(jsonb_build_object('recordId',id,'source','tenops','supplier',vendor,'status',status,'materialName',material_name,'size',coalesce(size,''),'quantityExpected',quantity_expected::text,'quantityReceived',quantity_received::text,'unit',unit,'documentReference',null,'classification','possible','recordFingerprint',encode(sha256(convert_to(to_jsonb(limited)::text,'UTF8')),'hex'),'reason','Existing pending material for the same supplier, size and Job; invoice identity is not confirmed.') order by id),'[]'::jsonb) into match_count,matches from limited;
 fingerprint:=encode(sha256(convert_to(jsonb_build_object('matches',matches,'count',match_count)::text,'UTF8')),'hex');
 return jsonb_build_object('fingerprint',fingerprint,'matches',matches,'canAcknowledge',match_count between 1 and 20,'acknowledged',match_count between 1 and 20 and coalesce(ack=fingerprint,false),'matchedCount',match_count,'hasMore',match_count>20);
end $$;

create function public.tenbot_invoice_reviewed_line(p_line jsonb) returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
declare source text:=p_line->>'catalogSource'; catalog jsonb; proposal jsonb:=p_line->'newMaterial'; vendor_row jsonb; package_match text[]; order_unit text; selected_unit text; selected_job uuid; job_label text; vendor text; material text; size text; category text; quantity numeric; offer jsonb; normalized jsonb; basis jsonb; duplicate jsonb; package_quantity text; package_measure text; container text; supplier_matches integer;
begin
 if jsonb_typeof(p_line) is distinct from 'object' or (p_line-array['sourceLineId','catalogSource','catalogId','quantityExpected','unit','productionJobId','sourceQuantity','sourceText','newMaterial','duplicateAcknowledgement'])<>'{}'::jsonb
  or length(btrim(coalesce(p_line->>'sourceLineId',''))) not between 1 and 160
  or coalesce(p_line->>'quantityExpected','') !~ '^(0|[1-9][0-9]{0,8})(\.[0-9]{1,6})?$'
  or nullif(p_line->>'duplicateAcknowledgement','') is not null and p_line->>'duplicateAcknowledgement' !~ '^[a-f0-9]{64}$' then raise exception 'Invalid exact reviewed invoice line.' using errcode='22023'; end if;
 quantity:=(p_line->>'quantityExpected')::numeric;if quantity<=0 then raise exception 'Positive expected quantity required.' using errcode='22023';end if;
 if proposal is not null and proposal<>'null'::jsonb then
  perform public.require_app_capability('manageVendorsCatalog');
  if nullif(p_line->>'catalogId','') is not null or nullif(source,'') is not null
   or jsonb_typeof(proposal) is distinct from 'object' or (proposal-array['supplier','itemName','vendorSku','materialType','size','unitSize','unitSizeUom','packaging','priceUnit','notes','prepared'])<>'{}'::jsonb
   or proposal->'prepared' is distinct from 'true'::jsonb or coalesce(proposal->>'materialType','') not in('chip','resin','pigment','filler','other')
   or length(btrim(coalesce(proposal->>'itemName',''))) not between 1 and 160 or length(btrim(coalesce(proposal->>'supplier',''))) not between 1 and 160
   or proposal->>'materialType'='chip' and length(btrim(coalesce(proposal->>'size',''))) not between 1 and 160 then raise exception 'Complete one new catalog proposal instead of inventing an existing identity.' using errcode='22023'; end if;
  if exists(select 1 from jsonb_each(proposal) field where field.key<>'prepared' and (jsonb_typeof(field.value)<>'string' or length(field.value#>>'{}')>case when field.key='notes' then 1200 else 160 end or field.value#>>'{}' ~ '[[:cntrl:]]')) then raise exception 'Invalid bounded catalog fields.' using errcode='22023';end if;
  select count(*),min(id::text)::uuid into supplier_matches,selected_job from public.vendors where public.tenbot_invoice_vendor_key(name)=public.tenbot_invoice_vendor_key(proposal->>'supplier') and coalesce(is_active,true);
  if supplier_matches<>1 then raise exception 'Choose one existing active configured supplier.' using errcode='22023';end if;
  select jsonb_build_object('id',id,'name',name,'is_active',is_active) into vendor_row from public.vendors where id=selected_job;
  vendor:=btrim(vendor_row->>'name');material:=btrim(proposal->>'itemName');size:=btrim(coalesce(proposal->>'size',''));category:=case proposal->>'materialType' when 'chip' then 'Chip / Aggregate' when 'resin' then 'Resin' when 'pigment' then 'Pigment' when 'filler' then 'Filler' else 'Other' end;
  if exists(select 1 from public.vendor_catalog c where public.tenbot_invoice_vendor_key(c.vendor)=public.tenbot_invoice_vendor_key(vendor) and ((nullif(btrim(proposal->>'vendorSku'),'') is not null and lower(btrim(c.vendor_sku))=lower(btrim(proposal->>'vendorSku'))) or (public.tenbot_invoice_text_key(c.item_name)=public.tenbot_invoice_text_key(material) and public.tenbot_invoice_text_key(c.size)=public.tenbot_invoice_text_key(size))))
   or exists(select 1 from public.vendor_catalog_v2 c where public.tenbot_invoice_vendor_key(c.vendor_name)=public.tenbot_invoice_vendor_key(vendor) and ((nullif(btrim(proposal->>'vendorSku'),'') is not null and lower(btrim(c.vendor_sku))=lower(btrim(proposal->>'vendorSku'))) or (public.tenbot_invoice_text_key(coalesce(nullif(c.canonical_item_name,''),c.item_name))=public.tenbot_invoice_text_key(material) and public.tenbot_invoice_text_key(coalesce(nullif(c.canonical_size,''),c.size))=public.tenbot_invoice_text_key(size)))) then raise exception 'Catalog material or supplier SKU already exists; select its real identity.' using errcode='23505';end if;
  proposal:=jsonb_build_object('supplier',vendor,'itemName',material,'vendorSku',btrim(coalesce(proposal->>'vendorSku','')),'materialType',proposal->>'materialType','size',size,'unitSize',btrim(coalesce(proposal->>'unitSize','')),'unitSizeUom',btrim(coalesce(proposal->>'unitSizeUom','')),'packaging',btrim(coalesce(proposal->>'packaging','')),'priceUnit',btrim(coalesce(proposal->>'priceUnit','')),'notes',btrim(coalesce(proposal->>'notes','')),'prepared',true);
  order_unit:=public.tenbot_invoice_unit(proposal->>'priceUnit');package_quantity:=nullif(proposal->>'unitSize','');package_measure:=nullif(proposal->>'unitSizeUom','');container:=nullif(proposal->>'packaging','');
  if order_unit is null or (order_unit in('Bag','Pail','Box','Bucket','Drum','Case','Tote','Kit') or package_quantity is not null or package_measure is not null or container is not null) and (coalesce(package_quantity,'') !~ '^(0|[1-9][0-9]{0,8})(\.[0-9]{1,6})?$' or coalesce(package_quantity,'0')::numeric<=0 or public.tenbot_invoice_unit(package_measure) not in('LB','KG','GAL','L','OZ') or public.tenbot_invoice_unit(container) is distinct from order_unit) then raise exception 'Complete compatible package amount, measure, container and order unit.' using errcode='22023';end if;
 else
  proposal:=null;
  if nullif(p_line->>'catalogId','') is null or length(p_line->>'catalogId')>160 then raise exception 'Current catalog identity required.' using errcode='22023';end if;
  if source='standard' then
   select jsonb_build_object('id',id::text,'vendor',c.vendor,'item_name',item_name,'size',c.size,'category',c.category,'unit',unit,'vendor_sku',vendor_sku,'material_class',material_class) into catalog from public.vendor_catalog c where id::text=p_line->>'catalogId';
   vendor:=btrim(catalog->>'vendor');material:=btrim(catalog->>'item_name');size:=coalesce(catalog->>'size','');category:=coalesce(nullif(catalog->>'category',''),catalog->>'material_class','');
   package_match:=regexp_match(catalog->>'unit','([0-9]+(?:\.[0-9]+)?)\s*(pounds|pound|lbs|lb|kilograms|kilogram|kg|ounces|ounce|oz|gallons|gallon|gal|liters|liter|l)\.?\s*(bag|pail|box|bucket|drum|case|tote|kit)?','i');
   order_unit:=case when package_match is null then catalog->>'unit' else package_match[3] end;package_quantity:=package_match[1];package_measure:=package_match[2];container:=coalesce(package_match[3],catalog->>'unit');
  elsif source='specialty' then
   select jsonb_build_object('id',id::text,'vendor_id',vendor_id,'vendor_name',vendor_name,'item_name',item_name,'canonical_item_name',canonical_item_name,'size',c.size,'canonical_size',canonical_size,'category',c.category,'material_type',material_type,'packaging',packaging,'price_unit',price_unit,'unit_size',unit_size,'unit_size_uom',unit_size_uom,'vendor_sku',vendor_sku,'is_active',is_active) into catalog from public.vendor_catalog_v2 c where id::text=p_line->>'catalogId' and is_active;
   vendor:=btrim(catalog->>'vendor_name');material:=btrim(coalesce(nullif(catalog->>'canonical_item_name',''),catalog->>'item_name'));size:=coalesce(nullif(catalog->>'canonical_size',''),catalog->>'size','');category:=coalesce(nullif(catalog->>'category',''),catalog->>'material_type','');
   package_match:=regexp_match(catalog->>'packaging','([0-9]+(?:\.[0-9]+)?)\s*(pounds|pound|lbs|lb|kilograms|kilogram|kg|ounces|ounce|oz|gallons|gallon|gal|liters|liter|l)\.?\s*(bag|pail|box|bucket|drum|case|tote|kit)?','i');
   container:=coalesce(package_match[3],catalog->>'packaging');order_unit:=case when lower(btrim(coalesce(catalog->>'price_unit',''))) in('quote','call') then container else coalesce(nullif(btrim(catalog->>'price_unit'),''),container) end;
   package_quantity:=coalesce(nullif(catalog->>'unit_size',''),package_match[1]);package_measure:=coalesce(nullif(catalog->>'unit_size_uom',''),package_match[2]);
   if package_match is not null and ((nullif(catalog->>'unit_size','') is not null and (catalog->>'unit_size')::numeric<>package_match[1]::numeric) or (nullif(catalog->>'unit_size_uom','') is not null and public.tenbot_invoice_unit(catalog->>'unit_size_uom') is distinct from public.tenbot_invoice_unit(package_match[2]))) then raise exception 'Conflicting catalog package evidence.' using errcode='22023';end if;
  else raise exception 'Unknown catalog source.' using errcode='22023';end if;
  if catalog is null or nullif(vendor,'') is null or nullif(material,'') is null then raise exception 'Authorized catalog offer unavailable.' using errcode='22023';end if;
 end if;
 selected_unit:=public.tenbot_invoice_unit(p_line->>'unit');
 offer:=jsonb_build_object('orderUnit',order_unit,'packageQuantity',package_quantity,'packageMeasure',package_measure,'containerType',container);
 basis:=public.tenbot_invoice_quantity_basis(p_line->'sourceQuantity',offer,p_line->>'quantityExpected',p_line->>'unit',p_line->>'sourceText');
 selected_job:=nullif(p_line->>'productionJobId','')::uuid;
 if selected_job is not null then select case when nullif(btrim(job_number),'') is not null and nullif(btrim(name),'') is not null then btrim(job_number)||' — '||btrim(name) else coalesce(nullif(btrim(name),''),nullif(btrim(job_number),''),'Unnamed Production Job') end into job_label from public.jobs where id=selected_job and archived_at is null;if not found then raise exception 'Authorized current canonical Job unavailable.' using errcode='22023';end if;end if;
 normalized:=jsonb_build_object('sourceLineId',btrim(p_line->>'sourceLineId'),'catalogSource',case when proposal is null then source else null end,'catalogId',case when proposal is null then p_line->>'catalogId' else null end,'quantityExpected',trim_scale(quantity)::text,'unit',selected_unit,'productionJobId',selected_job,'vendor',vendor,'material',material,'size',size,'category',category,'jobLabel',job_label,'catalogSnapshot',catalog,'vendorSnapshot',vendor_row,'sourceQuantity',p_line->'sourceQuantity','sourceText',p_line->>'sourceText','quantityBasis',basis,'newMaterial',proposal,'duplicateAcknowledgement',nullif(p_line->>'duplicateAcknowledgement',''));
 duplicate:=public.tenbot_invoice_pending_duplicates(normalized);
 if jsonb_array_length(duplicate->'matches')=0 then normalized:=jsonb_set(normalized,'{duplicateAcknowledgement}','null'::jsonb);end if;
 return normalized||jsonb_build_object('duplicateReview',duplicate);
end $$;

revoke all on function public.tenbot_invoice_quantity_basis(jsonb,jsonb,text,text,text),public.tenbot_invoice_pending_duplicates(jsonb),public.tenbot_invoice_reviewed_line(jsonb) from public,anon,authenticated,service_role;
grant execute on function public.tenbot_invoice_quantity_basis(jsonb,jsonb,text,text,text),public.tenbot_invoice_pending_duplicates(jsonb),public.tenbot_invoice_reviewed_line(jsonb) to tenbot_invoice_executor;

create or replace function public.prepare_invoice_receival_draft(p_document jsonb,p_lines jsonb,p_metadata jsonb,p_provenance jsonb) returns jsonb language plpgsql security definer set search_path=pg_catalog,public set lock_timeout='3s' set statement_timeout='15s' as $$
declare item jsonb; normalized jsonb; normalized_lines jsonb:='[]'; payload jsonb; result public.invoice_receival_drafts; line_ids text[]:='{}'; material_keys text[]:='{}'; catalog_keys text[]:='{}'; material_key text; catalog_key text; supplier_key text; selected_order_date date; prior record;
begin
 perform public.tenbot_lock_invoice_actor();perform public.require_app_capability('readOperationalData');perform public.require_app_capability('writeBusinessData');perform public.require_app_capability('adjustInventory');
 if jsonb_typeof(p_document) is distinct from 'object' or (p_document-array['sha256','supplier','reference','documentDate'])<>'{}'::jsonb or coalesce(p_document->>'sha256','') !~ '^[a-f0-9]{64}$'
  or length(coalesce(p_document->>'supplier','')) not between 1 and 200 or length(coalesce(p_document->>'reference','')) not between 1 and 160
  or jsonb_typeof(p_metadata) is distinct from 'object' or (p_metadata-array['orderedBy','orderDate','location'])<>'{}'::jsonb
  or length(btrim(coalesce(p_metadata->>'orderedBy',''))) not between 1 and 160 or length(btrim(coalesce(p_metadata->>'location',''))) not between 1 and 160
  or coalesce(p_metadata->>'orderDate','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
  or jsonb_typeof(p_lines) is distinct from 'array' or jsonb_array_length(p_lines) not between 1 and 25
  or jsonb_typeof(p_provenance) is distinct from 'object' or (p_provenance-array['model','sourceMediaType','extractionSha256','toolTraceSha256'])<>'{}'::jsonb
  or length(btrim(coalesce(p_provenance->>'model',''))) not between 1 and 100 or coalesce(p_provenance->>'sourceMediaType','') not in('application/pdf','image/jpeg','image/png')
  or coalesce(p_provenance->>'extractionSha256','') !~ '^[a-f0-9]{64}$' or coalesce(p_provenance->>'toolTraceSha256','') !~ '^[a-f0-9]{64}$' then raise exception 'Invalid reviewed invoice draft.' using errcode='22023';end if;
 selected_order_date:=(p_metadata->>'orderDate')::date;if p_document->>'documentDate' is not null then perform (p_document->>'documentDate')::date;end if;
 supplier_key:=public.tenbot_invoice_vendor_key(p_document->>'supplier');
 if supplier_key='' or regexp_replace(lower(p_document->>'reference'),'[^a-z0-9]','','g')='' then raise exception 'Supplier and document reference required.' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':'||(p_document->>'sha256'),427902));
 if exists(select 1 from public.invoice_receival_document_claims where owner_user_id=auth.uid() and (attachment_sha256=p_document->>'sha256' or document_key=supplier_key||':'||regexp_replace(lower(p_document->>'reference'),'[^a-z0-9]','','g'))) then raise exception 'Document already claimed or conflicts with an existing receival request.' using errcode='23505';end if;
 for item in select value from jsonb_array_elements(p_lines) loop
  normalized:=public.tenbot_invoice_reviewed_line(item);
  if public.tenbot_invoice_vendor_key(normalized->>'vendor')<>supplier_key then raise exception 'Catalog supplier does not match invoice.' using errcode='22023';end if;
  material_key:=public.tenbot_invoice_text_key(normalized->>'material')||'|'||public.tenbot_invoice_text_key(normalized->>'size')||'|'||coalesce(normalized->>'productionJobId','');
  if normalized->>'sourceLineId'=any(line_ids) or material_key=any(material_keys) then raise exception 'Duplicate reviewed material/Job line.' using errcode='22023';end if;
  if normalized->'newMaterial'<>'null'::jsonb then
   catalog_key:=coalesce(nullif(lower(btrim(normalized->'newMaterial'->>'vendorSku')),''),public.tenbot_invoice_text_key(normalized->>'material')||'|'||public.tenbot_invoice_text_key(normalized->>'size'));
   if catalog_key=any(catalog_keys) then raise exception 'Repeated new catalog proposal requires one catalog identity.' using errcode='22023';end if;
   catalog_keys:=array_append(catalog_keys,catalog_key);
  end if;
  line_ids:=array_append(line_ids,normalized->>'sourceLineId');material_keys:=array_append(material_keys,material_key);normalized_lines:=normalized_lines||jsonb_build_array(normalized);
 end loop;
 payload:=jsonb_build_object('schemaVersion','invoice-receivals.v2','authorizationVersion',public.tenbot_invoice_authorization_version(),'document',jsonb_build_object('sha256',p_document->>'sha256','supplier',btrim(p_document->>'supplier'),'reference',btrim(p_document->>'reference'),'documentDate',p_document->>'documentDate'),'metadata',jsonb_build_object('orderedBy',btrim(p_metadata->>'orderedBy'),'orderDate',selected_order_date::text,'location',btrim(p_metadata->>'location')),'lines',normalized_lines,'provenance',p_provenance);
 -- A successful save is a new immutable review. The previous exact approval
 -- for this owner's same attachment can never execute after those edits.
 for prior in select id from public.invoice_receival_drafts d where owner_user_id=auth.uid() and d.payload->'document'->>'sha256'=p_document->>'sha256' and not exists(select 1 from public.invoice_receival_supersessions s where s.old_draft_id=d.id) order by id loop
  perform pg_advisory_xact_lock(hashtextextended(prior.id::text,427901));
  if exists(select 1 from public.invoice_receival_executions e where e.draft_id=prior.id) then raise exception 'An executed invoice cannot be replaced.' using errcode='23505';end if;
 end loop;
 insert into public.invoice_receival_drafts(owner_user_id,payload,content_hash) values(auth.uid(),payload,encode(sha256(convert_to(payload::text,'UTF8')),'hex')) returning * into result;
 insert into public.invoice_receival_supersessions(old_draft_id,new_draft_id,owner_user_id) select d.id,result.id,auth.uid() from public.invoice_receival_drafts d where d.owner_user_id=auth.uid() and d.id<>result.id and d.payload->'document'->>'sha256'=p_document->>'sha256' and not exists(select 1 from public.invoice_receival_supersessions s where s.old_draft_id=d.id);
 insert into public.invoice_receival_audit(draft_id,owner_user_id,event,content_hash,details) values(result.id,auth.uid(),'prepared',result.content_hash,jsonb_build_object('provenance',p_provenance,'provenanceTrust','untrusted_claims_bound_to_review','lineCount',jsonb_array_length(normalized_lines),'newCatalogCount',(select count(*) from jsonb_array_elements(normalized_lines) l where l->'newMaterial'<>'null'::jsonb)));
 return result.payload||jsonb_build_object('id',result.id,'hash',result.content_hash,'ownerId',result.owner_user_id,'expiresAt',result.expires_at);
end $$;

create or replace function public.get_invoice_receival_draft(p_draft_id uuid) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare draft public.invoice_receival_drafts; execution public.invoice_receival_executions;
begin
 if auth.role() is distinct from 'authenticated' or auth.uid() is null then raise exception 'Employee authentication required.' using errcode='42501';end if;
 perform public.require_app_capability('readOperationalData');perform public.require_app_capability('writeBusinessData');perform public.require_app_capability('adjustInventory');
 select * into draft from public.invoice_receival_drafts where id=p_draft_id and owner_user_id=auth.uid();if not found then raise exception 'Review draft unavailable.' using errcode='P0002';end if;
 select * into execution from public.invoice_receival_executions where draft_id=draft.id and owner_user_id=auth.uid();
 return draft.payload||jsonb_build_object('id',draft.id,'hash',draft.content_hash,'ownerId',draft.owner_user_id,'expiresAt',draft.expires_at,'superseded',exists(select 1 from public.invoice_receival_supersessions where old_draft_id=draft.id),'revoked',exists(select 1 from public.invoice_receival_revocations where draft_id=draft.id),'execution',case when execution.draft_id is null then null else jsonb_build_object('draftId',execution.draft_id,'hash',execution.content_hash,'createdRecordIds',to_jsonb(execution.created_record_ids),'createdCatalogRecords',execution.created_catalog_records,'idempotent',true,'executedAt',execution.executed_at) end);
end $$;

create function public.revoke_invoice_receival_draft(p_draft_id uuid,p_expected_hash text) returns jsonb language plpgsql security definer set search_path=pg_catalog,public set lock_timeout='3s' set statement_timeout='10s' as $$
declare draft public.invoice_receival_drafts;
begin
 perform public.tenbot_lock_invoice_actor();perform pg_advisory_xact_lock(hashtextextended(p_draft_id::text,427901));
 perform public.require_app_capability('readOperationalData');perform public.require_app_capability('writeBusinessData');perform public.require_app_capability('adjustInventory');
 select * into draft from public.invoice_receival_drafts where id=p_draft_id and owner_user_id=auth.uid();
 if draft.id is null or draft.content_hash is distinct from p_expected_hash then raise exception 'Current owned immutable draft required.' using errcode='22023';end if;
 if exists(select 1 from public.invoice_receival_executions where draft_id=draft.id) then raise exception 'An executed operation cannot be edited or revoked.' using errcode='22023';end if;
 insert into public.invoice_receival_revocations(draft_id,owner_user_id) values(draft.id,auth.uid()) on conflict(draft_id) do nothing;
 return jsonb_build_object('draftId',draft.id,'hash',draft.content_hash,'revoked',true);
end $$;
grant create on schema public to tenbot_invoice_executor;
alter function public.revoke_invoice_receival_draft(uuid,text) owner to tenbot_invoice_executor;
revoke create on schema public from tenbot_invoice_executor;
revoke all on function public.revoke_invoice_receival_draft(uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.revoke_invoice_receival_draft(uuid,text) to authenticated;

create or replace function public.approve_invoice_receival_draft(p_draft_id uuid,p_expected_hash text,p_confirmation text) returns jsonb language plpgsql security definer set search_path=pg_catalog,public set lock_timeout='3s' set statement_timeout='15s' as $$
declare draft public.invoice_receival_drafts; approval public.invoice_receival_approvals; item jsonb;
begin
 perform public.tenbot_lock_invoice_actor();perform pg_advisory_xact_lock(hashtextextended(p_draft_id::text,427901));
 perform public.require_app_capability('readOperationalData');perform public.require_app_capability('writeBusinessData');perform public.require_app_capability('adjustInventory');
 select * into draft from public.invoice_receival_drafts where id=p_draft_id and owner_user_id=auth.uid();
 if draft.id is null or draft.content_hash is distinct from p_expected_hash or p_confirmation is distinct from 'CREATE_REVIEWED_PENDING_RECEIVALS' or draft.payload->>'schemaVersion' is distinct from 'invoice-receivals.v2' or draft.payload->>'authorizationVersion' is distinct from public.tenbot_invoice_authorization_version() then raise exception 'Current immutable draft and current employee approval required.' using errcode='22023';end if;
 if exists(select 1 from public.invoice_receival_supersessions where old_draft_id=draft.id) or exists(select 1 from public.invoice_receival_revocations where draft_id=draft.id) then raise exception 'Draft was edited or revoked; review its replacement.' using errcode='22023';end if;
 for item in select value from jsonb_array_elements(draft.payload->'lines') loop
  if item->'newMaterial'<>'null'::jsonb then perform public.require_app_capability('manageVendorsCatalog');end if;
  if coalesce((item->'duplicateReview'->>'matchedCount')::integer,0)>0 and item->'duplicateReview'->>'acknowledged' is distinct from 'true' then raise exception 'Explicit acknowledgement of current potential duplicate evidence is required.' using errcode='23505';end if;
 end loop;
 select * into approval from public.invoice_receival_approvals where draft_id=draft.id and owner_user_id=auth.uid();
 if approval.id is not null and exists(select 1 from public.invoice_receival_executions where draft_id=draft.id and approval_id=approval.id and owner_user_id=auth.uid() and content_hash=draft.content_hash) then return jsonb_build_object('id',approval.id,'draftId',draft.id,'hash',draft.content_hash,'expiresAt',approval.expires_at);end if;
 if draft.expires_at<=clock_timestamp() or approval.id is not null and approval.expires_at<=clock_timestamp() then raise exception 'Approval expired; prepare and review a fresh draft.' using errcode='22023';end if;
 if approval.id is null then
  insert into public.invoice_receival_approvals(draft_id,owner_user_id,content_hash,confirmation,expires_at) values(draft.id,auth.uid(),draft.content_hash,p_confirmation,least(draft.expires_at,clock_timestamp()+interval '10 minutes')) returning * into approval;
  insert into public.invoice_receival_audit(draft_id,owner_user_id,event,content_hash,details) values(draft.id,auth.uid(),'approved',draft.content_hash,jsonb_build_object('approvalId',approval.id,'confirmation',p_confirmation,'authorizationVersion',draft.payload->>'authorizationVersion'));
 end if;
 return jsonb_build_object('id',approval.id,'draftId',draft.id,'hash',draft.content_hash,'expiresAt',approval.expires_at);
end $$;

create or replace function public.execute_invoice_receival_draft(p_draft_id uuid,p_expected_hash text,p_approval_id uuid) returns jsonb language plpgsql security definer set search_path=pg_catalog,public set lock_timeout='3s' set statement_timeout='15s' as $$
declare draft public.invoice_receival_drafts; approval public.invoice_receival_approvals; replay public.invoice_receival_executions; item jsonb; current_line jsonb; pending_id uuid; created_ids uuid[]:='{}'; created_catalog jsonb:='[]'; catalog_id uuid; catalog_line jsonb; document_key text; executed timestamptz; expected_count integer;
begin
 perform public.tenbot_lock_invoice_actor();perform pg_advisory_xact_lock(hashtextextended(p_draft_id::text,427901));perform public.tenbot_lock_invoice_resources();
 perform public.require_app_capability('readOperationalData');perform public.require_app_capability('writeBusinessData');perform public.require_app_capability('adjustInventory');
 if not exists(select 1 from public.tenbot_receival_execution_control where singleton and execution_enabled and validated_at is not null and nullif(btrim(isolated_validation_receipt),'') is not null) then raise exception 'Pending-receival execution is disabled until isolated validation and activation.' using errcode='42501';end if;
 select * into draft from public.invoice_receival_drafts where id=p_draft_id and owner_user_id=auth.uid();select * into approval from public.invoice_receival_approvals where id=p_approval_id and draft_id=p_draft_id and owner_user_id=auth.uid();
 if draft.id is null or approval.id is null or draft.content_hash is distinct from p_expected_hash or approval.content_hash is distinct from p_expected_hash or draft.payload->>'schemaVersion' is distinct from 'invoice-receivals.v2' or draft.payload->>'authorizationVersion' is distinct from public.tenbot_invoice_authorization_version() then raise exception 'Current immutable draft approval and unchanged employee permissions required.' using errcode='22023';end if;
 if encode(sha256(convert_to(draft.payload::text,'UTF8')),'hex')<>draft.content_hash or exists(select 1 from public.invoice_receival_supersessions where old_draft_id=draft.id) or exists(select 1 from public.invoice_receival_revocations where draft_id=draft.id) then raise exception 'Review integrity failed or draft was edited/revoked.' using errcode='22023';end if;
 for item in select value from jsonb_array_elements(draft.payload->'lines') loop if item->'newMaterial'<>'null'::jsonb then perform public.require_app_capability('manageVendorsCatalog');end if;end loop;
 select * into replay from public.invoice_receival_executions where draft_id=draft.id and owner_user_id=auth.uid();
 if found then
  if replay.approval_id<>approval.id or replay.content_hash<>draft.content_hash then raise exception 'Approval replay mismatch.' using errcode='22023';end if;
  -- RLS can still revoke visibility of a created Job-linked record.
  if (select count(*) from public.pending_receivals where id=any(replay.created_record_ids))<>cardinality(replay.created_record_ids) then raise exception 'Created records are not currently authorized.' using errcode='42501';end if;
  return jsonb_build_object('draftId',draft.id,'hash',draft.content_hash,'createdRecordIds',to_jsonb(replay.created_record_ids),'createdCatalogRecords',replay.created_catalog_records,'idempotent',true,'executedAt',replay.executed_at);
 end if;
 if draft.expires_at<=clock_timestamp() or approval.expires_at<=clock_timestamp() then raise exception 'Approval expired; prepare and review a fresh draft.' using errcode='22023';end if;
 -- Revalidate every existing identity/proposed operation, quantity, Job and
 -- duplicate evidence while canonical/manual writers are excluded by locks.
 for item in select value from jsonb_array_elements(draft.payload->'lines') loop
  current_line:=public.tenbot_invoice_reviewed_line(item-array['vendor','material','size','category','jobLabel','catalogSnapshot','vendorSnapshot','quantityBasis','duplicateReview']);
  if current_line is distinct from item then raise exception 'Catalog, supplier, Job or duplicate evidence changed; review again.' using errcode='22023';end if;
  if (item->'duplicateReview'->>'matchedCount')::integer>0 and item->'duplicateReview'->>'acknowledged' is distinct from 'true' then raise exception 'Potential duplicate acknowledgement is unresolved.' using errcode='23505';end if;
 end loop;
 document_key:=public.tenbot_invoice_vendor_key(draft.payload->'document'->>'supplier')||':'||regexp_replace(lower(draft.payload->'document'->>'reference'),'[^a-z0-9]','','g');
 begin insert into public.invoice_receival_document_claims(document_key,attachment_sha256,draft_id,owner_user_id) values(document_key,draft.payload->'document'->>'sha256',draft.id,auth.uid());exception when unique_violation then raise exception 'Document already claimed or conflicts with an existing receival request.' using errcode='23505';end;
 for item in select value from jsonb_array_elements(draft.payload->'lines') loop
  if item->'newMaterial'<>'null'::jsonb then
   perform public.require_app_capability('manageVendorsCatalog');
   -- Exact canonical Catalog service used by Purchasing; never an arbitrary
   -- INSERT payload, fabricated ID, catalog update or automatic price guess.
   catalog_id:=public.save_purchasing_catalog_item_v2(jsonb_build_object('id',null,'vendor_id',item->'vendorSnapshot'->>'id','vendor_sku',nullif(item->'newMaterial'->>'vendorSku',''),'item_name',item->'newMaterial'->>'itemName','category',item->>'category','size',nullif(item->>'size',''),'unit_size',nullif(item->'newMaterial'->>'unitSize',''),'unit_size_uom',nullif(item->'newMaterial'->>'unitSizeUom',''),'packaging',nullif(item->'newMaterial'->>'packaging',''),'price',null,'price_unit',item->'newMaterial'->>'priceUnit','material_type',item->'newMaterial'->>'materialType','notes',nullif(item->'newMaterial'->>'notes',''),'is_active',true));
   if catalog_id is null then raise exception 'Canonical catalog creation returned no identity.' using errcode='22023';end if;
   select to_jsonb(c) into catalog_line from public.vendor_catalog_v2 c where id=catalog_id and is_active;
   if catalog_line is null or public.tenbot_invoice_vendor_key(catalog_line->>'vendor_name')<>public.tenbot_invoice_vendor_key(item->>'vendor')
    or coalesce(nullif(catalog_line->>'canonical_item_name',''),catalog_line->>'item_name')<>item->>'material'
    or coalesce(nullif(catalog_line->>'canonical_size',''),catalog_line->>'size','')<>item->>'size'
    or nullif(catalog_line->>'unit_size','')::numeric is distinct from nullif(item->'newMaterial'->>'unitSize','')::numeric
    or public.tenbot_invoice_unit(catalog_line->>'unit_size_uom') is distinct from public.tenbot_invoice_unit(item->'newMaterial'->>'unitSizeUom')
    or public.tenbot_invoice_unit(catalog_line->>'price_unit') is distinct from public.tenbot_invoice_unit(item->'newMaterial'->>'priceUnit')
    or coalesce(catalog_line->>'packaging','')<>coalesce(item->'newMaterial'->>'packaging','') then raise exception 'Created catalog identity/package is not currently authorized or exact.' using errcode='22023';end if;
   created_catalog:=created_catalog||jsonb_build_array(jsonb_build_object('sourceLineId',item->>'sourceLineId','catalogSource','specialty','catalogId',catalog_id));
  end if;
  -- Same canonical pending-receival row shape and existing RLS/triggers as the
  -- manual Inventory form: pending + zero received; no on-hand transaction.
  insert into public.pending_receivals(vendor,material_name,size,category,quantity_expected,quantity_received,unit,location,pallet_number,status,ordered_by,order_date,received_by,eta,notes,received_at,is_earmarked,earmarked_job_name,earmark_notes,production_job_id,temporary_job_label)
  values(item->>'vendor',item->>'material',nullif(btrim(item->>'size'),''),nullif(btrim(item->>'category'),''),(item->>'quantityExpected')::numeric,0,item->>'unit',draft.payload->'metadata'->>'location',null,'pending',draft.payload->'metadata'->>'orderedBy',(draft.payload->'metadata'->>'orderDate')::date,null,null,'Invoice '||(draft.payload->'document'->>'reference')||'; reviewed draft '||draft.id::text,null,item->>'productionJobId' is not null,item->>'jobLabel',null,nullif(item->>'productionJobId','')::uuid,null) returning id into pending_id;
  -- A column scale or canonical trigger may reject a value, but cannot silently
  -- round the reviewed quantity or alter its business identity before commit.
  if not exists(select 1 from public.pending_receivals actual where actual.id=pending_id and actual.status='pending' and actual.quantity_received=0
    and actual.quantity_expected=(item->>'quantityExpected')::numeric and actual.unit=item->>'unit' and actual.vendor=item->>'vendor' and actual.material_name=item->>'material'
    and coalesce(actual.size,'')=item->>'size' and actual.production_job_id is not distinct from nullif(item->>'productionJobId','')::uuid and actual.temporary_job_label is null) then raise exception 'Created receival differs from the exact approved quantity or identity.' using errcode='22023';end if;
  created_ids:=array_append(created_ids,pending_id);
 end loop;
 perform public.require_app_capability('readOperationalData');perform public.require_app_capability('writeBusinessData');perform public.require_app_capability('adjustInventory');
 if draft.payload->>'authorizationVersion' is distinct from public.tenbot_invoice_authorization_version() or draft.expires_at<=clock_timestamp() or approval.expires_at<=clock_timestamp() then raise exception 'Approval or permission changed before completion.' using errcode='22023';end if;
 expected_count:=jsonb_array_length(draft.payload->'lines');if cardinality(created_ids)<>expected_count or (select count(*) from public.pending_receivals where id=any(created_ids) and status='pending' and quantity_received=0)<>expected_count then raise exception 'Created pending records could not be verified.' using errcode='42501';end if;
 executed:=clock_timestamp();
 insert into public.invoice_receival_executions(draft_id,approval_id,owner_user_id,content_hash,created_record_ids,created_catalog_records,executed_at) values(draft.id,approval.id,auth.uid(),draft.content_hash,created_ids,created_catalog,executed);
 insert into public.invoice_receival_audit(draft_id,owner_user_id,event,content_hash,details) values(draft.id,auth.uid(),'executed',draft.content_hash,jsonb_build_object('approvalId',approval.id,'createdRecordIds',to_jsonb(created_ids),'createdCatalogRecords',created_catalog,'documentIdentity',document_key,'provenance',draft.payload->'provenance','authorizationVersion',draft.payload->>'authorizationVersion'));
 return jsonb_build_object('draftId',draft.id,'hash',draft.content_hash,'createdRecordIds',to_jsonb(created_ids),'createdCatalogRecords',created_catalog,'idempotent',false,'executedAt',executed);
end $$;

-- CREATE OR REPLACE preserves the four entry points' non-bypass owner. Assert
-- that invariant instead of widening role membership or business table grants.
do $owners$ begin
 if exists(select 1 from pg_proc p where p.oid in('public.prepare_invoice_receival_draft(jsonb,jsonb,jsonb,jsonb)'::regprocedure,'public.get_invoice_receival_draft(uuid)'::regprocedure,'public.approve_invoice_receival_draft(uuid,text,text)'::regprocedure,'public.execute_invoice_receival_draft(uuid,text,uuid)'::regprocedure) and pg_get_userbyid(p.proowner)<>'tenbot_invoice_executor') then raise exception 'Invoice entry points must retain the RLS-bound executor owner.';end if;
end $owners$;
notify pgrst,'reload schema';
commit;
