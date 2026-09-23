-- Only run in the disposable captured-schema database. No real business identities.
select set_config('request.jwt.claim.role','authenticated',false);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
insert into test_ids values('service_po',save_purchase_order_allocated_draft(test_order(),jsonb_build_array(test_line(24,'[{"production_job_id":"10000000-0000-4000-8000-000000000001","quantity":16},{"production_job_id":"10000000-0000-4000-8000-000000000002","quantity":4}]')||'{"material_name_snapshot":"TEST service split"}'::jsonb),'TEST Admin'));
select issue_purchase_order(id,'TEST Admin',(select updated_at from purchase_orders where id=test_ids.id)) from test_ids where name='service_po';
update purchase_order_documents set status='generated',storage_path='TEST/local.pdf',generated_at=now() where issuance_id in(select id from purchase_order_issuances where purchase_order_id=(select id from test_ids where name='service_po'));
grant select on test_ids to service_role;
set role service_role;
select set_config('request.jwt.claim.role','service_role',false);
select set_config('request.jwt.claim.sub','',false);
select create_pending_receivals_from_purchase_order(i.id,test_projection(i.purchase_order_id),'TEST Service') from purchase_order_issuances i where purchase_order_id=(select id from test_ids where name='service_po');
do $$declare r public.pending_receivals%rowtype;req uuid:=gen_random_uuid();begin
 if exists(select 1 from pending_receival_receipt_batches where pending_receival_id='40000000-0000-4000-8000-000000000099') then raise exception 'Legacy receipt was backfilled';end if;
 perform undo_pending_receival_receipt('40000000-0000-4000-8000-000000000099','TEST Service','Legacy path compatibility');
 if not exists(select 1 from pending_receivals where id='40000000-0000-4000-8000-000000000099' and quantity_received=0 and status='pending') then raise exception 'Legacy service undo failed';end if;
 select * into strict r from pending_receivals where material_name='TEST service split' and production_job_id='10000000-0000-4000-8000-000000000001';
 perform receive_pending_receival_quantity(r.id,'TEST Service',8,req);
 perform receive_pending_receival_quantity(r.id,'TEST Service',8,req);
 if(select quantity_received from pending_receivals where id=r.id)<>8 or(select status from pending_receivals where id=r.id)<>'pending' then raise exception 'Service partial status/quantity failed';end if;
 if not exists(select 1 from pending_receival_receipt_batches where request_id=req and received_by_user_id is null and received_by_auth_role='service_role') then raise exception 'Service identity fabricated or lost';end if;
 perform undo_pending_receival_receipt(r.id,'TEST Service','TEST partial undo');
 if(select quantity_received from pending_receivals where id=r.id)<>0 or(select status from pending_receivals where id=r.id)<>'pending' then raise exception 'Service partial undo failed';end if;
 begin perform receive_pending_receival_quantity(r.id,'TEST Service',8,req);raise exception 'Reversed request reused';exception when raise_exception then if sqlerrm='Reversed request reused' then raise;end if;end;
 perform receive_pending_receival_with_reservation(r.id,'TEST Service');
 if(select quantity_received from pending_receivals where id=r.id)<>16 or(select status from pending_receivals where id=r.id)<>'received' then raise exception 'Service receive-all compatibility failed';end if;
 perform undo_pending_receival_receipt(r.id,'TEST Service','TEST full undo');
 -- Service path also retains projection of historical, non-allocation snapshots.
 perform create_pending_receivals_from_purchase_order(i.id,test_projection(i.purchase_order_id),'TEST Service') from purchase_order_issuances i where purchase_order_id=(select id from test_ids where name='historical');
