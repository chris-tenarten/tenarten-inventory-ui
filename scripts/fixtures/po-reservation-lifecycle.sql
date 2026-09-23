-- Synthetic fixtures, executed only in disposable PostgreSQL with the captured Production schema.
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
insert into vendors(id,name,canonical_name) values('20000000-0000-4000-8000-000000000001','TEST Vendor','TEST Vendor');
create table test_ids(name text primary key,id uuid);
create function test_order() returns jsonb language sql as $$select jsonb_build_object('vendor_id','20000000-0000-4000-8000-000000000001','vendor_name_snapshot','TEST Vendor','order_date','2026-09-22','production_job_id','10000000-0000-4000-8000-000000000001','job_number_snapshot','26-9001','job_name_snapshot','TEST A')$$;
create function test_line(q numeric, allocations jsonb default '[]') returns jsonb language sql as $$select jsonb_build_object('line_number',1,'material_type','chip','material_name_snapshot','TEST Marble','chip_size','#1','quantity_ordered',q,'order_unit','Bag','unit_price','10','allocations',allocations)$$;
insert into test_ids values('historical',save_chip_purchase_order_draft_v2(test_order(),jsonb_build_array(test_line(20)),'TEST Admin'));
select issue_purchase_order(id,'TEST Admin',(select updated_at from purchase_orders where id=test_ids.id)) from test_ids where name='historical';
create table historical_issuance as select to_jsonb(i) row from purchase_order_issuances i;


-- Existing received stock exercises original public service semantics before migrations.
insert into jobs(id,name,job_number) values('10000000-0000-4000-8000-000000000003','TEST Legacy reservation','26-9003');
insert into pending_receivals(id,material_name,quantity_expected,unit,production_job_id,is_earmarked) values('40000000-0000-4000-8000-000000000099','TEST Legacy receipt',2,'lb','10000000-0000-4000-8000-000000000003',true);
set role service_role;
select set_config('request.jwt.claim.role','service_role',false);
select set_config('request.jwt.claim.sub','',false);
select receive_pending_receival_with_reservation('40000000-0000-4000-8000-000000000099','TEST Legacy Service');
reset role;
select set_config('request.jwt.claim.role','authenticated',false);

-- AFTER MIGRATIONS

do $$begin if exists((select row from historical_issuance) except (select to_jsonb(i) from purchase_order_issuances i)) then raise exception 'Historical issuance changed'; end if; end$$;
set role authenticated;select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',false);
do $$begin begin perform save_purchase_order_allocated_draft('{}','[]','TEST');raise exception 'Guest write allowed';exception when insufficient_privilege then null;end;begin insert into purchase_order_line_allocations values(gen_random_uuid(),'10000000-0000-4000-8000-000000000001',1);raise exception 'Direct allocation write allowed';exception when insufficient_privilege then null;end;end$$;
reset role;select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
insert into test_ids values('split',save_purchase_order_allocated_draft(test_order(),jsonb_build_array(test_line(40,'[{"production_job_id":"10000000-0000-4000-8000-000000000001","quantity":24},{"production_job_id":"10000000-0000-4000-8000-000000000002","quantity":10}]')),'TEST Admin'));
do $$declare oid uuid:=(select id from test_ids where name='split');lid uuid;begin
 select id into lid from purchase_order_lines where purchase_order_id=oid;
 if (select sum(quantity) from purchase_order_line_allocations where purchase_order_line_id=lid)<>34 or (select subtotal from purchase_orders where id=oid)<>400 then raise exception 'Split or pricing incorrect'; end if;
 perform save_purchase_order_allocated_draft(test_order()||jsonb_build_object('id',oid),jsonb_build_array(test_line(40,'[{"production_job_id":"10000000-0000-4000-8000-000000000001","quantity":24},{"production_job_id":"10000000-0000-4000-8000-000000000002","quantity":10}]')||jsonb_build_object('id',lid)),'TEST Admin');
 begin perform save_purchase_order_allocated_draft(test_order()||jsonb_build_object('id',oid),jsonb_build_array(test_line(10,'[{"production_job_id":"10000000-0000-4000-8000-000000000001","quantity":24}]')||jsonb_build_object('id',lid)),'TEST Admin');raise exception 'Overallocated line allowed';exception when invalid_parameter_value then null;end;
 if (select quantity_ordered from chip_purchase_order_line_details where purchase_order_line_id=lid)<>40 then raise exception 'Invalid save did not roll back'; end if;
