-- Forward-only quantity-evidence correction. One existing pure canonical function
-- changes; no historical data, grants, roles, RLS, action or financial controls.
-- Separate same-line totals and package labels retain distinct provenance.
begin;
set local lock_timeout='3s';set local statement_timeout='30s';
do $quantity_contract_preflight$ declare fn pg_proc;begin
 select * into fn from pg_proc where oid=to_regprocedure('public.tenbot_invoice_quantity_basis(jsonb,jsonb,text,text,text)');
 if not found or md5(fn.prosrc) is distinct from 'c9616fb63241ce96de7c186f8a8c40e2' or pg_get_userbyid(fn.proowner)<>'postgres' or fn.prosecdef or fn.provolatile<>'v'
  or array(select x::text from unnest(fn.proacl)x order by x::text) is distinct from array['postgres=X/postgres','tenbot_invoice_executor=X/postgres']::text[]
  or coalesce(array_length(fn.proconfig,1),0)<>1 or regexp_replace(fn.proconfig[1],'[[:space:]]','','g')<>'search_path=pg_catalog,public'
 then raise exception 'Reviewed canonical quantity function body/owner/ACL/configuration required.';end if;
end $quantity_contract_preflight$;

create or replace function public.tenbot_invoice_quantity_basis(p_source jsonb,p_offer jsonb,p_quantity text,p_unit text,p_source_text text) returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
declare source_quantity numeric; source_unit text; target text; package_quantity numeric; measure text; container text;
 is_count boolean; expected numeric; package_count numeric; total numeric; calculation text; mention text[]; mention_unit text; mention_quantity numeric; per_container boolean;
 scan_offset integer:=1; matched_start integer; matched_end integer; quantity_start integer; line_start integer; fragment text; before_text text; after_text text; following text[]; following_unit text;
 parenthesis_depth integer:=0;parenthesis_offset integer:=1;
 prior_count boolean:=false; assertions jsonb:='[]'::jsonb; assertion jsonb; independent_lines integer[]:='{}'::integer[];
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
 -- Classify each actual occurrence using the same before/after context as
 -- deriveInvoiceQuantity. A later factor must not classify an earlier total.
 while scan_offset<=length(p_source_text) loop
  fragment:=substring(p_source_text from scan_offset);
  mention:=regexp_match(fragment,'((^|[^a-zA-Z0-9.#-])([0-9]+(?:\.[0-9]+)?)\s*(?:-\s*)?(?:\|\s*)?([a-zA-Z.]+)\M)','i');
  exit when mention is null;
  matched_start:=scan_offset+strpos(fragment,mention[1])-1;matched_end:=matched_start+length(mention[1])-1;
  quantity_start:=matched_start+length(coalesce(mention[2],''));scan_offset:=matched_end+1;
  mention_unit:=public.tenbot_invoice_unit(mention[4]);if mention_unit is null then continue;end if;
  mention_quantity:=mention[3]::numeric;before_text:=left(p_source_text,quantity_start-1);after_text:=substring(p_source_text from matched_end+1);
  following:=regexp_match(after_text,'^\s*\.?\s*(?:[/-]\s*|per\s+)?(bag|bags|pail|pails|box|boxes|bucket|buckets|drum|drums|case|cases|tote|totes|kit|kits)\M','i');
  following_unit:=case when following is null then null else public.tenbot_invoice_unit(following[1]) end;
  per_container:=mention_unit in('LB','KG','GAL','L','OZ') and (following is not null or prior_count and before_text ~* '[@×]\s*$|\mx\M\s*$|\m(at|each)\M\s*$');
  line_start:=length(before_text)-length(regexp_replace(before_text,E'^.*[\r\n]','','s'));
  -- Parenthesized bare repeats are package annotations, not independent totals.
  while parenthesis_offset<quantity_start loop
   if substring(p_source_text from parenthesis_offset for 1)='(' then parenthesis_depth:=parenthesis_depth+1;
   elsif substring(p_source_text from parenthesis_offset for 1)=')' and parenthesis_depth>0 then parenthesis_depth:=parenthesis_depth-1;end if;
   parenthesis_offset:=parenthesis_offset+1;
  end loop;
  assertions:=assertions||jsonb_build_array(jsonb_build_object('quantity',mention_quantity,'unit',mention_unit,'perContainer',per_container,'container',following_unit,'lineStart',line_start));
  if not is_count and not per_container and parenthesis_depth=0 and mention_unit=source_unit and mention_quantity=source_quantity then independent_lines:=array_append(independent_lines,line_start);end if;
  if mention_unit not in('LB','KG','GAL','L','OZ') then prior_count:=true;end if;
 end loop;
 for assertion in select value from jsonb_array_elements(assertions) loop
  mention_unit:=assertion->>'unit';mention_quantity:=(assertion->>'quantity')::numeric;following_unit:=assertion->>'container';line_start:=(assertion->>'lineStart')::integer;
  if (assertion->>'perContainer')::boolean then
   if package_quantity is null or mention_unit<>measure or mention_quantity<>package_quantity or following_unit is not null and following_unit is distinct from container then raise exception 'Invoice package assertion conflicts with catalog evidence.' using errcode='22023'; end if;
   -- One package may equal the material total only when a distinct non-package
   -- assertion on this physical line independently proves that exact total.
   if source_unit=mention_unit and source_quantity=mention_quantity and not(line_start=any(independent_lines)) then raise exception 'Invoice source quantity is a package size, not the line total.' using errcode='22023';end if;
  elsif total is not null and mention_unit=(case when is_count then measure else source_unit end) and mention_quantity<>total then raise exception 'Conflicting source material totals require clarification.' using errcode='22023';
  elsif package_count is not null and mention_unit=(case when is_count then source_unit else container end) and mention_quantity<>package_count then raise exception 'Conflicting source package counts require clarification.' using errcode='22023';end if;
 end loop;
 return jsonb_build_object('sourceKind',case when is_count then 'package_count' else 'material_total' end,'packageCount',case when package_count is null then null else trim_scale(package_count)::text end,'perPackage',case when package_quantity is null then null else jsonb_build_object('quantity',trim_scale(package_quantity)::text,'unit',measure,'container',container) end,'totalMaterial',case when total is null then null else jsonb_build_object('quantity',trim_scale(total)::text,'unit',case when is_count then measure else source_unit end) end,'receivalQuantity',trim_scale(expected)::text,'receivalUnit',target,'inventoryStockingUnit',null,'calculation',calculation,'reasons','[]'::jsonb);
end $$;

do $quantity_contract_readback$ declare fn pg_proc;begin
 select * into fn from pg_proc where oid=to_regprocedure('public.tenbot_invoice_quantity_basis(jsonb,jsonb,text,text,text)');
 if not found or pg_get_userbyid(fn.proowner)<>'postgres' or fn.prosecdef or fn.provolatile<>'v'
  or array(select x::text from unnest(fn.proacl)x order by x::text) is distinct from array['postgres=X/postgres','tenbot_invoice_executor=X/postgres']::text[]
  or coalesce(array_length(fn.proconfig,1),0)<>1 or regexp_replace(fn.proconfig[1],'[[:space:]]','','g')<>'search_path=pg_catalog,public'
 then raise exception 'Canonical quantity authorization metadata changed.';end if;
end $quantity_contract_readback$;
commit;
