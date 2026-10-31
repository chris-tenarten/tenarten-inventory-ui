-- Forward-only local correction after real isolated PostgreSQL validation.
-- Prior 120000 migration remains byte-for-byte unchanged. Qualify invoice
-- variables separately from catalog columns; track read-only revoke/regrant.
begin;
set local lock_timeout='3s';
set local statement_timeout='15s';

create or replace function public.tenbot_invoice_permission_changed() returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare key text;
begin
 if tg_table_name='app_role_capabilities' then
  if tg_op='UPDATE' and to_jsonb(new)=to_jsonb(old) then return new; end if;
  key:='capabilities';
 else
  if tg_op='UPDATE' and new.role is not distinct from old.role and new.is_active is not distinct from old.is_active and new.user_id is not distinct from old.user_id and (to_jsonb(new)->'read_only') is not distinct from (to_jsonb(old)->'read_only') then return new; end if;
  key:='actor:'||case when tg_op='DELETE' then old.user_id else new.user_id end::text;
 end if;
 insert into public.invoice_receival_permission_epochs(scope,revision) values(key,1)
 on conflict(scope) do update set revision=invoice_receival_permission_epochs.revision+1;
 if tg_op='DELETE' then return old; end if; return new;
end $$;

create or replace function public.tenbot_invoice_reviewed_line(p_line jsonb) returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
<<invoice_line>>
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
  select count(*),min(configured.id::text)::uuid into supplier_matches,selected_job from public.vendors configured where public.tenbot_invoice_vendor_key(configured.name)=public.tenbot_invoice_vendor_key(invoice_line.proposal->>'supplier') and coalesce(configured.is_active,true);
  if supplier_matches<>1 then raise exception 'Choose one existing active configured supplier.' using errcode='22023';end if;
  select jsonb_build_object('id',configured.id,'name',configured.name,'is_active',configured.is_active) into vendor_row from public.vendors configured where configured.id=invoice_line.selected_job;
  vendor:=btrim(vendor_row->>'name');material:=btrim(proposal->>'itemName');size:=btrim(coalesce(proposal->>'size',''));category:=case proposal->>'materialType' when 'chip' then 'Chip / Aggregate' when 'resin' then 'Resin' when 'pigment' then 'Pigment' when 'filler' then 'Filler' else 'Other' end;
  if exists(select 1 from public.vendor_catalog c where public.tenbot_invoice_vendor_key(c.vendor)=public.tenbot_invoice_vendor_key(invoice_line.vendor) and ((nullif(btrim(proposal->>'vendorSku'),'') is not null and lower(btrim(c.vendor_sku))=lower(btrim(proposal->>'vendorSku'))) or (public.tenbot_invoice_text_key(c.item_name)=public.tenbot_invoice_text_key(invoice_line.material) and public.tenbot_invoice_text_key(c.size)=public.tenbot_invoice_text_key(invoice_line.size))))
   or exists(select 1 from public.vendor_catalog_v2 c where public.tenbot_invoice_vendor_key(c.vendor_name)=public.tenbot_invoice_vendor_key(invoice_line.vendor) and ((nullif(btrim(proposal->>'vendorSku'),'') is not null and lower(btrim(c.vendor_sku))=lower(btrim(proposal->>'vendorSku'))) or (public.tenbot_invoice_text_key(coalesce(nullif(c.canonical_item_name,''),c.item_name))=public.tenbot_invoice_text_key(invoice_line.material) and public.tenbot_invoice_text_key(coalesce(nullif(c.canonical_size,''),c.size))=public.tenbot_invoice_text_key(invoice_line.size)))) then raise exception 'Catalog material or supplier SKU already exists; select its real identity.' using errcode='23505';end if;
  proposal:=jsonb_build_object('supplier',vendor,'itemName',material,'vendorSku',btrim(coalesce(proposal->>'vendorSku','')),'materialType',proposal->>'materialType','size',size,'unitSize',btrim(coalesce(proposal->>'unitSize','')),'unitSizeUom',btrim(coalesce(proposal->>'unitSizeUom','')),'packaging',btrim(coalesce(proposal->>'packaging','')),'priceUnit',btrim(coalesce(proposal->>'priceUnit','')),'notes',btrim(coalesce(proposal->>'notes','')),'prepared',true);
  order_unit:=public.tenbot_invoice_unit(proposal->>'priceUnit');package_quantity:=nullif(proposal->>'unitSize','');package_measure:=nullif(proposal->>'unitSizeUom','');container:=nullif(proposal->>'packaging','');
  if order_unit is null or (order_unit in('Bag','Pail','Box','Bucket','Drum','Case','Tote','Kit') or package_quantity is not null or package_measure is not null or container is not null) and (coalesce(package_quantity,'') !~ '^(0|[1-9][0-9]{0,8})(\.[0-9]{1,6})?$' or coalesce(package_quantity,'0')::numeric<=0 or public.tenbot_invoice_unit(package_measure) not in('LB','KG','GAL','L','OZ') or public.tenbot_invoice_unit(container) is distinct from order_unit) then raise exception 'Complete compatible package amount, measure, container and order unit.' using errcode='22023';end if;
 else
  proposal:=null;
  if nullif(p_line->>'catalogId','') is null or length(p_line->>'catalogId')>160 then raise exception 'Current catalog identity required.' using errcode='22023';end if;
  if source='standard' then
   select jsonb_build_object('id',c.id::text,'vendor',c.vendor,'item_name',c.item_name,'size',c.size,'category',c.category,'unit',c.unit,'vendor_sku',c.vendor_sku,'material_class',c.material_class) into catalog from public.vendor_catalog c where c.id::text=p_line->>'catalogId';
   vendor:=btrim(catalog->>'vendor');material:=btrim(catalog->>'item_name');size:=coalesce(catalog->>'size','');category:=coalesce(nullif(catalog->>'category',''),catalog->>'material_class','');
   package_match:=regexp_match(catalog->>'unit','([0-9]+(?:\.[0-9]+)?)\s*(pounds|pound|lbs|lb|kilograms|kilogram|kg|ounces|ounce|oz|gallons|gallon|gal|liters|liter|l)\.?\s*(bag|pail|box|bucket|drum|case|tote|kit)?','i');
   order_unit:=case when package_match is null then catalog->>'unit' else package_match[3] end;package_quantity:=package_match[1];package_measure:=package_match[2];container:=coalesce(package_match[3],catalog->>'unit');
  elsif source='specialty' then
   select jsonb_build_object('id',c.id::text,'vendor_id',c.vendor_id,'vendor_name',c.vendor_name,'item_name',c.item_name,'canonical_item_name',c.canonical_item_name,'size',c.size,'canonical_size',c.canonical_size,'category',c.category,'material_type',c.material_type,'packaging',c.packaging,'price_unit',c.price_unit,'unit_size',c.unit_size,'unit_size_uom',c.unit_size_uom,'vendor_sku',c.vendor_sku,'is_active',c.is_active) into catalog from public.vendor_catalog_v2 c where c.id::text=p_line->>'catalogId' and c.is_active;
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
 if selected_job is not null then select case when nullif(btrim(job.job_number),'') is not null and nullif(btrim(job.name),'') is not null then btrim(job.job_number)||' — '||btrim(job.name) else coalesce(nullif(btrim(job.name),''),nullif(btrim(job.job_number),''),'Unnamed Production Job') end into job_label from public.jobs job where job.id=invoice_line.selected_job and job.archived_at is null;if not found then raise exception 'Authorized current canonical Job unavailable.' using errcode='22023';end if;end if;
 normalized:=jsonb_build_object('sourceLineId',btrim(p_line->>'sourceLineId'),'catalogSource',case when proposal is null then source else null end,'catalogId',case when proposal is null then p_line->>'catalogId' else null end,'quantityExpected',trim_scale(quantity)::text,'unit',selected_unit,'productionJobId',selected_job,'vendor',vendor,'material',material,'size',size,'category',category,'jobLabel',job_label,'catalogSnapshot',catalog,'vendorSnapshot',vendor_row,'sourceQuantity',p_line->'sourceQuantity','sourceText',p_line->>'sourceText','quantityBasis',basis,'newMaterial',proposal,'duplicateAcknowledgement',nullif(p_line->>'duplicateAcknowledgement',''));
 duplicate:=public.tenbot_invoice_pending_duplicates(normalized);
 if jsonb_array_length(duplicate->'matches')=0 then normalized:=jsonb_set(normalized,'{duplicateAcknowledgement}','null'::jsonb);end if;
 return normalized||jsonb_build_object('duplicateReview',duplicate);
end $$;


notify pgrst,'reload schema';
commit;