end$$;
select issue_purchase_order(id,'TEST Admin',(select updated_at from purchase_orders where id=test_ids.id)) from test_ids where name='split';
update purchase_order_documents set status='generated',storage_path='TEST/local.pdf',generated_at=now();
create function test_projection(oid uuid) returns jsonb language sql as $$select jsonb_agg(jsonb_build_object('source_line_id',x->>'purchase_order_line_id','material_name',x->>'material','size',x->>'chip_size','quantity_expected',x->>'quantity','unit',x->>'unit','location','Denton','category','Chip / Aggregate')) from purchase_order_issuances i cross join lateral jsonb_array_elements(i.lines_snapshot)x where i.purchase_order_id=oid$$;
select create_pending_receivals_from_purchase_order(i.id,test_projection(i.purchase_order_id),'TEST Admin') from purchase_order_issuances i;
select create_pending_receivals_from_purchase_order(i.id,test_projection(i.purchase_order_id),'TEST Admin') from purchase_order_issuances i;
do $$declare oid uuid:=(select id from test_ids where name='split');rid uuid;req uuid:=gen_random_uuid();begin
 if (select count(*) from pending_receivals r join purchase_order_issuances i on i.id=r.source_purchase_order_issuance_id where i.purchase_order_id=oid)<>3 then raise exception 'Split projection or replay failed'; end if;
 if not exists(select 1 from pending_receivals r join purchase_order_issuances i on i.id=r.source_purchase_order_issuance_id where i.purchase_order_id=oid and r.production_job_id is null and quantity_expected=6) then raise exception 'General remainder missing';end if;
 select r.id into rid from pending_receivals r join purchase_order_issuances i on i.id=r.source_purchase_order_issuance_id where i.purchase_order_id=oid and r.production_job_id='10000000-0000-4000-8000-000000000001';
 perform receive_pending_receival_quantity(rid,'TEST Admin',8,req);perform receive_pending_receival_quantity(rid,'TEST Admin',8,req);
 if (select quantity_received from pending_receivals where id=rid)<>8 or (select status from pending_receivals where id=rid)<>'pending' or (select count(*) from inventory_transactions where pending_receival_id=rid)<>1 then raise exception 'Partial receipt/idempotency failed';end if;
 begin perform receive_pending_receival_quantity(rid,'TEST Admin',17,gen_random_uuid());raise exception 'Overreceipt allowed';exception when invalid_parameter_value then null;end;
 perform receive_pending_receival_quantity(rid,'TEST Admin',16,gen_random_uuid());
 if (select sum(quantity) from inventory_items where production_job_id='10000000-0000-4000-8000-000000000001')<>24 then raise exception 'Reservation stock incorrect';end if;
 perform undo_pending_receival_receipt(rid,'TEST Admin','TEST undo latest');
 if (select quantity_received from pending_receivals where id=rid)<>8 or (select status from pending_receivals where id=rid)<>'pending' then raise exception 'Partial undo lost prior receipt';end if;
 perform receive_pending_receival_with_reservation(rid,'TEST Admin');
end$$;
select receive_pending_receival_with_reservation(id,'TEST Admin') from pending_receivals where status='pending';
do $$begin if (select sum(quantity) from inventory_items where production_job_id is null)<>6 then raise exception 'General stock not available';end if;if (select sum(quantity) from inventory_items where production_job_id='10000000-0000-4000-8000-000000000002')<>10 then raise exception 'Job B incorrect';end if;end$$;
-- New unallocated, single-job and mixed-material snapshots use the same receiving path.
do $$declare oid uuid;issue_id uuid;kind text;line jsonb;rid uuid;before_qty numeric;begin
 foreach kind in array array['resin','pigment','filler','other'] loop
  line:=test_line(10)||jsonb_build_object('material_type',kind,'chip_size',null,'order_unit','lb','catalog_source','specialty','catalog_item_id','30000000-0000-4000-8000-000000000001','allocations',case when kind='resin' then jsonb_build_array(jsonb_build_object('production_job_id','10000000-0000-4000-8000-000000000002','quantity',10)) else '[]'::jsonb end);
  oid:=save_purchase_order_allocated_draft(test_order(),jsonb_build_array(line),'TEST Admin');
  select issuance_id into issue_id from issue_purchase_order(oid,'TEST Admin',(select updated_at from purchase_orders where id=oid));
  update purchase_order_documents set status='generated',storage_path='TEST/local.pdf',generated_at=now() where issuance_id=issue_id;
  perform create_pending_receivals_from_purchase_order(issue_id,test_projection(oid),'TEST Admin');
  select id into rid from pending_receivals where source_purchase_order_issuance_id=issue_id;
  if kind='resin' and (select production_job_id from pending_receivals where id=rid) is distinct from '10000000-0000-4000-8000-000000000002'::uuid then raise exception 'Single Job allocation failed';end if;
  if kind<>'resin' and (select production_job_id from pending_receivals where id=rid) is not null then raise exception 'Document context silently allocated stock';end if;
  perform receive_pending_receival_quantity(rid,'TEST Admin',3,gen_random_uuid());
  if not exists(select 1 from inventory_transactions where pending_receival_id=rid and catalog_source='specialty') then raise exception 'Specialty provenance lost';end if;
  select sum(quantity) into before_qty from inventory_items;
  update pending_receivals set status='cancelled' where id=rid;
  if (select sum(quantity) from inventory_items)<>before_qty or (select quantity_received from pending_receivals where id=rid)<>3 then raise exception 'Short delivery cancellation changed stock';end if;
 end loop;
end$$;
-- Deferred checks reject mutation of captured allocation intent.
do $$declare rid uuid;begin
 select r.id into rid from pending_receivals r join purchase_order_issuances i on i.id=r.source_purchase_order_issuance_id where i.purchase_order_id=(select id from test_ids where name='split') and r.production_job_id='10000000-0000-4000-8000-000000000002';
 begin update pending_receivals set production_job_id='10000000-0000-4000-8000-000000000001' where id=rid;set constraints all immediate;raise exception 'Reservation reassignment bypassed snapshot';exception when raise_exception then if sqlerrm='Reservation reassignment bypassed snapshot' then raise;end if;end;
end$$;
set role authenticated;select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',false);
do $$begin begin perform receive_pending_receival_quantity(gen_random_uuid(),'TEST',1,gen_random_uuid());raise exception 'Guest received stock';exception when insufficient_privilege then null;end;end$$;
reset role;
select 'PO allocation/receipt lifecycle passed';
