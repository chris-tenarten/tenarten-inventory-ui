-- PO intent uses existing canonical Job-reserved Inventory semantics; no demand ledger.
begin;
-- Fail closed against the read-only Production capture dated 2026-09-23.
-- Fingerprints include full definitions, attributes, owner and effective grants.
-- Only CRLF/LF transport normalization is allowed; no semantic whitespace stripping.
do $production_guard$
declare expected record; actual text;
begin
 for expected in select * from (values
  ('public.create_pending_receivals_from_purchase_order(uuid,jsonb,text)','0c1ca74716855a08ea9794449cc06af3'),
  ('public.tenops_create_pending_receivals_from_po_impl(uuid,jsonb,text)','b4e3a810d515727b7611e219417d5227')) as baseline(identity,fingerprint) loop
  select md5((jsonb_build_object('definition',replace(pg_get_functiondef(p.oid),E'\r\n',E'\n'),'owner',pg_get_userbyid(p.proowner),'kind',p.prokind,'security_definer',p.prosecdef,'strict',p.proisstrict,'volatility',p.provolatile,'leakproof',p.proleakproof,'parallel',p.proparallel,'config',p.proconfig,'acl',(select jsonb_agg(jsonb_build_object('grantor',pg_get_userbyid(a.grantor),'grantee',case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end,'privilege',a.privilege_type,'grantable',a.is_grantable) order by pg_get_userbyid(a.grantor),case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end,a.privilege_type,a.is_grantable) from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a)))::text) into actual from pg_proc p where p.oid=to_regprocedure(expected.identity);
  if actual is distinct from expected.fingerprint then raise exception 'Production function drift: %. Stop and review the installed definition/attributes/grants.',expected.identity; end if;
 end loop;
 select md5((jsonb_build_object('definition',pg_get_indexdef(i.indexrelid),'owner',pg_get_userbyid(c.relowner),'unique',i.indisunique,'valid',i.indisvalid,'ready',i.indisready,'live',i.indislive,'immediate',i.indimmediate,'primary',i.indisprimary,'exclusion',i.indisexclusion,'nulls_not_distinct',i.indnullsnotdistinct))::text) into actual from pg_index i join pg_class c on c.oid=i.indexrelid where i.indexrelid=to_regclass('public.pending_receivals_purchase_order_source_uidx');
 if actual is distinct from '8588cdb3e263bfdf099bf9163e2bb2d3' then raise exception 'Production index drift: pending_receivals_purchase_order_source_uidx'; end if;
end $production_guard$;
create table public.purchase_order_line_allocations (
 purchase_order_line_id uuid not null references public.purchase_order_lines(id) on delete cascade,
 production_job_id uuid not null references public.jobs(id) on delete restrict,
 quantity numeric(14,6) not null check(quantity>0 and quantity::text<>'NaN'),
 primary key(purchase_order_line_id,production_job_id)
);
alter table public.purchase_order_line_allocations enable row level security;
revoke all on public.purchase_order_line_allocations from public,anon,authenticated;
grant select on public.purchase_order_line_allocations to authenticated;
grant all on public.purchase_order_line_allocations to service_role;
create policy po_allocations_read on public.purchase_order_line_allocations for select to authenticated using(public.has_app_capability('readOperationalData'));

-- Reuse core pricing/catalog/material validation atomically. No existing save function is replaced.
create function public.save_purchase_order_allocated_draft(p_order jsonb,p_lines jsonb,p_actor text)
returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare result uuid; line jsonb; line_id uuid; allocation jsonb; total numeric;
begin
 perform public.require_app_capability('createPurchaseOrderDraft');
 if nullif(p_order->>'id','') is not null then
  perform 1 from public.purchase_orders where id=(p_order->>'id')::uuid for update;
 end if;
 result:=public.save_chip_purchase_order_draft_v2(p_order,p_lines,p_actor);
 for line in select value from jsonb_array_elements(p_lines) loop
  select id into strict line_id from public.purchase_order_lines where purchase_order_id=result and line_number=(line->>'line_number')::integer;
  if jsonb_typeof(coalesce(line->'allocations','[]'::jsonb))<>'array' then raise exception 'Allocations must be a list.' using errcode='22023'; end if;
  delete from public.purchase_order_line_allocations where purchase_order_line_id=line_id;
  total:=0;
  for allocation in select value from jsonb_array_elements(coalesce(line->'allocations','[]'::jsonb)) loop
   if not exists(select 1 from public.jobs where id=(allocation->>'production_job_id')::uuid and archived_at is null) then raise exception 'Choose an existing non-archived Production Job.' using errcode='22023'; end if;
   insert into public.purchase_order_line_allocations values(line_id,(allocation->>'production_job_id')::uuid,(allocation->>'quantity')::numeric);
   total:=total+(allocation->>'quantity')::numeric;
  end loop;
  if total>(line->>'quantity_ordered')::numeric then raise exception 'Allocation exceeds PO line quantity.' using errcode='22023'; end if;
 end loop;
 return result;