end$$;
reset role;
select set_config('request.jwt.claim.role','authenticated',false);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
-- Active Lead shares the existing Inventory capabilities; Member may receive but not project/undo.
insert into auth.users(id) values('00000000-0000-4000-8000-000000000004'),('00000000-0000-4000-8000-000000000005');
insert into app_users(user_id,display_name,role,is_active) values('00000000-0000-4000-8000-000000000004','TEST Lead','lead',true),('00000000-0000-4000-8000-000000000005','TEST Inactive','admin',false);
insert into pending_receivals(id,material_name,quantity_expected,unit,is_earmarked) values('40000000-0000-4000-8000-000000000002','TEST General partial',24,'lb',false);
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',false);
do $$declare rid uuid:='40000000-0000-4000-8000-000000000002';req uuid:=gen_random_uuid();begin
 perform receive_pending_receival_quantity(rid,'TEST Member',8,req);
 perform receive_pending_receival_quantity(rid,'TEST Member',8,req);
 if not exists(select 1 from pending_receivals where id=rid and status='pending' and quantity_received=8 and quantity_expected-quantity_received=16) then raise exception '8/24 hidden from pending queue';end if;
 if not exists(select 1 from pending_receival_receipt_batches where request_id=req and received_by_user_id=auth.uid() and received_by_auth_role='authenticated') then raise exception 'App actor lost';end if;
 begin perform receive_pending_receival_quantity(rid,'TEST Member',9,req);raise exception 'Changed retry accepted';exception when raise_exception then if sqlerrm='Changed retry accepted' then raise;end if;end;
 begin perform create_pending_receivals_from_purchase_order(gen_random_uuid(),'[]','TEST Member');raise exception 'Member projection allowed';exception when insufficient_privilege then null;end;
 begin perform undo_pending_receival_receipt(rid,'TEST Member','Denied');raise exception 'Member undo allowed';exception when insufficient_privilege then null;end;
 perform receive_pending_receival_quantity(rid,'TEST Member',4,gen_random_uuid());
 if not exists(select 1 from pending_receivals where id=rid and status='pending' and quantity_received=12) then raise exception 'Subsequent receipt hidden';end if;
 begin perform receive_pending_receival_quantity(rid,'TEST Member',13,gen_random_uuid());raise exception 'Over-receipt accepted';exception when invalid_parameter_value then null;end;
 perform receive_pending_receival_quantity(rid,'TEST Member',12,gen_random_uuid());
 if not exists(select 1 from pending_receivals where id=rid and status='received' and quantity_received=24) then raise exception 'Full completion failed';end if;
end$$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000004',false);
do $$declare rid uuid:='40000000-0000-4000-8000-000000000002';begin
 perform undo_pending_receival_receipt(rid,'TEST Lead','Undo last general-stock batch');
 if not exists(select 1 from pending_receivals where id=rid and status='pending' and quantity_received=12) then raise exception 'Undo did not expose remainder';end if;
 if(select quantity from inventory_items where color='TEST General partial')<>12 then raise exception 'General-stock undo total failed';end if;
 update pending_receivals set status='cancelled' where id=rid;
 if(select quantity_received from pending_receivals where id=rid)<>12 or(select quantity from inventory_items where color='TEST General partial')<>12 then raise exception 'Short receipt cancellation changed stock';end if;
end$$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000005',false);
do $$begin begin perform receive_pending_receival_quantity(gen_random_uuid(),'TEST inactive',1,gen_random_uuid());raise exception 'Inactive received';exception when insufficient_privilege then null;end;end$$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',false);
do $$begin
 begin perform create_pending_receivals_from_purchase_order(gen_random_uuid(),'[]','TEST Guest');raise exception 'Guest projected';exception when insufficient_privilege then null;end;
 begin perform undo_pending_receival_receipt(gen_random_uuid(),'TEST Guest','Denied');raise exception 'Guest undo';exception when insufficient_privilege then null;end;
end$$;
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
do $$declare identity text;rid uuid;begin
 foreach identity in array array['public.create_pending_receivals_from_purchase_order(uuid,jsonb,text)','public.receive_pending_receival_with_reservation(uuid,text)','public.undo_pending_receival_receipt(uuid,text,text)','public.receive_pending_receival_quantity(uuid,text,numeric,uuid)'] loop
  if has_function_privilege('anon',identity,'EXECUTE') or not has_function_privilege('authenticated',identity,'EXECUTE') or not has_function_privilege('service_role',identity,'EXECUTE') then raise exception 'Public wrapper grants changed: %',identity;end if;
 end loop;
 select id into strict rid from pending_receivals where material_name='TEST service split' and production_job_id='10000000-0000-4000-8000-000000000002';
 perform receive_pending_receival_quantity(rid,'TEST Admin',2,gen_random_uuid());
 update inventory_items set quantity=quantity-1,updated_at=clock_timestamp() where id=(select receipt_inventory_item_id from pending_receivals where id=rid);
 begin perform undo_pending_receival_receipt(rid,'TEST Admin','Must refuse changed stock');raise exception 'Unsafe undo succeeded';exception when raise_exception then if sqlerrm='Unsafe undo succeeded' then raise;end if;end;
 if(select quantity_received from pending_receivals where id=rid)<>2 or(select status from pending_receivals where id=rid)<>'pending' then raise exception 'Rejected undo changed receipt';end if;
end$$;