end $$;
-- Protect against old clients reducing a line under retained allocations.
create function public.check_po_allocation_total() returns trigger language plpgsql set search_path=pg_catalog,public as $$
declare line_id uuid:=coalesce(new.purchase_order_line_id,old.purchase_order_line_id); qty numeric; allocated numeric;
begin
 select quantity_ordered into qty from public.chip_purchase_order_line_details where purchase_order_line_id=line_id;
 select coalesce(sum(quantity),0) into allocated from public.purchase_order_line_allocations where purchase_order_line_id=line_id;
 if allocated>coalesce(qty,0) then raise exception 'Allocation exceeds PO line quantity.' using errcode='23514'; end if;
 return null;
end $$;
create constraint trigger po_allocation_total after insert or update or delete on public.purchase_order_line_allocations deferrable initially deferred for each row execute function public.check_po_allocation_total();
create constraint trigger po_detail_allocation_total after insert or update or delete on public.chip_purchase_order_line_details deferrable initially deferred for each row execute function public.check_po_allocation_total();

create function public.capture_po_allocation_intent() returns trigger language plpgsql security definer set search_path=pg_catalog,public,extensions as $$
declare item jsonb; captured jsonb:='[]'::jsonb; allocations jsonb;
begin
 for item in select value from jsonb_array_elements(new.lines_snapshot) loop
  select coalesce(jsonb_agg(jsonb_build_object('production_job_id',a.production_job_id,'job_number',j.job_number,'job_name',j.name,'quantity',a.quantity) order by a.production_job_id),'[]'::jsonb) into allocations from public.purchase_order_line_allocations a join public.jobs j on j.id=a.production_job_id where a.purchase_order_line_id=(item->>'purchase_order_line_id')::uuid;
  if (select coalesce(sum((x->>'quantity')::numeric),0) from jsonb_array_elements(allocations)x)>(item->>'quantity')::numeric then raise exception 'Allocation exceeds issued line quantity.'; end if;
  captured:=captured||jsonb_build_array(item||jsonb_build_object('reservation_allocations',allocations));
 end loop;
 new.lines_snapshot:=captured;
 new.order_snapshot:=new.order_snapshot||jsonb_build_object('reservation_allocation_version',1);
 new.snapshot_hash:=encode(digest(convert_to(new.order_snapshot::text||E'\n'||new.lines_snapshot::text,'UTF8'),'sha256'),'hex');
 return new;
end $$;
-- Runs after existing PDF/material snapshot enrichers. Old snapshots are never updated.
create trigger zz_capture_po_allocation_intent before insert on public.purchase_order_issuances for each row execute function public.capture_po_allocation_intent();

alter table public.pending_receivals add column source_allocation_key text not null default 'legacy';
drop index public.pending_receivals_purchase_order_source_uidx;
create unique index pending_receivals_purchase_order_source_uidx on public.pending_receivals(source_purchase_order_issuance_id,source_purchase_order_line_id) where source_purchase_order_issuance_id is not null and source_purchase_order_line_id is not null and source_allocation_key='legacy';
create unique index pending_receivals_allocation_source_uidx on public.pending_receivals(source_purchase_order_issuance_id,source_purchase_order_line_id,source_allocation_key) where source_purchase_order_issuance_id is not null and source_purchase_order_line_id is not null;
-- Keep historical projection behavior, including its retry identity, working against its legacy partition.
do $$declare original text; patched text;begin
 select pg_get_functiondef('public.tenops_create_pending_receivals_from_po_impl(uuid,jsonb,text)'::regprocedure) into original;
 patched:=replace(original,'and source_purchase_order_line_id is not null','and source_purchase_order_line_id is not null and source_allocation_key=''legacy''');
 if patched=original then raise exception 'Pending Receival conflict-key patch did not match installed function.'; end if;
 execute patched;
end $$;

alter function public.create_pending_receivals_from_purchase_order(uuid,jsonb,text) rename to po_base_create_pending_receivals;
revoke all on function public.po_base_create_pending_receivals(uuid,jsonb,text) from public,anon,authenticated,service_role;
create function public.create_allocated_po_receivals(p_issuance_id uuid,p_lines jsonb,p_actor text)
returns table(pending_receival_id uuid,source_line_id uuid,source_line_number integer,creation_status text)
language plpgsql security definer set search_path=pg_catalog,public as $$
declare issuance public.purchase_order_issuances%rowtype; submitted jsonb; item jsonb; allocation jsonb; base public.pending_receivals%rowtype; generated record; target_job public.jobs%rowtype; remainder numeric; allocated numeric; is_first boolean;
begin
 if coalesce(auth.role(), '') <> 'service_role' then
  perform public.require_app_capability('adjustInventory');
 end if;
 select * into strict issuance from public.purchase_order_issuances where id=p_issuance_id for update;
 if issuance.order_snapshot->>'reservation_allocation_version' is distinct from '1' then
  return query select * from public.po_base_create_pending_receivals(p_issuance_id,p_lines,p_actor); return;
 end if;
 if jsonb_typeof(p_lines) is distinct from 'array' or jsonb_array_length(p_lines)=0 then raise exception 'Select PO lines.'; end if;
 for submitted in select value from jsonb_array_elements(p_lines) loop
  select value into strict item from jsonb_array_elements(issuance.lines_snapshot) where value->>'purchase_order_line_id'=submitted->>'source_line_id';
  if exists(select 1 from public.pending_receivals r where r.source_purchase_order_issuance_id=p_issuance_id and r.source_purchase_order_line_id=(item->>'purchase_order_line_id')::uuid) then
   return query select r.id,r.source_purchase_order_line_id,r.source_purchase_order_line_number,'existing'::text from public.pending_receivals r where r.source_purchase_order_issuance_id=p_issuance_id and r.source_purchase_order_line_id=(item->>'purchase_order_line_id')::uuid; continue;
  end if;
  if (submitted->>'quantity_expected')::numeric is distinct from (item->>'quantity')::numeric or submitted->>'unit' is distinct from item->>'unit' or submitted->>'material_name' is distinct from item->>'material' then raise exception 'Allocated receipts retain issued material, quantity and order unit. Record short deliveries through partial receiving.'; end if;
  select * into generated from public.po_base_create_pending_receivals(p_issuance_id,jsonb_build_array(submitted),p_actor);
  select * into strict base from public.pending_receivals where id=generated.pending_receival_id;
  select coalesce(sum((a->>'quantity')::numeric),0) into allocated from jsonb_array_elements(item->'reservation_allocations') a;
  remainder:=(item->>'quantity')::numeric-allocated; is_first:=true;
  for allocation in select value from jsonb_array_elements((item->'reservation_allocations')||case when remainder>0 then jsonb_build_array(jsonb_build_object('quantity',remainder,'production_job_id',null)) else '[]'::jsonb end) loop
   target_job:=null;
   if nullif(allocation->>'production_job_id','') is not null then select * into strict target_job from public.jobs where id=(allocation->>'production_job_id')::uuid; end if;
   if is_first then
    update public.pending_receivals set quantity_expected=(allocation->>'quantity')::numeric,production_job_id=target_job.id,temporary_job_label=null,is_earmarked=target_job.id is not null,earmarked_job_name=case when target_job.id is not null then concat_ws(' — ',nullif(target_job.job_number,''),target_job.name) end,earmark_notes=case when target_job.id is not null then 'Reserved by immutable PO line allocation.' end where id=base.id;
    pending_receival_id:=base.id; is_first:=false;
   else
    insert into public.pending_receivals(vendor,material_name,size,category,quantity_expected,quantity_received,unit,location,pallet_number,status,ordered_by,order_date,eta,notes,is_earmarked,earmarked_job_name,earmark_notes,production_job_id,source_purchase_order_issuance_id,source_purchase_order_line_id,source_purchase_order_line_number,source_purchase_order_number,source_allocation_key)
    values(base.vendor,base.material_name,base.size,base.category,(allocation->>'quantity')::numeric,0,base.unit,base.location,base.pallet_number,'pending',base.ordered_by,base.order_date,base.eta,base.notes,target_job.id is not null,case when target_job.id is not null then concat_ws(' — ',nullif(target_job.job_number,''),target_job.name) end,case when target_job.id is not null then 'Reserved by immutable PO line allocation.' end,target_job.id,p_issuance_id,base.source_purchase_order_line_id,base.source_purchase_order_line_number,base.source_purchase_order_number,coalesce(target_job.id::text,'stock')) returning id into pending_receival_id;
   end if;
   source_line_id:=base.source_purchase_order_line_id;source_line_number:=base.source_purchase_order_line_number;creation_status:='created';return next;
  end loop;
 end loop;
end $$;
alter function public.save_purchase_order_allocated_draft(jsonb,jsonb,text) owner to postgres;
alter function public.create_allocated_po_receivals(uuid,jsonb,text) owner to postgres;
revoke all on function public.save_purchase_order_allocated_draft(jsonb,jsonb,text),public.create_allocated_po_receivals(uuid,jsonb,text) from public,anon;
grant execute on function public.save_purchase_order_allocated_draft(jsonb,jsonb,text),public.create_allocated_po_receivals(uuid,jsonb,text) to authenticated,service_role;
-- Both old and new clients use the allocation-aware entry point for new snapshots.
create function public.create_pending_receivals_from_purchase_order(p_issuance_id uuid,p_lines jsonb,p_actor text)
returns table(pending_receival_id uuid,source_line_id uuid,source_line_number integer,creation_status text)
language plpgsql security definer set search_path=pg_catalog,public as $$begin return query select * from public.create_allocated_po_receivals(p_issuance_id,p_lines,p_actor); end$$;
alter function public.create_pending_receivals_from_purchase_order(uuid,jsonb,text) owner to postgres;
revoke all on function public.create_pending_receivals_from_purchase_order(uuid,jsonb,text) from public,anon;
grant execute on function public.create_pending_receivals_from_purchase_order(uuid,jsonb,text) to authenticated,service_role;
-- Deferred reconciliation allows atomic projection but forbids later destination/quantity drift.
create function public.check_po_receival_allocations() returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare issuance_id uuid; line_id uuid; snapshot jsonb; header jsonb; expected jsonb; actual jsonb;
begin
 if tg_op='UPDATE' and row(new.source_purchase_order_issuance_id,new.source_purchase_order_line_id,new.source_allocation_key) is distinct from row(old.source_purchase_order_issuance_id,old.source_purchase_order_line_id,old.source_allocation_key) then raise exception 'PO receival source identity is immutable.'; end if;
 issuance_id:=coalesce(new.source_purchase_order_issuance_id,old.source_purchase_order_issuance_id);
 line_id:=coalesce(new.source_purchase_order_line_id,old.source_purchase_order_line_id);
 select order_snapshot,value into header,snapshot from public.purchase_order_issuances i cross join lateral jsonb_array_elements(i.lines_snapshot) where i.id=issuance_id and value->>'purchase_order_line_id'=line_id::text;
 if header->>'reservation_allocation_version' is distinct from '1' then return null; end if;
 if exists(select 1 from public.pending_receivals where source_purchase_order_issuance_id=issuance_id and source_purchase_order_line_id=line_id and (quantity_expected<=0 or quantity_received<0 or quantity_received>quantity_expected or material_name is distinct from snapshot->>'material' or unit is distinct from snapshot->>'unit' or temporary_job_label is not null or coalesce(is_earmarked,false) is distinct from (production_job_id is not null))) then raise exception 'Issued PO receipt identity or quantity cannot be changed; cancel an undelivered balance instead.'; end if;
 select coalesce(jsonb_object_agg(a->>'production_job_id',(a->>'quantity')::numeric),'{}'::jsonb) into expected from jsonb_array_elements(snapshot->'reservation_allocations') a;
 expected:=expected||jsonb_build_object('stock',(snapshot->>'quantity')::numeric-(select coalesce(sum((a->>'quantity')::numeric),0) from jsonb_array_elements(snapshot->'reservation_allocations') a));
 select coalesce(jsonb_object_agg(job,qty),'{}'::jsonb) into actual from (select coalesce(production_job_id::text,'stock') job,sum(quantity_expected) qty from public.pending_receivals where source_purchase_order_issuance_id=issuance_id and source_purchase_order_line_id=line_id group by production_job_id) totals;
 if not(actual?'stock') then actual:=actual||'{"stock":0}'::jsonb; end if;
 if actual<>expected then raise exception 'PO receipt portions must reconcile to the immutable Job allocations and general-stock remainder.'; end if;
 return null;
end $$;
create constraint trigger po_receival_allocation_reconciliation after insert or update or delete on public.pending_receivals deferrable initially deferred for each row execute function public.check_po_receival_allocations();
commit;
